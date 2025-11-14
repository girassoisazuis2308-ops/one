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
      ultimasRolagensVisiveis: false, // controla se o popup está visível
      fichas: {},
      salvarTimeout: null,
      logs: [],
      isMestre: false,
      rolando: false, // 🔥 indica que uma rolagem está em andamento
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

        const roomData = await OBR.room.getMetadata();
        const fichasAtuais = {};
        for (const [key, value] of Object.entries(roomData)) {
          if (key.startsWith("ficha-")) fichasAtuais[key] = value;
        }
        this.fichas = fichasAtuais;

                // Ao carregar a ficha do player
        const minhaFicha = roomData[`ficha-${playerId}`];
        if (minhaFicha) {
          Object.assign(this, minhaFicha);
          if (typeof this.ultimasRolagens === 'string') {
            this.ultimasRolagens = this.ultimasRolagens.split('|');
          } else if (!Array.isArray(this.ultimasRolagens)) {
            this.ultimasRolagens = [];
          }
        }
        
        // Ao atualizar as fichas do Mestre
        OBR.room.onMetadataChange((metadata) => {
          const novas = {};
          for (const [key, value] of Object.entries(metadata)) {
            if (key.startsWith("ficha-")) {
              // converte ultimasRolagens de string para array se necessário
              if (value.ultimasRolagens && typeof value.ultimasRolagens === 'string') {
                value.ultimasRolagens = value.ultimasRolagens.split('|');
              } else if (!Array.isArray(value.ultimasRolagens)) {
                value.ultimasRolagens = [];
              }
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
              ultimoResultado: this.ultimoResultado,
              ultimasRolagens: this.ultimasRolagens.join('|'),
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

    async rolarDado(max, tipo) {
      if (this.rolando) return;
      this.rolando = true;

      // toca som de dado caindo
      const audio = new Audio('/roll-of-dice.mp3');
      audio.play();

      // delay de 2 segundos
      await new Promise(res => setTimeout(res, 1000));

      const valor = Math.floor(Math.random() * max) + 1;

      // atualiza histórico
      this.ultimasRolagens.unshift(`${tipo} → ${valor}`);
      if (this.ultimasRolagens.length > 3) this.ultimasRolagens.pop();
      this.ultimoResultado = this.ultimasRolagens[0];

      this.salvarFicha();
      this.log(`${this.nome} 🎲 ${tipo}: ${valor}`);

      this.rolando = false;
    },

    rolarD10() { this.rolarDado(10, "D10"); },
    rolarD4() { this.rolarDado(4, "D4"); },

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
        <h1>ONE</h1>

        <div class="field">
          <label>Nome</label>
          <input v-model="nome" placeholder="Digite o nome" />
        </div>

        <!-- VIDA + MANA -->
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
            <span class="label">Mana</span>
            <div class="stat-controls">
              <button @click="mana--">−</button>
              <span class="value">{{ mana }}</span>
              <button @click="mana++">+</button>
            </div>
          </div>
        </div>

        <!-- TIPO + ATRIBUTO -->
        <div class="stats-row">
          <div class="stat-box" style="text-align:center;">
            <label class="label" style="margin-bottom:6px; display:block;">Tipo</label>
            <select v-model="tipo" style="width:100%;text-align:center;">
              <option>Combatente</option>
              <option>Conjurador</option>
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
       <div class="field" v-if="ultimoResultado !== null" style="position:relative; display:flex; align-items:center; justify-content:center;">
  <label>Resultado</label>
  <div style="font-size:22px; font-weight:bold; margin-left:6px;">
    {{ ultimoResultado }}
  </div>
  
  <!-- botão pequeno ao lado -->
  <button 
    @click="toggleUltimasRolagens" 
    style="margin-left:6px; font-size:12px; padding:2px 4px; border-radius:4px; border:none; cursor:pointer; background:#7C5CFF; color:white;"
  >
    ⟳
  </button>

  <!-- popup com últimas 3 rolagens -->
  <div v-if="ultimasRolagensVisiveis" 
       style="position:absolute; top:30px; left:50%; transform:translateX(-50%); background:white; border:1px solid #ccc; border-radius:6px; padding:6px 10px; box-shadow:0 2px 6px rgba(0,0,0,0.3); z-index:100;">
    <div v-for="(r, i) in ultimasRolagens" :key="i" style="font-size:14px;">
      {{ r }}
    </div>
  </div>
</div>


        <div class="field">
          <label>Inventário</label>
          <textarea v-model="inventario" rows="5" placeholder="Anote itens"></textarea>
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
          <h2 style text-align:center>{{ ficha.nome || 'Sem nome' }}</h2>
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
