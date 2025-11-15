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

        // Carregar todas as fichas já existentes
        const roomData = await OBR.room.getMetadata();
        const fichasAtuais = {};

        for (const [key, value] of Object.entries(roomData)) {
          if (key.startsWith("ficha-")) {
            // Corrige antes de armazenar
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

    // 🔥 garante que SEMPRE vira array
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
              mana: this.mana,
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

      // som
      new Audio('/roll-of-dice.mp3').play();

      // efeito
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

      <!-- Player -->
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
            <span class="label">Mana</span>
            <div class="stat-controls">
              <button @click="mana--">−</button>
              <span class="value">{{ mana }}</span>
              <button @click="mana++">+</button>
            </div>
          </div>
        </div>

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
              ">
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

      <!-- Mestre -->
      <div v-if="page==='master' && isMestre" class="master">

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
          <p>
            {{ ficha.ultimasRolagens.length ? ficha.ultimasRolagens.join(' | ') : '—' }}
          </p>
          <p>{{ ficha.inventario }}</p>
        </div>

        <!-- MONSTROS — ADMINISTRAÇÃO DO MESTRE -->
<div style="margin-top:20px; padding:10px; background:#1a1a1a; border-radius:8px;">

  <h2 style="text-align:center; margin-bottom:10px;">Monstros</h2>

  <div style="display:flex; justify-content:center; gap:10px; margin-bottom:15px;">
    <button
      @click="adicionarMonstro"
      style="padding:6px 12px; background:linear-gradient(135deg, #7C5CFF, #9B7BFF); color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;"
    >
      ➕ Adicionar Monstro
    </button>

    <button
      @click="limparMonstros"
      style="padding:6px 12px; background:#b00000; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;"
    >
      🗑 Limpar
    </button>
  </div>

  <div v-if="monstros.length === 0" style="text-align:center; opacity:0.6;">
    Nenhum monstro criado.
  </div>

  <!-- grade de 2 por linha -->
  <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;">
    <div
      v-for="(m, index) in monstros"
      :key="index"
      style="padding:10px; background:#111; border:1px solid #333; border-radius:8px;"
    >
      <h3 style="margin-bottom:10px; text-align:center;">Monstro {{ index + 1 }}</h3>

      <div class="stats-row">
        <div class="stat-box">
          <span class="label">Vida</span>
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
        v-if="page === 'master' && isMestre"
        style="margin-top:20px; background:#111; padding:10px; border-radius:8px; max-height:150px; overflow:auto;">
        <h3>🪲 Debug:</h3>
        <div v-for="(log, i) in logs" :key="i" style="font-size:12px;">{{ log }}</div>
      </div>
    </div>
  `,
};

Vue.createApp(App).mount("#app");
