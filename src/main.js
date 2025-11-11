const { OBR } = window

const App = {
  data() {
    return {
      page: "player", // ou "master"
      nome: "",
      vida: 10,
      mana: 5,
      tipo: "Combatente",
      atributo: "Força",
      inventario: "",
      fichas: {},
      salvarTimeout: null
    }
  },

  mounted() {
    OBR.onReady(async () => {
  alert("OBR carregado!");
  const playerId = await OBR.player.getId();
  console.log("Meu ID:", playerId);


      // --- Carregar todas as fichas ---
      const metadata = await OBR.room.getMetadata()
      this.atualizarFichas(metadata)

      // --- Carregar ficha do jogador atual ---
      const minhaFicha = metadata[`ficha-${playerId}`]
      if (minhaFicha) Object.assign(this, minhaFicha)

      // --- Escutar mudanças em metadados (sincronização ao vivo) ---
      OBR.room.onMetadataChange(async (meta) => {
        this.atualizarFichas(meta)
      })
    })
  },

  watch: {
    nome: "salvarFicha",
    vida: "salvarFicha",
    mana: "salvarFicha",
    tipo: "salvarFicha",
    atributo: "salvarFicha",
    inventario: "salvarFicha"
  },

  methods: {
    atualizarFichas(metadata) {
      const novas = {}
      for (const [key, value] of Object.entries(metadata)) {
        if (key.startsWith("ficha-")) novas[key] = value
      }
      this.fichas = novas
    },

    salvarFicha() {
      clearTimeout(this.salvarTimeout)
      this.salvarTimeout = setTimeout(async () => {
        const playerId = await OBR.player.getId()
        await OBR.room.setMetadata({
          [`ficha-${playerId}`]: {
            nome: this.nome,
            vida: this.vida,
            mana: this.mana,
            tipo: this.tipo,
            atributo: this.atributo,
            inventario: this.inventario
          }
        })
      }, 500)
    },

    trocarPagina(p) {
      this.page = p
    }
  },

  template: `
    <div>
      <nav>
        <button :class="{active: page==='player'}" @click="trocarPagina('player')">Jogador</button>
        <button :class="{active: page==='master'}" @click="trocarPagina('master')">Mestre</button>
      </nav>

      <div v-if="page==='player'" class="sheet">
        <h1>Ficha ONE</h1>
        <div class="field"><label>Nome:</label><input v-model="nome" placeholder="Digite o nome" /></div>
        <div class="field row"><label>Vida:</label><button @click="vida--">−</button><span>{{vida}}</span><button @click="vida++">+</button></div>
        <div class="field row"><label>Mana:</label><button @click="mana--">−</button><span>{{mana}}</span><button @click="mana++">+</button></div>
        <div class="field"><label>Tipo:</label><select v-model="tipo"><option>Combatente</option><option>Conjurador</option></select></div>
        <div class="field"><label>Atributo:</label><select v-model="atributo"><option>Força</option><option>Destreza</option><option>Intelecto</option><option>Vigor</option></select></div>
        <div class="field"><label>Inventário:</label><textarea v-model="inventario" rows="5" placeholder="Anote itens"></textarea></div>
      </div>

      <div v-else class="master">
        <h1>Fichas dos Jogadores</h1>
        <div v-if="Object.keys(fichas).length === 0">
          Nenhum jogador conectado ainda.
        </div>
        <div v-for="(ficha,id) in fichas" :key="id" class="ficha">
          <h2>{{ ficha.nome || 'Sem nome' }}</h2>
          <p>Vida: {{ ficha.vida }} | Mana: {{ ficha.mana }} | {{ ficha.atributo }}</p>
          <p>{{ ficha.tipo }}</p>
          <p>{{ ficha.inventario }}</p>
        </div>
      </div>
    </div>
  `
}

Vue.createApp(App).mount("#app")
