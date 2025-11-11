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
