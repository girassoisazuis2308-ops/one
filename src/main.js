import OBR from "@owlbear-rodeo/sdk";

// Configurações do sistema
const CONFIG = {
  SALVAMENTO_DELAY: 700,
  MAX_LOGS: 20,
  MAX_ROLAGENS_HISTORICO: 3,
  DADOS: {
    D10: { max: 10, label: "D10" },
    D4: { max: 4, label: "D4" }
  },
  TIPOS_PERSONAGEM: ["Combatente", "Conjurador"],
  ATRIBUTOS: ["Força", "Destreza", "Intelecto", "Vigor"]
};

const App = {
  data() {
    return {
      page: "player",
      ficha: this.criarFichaVazia(),
      fichas: {},
      ultimasRolagensVisiveis: false,
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
      await this.inicializarAplicacao();
    });
  },

  methods: {
    // Método para criar uma ficha vazia
    criarFichaVazia() {
      return {
        nome: "",
        vida: 10,
        mana: 5,
        tipo: "Combatente",
        atributo: "Força",
        inventario: "",
        ultimoResultado: "",
        ultimasRolagens: []
      };
    },

    // Inicialização principal
    async inicializarAplicacao() {
      try {
        const playerId = await OBR.player.getId();
        this.log("🎮 Meu ID: " + playerId);

        const role = await OBR.player.getRole();
        this.isMestre = role === "GM";
        this.log("🎩 Papel detectado: " + role);

        // Carregar ficha do jogador
        await this.carregarMinhaFicha(playerId);
        
        // Configurar listener para mudanças
        this.configurarListenerFichas();

      } catch (e) {
        this.log("❌ Erro na inicialização: " + (e.message || e));
      }
    },

    // Carregar ficha do jogador atual
    async carregarMinhaFicha(playerId) {
      const roomData = await OBR.room.getMetadata();
      const minhaFicha = roomData[`ficha-${playerId}`];
      
      if (minhaFicha) {
        this.ficha = this.processarFicha(minhaFicha);
        this.log("📁 Ficha carregada: " + this.ficha.nome);
      }
      
      // Carregar todas as fichas para o mestre
      this.fichas = this.carregarTodasFichas(roomData);
    },

    // Processar dados da ficha (converter string para array se necessário)
    processarFicha(ficha) {
      const fichaProcessada = { ...ficha };
      
      if (fichaProcessada.ultimasRolagens) {
        if (typeof fichaProcessada.ultimasRolagens === 'string') {
          fichaProcessada.ultimasRolagens = fichaProcessada.ultimasRolagens.split('|');
        } else if (!Array.isArray(fichaProcessada.ultimasRolagens)) {
          fichaProcessada.ultimasRolagens = [];
        }
      } else {
        fichaProcessada.ultimasRolagens = [];
      }
      
      return fichaProcessada;
    },

    // Carregar todas as fichas da sala
    carregarTodasFichas(roomData) {
      const fichas = {};
      for (const [key, value] of Object.entries(roomData)) {
        if (key.startsWith("ficha-")) {
          fichas[key] = this.processarFicha(value);
        }
      }
      return fichas;
    },

    // Configurar listener para mudanças nas fichas
    configurarListenerFichas() {
      OBR.room.onMetadataChange((metadata) => {
        this.fichas = this.carregarTodasFichas(metadata);
      });
    },

    // Salvar ficha com delay
    async salvarFicha() {
      clearTimeout(this.salvarTimeout);
      this.salvarTimeout = setTimeout(async () => {
        try {
          const playerId = await OBR.player.getId();
          await OBR.room.setMetadata({
            [`ficha-${playerId}`]: {
              nome: this.ficha.nome,
              vida: this.ficha.vida,
              mana: this.ficha.mana,
              tipo: this.ficha.tipo,
              atributo: this.ficha.atributo,
              inventario: this.ficha.inventario,
              ultimoResultado: this.ficha.ultimoResultado,
              ultimasRolagens: this.ficha.ultimasRolagens.join('|'),
            },
          });
          this.log("💾 Ficha salva: " + this.ficha.nome);
        } catch (e) {
          this.log("❌ Erro ao salvar: " + e.message);
        }
      }, CONFIG.SALVAMENTO_DELAY);
    },

    // Navegação entre páginas
    trocarPagina(pagina) {
      this.page = pagina;
    },

    // Limpar todas as fichas (apenas mestre)
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

    // Controle do popup de rolagens
    toggleUltimasRolagens() {
      this.ultimasRolagensVisiveis = !this.ultimasRolagensVisiveis;
    },

    // Sistema de rolagem de dados
    async rolarDado(tipoDado) {
      if (this.rolando) return;
      this.rolando = true;

      // Tocar som de dado
      const audio = new Audio('/roll-of-dice.mp3');
      audio.play();

      // Delay para drama
      await this.delay(1000);

      const config = CONFIG.DADOS[tipoDado];
      const valor = Math.floor(Math.random() * config.max) + 1;

      // Atualizar histórico
      this.ficha.ultimasRolagens.unshift(`${config.label} → ${valor}`);
      if (this.ficha.ultimasRolagens.length > CONFIG.MAX_ROLAGENS_HISTORICO) {
        this.ficha.ultimasRolagens.pop();
      }
      this.ficha.ultimoResultado = this.ficha.ultimasRolagens[0];

      await this.salvarFicha();
      this.log(`${this.ficha.nome} 🎲 ${config.label}: ${valor}`);

      this.rolando = false;
    },

    // Métodos específicos para cada dado
    rolarD10() { this.rolarDado("D10"); },
    rolarD4() { this.rolarDado("D4"); },

    // Utilitários
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    log(msg) {
      this.logs.unshift(new Date().toLocaleTimeString() + " " + msg);
      if (this.logs.length > CONFIG.MAX_LOGS) this.logs.pop();
    },
  },

  watch: {
    // Observa mudanças profundas na ficha
    ficha: {
      handler: 'salvarFicha',
      deep: true
    }
  },

  template: `
    <div>
      <nav>
        <button :class="{active: page==='player'}" @click="trocarPagina('player')">Jogador</button>
        <button v-if="isMestre" :class="{active: page==='master'}" @click="trocarPagina('master')">Mestre</button>
      </nav>

      <!-- Aba do Jogador -->
      <div v-if="page==='player'" class="sheet">
        <h1>ONE</h1>

        <div class="field">
          <label>Nome</label>
          <input v-model="ficha.nome" placeholder="Digite o nome" />
        </div>

        <!-- VIDA + MANA -->
        <div class="stats-row">
          <div class="stat-box">
            <span class="label">Vida</span>
            <div class="stat-controls">
              <button @click="ficha.vida--">−</button>
              <span class="value">{{ ficha.vida }}</span>
              <button @click="ficha.vida++">+</button>
            </div>
          </div>

          <div class="stat-box">
            <span class="label">Mana</span>
            <div class="stat-controls">
              <button @click="ficha.mana--">−</button>
              <span class="value">{{ ficha.mana }}</span>
              <button @click="ficha.mana++">+</button>
            </div>
          </div>
        </div>

        <!-- TIPO + ATRIBUTO -->
        <div class="stats-row">
          <div class="stat-box" style="text-align:center;">
            <label class="label" style="margin-bottom:6px; display:block;">Tipo</label>
            <select v-model="ficha.tipo" style="width:100%;text-align:center;">
              <option v-for="tipo in CONFIG.TIPOS_PERSONAGEM" :key="tipo" :value="tipo">
                {{ tipo }}
              </option>
            </select>
          </div>
        
          <div class="stat-box" style="text-align:center;">
            <label class="label" style="margin-bottom:6px; display:block;">Atributo</label>
            <select v-model="ficha.atributo" style="width:100%; text-align:center;">
              <option v-for="atributo in CONFIG.ATRIBUTOS" :key="atributo" :value="atributo">
                {{ atributo }}
              </option>
            </select>
          </div>
        </div>

        <!-- ROLAGEM DE DADOS -->
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

        <!-- Resultado -->
        <div class="field" v-if="ficha.ultimoResultado" style="position:relative; display:flex; align-items:center; justify-content:center;">
          <label style="margin-right:6px;">Resultado</label>
          <div style="font-size:22px; font-weight:bold;">
            {{ ficha.ultimoResultado }}
          </div>
          
          <!-- botão pequeno no canto direito -->
          <button 
            @click="toggleUltimasRolagens" 
            style="
              margin-left:8px; 
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

          <!-- popup com últimas 3 rolagens -->
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
               ">
            <div v-for="(r, i) in ficha.ultimasRolagens" :key="i" style="font-size:14px;">
              {{ r }}
            </div>
          </div>
        </div>

        <div class="field">
          <label>Inventário</label>
          <textarea v-model="ficha.inventario" rows="5" placeholder="Anote itens"></textarea>
        </div>
      </div>

      <!-- Aba do Mestre -->
      <div v-if="page==='master' && isMestre" class="master">
        <h1>PERSONAGENS</h1>

        <div style="text-align: center; margin-bottom: 10px;">
          <button 
            @click="limparFichas" 
            style="width: 80px; padding: 4px 8px; background: linear-gradient(135deg, #7C5CFF, #9B7BFF); color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"
          >
            Limpar
          </button>
        </div>

        <div v-if="Object.keys(fichas).length === 0">
          Nenhum jogador conectado ainda.
        </div>

        <div v-for="(ficha, id) in fichas" :key="id" class="ficha">
          <h2 style="text-align:center">{{ ficha.nome || 'Sem nome' }}</h2>
          <p>Vida: {{ ficha.vida }} | Mana: {{ ficha.mana }} | {{ ficha.atributo }}</p>
          <p>{{ ficha.tipo }}</p>
          <p>{{ ficha.inventario }}</p>
          <p><strong>Rolagens:</strong> 
            {{ ficha.ultimasRolagens.length ? ficha.ultimasRolagens.join(' | ') : '—' }}
          </p>
        </div>
      </div>

      <!-- Debug -->
      <div 
        v-if="page === 'master' && isMestre"
        style="margin-top:20px; background:#111; padding:10px; border-radius:8px; max-height:150px; overflow:auto;"
      >
        <h3>🪲 Debug:</h3>
        <div v-for="(log, i) in logs" :key="i" style="font-size:12px;">{{ log }}</div>
      </div>
    </div>
  `,
};

Vue.createApp(App).mount("#app");
