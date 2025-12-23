import OBR from "@owlbear-rodeo/sdk";

// Aplicação principal Vue
const App = {
  // Estado reativo da aplicação
  data() {
    return {
      page: "player",                 // Página atual (player/master)
      nome: "",                       // Nome do personagem
      vida: 3,                        // Vida do personagem
      ruina: 3,                       // Ruína do personagem
      tipo: "Combatente",             // Tipo/Função
      atributo: "Força",              // Atributo principal
      inventario: "",                 // Texto do inventário
      ultimoResultado: "",            // Último resultado de dado
      ultimasRolagens: [],            // Histórico de rolagens
      ultimasRolagensVisiveis: false, // Toggle de histórico
      fichas: {},                     // Todas as fichas da sala
      salvarTimeout: null,            // Controle de debounce
      logs: [],                       // Logs de debug
      isMestre: false,                // Se o jogador é GM
      rolando: false,                 // Trava durante rolagem
      monstros: [],                   // Lista de monstros
      _acoes: 3,                      // Ações disponíveis
      inventarioExpandido: {},        // Controle de inventário aberto
    };
  },

  // Executa ao montar o app
  mounted() {
    this.log("⏳ Aguardando OBR...");

    // Aguarda o SDK do Owlbear
    OBR.onReady(async () => {
      this.log("✅ OBR carregado!");

      try {
        // Obtém ID do jogador
        const playerId = await OBR.player.getId();
        this.log("🎮 Meu ID: " + playerId);

        // Verifica papel (Player ou GM)
        const role = await OBR.player.getRole();
        this.isMestre = role === "GM";
        this.log("🎩 Papel detectado: " + role);

        // Carrega metadados da sala
        const roomData = await OBR.room.getMetadata();
        const fichasAtuais = {};

        // Carrega fichas existentes
        for (const [key, value] of Object.entries(roomData)) {
          if (key.startsWith("ficha-")) {
            value.ultimasRolagens = this.normalizarRolagens(value.ultimasRolagens);
            fichasAtuais[key] = value;
          }
        }

        this.fichas = fichasAtuais;

        // Carrega ficha do próprio jogador
        const minhaFicha = roomData[`ficha-${playerId}`];

        if (minhaFicha) {
          Object.assign(this, minhaFicha);
          this.ultimasRolagens = this.normalizarRolagens(minhaFicha.ultimasRolagens);
          if (this._acoes === undefined) this._acoes = minhaFicha._acoes ?? 3;
        } else {
          this._acoes = 3;
        }

        // Carrega monstros salvos
        if (roomData.monstros) {
          this.monstros = roomData.monstros.split("|").map(entry => {
            const [nome, vida] = entry.split(",");
            return {
              nome: nome || "Monstro",
              vida: Number(vida) || 0,
            };
          });
        }

        // Listener de mudanças no metadata
        OBR.room.onMetadataChange((metadata) => {
          const novas = {};
        
          // Atualiza fichas
          for (const [key, value] of Object.entries(metadata)) {
            if (key.startsWith("ficha-")) {
              value.ultimasRolagens = this.normalizarRolagens(value.ultimasRolagens);
              novas[key] = value;
            }
          }
        
          // Mescla dados sem perder estado local
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

  // Observadores reativos
  watch: {
    nome: "salvarFicha",
    vida(value) {
      if (value < 0) this.vida = 0; // Impede vida negativa
      this.salvarFicha();
    },
    ruina(value) {
      if (value < 0) this.ruina = 0; // Impede ruína negativa
      this.salvarFicha();
    },
    tipo: "salvarFicha",
    atributo: "salvarFicha",
    inventario: "salvarFicha",
  },

  methods: {
    // Normaliza histórico de rolagens
    normalizarRolagens(v) {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (typeof v === "string") return v.split("|");
      return [];
    },

    // Salva ficha no metadata da sala
    async _salvarFichaNoRoom() {
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

        // Apenas o GM salva ações
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
    },

    // Gerencia salvamento com debounce
    async salvarFicha(debounce = true) {
      if (!debounce) {
        await this._salvarFichaNoRoom();
        return;
      }

      clearTimeout(this.salvarTimeout);

      this.salvarTimeout = setTimeout(async () => {
        await this._salvarFichaNoRoom();
      }, 700);
    },

    // Alterna páginas
    trocarPagina(p) {
      this.page = p;
    },

    // Abre/fecha inventário do GM
    toggleInventario(id) {
      this.$set
        ? this.$set(this.inventarioExpandido, id, !this.inventarioExpandido[id])
        : (this.inventarioExpandido[id] = !this.inventarioExpandido[id]);
    },

    // Salva monstros no metadata
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

    // Adiciona novo monstro
    adicionarMonstro() {
      this.monstros.push({ vida: 10 });
      this.salvarMonstros();
    },

    // Remove todos os monstros
    limparMonstros() {
      if (!confirm("Deseja remover todos os monstros?")) return;
      this.monstros = [];
      this.salvarMonstros();
    },

    // Limpa todas as fichas (GM)
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

    // Toggle histórico de rolagens
    toggleUltimasRolagens() {
      this.ultimasRolagensVisiveis = !this.ultimasRolagensVisiveis;
    },

    // Rola um dado genérico
    async rolarDado(max, tipo) {
      if (this.rolando) return;
      this.rolando = true;

      new Audio('/roll-of-dice.mp3').play();
      await new Promise(res => setTimeout(res, 1000));

      const valor = Math.floor(Math.random() * max) + 1;

      this.ultimasRolagens.unshift(`${tipo} → ${valor}`);
      if (this.ultimasRolagens.length > 3) this.ultimasRolagens.pop();

      this.ultimoResultado = this.ultimasRolagens[0];

      await this.salvarFicha(false);

      this.log(`${this.nome} 🎲 ${tipo}: ${valor}`);

      this.rolando = false;
    },

    // Atalhos de dados
    rolarD10() {
      return this.rolarDado(10, "D10");
    },

    rolarD4() {
      return this.rolarDado(4, "D4");
    },

    // Log interno
    log(msg) {
      this.logs.unshift(new Date().toLocaleTimeString() + " " + msg);
      if (this.logs.length > 20) this.logs.pop();
    },

    // GM altera ações de um jogador
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

  // Template HTML (interface)
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
        </div>

        <div v-if="Object.keys(fichas).length === 0">
          Nenhum jogador conectado ainda.
        </div>


  <div v-for="(ficha, id) in fichas" :key="id" class="ficha">

    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h2 style="margin:0;">{{ ficha.nome || 'Sem nome' }} | {{ ficha.tipo }}</h2>
    </div>

    <p>Vida: {{ ficha.vida }} | Ruina: {{ ficha.ruina }} | {{ ficha.atributo }}</p>

    <!-- BOTÃO DE INVENTÁRIO + AÇÕES LADO A LADO -->
    <div
      style="
        display:flex;
        align-items:center;
        font-size:12px;
        margin-top:6px;
      "
    >

      <!-- Botão de inventário -->
      <button
        @click="toggleInventario(id)"
        style="
          font-size:15px;
          padding:2px 6px;
          border:none;
          background:linear-gradient(145deg, #1A1B2E, #1C1D33);
          color:white;
          border-radius:4px;
          cursor:pointer;
          margin-right:6px;
        "
      >
        {{ inventarioExpandido[id] ? 'Esconder Inventário' : 'Mostrar Inventário' }}
      </button>

      <!-- Controles de Ações -->
      <div class="stat-controls" style="display:flex; align-items:center; gap:6px;">
        <button @click="alterarAcoes(id, (ficha._acoes ?? 3) - 1)">−</button>

        <span style="display:inline-block;">
          {{ ficha._acoes ?? 3 }}
        </span>

        <button @click="alterarAcoes(id, (ficha._acoes ?? 3) + 1)">+</button>
      </div>

    </div>

    <!-- Inventário expandido -->
    <div
      v-if="inventarioExpandido[id]"
      style="
        background:linear-gradient(145deg, #1A1B2E, #1C1D33);
        padding:6px;
        border-radius:4px;
        white-space:pre-wrap;
        margin-top:4px;
      "
    >
      {{ ficha.inventario || '—' }}
    </div>

    <p>{{ ficha.ultimasRolagens.length ? ficha.ultimasRolagens.join(' | ') : '—' }}</p>

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
