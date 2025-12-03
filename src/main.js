import OBR from "@owlbear-rodeo/sdk";

const App = {
  data() {
    return {
      page: "player",
      nome: "",
      vida: 3,
      ruina: 3,
      tipo: "Combatente",
      atributo: "Força",
      inventario: "",
      ultimoResultado: "",
      ultimasRolagens: [], // Manter localmente para feedback, mas não mais salvar no OBR.
      ultimasRolagensVisiveis: false,
      fichas: {},
      salvarTimeout: null,
      logs: [],
      historicoRolagens: [], 
      isMestre: false,
      rolando: false,
      monstros: [], 
      _acoes: 3,
      inventarioExpandido: {},
      
      // 🔥 NOVO: Modificador de D4 para Vantagem/Desvantagem
      modificadorD4: "0", // Valores: "-2", "-1", "0", "+1", "+2"
    };
  },

  mounted() {
    this.log("⏳ Aguardando OBR...");

    OBR.onReady(async () => {
      this.log("✅ OBR carregado!");

      try {
        const playerId = await OBR.player.getId();
        this.log("🎮 Meu ID: " + playerId);

        const role = await OBR.player.getRole();
        this.isMestre = role === "GM";
        this.log("🎩 Papel detectado: " + role);

        // Carregar dados iniciais
        const roomData = await OBR.room.getMetadata();
        this.processarMetadados(roomData);

        // Carregar minha própria ficha
        const minhaFicha = roomData[`ficha-${playerId}`];
        if (minhaFicha) {
          Object.assign(this, minhaFicha);
          // ⚠️ Removendo normalizarRolagens pois não vamos mais salvar isso na ficha
          if (this._acoes === undefined) this._acoes = minhaFicha._acoes ?? 3;
        } else {
          this._acoes = 3;
        }

        // Carregar monstros
        if (roomData.monstros) {
            this.carregarMonstros(roomData.monstros);
        }

        // Listeners ao vivo
        OBR.room.onMetadataChange((metadata) => {
           this.processarMetadados(metadata);
        });

      } catch (e) {
        this.log("❌ Erro na inicialização: " + (e.message || e));
      }
    });
  },

  watch: {
    nome: "salvarFicha",
    vida(value) {
      if (value < 0) this.vida = 0; 
      this.salvarFicha();
    },
    ruina(value) {
      if (value < 0) this.ruina = 0; 
      this.salvarFicha();
    },
    tipo: "salvarFicha",
    atributo: "salvarFicha",
    inventario: "salvarFicha",
  },

  methods: {
    
    // 🗑️ normalizarRolagens não é mais necessário, mas vamos manter ele vazio para evitar quebrar o processamento.
    normalizarRolagens(v) {
      return [];
    },

    processarMetadados(metadata) {
        const novasFichas = {};
        const novoHistorico = [];

        for (const [key, value] of Object.entries(metadata)) {
            // 1. Processa Fichas
            if (key.startsWith("ficha-")) {
                novasFichas[key] = value;
            }
            // 2. Processa o Chat (Logs de Rolagem)
            if (key.startsWith("log-")) {
                novoHistorico.push(value);
            }
        }

        // Atualiza Fichas
        for (const [key, ficha] of Object.entries(novasFichas)) {
            if (!this.fichas[key]) {
                this.fichas[key] = { ...ficha, _acoes: ficha._acoes ?? 3 };
            } else {
                const existente = this.fichas[key];
                Object.assign(existente, {
                    nome: ficha.nome ?? existente.nome,
                    vida: ficha.vida ?? existente.vida,
                    ruina: ficha.ruina ?? existente.ruina,
                    tipo: ficha.tipo ?? existente.tipo,
                    atributo: ficha.atributo ?? existente.atributo,
                    inventario: ficha.inventario !== undefined ? ficha.inventario : existente.inventario,
                    ultimoResultado: ficha.ultimoResultado !== undefined ? ficha.ultimoResultado : existente.ultimoResultado,
                    // ⚠️ ultimasRolagens não são mais atualizadas aqui
                    _acoes: ficha._acoes !== undefined ? ficha._acoes : (existente._acoes ?? 3)
                });
            }
        }

        // Atualiza Monstros
        if (metadata.monstros) {
            this.carregarMonstros(metadata.monstros);
        }

        // Atualiza o Histórico de Rolagens (Ordenado)
        novoHistorico.sort((a, b) => b.timestamp - a.timestamp);
        this.historicoRolagens = novoHistorico;
    },

    carregarMonstros(str) {
        this.monstros = str.split("|").map(entry => {
            const [nome, vida] = entry.split(",");
            return {
                nome: nome || "Monstro",
                vida: Number(vida) || 0,
            };
        });
    },

    async salvarFicha() {
      clearTimeout(this.salvarTimeout);
      this.salvarTimeout = setTimeout(async () => {
        try {
          const playerId = await OBR.player.getId();
          const payload = {
            nome: this.nome,
            vida: this.vida,
            ruina: this.ruina,
            tipo: this.tipo,
            atributo: this.atributo,
            inventario: this.inventario,
            ultimoResultado: this.ultimoResultado,
            // 🗑️ Removendo ultimasRolagens do payload para evitar o bug de serialização
            // ultimasRolagens: this.ultimasRolagens.join("|"),

          };

          if (this.isMestre) {
            payload._acoes = this._acoes;
          }

          await OBR.room.setMetadata({
            [`ficha-${playerId}`]: payload
          });

          this.log("💾 Ficha salva: " + this.nome);
        } catch (e) {
          this.log("❌ Erro ao salvar: " + e.message);
        }
      }, 700);
    },

    trocarPagina(p) {
      this.page = p;
    },

    toggleInventario(id) {
      this.$set
        ? this.$set(this.inventarioExpandido, id, !this.inventarioExpandido[id])
        : (this.inventarioExpandido[id] = !this.inventarioExpandido[id]);
    },

    async salvarMonstros() {
      try {
        const compact = this.monstros
          .map(m => `${m.nome || ''},${m.vida}`)
          .join("|");

        await OBR.room.setMetadata({
          monstros: compact,
        });
      } catch (e) {
        this.log("❌ Erro ao salvar monstros: " + e.message);
      }
    },

    adicionarMonstro() {
      this.monstros.push({ vida: 10 });
      this.salvarMonstros();
    },

    limparMonstros() {
      if (!confirm("Deseja remover todos os monstros?")) return;
      this.monstros = [];
      this.salvarMonstros();
    },

    async limparHistorico() {
        if (!confirm("Limpar histórico de rolagens?")) return;
        const roomData = await OBR.room.getMetadata();
        const deletar = {};
        for(const key of Object.keys(roomData)) {
            if(key.startsWith('log-')) deletar[key] = undefined;
        }
        await OBR.room.setMetadata(deletar);
    },

    async limparFichas() {
      if (!this.isMestre) return;
      if (!confirm("Tem certeza que deseja limpar todas as fichas dos jogadores?")) return;

      try {
        const roomData = await OBR.room.getMetadata();
        const updates = {};

        for (const key of Object.keys(roomData)) {
          if (key.startsWith("ficha-")) updates[key] = undefined;
        }

        await OBR.room.setMetadata(updates);
        this.fichas = {};
        this.log("🧹 Todas as fichas foram limpas!");
      } catch (e) {
        this.log("❌ Erro ao limpar fichas: " + (e.message || e));
      }
    },

    toggleUltimasRolagens() {
      this.ultimasRolagensVisiveis = !this.ultimasRolagensVisiveis;
    },

    // 🔥 NOVO: LÓGICA REVISADA DE ROLAR DADO
    async rolarDado(max, tipo, modificador) {
      if (this.rolando) return;
      this.rolando = true;

      new Audio('/roll-of-dice.mp3').play();
      await new Promise(res => setTimeout(res, 1000));

      // 1. Rolagem Principal (D10 ou D4)
      const valorDado = Math.floor(Math.random() * max) + 1;
      let resultadoFinal = valorDado;
      let detalhes = `${tipo} (${valorDado})`;
      let detalheSimplificado = `${tipo} → ${valorDado}`;

      // 2. Rolagem de Modificação (D4s Adicionais)
      const numModD4 = parseInt(modificador || "0");
      let totalD4 = 0;
      let rolagensD4 = [];

      if (numModD4 !== 0) {
        const quantidade = Math.abs(numModD4);
        
        for (let i = 0; i < quantidade; i++) {
          const roll = Math.floor(Math.random() * 4) + 1; // Rola D4
          rolagensD4.push(roll);
          totalD4 += roll;
        }

        const sinal = numModD4 > 0 ? "+" : "−";
        
        if (numModD4 > 0) {
          resultadoFinal += totalD4;
        } else {
          resultadoFinal -= totalD4;
        }
        
        detalhes += ` ${sinal} ${quantidade}D4 (${rolagensD4.join(", ")})`;
        detalheSimplificado = `${detalheSimplificado} ${sinal} ${totalD4} (Total D4)`;
      }


      // 3. Atualiza feedback local
      this.ultimoResultado = resultadoFinal;
      this.ultimasRolagens.unshift(`${detalhes} = ${resultadoFinal}`);
      if (this.ultimasRolagens.length > 3) this.ultimasRolagens.pop();
      this.salvarFicha(); // Salva último resultado para o painel do jogador

      // 4. Envia Log (Chat)
      const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const logData = {
          msg: `${detalhes} = ${resultadoFinal}`,
          autor: this.nome || "Sem Nome",
          timestamp: Date.now()
      };
      
      await OBR.room.setMetadata({ [logId]: logData });

      this.log(`${this.nome} 🎲 ${detalheSimplificado} = ${resultadoFinal}`);
      this.rolando = false;
    },

    rolarD10_Modificado() {
      // Chama rolarDado passando o valor do seletor modificadorD4
      return this.rolarDado(10, "D10", this.modificadorD4);
    },

    rolarD4_Simples() {
      // Rola D4 simples, sem modificadores D4 adicionais.
      return this.rolarDado(4, "D4", "0");
    },

    log(msg) {
      this.logs.unshift(new Date().toLocaleTimeString() + " " + msg);
      if (this.logs.length > 20) this.logs.pop();
    },

    async alterarAcoes(id, novoValor) {
      const fichaAtual = this.fichas[id];
      if (!fichaAtual) return;

      const fichaParaSalvar = {
        nome: fichaAtual.nome,
        vida: fichaAtual.vida,
        ruina: fichaAtual.ruina,
        tipo: fichaAtual.tipo,
        atributo: fichaAtual.atributo,
        inventario: fichaAtual.inventario,
        ultimoResultado: fichaAtual.ultimoResultado,
        // 🗑️ Removendo ultimasRolagens da ficha do GM
        // ultimasRolagens: (fichaAtual.ultimasRolagens || []).join("|"), 
        _acoes: novoValor,
      };

      try {
        await OBR.room.setMetadata({
          [id]: fichaParaSalvar
        });
        this.fichas[id]._acoes = novoValor;
        this.log(`🔧 GM alterou ações de ${fichaAtual.nome} para ${novoValor}`);
      } catch (e) {
        this.log("❌ Erro ao alterar ações: " + e.message);
      }
    }
  },
  
  template: `
    <div>
      <nav>
        <button :class="{active: page==='player'}" @click="trocarPagina('player')">Jogador</button>
        <button v-if="isMestre" :class="{active: page==='master'}" @click="trocarPagina('master')">Mestre</button>
      </nav>

      <div v-if="page==='player'" class="sheet">

        <div class="field">
          <label>Nome</label>
          <input v-model="nome" placeholder="Digite o nome" />
        </div>

        <div class="stats-row">
          <div class="stat-box">
            <span class="label">Vida</span>
            <div class="stat-controls">
              <button @click="vida--">−</button>
              <span class="value">{{ vida }}</span>
              <button @click="vida++">+</button>
            </div>
          </div>

          <div class="stat-box">
            <span class="label">Ruina</span>
            <div class="stat-controls">
              <button @click="ruina--">−</button>
              <span class="value">{{ ruina }}</span>
              <button @click="ruina++">+</button>
            </div>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-box" style="text-align:center;">
            <label class="label" style="margin-bottom:6px; display:block;">Função</label>
            <select v-model="tipo" style="width:100%;text-align:center;">
              <option>Combatente</option>
              <option>Arruinado</option>
            </select>
          </div>

          <div class="stat-box" style="text-align:center;">
            <label class="label" style="margin-bottom:6px; display:block;">Atributo</label>
            <select v-model="atributo" style="width:100%; text-align:center;">
              <option>Força</option>
              <option>Destreza</option>
              <option>Intelecto</option>
              <option>Vigor</option>
            </select>
          </div>
        </div>
        
        <div class="field" style="text-align:center; padding: 0 14px;">
            <label class="label" style="margin-bottom:6px; display:block;">Vantagem/Desvantagem (D4)</label>
            <select v-model="modificadorD4" style="width:100%; text-align:center; font-weight:bold; background-color:#333; color:white; border:1px solid #555; padding:5px; border-radius:4px;">
                <option value="-2">2 Desvantagens (−2D4)</option>
                <option value="-1">1 Desvantagem (−1D4)</option>
                <option value="0">Normal (0D4)</option>
                <option value="+1">1 Vantagem (+1D4)</option>
                <option value="+2">2 Vantagens (+2D4)</option>
            </select>
        </div>


        <div class="stats-row">
          <div class="stat-box" style="padding: 14px;">
            <button
              @click="rolarD10_Modificado"
              :disabled="rolando"
              style="width:100%; padding:8px; border-radius:8px; border:none; background:linear-gradient(135deg, #7C5CFF, #9B7BFF); color:white; font-weight:700; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.4); cursor:pointer;"
            >
              Rolar D10 + D4
            </button>
          </div>

          <div class="stat-box" style="padding: 14px;">
            <button
              @click="rolarD4_Simples"
              :disabled="rolando"
              style="width:100%; padding:8px; border-radius:8px; border:none; background:linear-gradient(135deg, #7C5CFF, #9B7BFF); color:white; font-weight:700; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.4); cursor:pointer;"
            >
              Rolar D4
            </button>
          </div>
        </div>

        <div class="field" v-if="ultimoResultado !== null" style="position:relative; display:flex; flex-direction:column; align-items:flex-start;">
          <div style="display:flex; align-items:center; gap:6px; width:100%; position:relative;">
            <label>Resultado</label>

            <div style="font-size:22px; font-weight:bold; flex-shrink:0;">
              {{ ultimoResultado }}
            </div>

            <button
              @click="toggleUltimasRolagens"
              style="
                margin-left:auto;
                font-size:12px;
                padding:2px 4px;
                border-radius:4px;
                border:none;
                cursor:pointer;
                background:#7C5CFF;
                color:white;
                position:relative;
                z-index:1;
              "
            >
              ⟳
            </button>

            <div v-if="ultimasRolagensVisiveis"
              style="
                position:absolute;
                bottom: 30px;
                right: 0;
                background:#222;
                color:white;
                border:1px solid #444;
                border-radius:6px;
                padding:6px 10px;
                box-shadow:0 2px 6px rgba(0,0,0,0.5);
                z-index:100;
                white-space:nowrap;
              "
            >
              <div v-for="(r, i) in ultimasRolagens" :key="i" style="font-size:14px; white-space: normal;">
                {{ r }}
              </div>
            </div>
          </div>
        </div>

        <div class="field">
          <label>Inventário</label>
          <textarea v-model="inventario" rows="5" placeholder="Anote itens"></textarea>
        </div>
      </div>

      <div v-if="page==='master' && isMestre" class="master">

        <div style="margin-bottom: 10px; background: #222; border: 1px solid #444; border-radius: 6px; overflow: hidden;">
            <div style="background: #333; padding: 4px 8px; font-size: 12px; font-weight: bold; color: #ccc; display:flex; justify-content:space-between; align-items:center;">
                <span>📜 Histórico de Rolagens</span>
                <button @click="limparHistorico" style="background:transparent; border:none; color:#888; cursor:pointer; font-size:10px;">Limpar</button>
            </div>
            <div style="max-height: 120px; overflow-y: auto; padding: 5px;">
                <div v-if="historicoRolagens.length === 0" style="color: #666; font-size: 11px; text-align: center; padding: 10px;">
                    Nenhuma rolagem ainda.
                </div>
                <div v-for="(log, i) in historicoRolagens" :key="i" style="font-size: 12px; border-bottom: 1px solid #333; padding: 3px 0; color: #eee; white-space: normal;">
                    <span style="color: #9B7BFF; font-weight: bold;">{{ log.autor }}:</span>
                    {{ log.msg }}
                </div>
            </div>
        </div>

        <div style="text-align: center; margin-bottom: 2px; margin-top: 5px">
          <button
            @click="limparFichas"
            style="width: 80px; padding: 4px 8px; background:#b00000; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"
          >
            Limpar
          </button>
        </div>

        <div v-if="Object.keys(fichas).length === 0">
          Nenhum jogador conectado ainda.
        </div>

        <div v-for="(ficha, id) in fichas" :key="id" class="ficha">
          <div style="display:flex; justify-content:space-between; align-items:center;">

            <h2 style="margin:0;">{{ ficha.nome || 'Sem nome' }} | {{ ficha.tipo }}</h2>

            <div class="stat-controls" style="display:flex; align-items:center; gap:6px;">
              <button @click="alterarAcoes(id, (ficha._acoes ?? 3) - 1)">−</button>

              <span style="display:inline-block;">
                {{ ficha._acoes ?? 3 }}
              </span>

              <button @click="alterarAcoes(id, (ficha._acoes ?? 3) + 1)">+</button>
            </div>

          </div>

          <p>Vida: {{ ficha.vida }} | Ruina: {{ ficha.ruina }} | {{ ficha.atributo }}</p>
          <div style="font-size:12px; margin-top:6px;">
            <button
              @click="toggleInventario(id)"
              style="
                font-size:10px;
                padding:2px 6px;
                border:none;
                background:linear-gradient(145deg, #1A1B2E, #1C1D33);
                color:white;
                border-radius:4px;
                cursor:pointer;
                margin-bottom:4px;
              "
            >
              {{ inventarioExpandido[id] ? 'Esconder Inventário' : 'Mostrar Inventário' }}
            </button>

            <div v-if="inventarioExpandido[id]"
              style="background:linear-gradient(145deg, #1A1B2E, #1C1D33); padding:6px; border-radius:4px; white-space:pre-wrap; margin-top:4px;">
              {{ ficha.inventario || '—' }}
            </div>
          </div>
          
          <p style="opacity:0.6; font-size:11px;">(Rolagens no Histórico)</p>
        </div>

        <div>
          <div style="display:flex; justify-content:center; gap:10px; margin-bottom:15px;">
            <button
              @click="adicionarMonstro"
              style="padding:6px 12px; background:linear-gradient(135deg, #7C5CFF, #9B7BFF); color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;"
            >
              Adicionar Monstro
            </button>

            <button
              @click="limparMonstros"
              style="padding:6px 12px; background:#b00000; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;"
            >
              Limpar
            </button>
          </div>

          <div v-if="monstros.length === 0" style="text-align:center; opacity:0.6;">
            Nenhum monstro criado.
          </div>

          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;">
            <div v-for="(m, index) in monstros" :key="index">
              <div style="padding:6px; padding-top:0;">
                <div class="stats-row" style="margin:0;">
                  <div class="stat-box">
                    <span class="label">
                      <span
                        contenteditable="true"
                        @input="m.nome = $event.target.innerText; salvarMonstros()"
                        style="
                          display:inline-block;
                          min-width:60px;
                          padding:2px 4px;
                          border-radius:3px;
                          outline:none;
                        "
                      >
                        {{ m.nome }}
                      </span>

                    </span>
                    
                    <div class="stat-controls">
                      <button @click="m.vida--; salvarMonstros()">−</button>
                      <span class="value">{{ m.vida }}</span>
                      <button @click="m.vida++; salvarMonstros()">+</button>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div
          v-if="page === 'master' && isMestre"
          style="margin-top:20px; background:linear-gradient(145deg, #1A1B2E, #1C1D33); padding:10px; border-radius:8px; max-height:150px; overflow:auto;"
        >
          <h3>Debug:</h3>
          <div v-for="(log, i) in logs" :key="i" style="font-size:12px;">{{ log }}</div>
        </div>
      </div>
    </div>
  `,
};

Vue.createApp(App).mount("#app");
