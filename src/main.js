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
      fichas: {},
      salvarTimeout: null,
      logs: [],
      isMestre: false,
    };
  },

  mounted() {
    this.log("⏳ Aguardando OBR...");
    OBR.onReady(async () => {
      this.log("✅ OBR carregado!");

      try {
        const playerId = await OBR.player.getId();
        this.log("🎮 Meu ID: " + playerId);

        // Detecta papel apenas uma vez
        const role = await OBR.player.getRole();
        this.isMestre = role === "GM";
        this.log("🎩 Papel detectado: " + role);

        // Carregar fichas atuais
        const roomData = await OBR.room.getMetadata();
        const fichasAtuais = {};
        for (const [key, value] of Object.entries(roomData)) {
          if (key.startsWith("ficha-")) fichasAtuais[key] = value;
        }
        this.fichas = fichasAtuais;
        this.log("📥 Fichas carregadas: " + Object.keys(fichasAtuais).length);

        // Ficha do jogador atual
        const minhaFicha = roomData[`ficha-${playerId}`];
        if (minhaFicha) {
          Object.assign(this, minhaFicha);
          this.log("📄 Ficha recuperada da sala");
        }

        // Atualizações de fichas
        OBR.room.onMetadataChange((metadata) => {
          const novas = {};
          for (const [key, value] of Object.entries(metadata)) {
            if (key.startsWith("ficha-")) novas[key] = value;
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
    async salvarFicha() {
      clearTimeout(this.salvarTimeout);
      this.salvarTimeout = setTimeout(async () => {
        try {
          const playerId = await OBR.player.getId();
          await OBR.room.setMetadata({
            [`ficha-${playerId}`]: {
              nome: this.nome,
              vida: this.vida,
              mana: this.mana,
              tipo: this.tipo,
              atributo: this.atributo,
              inventario: this.inventario,
            },
          });
          this.log("💾 Ficha salva: " + this.nome);
        } catch (e) {
          this.log("❌ Erro ao salvar: " + e.message);
        }
      }, 500);
    },

    trocarPagina(p) {
      this.page = p;
    },

    async limparFichas() {
      if (!this.isMestre) return;
      if (!confirm("Tem certeza que deseja limpar todas as fichas dos jogadores?")) return;

      try {
        const roomData = await OBR.room.getMetadata();
        const updates = {};
        for (const key of Object.keys(roomData)) {
          if (key.startsWith("ficha-")) {
            updates[key] = undefined; // apagar metadado
          }
        }

        await OBR.room.setMetadata(updates);
        this.fichas = {}; // limpar localmente também
        this.log("🧹 Todas as fichas foram limpas!");
      } catch (e) {
        this.log("❌ Erro ao limpar fichas: " + (e.message || e));
      }
    },

    log(msg) {
      this.logs.unshift(new Date().toLocaleTimeString() + " " + msg);
      if (this.logs.length > 20) this.logs.pop();
    },
  },

  template: `
    <div>
      <nav>
        <button :class="{active: page==='player'}" @click="trocarPagina('player')">Jogador</button>
        <button v-if="isMestre" :class="{active: page==='master'}" @click="trocarPagina('master')">Mestre</button>
      </nav>

      <!-- Aba do Jogador -->
      <div v-if="page==='player'" class="sheet">
        <h1>ONE RPG</h1>

        <div class="field">
          <label>Nome</label>
          <input v-model="nome" placeholder="Digite o nome" />
        </div>

        <div class="field row">
          <label>Vida</label>
          <button @click="vida--">−</button>
          <span>{{vida}}</span>
          <button @click="vida++">+</button>
        </div>

        <div class="field row">
          <label>Mana</label>
          <button @click="mana--">−</button>
          <span>{{mana}}</span>
          <button @click="mana++">+</button>
        </div>

        <div class="field">
          <label>Tipo</label>
          <select v-model="tipo">
            <option>Combatente</option>
            <option>Conjurador</option>
          </select>
        </div>

        <div class="field">
          <label>Atributo</label>
          <select v-model="atributo">
            <option>Força</option>
            <option>Destreza</option>
            <option>Intelecto</option>
            <option>Vigor</option>
          </select>
        </div>

        <div class="field">
          <label></label>
          <textarea v-model="inventario" rows="5" placeholder="Anote itens"></textarea>
        </div>
      </div>

      <!-- Aba do Mestre -->
      <div v-if="page==='master' && isMestre" class="master">
        <h1>FICHAS</h1>

        <button @click="limparFichas" style="margin-bottom:10px; background;withe; color:grey; padding:6px 12px; border:none; border-radius:6px;">
          Limpar todas as fichas
        </button>

        <div v-if="Object.keys(fichas).length === 0">
          Nenhum jogador conectado ainda.
        </div>

        <div v-for="(ficha, id) in fichas" :key="id" class="ficha">
          <h2>{{ ficha.nome || 'Sem nome' }}</h2>
          <p>Vida: {{ ficha.vida }} | Mana: {{ ficha.mana }} | {{ ficha.atributo }}</p>
          <p>{{ ficha.tipo }}</p>
          <p>{{ ficha.inventario }}</p>
        </div>
      </div>

      <!-- Debug -->
      <div style="margin-top:20px; background:#111; padding:10px; border-radius:8px; max-height:150px; overflow:auto;">
        <h3>🪲 Debug:</h3>
        <div v-for="(log, i) in logs" :key="i" style="font-size:12px;">{{ log }}</div>
      </div>
    </div>
  `,
};

Vue.createApp(App).mount("#app");
