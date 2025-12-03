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
      ultimasRolagens: [],
      ultimasRolagensVisiveis: false,
      fichas: {},
      salvarTimeout: null,
      logs: [],
      isMestre: false,
      rolando: false,
      monstros: [], 
      _acoes: 3,
      inventarioExpandido: {},
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

        // Carregar todas as fichas já existentes
        const roomData = await OBR.room.getMetadata();
        const fichasAtuais = {};

        for (const [key, value] of Object.entries(roomData)) {
          if (key.startsWith("ficha-")) {
            value.ultimasRolagens = this.normalizarRolagens(value.ultimasRolagens);
            fichasAtuais[key] = value;
          }
        }

        this.fichas = fichasAtuais;

        // Carregar minha própria ficha
        const minhaFicha = roomData[`ficha-${playerId}`];

        if (minhaFicha) {
          Object.assign(this, minhaFicha);
          this.ultimasRolagens = this.normalizarRolagens(minhaFicha.ultimasRolagens);
          this._acoes = minhaFicha._acoes ?? 3;
        } else {
          this._acoes = 3;
        }


        // 🔥 MELHORIA 3: CARREGAR MONSTROS SALVOS
       if (roomData.monstros) {
          this.monstros = roomData.monstros.split("|").map(entry => {
            const [nome, vida] = entry.split(",");
            return {
              nome: nome || "Monstro",
              vida: Number(vida) || 0,
            };
          });
        }

        			// Listeners ao vivo para o Mestre
      OBR.room.onMetadataChange((metadata) => {
        const novas = {};
      
        for (const [key, value] of Object.entries(metadata)) {
          if (key.startsWith("ficha-")) {
            value.ultimasRolagens = this.normalizarRolagens(value.ultimasRolagens);
            novas[key] = value;
          }
        }
      
        // Mescla sem sobrescrever campos importantes
        for (const [key, ficha] of Object.entries(novas)) {
          if (!this.fichas[key]) {
            this.fichas[key] = {
              ...ficha,
              _acoes: ficha._acoes ?? 3
            };
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
              ultimasRolagens: ficha.ultimasRolagens ?? existente.ultimasRolagens,
              _acoes: ficha._acoes !== undefined ? ficha._acoes : (existente._acoes ?? 3)
            });
          }
        }
      
        // Atualiza monstros
        if (metadata.monstros) {
          this.monstros = metadata.monstros.split("|").map(entry => {
            const [nome, vida] = entry.split(",");
            return {
              nome: nome || "Monstro",
              vida: Number(vida) || 0,
            };
          });
        }

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
    normalizarRolagens(v) {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (typeof v === "string") return v.split("|");
      return [];
    },

    // 💡 CORRIGIDO: Aceita 'imediato = false' para permitir salvamento manual no botão ⟳
    async salvarFicha(imediato = false) {
      clearTimeout(this.salvarTimeout);

      const delay = imediato ? 0 : 700; // Se imediato for true, delay é 0

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
            ultimasRolagens: this.ultimasRolagens.join("|"),
          };

          if (this.isMestre) {
            payload._acoes = this._acoes;
          }

          await OBR.room.setMetadata({
            [`ficha-${playerId}`]: payload
          });

          this.log("💾 Ficha salva: " + this.nome + (imediato ? ' (IMEDIATO)' : ''));
        } catch (e) {
          this.log("❌ Erro ao salvar: " + e.message);
        }
      }, delay);
    },


    trocarPagina(p) {
      this.page = p;
    },

    toggleInventario(id) {
      this.$set
        ? this.$set(this.inventarioExpandido, id, !this.inventarioExpandido[id])
        : (this.inventarioExpandido[id] = !this.inventarioExpandido[id]);
    },


    // 🔥 MELHORIA 2: SALVAR MONSTROS
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

    // 💡 Modificado: Chama salvarFicha(true) para forçar o envio da rolagem
    async toggleUltimasRolagens() {
      this.ultimasRolagensVisiveis = !this.ultimasRolagensVisiveis;

      // Força o salvamento imediato da ficha ao abrir o histórico
      if (this.ultimasRolagensVisiveis) {
        await this.salvarFicha(true);
      }
    },

    async rolarDado(max, tipo) {
      if (this.rolando) return;
      this.rolando = true;

      new Audio('/roll-of-dice.mp3').play();
      await new Promise(res => setTimeout(res, 1000));

      const valor = Math.floor(Math.random() * max) + 1;

      this.ultimasRolagens.unshift(`${tipo} → ${valor}`);
      if (this.ultimasRolagens.length > 3) this.ultimasRolagens.pop();

      this.ultimoResultado = this.ultimasRolagens[0];

      this.salvarFicha();
      this.log(`${this.nome} 🎲 ${tipo}: ${valor}`);

      this.rolando = false;
    },

    rolarD10() {
      return this.rolarDado(10, "D10");
    },

    rolarD4() {
      return this.rolarDado(4, "D4");
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
        ultimasRolagens: (fichaAtual.ultimasRolagens || []).join("|"),
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
          <small style="display:block; margin-top: 4px; opacity: 0.7;">Clique no ⟳ se uma rolagem falhar.</small>
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

        <div class="stats-row">
          <div class="stat-box" style="padding: 14px;">
            <button
              @click="rolarD10"
              :disabled="rolando"
              style="width:100%; padding:8px; border-radius:8px; border:none; background:linear-gradient(135deg, #7C5CFF, #9B7BFF); color:white; font-weight:700; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.4); cursor:pointer;"
            >
              Rolar D10
            </button>
          </div>

          <div class="stat-box" style="padding: 14px;">
            <button
              @click="rolarD4"
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
              <div v-for="(r, i) in ultimasRolagens" :key="i" style="font-size:14px;">
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

        <div style="text-align: center; margin-bottom: 2px; margin-top: 5px">
          <button
            @click="limparFichas"
            style="width: 80px; padding: 4px 8px; background:#b00000; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"
          >
            Limpar
          </button>
          <small style="display:block; margin-top: 4px; opacity: 0.7;">Limpar todas as fichas dos jogadores.</small>
        </div>

        <div v-if="Object.keys(fichas).length === 0" style="margin-top: 15px; text-align: center; opacity: 0.8;">
          Nenhum jogador conectado ainda.
        </div>

        <div v-for="(ficha, id) in fichas" :key="id" class="ficha">
          <div style="display:flex; justify-content:space-between; align-items:center;">

                        <h2 style="margin:0;">{{ ficha.nome || 'Sem nome' }} | {{ ficha.tipo }}</h2>

                        <div class="stat-controls" style="display:flex; align-items:center; gap:6px;">
              <button @click="alterarAcoes(id, (ficha._acoes ?? 3) - 1)">−</button>
                <span class="label" style="font-weight: bold;">Ações:</span>
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

          <p style="font-size: 14px; font-style: italic; opacity: 0.9;">Últimas Rolagens: {{ ficha.ultimasRolagens.length ? ficha.ultimasRolagens.join(' | ') : '—' }}</p>
        </div>

                <h2 style="margin-top: 20px;">Administração de Monstros</h2>
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
