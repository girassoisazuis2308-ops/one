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

        // Carregar todas as fichas existentes
        const roomData = await OBR.room.getMetadata();
        const fichasAtuais = {};

        for (const [key, value] of Object.entries(roomData)) {
          if (key.startsWith("ficha-")) {
            value.ultimasRolagens = this.normalizarRolagens(value.ultimasRolagens);
            fichasAtuais[key] = value;
          }
        }

        this.fichas = fichasAtuais;

        // Carregar minha ficha
        const minhaFicha = roomData[`ficha-${playerId}`];

        if (minhaFicha) {
          Object.assign(this, minhaFicha);
          this.ultimasRolagens = this.normalizarRolagens(minhaFicha.ultimasRolagens);
        }

        // Atualizações ao vivo
        OBR.room.onMetadataChange((metadata) => {
          const novas = {};

          for (const [key, value] of Object.entries(metadata)) {
            if (key.startsWith("ficha-")) {
              value.ultimasRolagens = this.normalizarRolagens(value.ultimasRolagens);
              novas[key] = value;
            }
          }

          this.fichas = novas;
        });

      } catch (e) {
        this.log("❌ Erro na inicialização: " + (e.message || e));
      }
    });
  },

  watch: {
    nome: "salvarFicha",
    vida: "salvarFicha",
    ruina: "salvarFicha",
    tipo: "salvarFicha",
    atributo: "salvarFicha",
    inventario: "salvarFicha",
  },

  methods: {
    // 🔥 Normalização do histórico
    normalizarRolagens(v) {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (typeof v === "string") return v.split("|");
      return [];
    },

    async salvarFicha() {
      clearTimeout(this.salvarTimeout);

      this.salvarTimeout = setTimeout(async () => {
        try {
          const playerId = await OBR.player.getId();

          await OBR.room.setMetadata({
            [`ficha-${playerId}`]: {
              nome: this.nome,
              vida: this.vida,
              ruina: this.ruina,
              tipo: this.tipo,
              atributo: this.atributo,
              inventario: this.inventario,
              ultimoResultado: this.ultimoResultado,
              ultimasRolagens: this.ultimasRolagens.join("|"),
            },
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

    adicionarMonstro() {
      this.monstros.push({ vida: 10 });
    },

    limparMonstros() {
      if (!confirm("Deseja remover todos os monstros?")) return;
      this.monstros = [];
    },

    async limparFichas() {
      if (!this.isMestre) return;
      if (!confirm("Tem certeza que deseja limpar todas as fichas dos jogadores?"))
        return;

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

    async rolarDado(max, tipo) {
      if (this.rolando) return;
      this.rolando = true;

      // som
      new Audio('/roll-of-dice.mp3').play();

      // animação
      await new Promise(res => setTimeout(res, 1000));

      const valor = Math.floor(Math.random() * max) + 1;

      // histórico
      this.ultimasRolagens.unshift(`${tipo} → ${valor}`);
      if (this.ultimasRolagens.length > 3) this.ultimasRolagens.pop();

      this.ultimoResultado = this.ultimasRolagens[0];

      this.salvarFicha();
      this.log(`${this.nome} 🎲 ${tipo}: ${valor}`);

      this.rolando = false;
    },

    rolarD10() {
      this.rolarDado(10, "D10");
    },

    rolarD4() {
      this.rolarDado(4, "D4");
    },

    log(msg) {
      this.logs.unshift(new Date().toLocaleTimeString() + " " + msg);
      if (this.logs.length > 20) this.logs.pop();
    },
  },

  template: `
    <div>
      <nav>
        <button 
          :class="{active: page==='player'}"
          @click="trocarPagina('player')"
        >
          Jogador
        </button>

        <button 
          v-if="isMestre"
          :class="{active: page==='master'}"
          @click="trocarPagina('master')"
        >
          Mestre
        </button>
      </nav>

      <!-- PLAYER -->
      <div v-if="page==='player'" class="sheet">

        <!-- Nome -->
        <div class="field">
          <label>Nome</label>
          <input v-model="nome" placeholder="Digite o nome" />
        </div>

        <!-- Vida e Ruína -->
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

        <!-- Função e Atributo -->
        <div class="stats-row">

          <div class="stat-box" style="text-align:center;">
            <label class="label">Função</label>
            <select v-model="tipo" style="width:100%;text-align:center;">
              <option>Combatente</option>
              <option>Arruinado</option>
            </select>
          </div>

          <div class="stat-box" style="text-align:center;">
            <label class="label">Atributo</label>
            <select v-model="atributo" style="width:100%;text-align:center;">
              <option>Força</option>
              <option>Destreza</option>
              <option>Intelecto</option>
              <option>Vigor</option>
            </select>
          </div>

        </div>

        <!-- Botões de rolagem -->
        <div class="stats-row">

          <div class="stat-box" style="padding:14px;">
            <button
              @click="rolarD10"
              :disabled="rolando"
              class="dice-button"
            >
              Rolar D10
            </button>
          </div>

          <div class="stat-box" style="padding:14px;">
            <button
              @click="rolarD4"
              :disabled="rolando"
              class="dice-button"
            >
              Rolar D4
            </button>
          </div>

        </div>

        <!-- Resultado -->
        <div 
          class="field"
          v-if="ultimoResultado !== null"
          style="position:relative;"
        >

          <div style="display:flex; align-items:center; width:100%;">

            <label>Resultado</label>

            <div style="font-size:22px; font-weight:bold; margin-left:8px;">
              {{ ultimoResultado }}
            </div>

            <button 
              @click="toggleUltimasRolagens"
              class="toggle-history-btn"
            >
              ⟳
            </button>

            <!-- Histórico -->
            <div 
              v-if="ultimasRolagensVisiveis"
              class="history-popup"
            >
              <div 
                v-for="(r, i) in ultimasRolagens"
                :key="i"
                style="font-size:14px;"
              >
                {{ r }}
              </div>
            </div>

          </div>
        </div>

        <!-- Inventário -->
        <div class="field">
          <label>Inventário</label>
          <textarea v-model="inventario" rows="5"></textarea>
        </div>

      </div>

      <!-- MESTRE -->
      <div v-if="page==='master' && isMestre" class="master">

        <div style="text-align:center; margin-bottom:10px;">
          <button class="clear-button" @click="limparFichas">
            Limpar
          </button>
        </div>

        <div v-if="Object.keys(fichas).length === 0">
          Nenhum jogador conectado ainda.
        </div>

        <div 
          v-for="(ficha, id) in fichas"
          :key="id"
          class="ficha"
        >

          <div style="display:flex; justify-content:space-between; align-items:center;">

            <h2>{{ ficha.nome || "Sem nome" }} | {{ ficha.tipo }}</h2>

            <div class="stat-controls">
              <button @click="ficha._acoes = (ficha._acoes ?? 3) - 1">−</button>
              <span>{{ ficha._acoes ?? 3 }}</span>
              <button @click="ficha._acoes = (ficha._acoes ?? 3) + 1">+</button>
            </div>

          </div>

          <p>
            Vida: {{ ficha.vida }} | 
            Ruina: {{ ficha.ruina }} | 
            {{ ficha.atributo }}
          </p>

          <p style="font-size:12px;">{{ ficha.inventario }}</p>

          <p>
            {{ ficha.ultimasRolagens.length ? ficha.ultimasRolagens.join(" | ") : "—" }}
          </p>

        </div>

        <!-- Monstros -->
        <div>

          <div style="display:flex; justify-content:center; gap:10px; margin:15px 0;">
            <button class="monster-btn" @click="adicionarMonstro">Adicionar Monstro</button>
            <button class="monster-clear-btn" @click="limparMonstros">Limpar</button>
          </div>

          <div v-if="monstros.length === 0" style="text-align:center; opacity:0.6;">
            Nenhum monstro criado.
          </div>

          <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:12px;">
            <div 
              v-for="(m, index) in monstros"
              :key="index"
            >

              <div style="padding:6px; padding-top:0;">
                <div class="stats-row" style="margin:0;">

                  <div class="stat-box">
                    <span class="label">Monstro {{ index + 1 }}</span>

                    <div class="stat-controls">
                      <button @click="m.vida--">−</button>
                      <span class="value">{{ m.vida }}</span>
                      <button @click="m.vida++">+</button>
                    </div>

                  </div>

                </div>
              </div>

            </div>
          </div>

        </div>

        <!-- Debug -->
        <div 
          style="
            margin-top:20px;
            background:#111;
            padding:10px;
            border-radius:8px;
            max-height:150px;
            overflow:auto;
          "
        >
          <h3>Debug:</h3>

          <div 
            v-for="(log, i) in logs"
            :key="i"
            style="font-size:12px;"
          >
            {{ log }}
          </div>

        </div>

      </div>

    </div>
  `,
};

Vue.createApp(App).mount("#app");
