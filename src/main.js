import OBR from "@owlbear-rodeo/sdk";

const App = {
  data() {
    return {
      page: "player",
      nome: "",
      vida: 10,
      mana: 5,
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
    };
  },

  mounted() {
    this.log("⏳ Aguardando OBR...");

    OBR.onReady(async () => {
      this.log("✅ OBR carregado!");

      try {
        const playerId = await OBR.player.getId();
        const role = await OBR.player.getRole();
        this.isMestre = role === "GM";

        this.log("🎮 ID: " + playerId);
        this.log("🎩 Papel: " + role);

        // ===========================
        // 1. CARREGAR METADATA
        // ===========================
        const roomData = await OBR.room.getMetadata();
        const fichasAtuais = {};

        for (const [key, value] of Object.entries(roomData)) {
          if (key.startsWith("ficha-")) {
            fichasAtuais[key] = JSON.parse(JSON.stringify(value));
          }
        }

        this.fichas = fichasAtuais;

        // CARREGAR MINHA FICHA
        const minhaFicha = roomData[`ficha-${playerId}`];

        if (minhaFicha) {
          const copia = JSON.parse(JSON.stringify(minhaFicha));

          // garantir array
          if (typeof copia.ultimasRolagens === "string") {
            copia.ultimasRolagens = copia.ultimasRolagens.split("|");
          }
          if (!Array.isArray(copia.ultimasRolagens)) {
            copia.ultimasRolagens = [];
          }

          Object.assign(this, copia);
        }

        // ===========================
        // 2. ATUALIZAÇÕES EM TEMPO REAL
        // ===========================
        OBR.room.onMetadataChange((metadata) => {
          this.log("📡 Atualização global recebida");

          const novas = {};

          for (const [key, value] of Object.entries(metadata)) {
            if (!key.startsWith("ficha-")) continue;

            // 🔥 sempre trabalhar em uma cópia
            const copia = JSON.parse(JSON.stringify(value));

            if (typeof copia.ultimasRolagens === "string") {
              copia.ultimasRolagens = copia.ultimasRolagens.split("|");
            }
            if (!Array.isArray(copia.ultimasRolagens)) {
              copia.ultimasRolagens = [];
            }

            novas[key] = copia;
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
    mana: "salvarFicha",
    tipo: "salvarFicha",
    atributo: "salvarFicha",
    inventario: "salvarFicha",
  },

  methods: {
    // ===========================
    // SALVAR FICHA
    // ===========================
    async salvarFicha() {
      clearTimeout(this.salvarTimeout);

      this.salvarTimeout = setTimeout(async () => {
        try {
          const playerId = await OBR.player.getId();

          const fichaParaSalvar = {
            nome: this.nome,
            vida: this.vida,
            mana: this.mana,
            tipo: this.tipo,
            atributo: this.atributo,
            inventario: this.inventario,
            ultimoResultado: this.ultimoResultado,
            ultimasRolagens: Array.isArray(this.ultimasRolagens)
              ? this.ultimasRolagens.join("|")
              : "",
          };

          await OBR.room.setMetadata({
            [`ficha-${playerId}`]: fichaParaSalvar,
          });

          this.log("💾 Ficha salva!");
        } catch (e) {
          this.log("❌ Erro ao salvar: " + e.message);
        }
      }, 500);
    },

    trocarPagina(p) {
      this.page = p;
    },

    // ===========================
    // LIMPAR FICHAS DO MESTRE
    // ===========================
    async limparFichas() {
      if (!this.isMestre) return;

      if (!confirm("Tem certeza que deseja limpar todas as fichas?")) return;

      try {
        const roomData = await OBR.room.getMetadata();
        const updates = {};

        for (const key of Object.keys(roomData)) {
          if (key.startsWith("ficha-")) {
            updates[key] = undefined;
          }
        }

        await OBR.room.setMetadata(updates);
        this.fichas = {};

        this.log("🧹 Fichas limpas!");
      } catch (e) {
        this.log("❌ Erro ao limpar: " + (e.message || e));
      }
    },

    toggleUltimasRolagens() {
      this.ultimasRolagensVisiveis = !this.ultimasRolagensVisiveis;
    },

    // ===========================
    // ROLAGEM DE DADOS
    // ===========================
    async rolarDado(max, tipo) {
      if (this.rolando) return;
      this.rolando = true;

      // som em /src
      const audio = new Audio("roll-of-dice.mp3");
      audio.play().catch(() => {});

      await new Promise((r) => setTimeout(r, 800));

      const valor = Math.floor(Math.random() * max) + 1;

      this.ultimasRolagens.unshift(`${tipo} → ${valor}`);
      if (this.ultimasRolagens.length > 3) this.ultimasRolagens.pop();

      this.ultimoResultado = this.ultimasRolagens[0];

      this.salvarFicha();
      this.log(`🎲 ${tipo}: ${valor}`);

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
      if (this.logs.length > 50) this.logs.pop();
    },
  },

  template: `
    <div>
      <nav>
        <button :class="{active: page==='player'}" @click="trocarPagina('player')">Jogador</button>
        <button v-if="isMestre" :class="{active: page==='master'}" @click="trocarPagina('master')">Mestre</button>
      </nav>

      <!-- =========================================== -->
      <!-- JOGADOR -->
      <!-- =========================================== -->
      <div v-if="page==='player'" class="sheet">

        <h1>ONE</h1>

        <div class="field">
          <label>Nome</label>
          <input v-model="nome" />
        </div>

        <div class="stats-row">
          <div class="stat-box">
            <span>Vida</span>
            <div class="stat-controls">
              <button @click="vida--">−</button>
              <span>{{ vida }}</span>
              <button @click="vida++">+</button>
            </div>
          </div>

          <div class="stat-box">
            <span>Mana</span>
            <div class="stat-controls">
              <button @click="mana--">−</button>
              <span>{{ mana }}</span>
              <button @click="mana++">+</button>
            </div>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-box">
            <label>Tipo</label>
            <select v-model="tipo">
              <option>Combatente</option>
              <option>Conjurador</option>
            </select>
          </div>

          <div class="stat-box">
            <label>Atributo</label>
            <select v-model="atributo">
              <option>Força</option>
              <option>Destreza</option>
              <option>Intelecto</option>
              <option>Vigor</option>
            </select>
          </div>
        </div>

        <!-- DADOS -->
        <div class="stats-row">
          <div class="stat-box">
            <button @click="rolarD10" :disabled="rolando">Rolar D10</button>
          </div>
          <div class="stat-box">
            <button @click="rolarD4" :disabled="rolando">Rolar D4</button>
          </div>
        </div>

        <!-- Resultado -->
        <div class="field" v-if="ultimoResultado !== ''">
          <label>Resultado</label>
          <div class="resultado">
            {{ ultimoResultado }}
            <button @click="toggleUltimasRolagens">⟳</button>

            <div v-if="ultimasRolagensVisiveis" class="popup">
              <div v-for="(r,i) in ultimasRolagens" :key="i">{{ r }}</div>
            </div>
          </div>
        </div>

        <div class="field">
          <label>Inventário</label>
          <textarea v-model="inventario" rows="5"></textarea>
        </div>

      </div>

      <!-- =========================================== -->
      <!-- MESTRE -->
      <!-- =========================================== -->
      <div v-if="page==='master' && isMestre" class="master">
        <h1>PERSONAGENS</h1>

        <button @click="limparFichas">Limpar</button>

        <div v-if="Object.keys(fichas).length === 0">
          Nenhum jogador conectado.
        </div>

        <div v-for="(ficha,id) in fichas" :key="id" class="ficha">
          <h2>{{ ficha.nome || "Sem nome" }}</h2>
          <p>Vida: {{ ficha.vida }} | Mana: {{ ficha.mana }}</p>
          <p>{{ ficha.tipo }} · {{ ficha.atributo }}</p>
          <p>{{ ficha.inventario }}</p>
          <p>{{ ficha.ultimasRolagens.join(" | ") }}</p>
        </div>

        <div class="debug">
          <h3>🪲 Debug:</h3>
          <div v-for="(log,i) in logs" :key="i">{{ log }}</div>
        </div>

      </div>
    </div>
  `,
};

Vue.createApp(App).mount("#app");
