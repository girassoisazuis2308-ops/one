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
      // 🔥 NOVO: Controle para evitar conflitos
      atualizandoFicha: false
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
          if (this._acoes === undefined) this._acoes = minhaFicha._acoes ?? 3;
        } else {
          this._acoes = 3;
        }

        // 🔥 MELHORIA 3: CARREGAR MONSTROS SALVOS
        if (roomData.monstros) {
          const valores = roomData.monstros.split("|").map(v => Number(v));
          this.monstros = valores.map(v => ({ vida: v }));
        }

        // 🔥 CORREÇÃO: Listener simplificado e seguro
        // 🔥 CORREÇÃO: Listener focado apenas em rolagens
OBR.room.onMetadataChange((metadata) => {
  if (this.atualizandoFicha) return;
  
  const minhaFichaId = `ficha-${playerId}`;
  
  // Atualiza monstros
  if (metadata.monstros !== undefined) {
    const valores = metadata.monstros.split("|").map(v => Number(v));
    this.monstros = valores.map(v => ({ vida: v }));
  }

  // 🔥 ATUALIZA APENAS ROLAGENS de outras fichas
  for (const [key, value] of Object.entries(metadata)) {
    if (key.startsWith("ficha-") && key !== minhaFichaId) {
      const rolagensNormalizadas = this.normalizarRolagens(value.ultimasRolagens);
      
      if (!this.fichas[key]) {
        // Se é uma ficha nova, cria com todos os dados
        this.fichas[key] = { 
          ...value, 
          ultimasRolagens: rolagensNormalizadas,
          _acoes: value._acoes ?? 3
        };
      } else {
        // 🔥 ATUALIZA APENAS ROLAGENS, mantém outros campos
        const rolagensMudaram = JSON.stringify(this.fichas[key].ultimasRolagens) !== JSON.stringify(rolagensNormalizadas);
        
        if (rolagensMudaram) {
          this.fichas[key].ultimasRolagens = rolagensNormalizadas;
          this.fichas[key].ultimoResultado = value.ultimoResultado;
        }
        
        // Atualiza outros campos apenas se necessário (sem sobrescrever mudanças locais)
        if (value.vida !== undefined) this.fichas[key].vida = value.vida;
        if (value.ruina !== undefined) this.fichas[key].ruina = value.ruina;
        if (value.nome !== undefined) this.fichas[key].nome = value.nome;
        if (value.tipo !== undefined) this.fichas[key].tipo = value.tipo;
        if (value.atributo !== undefined) this.fichas[key].atributo = value.atributo;
        if (value.inventario !== undefined) this.fichas[key].inventario = value.inventario;
        if (value._acoes !== undefined) this.fichas[key]._acoes = value._acoes;
      }
    }
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

    async salvarFicha() {
      clearTimeout(this.salvarTimeout);

      this.salvarTimeout = setTimeout(async () => {
        try {
          const playerId = await OBR.player.getId();
          this.atualizandoFicha = true; // 🔥 BLOQUEIA ATUALIZAÇÕES
          
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

          this.log("💾 Ficha salva: " + this.nome);
          
          // 🔥 LIBERA APÓS UM PEQUENO DELAY
          setTimeout(() => {
            this.atualizandoFicha = false;
          }, 500);
          
        } catch (e) {
          this.log("❌ Erro ao salvar: " + e.message);
          this.atualizandoFicha = false;
        }
      }, 800);
    },

    trocarPagina(p) {
      this.page = p;
    },

    async salvarMonstros() {
      try {
        await OBR.room.setMetadata({
          monstros: this.monstros.map(m => m.vida).join("|"),
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

    toggleUltimasRolagens() {
      this.ultimasRolagensVisiveis = !this.ultimasRolagensVisiveis;
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

    async atualizarRolagens() {
  try {
    this.log("🔄 Atualizando apenas rolagens das fichas...");
    
    const roomData = await OBR.room.getMetadata();
    const playerId = await OBR.player.getId();
    let atualizouAlgo = false;
    
    for (const [key, value] of Object.entries(roomData)) {
      if (key.startsWith("ficha-")) {
        const rolagensNormalizadas = this.normalizarRolagens(value.ultimasRolagens);
        
        // 🔥 ATUALIZA APENAS ROLAGENS, mantém todos os outros campos
        if (this.fichas[key]) {
          // Só atualiza se as rolagens forem diferentes
          const rolagensAtuais = JSON.stringify(this.fichas[key].ultimasRolagens);
          const rolagensNovas = JSON.stringify(rolagensNormalizadas);
          
          if (rolagensAtuais !== rolagensNovas) {
            this.fichas[key].ultimasRolagens = rolagensNormalizadas;
            this.fichas[key].ultimoResultado = value.ultimoResultado || '';
            atualizouAlgo = true;
          }
        } else {
          // Se é uma ficha nova, cria com todos os dados
          this.fichas[key] = {
            nome: value.nome || '',
            vida: value.vida ?? 3,
            ruina: value.ruina ?? 3,
            tipo: value.tipo || 'Combatente',
            atributo: value.atributo || 'Força',
            inventario: value.inventario || '',
            ultimoResultado: value.ultimoResultado || '',
            ultimasRolagens: rolagensNormalizadas,
            _acoes: value._acoes ?? 3
          };
          atualizouAlgo = true;
        }
        
        // 🔥 Atualiza também a ficha do jogador atual (apenas rolagens)
        if (key === `ficha-${playerId}`) {
          const minhasRolagensAtuais = JSON.stringify(this.ultimasRolagens);
          const minhasRolagensNovas = JSON.stringify(rolagensNormalizadas);
          
          if (minhasRolagensAtuais !== minhasRolagensNovas) {
            this.ultimasRolagens = rolagensNormalizadas;
            if (rolagensNormalizadas.length > 0) {
              this.ultimoResultado = rolagensNormalizadas[0];
            }
            atualizouAlgo = true;
          }
        }
      }
    }
    
    if (atualizouAlgo) {
      this.log("✅ Rolagens atualizadas com sucesso! (outros campos preservados)");
    } else {
      this.log("ℹ️ Nenhuma rolagem nova encontrada.");
    }
    
  } catch (e) {
    this.log("❌ Erro ao atualizar rolagens: " + e.message);
  }
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

        <div class="field" v-if="ultimoResultado" style="position:relative; display:flex; flex-direction:column; align-items:flex-start;">
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
              <div v-for="(r, i) in (ultimasRolagens || [])" :key="i" style="font-size:14px;">
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
          <button
            @click="atualizarRolagens"
            style="padding:6px 12px; background:#28a745; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-left: 10px;"
          >
            🔄 Atualizar Tudo
          </button>
        </div>

        <div v-if="Object.keys(fichas).length === 0">
          Nenhum jogador conectado ainda.
        </div>

        <div v-for="(ficha, id) in fichas" :key="id" class="ficha">
          <div style="display:flex; justify-content:space-between; align-items:center;">

            <!-- Nome -->
            <h2 style="margin:0;">{{ ficha.nome || 'Sem nome' }} | {{ ficha.tipo }}</h2>

            <!-- CONTADOR BONITO IGUAL VIDA -->
            <div class="stat-controls" style="display:flex; align-items:center; gap:6px;">
              <button @click="alterarAcoes(id, (ficha._acoes ?? 3) - 1)">−</button>

              <span style="display:inline-block;">
                {{ ficha._acoes ?? 3 }}
              </span>

              <button @click="alterarAcoes(id, (ficha._acoes ?? 3) + 1)">+</button>
            </div>

          </div>

          <p>Vida: {{ ficha.vida }} | Ruina: {{ ficha.ruina }} | {{ ficha.atributo }}</p>
          <p style="font-size:12px;">{{ ficha.inventario }}</p>
          <p>{{ ficha.ultimasRolagens.length ? ficha.ultimasRolagens.join(' | ') : '—' }}</p>
        </div>

        <!-- MONSTROS — ADMINISTRAÇÃO DO MESTRE -->
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

          <!-- grade de 2 por linha -->
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;">
            <div v-for="(m, index) in monstros" :key="index">
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
          v-if="page === 'master' && isMestre"
          style="margin-top:20px; background:#111; padding:10px; border-radius:8px; max-height:150px; overflow:auto;"
        >
          <h3>Debug:</h3>
          <div v-for="(log, i) in logs" :key="i" style="font-size:12px;">{{ log }}</div>
        </div>
      </div>
    </div>
  `,
};

Vue.createApp(App).mount("#app");
