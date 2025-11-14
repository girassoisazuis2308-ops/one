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

        const role = await OBR.player.getRole();
        this.isMestre = role === "GM";
        this.log("🎩 Papel detectado: " + role);

        const roomData = await OBR.room.getMetadata();
        const fichasAtuais = {};
        for (const [key, value] of Object.entries(roomData)) {
          if (key.startsWith("ficha-")) fichasAtuais[key] = value;
        }
        this.fichas = fichasAtuais;

        const minhaFicha = roomData[`ficha-${playerId}`];
        if (minhaFicha) Object.assign(this, minhaFicha);

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
              ultimoResultado: this.ultimoResultado,   // 🔥 agora vai junto
              ultimasRolagens: this.ultimasRolagens, // 🔥 novo campo
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
          if (key.startsWith("ficha-")) updates[key] = undefined;
        }

        await OBR.room.setMetadata(updates);
        this.fichas = {};
        this.log("🧹 Todas as fichas foram limpas!");
      } catch (e) {
        this.log("❌ Erro ao limpar fichas: " + (e.message || e));
      }
    },

rolarD10() {
  const valor = Math.floor(Math.random() * 10) + 1;
  // adiciona ao histórico
  if (!this.ultimasRolagens) this.ultimasRolagens = [];
  this.ultimasRolagens.unshift("D10 → " + valor);
  if (this.ultimasRolagens.length > 2) this.ultimasRolagens.pop();
  
  this.ultimoResultado = this.ultimasRolagens[0];
  
  this.salvarFicha();
  this.log(this.nome + " 🎲 D10: " + valor);
},

rolarD4() {
  const valor = Math.floor(Math.random() * 4) + 1;
  if (!this.ultimasRolagens) this.ultimasRolagens = [];
  this.ultimasRolagens.unshift("D4 → " + valor);
  if (this.ultimasRolagens.length > 2) this.ultimasRolagens.pop();
  
  this.ultimoResultado = this.ultimasRolagens[0];

  this.salvarFicha();
  this.log(this.nome + " 🎲 D4: " + valor);
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

        <!-- TIPO + ATRIBUTO lado a lado, com o texto ACIMA do select -->
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
      style="
        width:100%;
        padding:8px;
        border-radius:8px;
        border:none;
        background:linear-gradient(135deg, #7C5CFF, #9B7BFF);
        color:white;
        font-weight:700;
        cursor:pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      "
      onmousedown="this.style.transform='scale(1.1)'; this.style.boxShadow='0 4px 10px rgba(0,0,0,0.5)';"
      onmouseup="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.4)';"
      onmouseleave="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.4)';"
    >
      Rolar D10
    </button>
  </div>

  <div class="stat-box" style="padding: 14px;">
    <button 
      @click="rolarD4" 
      style="
        width:100%;
        padding:8px;
        border-radius:8px;
        border:none;
        background:linear-gradient(135deg, #7C5CFF, #9B7BFF);
        color:white;
        font-weight:700;
        cursor:pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      "
      onmousedown="this.style.transform='scale(1.1)'; this.style.boxShadow='0 4px 10px rgba(0,0,0,0.5)';"
      onmouseup="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.4)';"
      onmouseleave="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.4)';"
    >
      Rolar D4
    </button>
  </div>
</div>



<!-- Resultado -->
<div class="field" v-if="ultimoResultado !== null">
  <label>Resultado</label>
  <div style="font-size:22px; font-weight:bold; margin-top:4px;text-align:center;">
    {{ ultimoResultado }}
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
    style="
      width: 80px;               /* botão pequeno */
      padding: 4px 8px;          /* reduz o padding */
      background: linear-gradient(135deg, #7C5CFF, #9B7BFF); /* gradiente roxo Owlbear */
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "
    onmouseover="this.style.transform='scale(1.1)'; this.style.boxShadow='0 4px 10px rgba(0,0,0,0.5)';"
    onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.4)';"
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
            {{ ficha.ultimasRolagens ? ficha.ultimasRolagens.join(' | ') : '—' }}
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
