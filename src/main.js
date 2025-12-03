import OBR from "@owlbear-rodeo/sdk";

const App = {
  data() {
    return {
      // --- Navegação e Estado Local ---
      page: "player",
      logs: [],
      isMestre: false,
      rolando: false,
      ultimasRolagensVisiveis: false,
      inventarioExpandido: {},
      
      // --- Dados da Ficha (Persistentes) ---
      nome: "",
      vida: 3,
      ruina: 3,
      tipo: "Combatente",
      atributo: "Força",
      inventario: "",
      
      // --- Dados de Rolagem (Voláteis) ---
      ultimoResultado: "",
      ultimasRolagens: [],
      
      // --- Dados Globais (Sala) ---
      fichas: {},
      monstros: [],
      _acoes: 3, // Controle local de ações (Mestre)
      
      // --- Controle Interno ---
      salvarStatusTimeout: null, // Timer exclusivo para status
    };
  },

  mounted() {
    this.log("⏳ Iniciando extensão...");

    OBR.onReady(async () => {
      this.log("✅ OBR Conectado!");

      try {
        const playerId = await OBR.player.getId();
        const role = await OBR.player.getRole();
        this.isMestre = role === "GM";
        this.log(`🆔 ID: ${playerId} | 🎭 Role: ${role}`);

        // 1. Carga Inicial
        const metadata = await OBR.room.getMetadata();
        this.sincronizarSala(metadata);

        // 2. Carregar meu próprio estado se existir
        const minhaKey = `ficha-${playerId}`;
        if (metadata[minhaKey]) {
          const dados = metadata[minhaKey];
          this.nome = dados.nome || "";
          this.vida = dados.vida || 3;
          this.ruina = dados.ruina || 3;
          this.tipo = dados.tipo || "Combatente";
          this.atributo = dados.atributo || "Força";
          this.inventario = dados.inventario || "";
          this.ultimoResultado = dados.ultimoResultado || "";
          this.ultimasRolagens = this.normalizarRolagens(dados.ultimasRolagens);
          // Se eu for mestre, carrego minhas ações, senão default 3
          this._acoes = dados._acoes ?? 3;
        }

        // 3. Listener em Tempo Real (O Coração da Sincronização)
        OBR.room.onMetadataChange((novosDados) => {
          this.sincronizarSala(novosDados);
        });

      } catch (e) {
        this.log("❌ Erro Fatal: " + e.message);
      }
    });
  },

  watch: {
    // Observadores APENAS para status (com debounce)
    nome: "agendarSalvamentoStatus",
    vida(val) { if (val < 0) this.vida = 0; this.agendarSalvamentoStatus(); },
    ruina(val) { if (val < 0) this.ruina = 0; this.agendarSalvamentoStatus(); },
    tipo: "agendarSalvamentoStatus",
    atributo: "agendarSalvamentoStatus",
    inventario: "agendarSalvamentoStatus",
  },

  methods: {
    // --- Lógica de Sincronização (Receber Dados) ---
    sincronizarSala(metadata) {
      const fichasTemp = {};
      
      // Processar Fichas
      for (const [key, value] of Object.entries(metadata)) {
        if (key.startsWith("ficha-")) {
          // Normaliza arrays para evitar erros de renderização
          value.ultimasRolagens = this.normalizarRolagens(value.ultimasRolagens);
          fichasTemp[key] = value;
        }
      }
      // Atualiza a lista de fichas do Mestre/Jogadores
      // Usamos uma nova referência para garantir reatividade do Vue
      this.fichas = fichasTemp;

      // Processar Monstros
      if (metadata.monstros) {
        this.monstros = metadata.monstros.split("|").map(entry => {
          const [n, v] = entry.split(",");
          return { nome: n || "Monstro", vida: Number(v) || 0 };
        });
      }
    },

    normalizarRolagens(v) {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (typeof v === "string") return v.split("|");
      return [];
    },

    // --- SALVAMENTO TIPO A: Status (Vida, Nome, etc) ---
    // Usa Debounce para não floodar a API enquanto digita
    agendarSalvamentoStatus() {
      clearTimeout(this.salvarStatusTimeout);
      this.salvarStatusTimeout = setTimeout(() => {
        this.enviarDadosParaOBR(false); // false = não é rolagem
      }, 600);
    },

    // --- SALVAMENTO TIPO B: Rolagem (Dados) ---
    // Imediato, Forçado e Sem Debounce
    async salvarRolagemImediata() {
      await this.enviarDadosParaOBR(true); // true = é rolagem
    },

    // --- O NÚCLEO DE ENVIO ---
    async enviarDadosParaOBR(isRolagem) {
      try {
        const playerId = await OBR.player.getId();
        
        // Monta o pacote de dados
        const payload = {
          nome: this.nome,
          vida: this.vida,
          ruina: this.ruina,
          tipo: this.tipo,
          atributo: this.atributo,
          inventario: this.inventario,
          ultimoResultado: this.ultimoResultado,
          ultimasRolagens: this.ultimasRolagens.join("|"),
          // TRUQUE AGRESSIVO: Adiciona um ID aleatório para forçar o OBR 
          // a detectar mudança mesmo se os dados forem iguais.
          _updateId: Math.random().toString(36).substring(7) 
        };

        // Se for GM, anexa as ações
        if (this.isMestre) {
          payload._acoes = this._acoes;
        }

        // Envia para a sala
        // Nota: setMetadata faz merge no nível da raiz, então atualizar 
        // `ficha-XYZ` não apaga `ficha-ABC`.
        await OBR.room.setMetadata({
          [`ficha-${playerId}`]: payload
        });

        if (isRolagem) this.log("🎲 Rolagem enviada com sucesso!");
        else this.log("💾 Status salvo.");

      } catch (e) {
        this.log("❌ Erro ao enviar: " + e.message);
      }
    },

    // --- Ações de Jogador ---
    async rolarDado(max, tipo) {
      if (this.rolando) return;
      this.rolando = true;

      // Efeito sonoro e visual
      new Audio('/roll-of-dice.mp3').play().catch(() => {}); // catch para evitar erros de autoplay
      await new Promise(r => setTimeout(r, 800));

      // Lógica do Dado
      const valor = Math.floor(Math.random() * max) + 1;
      const resultadoStr = `${tipo} → ${valor}`;

      // Atualiza Estado Local
      this.ultimasRolagens.unshift(resultadoStr);
      if (this.ultimasRolagens.length > 3) this.ultimasRolagens.pop();
      this.ultimoResultado = this.ultimasRolagens[0];

      // 🔥 ENVIO AGRESSIVO: Chama o salvamento imediato
      await this.salvarRolagemImediata();

      this.log(`${this.nome || 'Jogador'} rolou ${valor}`);
      this.rolando = false;
    },

    rolarD10() { return this.rolarDado(10, "D10"); },
    rolarD4() { return this.rolarDado(4, "D4"); },
    
    toggleUltimasRolagens() {
      this.ultimasRolagensVisiveis = !this.ultimasRolagensVisiveis;
    },

    // --- Ações de Mestre ---
    async alterarAcoes(idFicha, novoValor) {
      // O GM edita diretamente a ficha do jogador no metadado
      try {
        // Pega a ficha atual para não perder dados
        const fichaAtual = this.fichas[idFicha];
        if (!fichaAtual) return;

        // Clona e atualiza apenas as ações
        const updatePayload = {
          ...fichaAtual, // Mantém tudo que o jogador salvou
          _acoes: novoValor,
          _updateId: Math.random().toString(36).substring(7) // Força update
        };
        
        // Array de rolagens precisa virar string para salvar
        if (Array.isArray(updatePayload.ultimasRolagens)) {
            updatePayload.ultimasRolagens = updatePayload.ultimasRolagens.join("|");
        }

        await OBR.room.setMetadata({ [idFicha]: updatePayload });
        this.log(`🔧 Ações de ${fichaAtual.nome} alteradas para ${novoValor}`);
      } catch (e) {
        this.log("❌ Erro GM: " + e.message);
      }
    },

    async salvarMonstros() {
      try {
        const compact = this.monstros.map(m => `${m.nome || ''},${m.vida}`).join("|");
        await OBR.room.setMetadata({ monstros: compact });
      } catch (e) { this.log("❌ Erro Monstros: " + e.message); }
    },

    adicionarMonstro() { this.monstros.push({ vida: 10 }); this.salvarMonstros(); },
    
    limparMonstros() {
      if (confirm("Remover monstros?")) {
        this.monstros = [];
        this.salvarMonstros();
      }
    },

    async limparFichas() {
      if (!this.isMestre || !confirm("Limpar TODAS as fichas?")) return;
      try {
        const roomData = await OBR.room.getMetadata();
        const deletar = {};
        for (const key in roomData) {
          if (key.startsWith("ficha-")) deletar[key] = undefined; // undefined deleta a chave
        }
        await OBR.room.setMetadata(deletar);
        this.fichas = {};
        this.log("🧹 Sala limpa.");
      } catch (e) { this.log("❌ Erro Limpeza: " + e.message); }
    },

    // --- Utilitários ---
    trocarPagina(p) { this.page = p; },
    
    toggleInventario(id) {
      // Compatibilidade Vue 2/3
      if (this.inventarioExpandido[id]) delete this.inventarioExpandido[id];
      else this.inventarioExpandido[id] = true;
      // Força reatividade se necessário (depende da versão do Vue no OBR, mas o assign acima costuma bastar)
      this.inventarioExpandido = { ...this.inventarioExpandido };
    },

    log(msg) {
      console.log("[Ficha] " + msg);
      this.logs.unshift(new Date().toLocaleTimeString().slice(0,5) + " " + msg);
      if (this.logs.length > 20) this.logs.pop();
    }
  },

  template: `
    <div>
      <nav>
        <button :class="{active: page==='player'}" @click="trocarPagina('player')">Jogador</button>
        <button v-if="isMestre" :class="{active: page==='master'}" @click="trocarPagina('master')">Mestre</button>
      </nav>

      <div v-if="page==='player'" class="sheet">
        <div class="field">
          <label>Nome</label>
          <input v-model="nome" placeholder="Seu nome" />
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
              <option>Combatente</option><option>Arruinado</option>
            </select>
          </div>
          <div class="stat-box" style="text-align:center;">
            <label class="label" style="margin-bottom:6px; display:block;">Atributo</label>
            <select v-model="atributo" style="width:100%; text-align:center;">
              <option>Força</option><option>Destreza</option><option>Intelecto</option><option>Vigor</option>
            </select>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-box" style="padding: 14px;">
            <button @click="rolarD10" :disabled="rolando" class="btn-roll">Rolar D10</button>
          </div>
          <div class="stat-box" style="padding: 14px;">
            <button @click="rolarD4" :disabled="rolando" class="btn-roll">Rolar D4</button>
          </div>
        </div>

        <div class="field" v-if="ultimoResultado" style="position:relative; display:flex; flex-direction:column;">
          <div style="display:flex; align-items:center; gap:6px; width:100%;">
            <label>Resultado</label>
            <div style="font-size:22px; font-weight:bold;">{{ ultimoResultado }}</div>
            <button @click="toggleUltimasRolagens" class="btn-mini" style="margin-left:auto;">⟳</button>
            
            <div v-if="ultimasRolagensVisiveis" class="dropdown-results">
              <div v-for="(r, i) in ultimasRolagens" :key="i">{{ r }}</div>
            </div>
          </div>
        </div>

        <div class="field">
          <label>Inventário</label>
          <textarea v-model="inventario" rows="5" placeholder="Itens..."></textarea>
        </div>
      </div>

      <div v-if="page==='master' && isMestre" class="master">
        <div style="text-align: center; margin: 5px 0;">
          <button @click="limparFichas" class="btn-danger">Limpar Fichas</button>
        </div>

        <div v-if="Object.keys(fichas).length === 0" style="text-align:center;">Aguardando jogadores...</div>

        <div v-for="(ficha, id) in fichas" :key="id" class="ficha">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h2 style="margin:0;">{{ ficha.nome || '...' }} <small>({{ ficha.tipo }})</small></h2>
            <div class="stat-controls">
              <button @click="alterarAcoes(id, (ficha._acoes ?? 3) - 1)">−</button>
              <span>{{ ficha._acoes ?? 3 }}</span>
              <button @click="alterarAcoes(id, (ficha._acoes ?? 3) + 1)">+</button>
            </div>
          </div>
          <p>❤️ {{ ficha.vida }} | 💀 {{ ficha.ruina }} | 💪 {{ ficha.atributo }}</p>
          
          <div style="font-size:12px; margin-top:6px;">
            <button @click="toggleInventario(id)" class="btn-mini-dark">
              {{ inventarioExpandido[id] ? 'Ocultar Inv.' : 'Ver Inv.' }}
            </button>
            <div v-if="inventarioExpandido[id]" class="inv-box">{{ ficha.inventario || 'Vazio' }}</div>
          </div>
          
          <p class="roll-history">{{ ficha.ultimasRolagens.length ? ficha.ultimasRolagens.join(' | ') : 'Sem rolagens' }}</p>
        </div>

        <div style="margin-top:20px; border-top:1px solid #444; paddingTop:10px;">
          <div style="display:flex; justify-content:center; gap:10px; margin-bottom:10px;">
            <button @click="adicionarMonstro" class="btn-primary">Add Monstro</button>
            <button @click="limparMonstros" class="btn-danger">Limpar</button>
          </div>

          <div class="grid-monsters">
            <div v-for="(m, index) in monstros" :key="index" class="monster-card">
              <span contenteditable="true" @input="m.nome = $event.target.innerText; salvarMonstros()" class="editable">{{ m.nome }}</span>
              <div class="stat-controls mini">
                <button @click="m.vida--; salvarMonstros()">−</button>
                <span>{{ m.vida }}</span>
                <button @click="m.vida++; salvarMonstros()">+</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="logs.length" class="debug-box">
          <div v-for="(log, i) in logs" :key="i">{{ log }}</div>
        </div>
      </div>
    </div>
  `,
};

// --- CSS Injetado (Para limpar o template) ---
const styles = document.createElement("style");
styles.innerHTML = `
  .sheet, .master { padding: 10px; font-family: sans-serif; }
  .field { margin-bottom: 10px; }
  label { display: block; font-size: 0.8em; color: #ccc; margin-bottom: 2px; }
  input, select, textarea { width: 100%; box-sizing: border-box; background: #222; border: 1px solid #444; color: white; padding: 6px; border-radius: 4px; }
  textarea { resize: vertical; }
  
  .stats-row { display: flex; gap: 10px; margin-bottom: 10px; }
  .stat-box { flex: 1; background: #1a1a1a; padding: 8px; border-radius: 6px; border: 1px solid #333; }
  .stat-controls { display: flex; align-items: center; justify-content: space-between; background: #000; padding: 2px; border-radius: 4px; }
  .stat-controls button { width: 25px; height: 25px; border: none; background: #333; color: white; cursor: pointer; border-radius: 3px; }
  .stat-controls .value { font-weight: bold; font-size: 1.1em; }
  
  .btn-roll { width: 100%; padding: 10px; border: none; border-radius: 6px; background: linear-gradient(135deg, #7C5CFF, #9B7BFF); color: white; font-weight: bold; cursor: pointer; transition: 0.2s; }
  .btn-roll:hover { filter: brightness(1.1); transform: translateY(-1px); }
  .btn-roll:disabled { opacity: 0.5; cursor: wait; }
  
  .btn-mini { border: none; background: #7C5CFF; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; padding: 2px 6px; }
  .btn-mini-dark { border: none; background: #333; color: white; border-radius: 4px; cursor: pointer; font-size: 10px; padding: 2px 6px; }
  .btn-primary { border: none; background: #444; color: white; border-radius: 4px; cursor: pointer; padding: 6px 12px; font-weight: bold; }
  .btn-danger { border: none; background: #800; color: white; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-weight: bold; font-size: 12px;}
  
  .dropdown-results { position: absolute; bottom: 30px; right: 0; background: #222; border: 1px solid #555; padding: 5px; border-radius: 4px; z-index: 100; font-size: 0.9em; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
  
  .ficha { background: #161616; padding: 10px; margin-bottom: 10px; border-radius: 6px; border-left: 3px solid #7C5CFF; }
  .ficha p { margin: 4px 0; font-size: 0.9em; color: #ddd; }
  .inv-box { background: #111; padding: 5px; font-size: 0.8em; margin-top: 4px; white-space: pre-wrap; border-radius: 3px; }
  .roll-history { font-family: monospace; color: #aaa; font-size: 0.85em; }
  
  .grid-monsters { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .monster-card { background: #222; padding: 6px; border-radius: 4px; display: flex; flex-direction: column; gap: 4px; }
  .editable { background: #111; padding: 2px 4px; border-radius: 2px; min-width: 20px; display: inline-block; }
  
  .debug-box { margin-top: 20px; font-size: 10px; color: #666; max-height: 100px; overflow-y: auto; background: #000; padding: 5px; }
  
  nav { display: flex; gap: 5px; margin-bottom: 10px; }
  nav button { flex: 1; padding: 8px; background: #222; border: 1px solid #444; color: #888; cursor: pointer; }
  nav button.active { background: #7C5CFF; color: white; border-color: #7C5CFF; }
`;
document.head.appendChild(styles);

Vue.createApp(App).mount("#app");
