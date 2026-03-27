# Plano Tecnico - EP03: Gestao de Carteiras

## 1. Visao Geral da Arquitetura

```
+------------------------------------------------------------------+
|                    ARQUITETURA DE CARTEIRAS                       |
+------------------------------------------------------------------+

  +------------------+     +------------------+     +-------------+
  |  Wallet Router   |---->|  Wallet Manager  |---->|  Wallet DAO |
  | (Express Routes) |     | (Business Logic) |     |  (MongoDB)  |
  +------------------+     +------------------+     +-------------+
           |                       |                       |
           |                       |                       v
           |                       |              +------------------+
           |                       |              |   Wallet Model   |
           |                       |              | (Mongoose Schema)|
           |                       |              +------------------+
           |                       |
           v                       v
  +------------------+     +------------------+
  | JWT Middleware   |     | Position Manager |
  | (Auth)           |     | (Calculos)       |
  +------------------+     +------------------+
           |                       |
           v                       v
  +------------------+     +------------------+
  |     Redis        |     | Transaction DAO  |
  | (Cache/Sessao)   |     | (Transacoes)     |
  +------------------+     +------------------+
```

### Diagrama de Contexto

```
+------------------------------------------------------------------+
|                    FLUXO DE DADOS DE CARTEIRA                     |
+------------------------------------------------------------------+

  [Usuario Autenticado]
          |
          | 1. Seleciona/Cria Carteira
          v
  +------------------+
  |  Wallet Selector |  <-- Componente Frontend
  +------------------+
          |
          | 2. API Request
          v
  +------------------+
  |  Wallet Router   |  <-- Backend
  +------------------+
          |
          | 3. Business Logic
          v
  +------------------+
  |  Wallet Manager  |
  +------------------+
          |
          +---> [MongoDB] Persistencia
          |
          +---> [Redis] Cache de carteira ativa
          |
          +---> [Position Manager] Calculos de posicao
```

---

## 2. Componentes Backend

### 2.1 Models (Mongoose Schemas)

#### wallet-model.js

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const walletSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    default: uuidv4,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  currency: {
    type: String,
    enum: ['BRL', 'USD', 'EUR'],
    default: 'BRL',
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  versionKey: false,
  timestamps: true,
})

// Indices
walletSchema.index({ userId: 1, name: 1 }, { unique: true })
walletSchema.index({ userId: 1, isActive: 1 })
walletSchema.index({ userId: 1, isDeleted: 1 })

module.exports = { walletSchema }
```

### 2.2 DAOs

#### wallet-dao.js

```javascript
const AppDAO = require('../app-dao')
const { walletSchema } = require('./wallet-model')

class WalletDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    return db.model('wallet', walletSchema)
  }

  // ==================== CREATE ====================

  async create(walletData) {
    const wallet = new this.objectModel(walletData)
    return await wallet.save()
  }

  // ==================== READ ====================

  async findByUserId(userId) {
    return await this.objectModel
      .find({ userId, isDeleted: false })
      .sort({ isActive: -1, createdAt: 1 })
      .lean()
      .exec()
  }

  async findById(walletId) {
    return await this.objectModel
      .findById(walletId)
      .lean()
      .exec()
  }

  async findByUserIdAndName(userId, name) {
    return await this.objectModel
      .findOne({
        userId,
        name: { $regex: new RegExp(`^${name}$`, 'i') }, // case-insensitive
        isDeleted: false,
      })
      .lean()
      .exec()
  }

  async findActiveByUserId(userId) {
    return await this.objectModel
      .findOne({ userId, isActive: true, isDeleted: false })
      .lean()
      .exec()
  }

  async countByUserId(userId) {
    return await this.objectModel
      .countDocuments({ userId, isDeleted: false })
  }

  async findOldestActive(userId) {
    return await this.objectModel
      .findOne({ userId, isDeleted: false })
      .sort({ createdAt: 1 })
      .lean()
      .exec()
  }

  // ==================== UPDATE ====================

  async update(walletId, userId, updateData) {
    return await this.objectModel
      .findOneAndUpdate(
        { _id: walletId, userId },
        { $set: { ...updateData, updatedAt: new Date() } },
        { new: true }
      )
      .lean()
      .exec()
  }

  async activate(walletId, userId) {
    return await this.objectModel
      .findOneAndUpdate(
        { _id: walletId, userId, isDeleted: false },
        { $set: { isActive: true, updatedAt: new Date() } },
        { new: true }
      )
      .lean()
      .exec()
  }

  async deactivateAll(userId) {
    return await this.objectModel
      .updateMany(
        { userId, isDeleted: false },
        { $set: { isActive: false, updatedAt: new Date() } }
      )
  }

  // ==================== DELETE ====================

  async softDelete(walletId, userId) {
    return await this.objectModel
      .findOneAndUpdate(
        { _id: walletId, userId },
        { $set: { isDeleted: true, isActive: false, updatedAt: new Date() } },
        { new: true }
      )
      .lean()
      .exec()
  }
}

module.exports = WalletDAO
```

### 2.3 Managers

#### wallet-manager.js

```javascript
const WalletDAO = require('./wallet-dao')
const APP_CONSTANTS = require('../app-constants')

class WalletManager {
  constructor(appManager) {
    this.appManager = appManager
    this.walletDAO = new WalletDAO(appManager.getDb())
    this.redisClient = appManager.getRedisClient()
  }

  // ==================== CRIAR CARTEIRA ====================

  async create({ userId, name, currency = 'BRL' }) {
    // Validar nome
    this._validateName(name)

    // Verificar nome unico (case-insensitive)
    const existingWallet = await this.walletDAO.findByUserIdAndName(userId, name)
    if (existingWallet) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.WALLET_ALREADY_EXISTS)
    }

    // Verificar se e a primeira carteira
    const walletCount = await this.walletDAO.countByUserId(userId)
    const isFirstWallet = walletCount === 0

    // Criar carteira
    const wallet = await this.walletDAO.create({
      userId,
      name: name.trim(),
      currency,
      isActive: isFirstWallet, // Primeira carteira e ativa por padrao
      isDeleted: false,
    })

    // Invalidar cache
    await this._invalidateUserCache(userId)

    return wallet
  }

  // ==================== LISTAR CARTEIRAS ====================

  async listByUser({ userId }) {
    return await this.walletDAO.findByUserId(userId)
  }

  // ==================== ATIVAR CARTEIRA ====================

  async activate({ userId, walletId }) {
    // Verificar se a carteira existe e pertence ao usuario
    const wallet = await this.walletDAO.findById(walletId)
    if (!wallet || wallet.userId !== userId || wallet.isDeleted) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.WALLET_NOT_FOUND)
    }

    // Desativar todas as carteiras do usuario
    await this.walletDAO.deactivateAll(userId)

    // Ativar a carteira selecionada
    const activatedWallet = await this.walletDAO.activate(walletId, userId)

    // Atualizar cache Redis
    await this._setActiveWalletCache(userId, walletId)

    // Invalidar cache de lista
    await this._invalidateUserCache(userId)

    return activatedWallet
  }

  // ==================== EDITAR CARTEIRA ====================

  async update({ userId, walletId, name, currency }) {
    // Verificar se a carteira existe
    const wallet = await this.walletDAO.findById(walletId)
    if (!wallet || wallet.userId !== userId || wallet.isDeleted) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.WALLET_NOT_FOUND)
    }

    const updateData = {}

    // Validar e atualizar nome
    if (name && name !== wallet.name) {
      this._validateName(name)
      
      // Verificar nome unico
      const existingWallet = await this.walletDAO.findByUserIdAndName(userId, name)
      if (existingWallet && existingWallet._id !== walletId) {
        this.appManager.handleError(APP_CONSTANTS.ERRORS.WALLET_ALREADY_EXISTS)
      }
      
      updateData.name = name.trim()
    }

    // Validar e atualizar moeda
    if (currency && currency !== wallet.currency) {
      // Verificar se ha transacoes na carteira
      const hasTransactions = await this._hasTransactions(walletId)
      if (hasTransactions) {
        this.appManager.handleError(APP_CONSTANTS.ERRORS.WALLET_CANNOT_CHANGE_CURRENCY)
      }
      updateData.currency = currency
    }

    // Atualizar carteira
    const updatedWallet = await this.walletDAO.update(walletId, userId, updateData)

    // Invalidar cache
    await this._invalidateUserCache(userId)

    return updatedWallet
  }

  // ==================== EXCLUIR CARTEIRA ====================

  async delete({ userId, walletId }) {
    // Verificar se a carteira existe
    const wallet = await this.walletDAO.findById(walletId)
    if (!wallet || wallet.userId !== userId || wallet.isDeleted) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.WALLET_NOT_FOUND)
    }

    // Verificar se e a unica carteira
    const walletCount = await this.walletDAO.countByUserId(userId)
    if (walletCount <= 1) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.WALLET_CANNOT_DELETE_ONLY)
    }

    // Soft delete
    const deletedWallet = await this.walletDAO.softDelete(walletId, userId)

    // Se a carteira era ativa, ativar outra
    let activatedWallet = null
    if (wallet.isActive) {
      const oldestWallet = await this.walletDAO.findOldestActive(userId)
      if (oldestWallet) {
        activatedWallet = await this.walletDAO.activate(oldestWallet._id, userId)
        await this._setActiveWalletCache(userId, oldestWallet._id)
      }
    }

    // Invalidar cache
    await this._invalidateUserCache(userId)

    return {
      deleted: deletedWallet,
      activated: activatedWallet,
    }
  }

  // ==================== VISAO CONSOLIDADA ====================

  async getConsolidated({ userId }) {
    // Buscar todas as carteiras do usuario
    const wallets = await this.walletDAO.findByUserId(userId)

    // Para cada carteira, calcular subtotal
    const consolidatedWallets = []
    let totalBRL = 0

    for (const wallet of wallets) {
      const subtotal = await this._calculateWalletSubtotal(wallet)
      
      // Converter para BRL se necessario
      let subtotalBRL = subtotal
      let exchangeRate = null

      if (wallet.currency !== 'BRL') {
        // TODO: Integrar com EP06 (Cambio) para conversao
        // Por enquanto, retorna null indicando conversao indisponivel
        subtotalBRL = null
      }

      consolidatedWallets.push({
        _id: wallet._id,
        name: wallet.name,
        currency: wallet.currency,
        subtotalOriginal: subtotal,
        subtotalBRL,
        exchangeRate,
      })

      if (subtotalBRL !== null) {
        totalBRL += subtotalBRL
      }
    }

    return {
      totalBRL,
      exchangeRateDate: new Date().toISOString().split('T')[0],
      exchangeAvailable: true, // TODO: Verificar disponibilidade do servico de cambio
      wallets: consolidatedWallets,
    }
  }

  // ==================== HELPERS ====================

  _validateName(name) {
    if (!name || name.trim().length === 0) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.WALLET_NAME_REQUIRED)
    }
    if (name.trim().length > 50) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.WALLET_NAME_TOO_LONG)
    }
  }

  async _hasTransactions(walletId) {
    // TODO: Integrar com TransactionDAO do EP04
    // Por enquanto, retorna false
    return false
  }

  async _calculateWalletSubtotal(wallet) {
    // TODO: Integrar com PositionManager do EP05
    // Por enquanto, retorna 0
    return 0
  }

  async _setActiveWalletCache(userId, walletId) {
    const key = `activeWallet:${userId}`
    await this.redisClient.set(key, walletId, { EX: 86400 }) // 24 horas
  }

  async _invalidateUserCache(userId) {
    const pattern = `wallets:${userId}:*`
    const keys = await this.redisClient.keys(pattern)
    if (keys.length > 0) {
      await this.redisClient.del(keys)
    }
  }
}

module.exports = WalletManager
```

### 2.4 Routers

#### wallet-router.js

```javascript
const express = require('express')
const APP_CONSTANTS = require('../app-constants')
const jwtMiddleware = require('../auth/jwt-middleware')

class WalletRouter {
  static handleError(exception, res) {
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getRoutes(appManager) {
    const router = express.Router()
    const walletManager = appManager.getWalletManager()

    // Aplicar middleware JWT
    router.use(jwtMiddleware(appManager, appManager.config))

    // GET /api/wallets - Listar carteiras
    router.get('/wallets', async (req, res) => {
      try {
        const wallets = await walletManager.listByUser({
          userId: req.user.userId,
        })
        res.status(200).send(wallets)
      } catch (exception) {
        WalletRouter.handleError(exception, res)
      }
    })

    // POST /api/wallets - Criar carteira
    router.post('/wallets', async (req, res) => {
      try {
        const wallet = await walletManager.create({
          userId: req.user.userId,
          ...req.body,
        })
        res.status(201).send(wallet)
      } catch (exception) {
        WalletRouter.handleError(exception, res)
      }
    })

    // GET /api/wallets/consolidated - Visao consolidada
    router.get('/wallets/consolidated', async (req, res) => {
      try {
        const consolidated = await walletManager.getConsolidated({
          userId: req.user.userId,
        })
        res.status(200).send(consolidated)
      } catch (exception) {
        WalletRouter.handleError(exception, res)
      }
    })

    // GET /api/wallets/:id - Obter carteira especifica
    router.get('/wallets/:id', async (req, res) => {
      try {
        const wallet = await walletManager.getById({
          userId: req.user.userId,
          walletId: req.params.id,
        })
        res.status(200).send(wallet)
      } catch (exception) {
        WalletRouter.handleError(exception, res)
      }
    })

    // PUT /api/wallets/:id - Editar carteira
    router.put('/wallets/:id', async (req, res) => {
      try {
        const wallet = await walletManager.update({
          userId: req.user.userId,
          walletId: req.params.id,
          ...req.body,
        })
        res.status(200).send(wallet)
      } catch (exception) {
        WalletRouter.handleError(exception, res)
      }
    })

    // DELETE /api/wallets/:id - Excluir carteira
    router.delete('/wallets/:id', async (req, res) => {
      try {
        const result = await walletManager.delete({
          userId: req.user.userId,
          walletId: req.params.id,
        })
        res.status(200).send({
          message: 'Carteira excluida com sucesso',
          activatedWallet: result.activated,
        })
      } catch (exception) {
        WalletRouter.handleError(exception, res)
      }
    })

    // PUT /api/wallets/:id/activate - Ativar carteira
    router.put('/wallets/:id/activate', async (req, res) => {
      try {
        const wallet = await walletManager.activate({
          userId: req.user.userId,
          walletId: req.params.id,
        })
        res.status(200).send(wallet)
      } catch (exception) {
        WalletRouter.handleError(exception, res)
      }
    })

    return router
  }
}

module.exports = WalletRouter
```

---

## 3. Componentes Frontend

### 3.1 Pages

| Pagina | Arquivo | Rota | Descricao |
|--------|---------|------|-----------|
| WalletSettingsPage | `src/pages/WalletSettingsPage.vue` | `/settings/wallets` | Gerenciar carteiras |
| ConsolidatedView | `src/pages/ConsolidatedView.vue` | `/consolidated` | Visao consolidada |

### 3.2 Components

#### WalletSelector.vue

```vue
<template>
  <div class="wallet-selector">
    <button class="selector-button" @click="toggleDropdown">
      <span class="wallet-name">{{ activeWallet?.name || 'Selecione...' }}</span>
      <span class="active-badge" v-if="activeWallet">Ativa</span>
      <ChevronIcon :class="{ rotated: isOpen }" />
    </button>

    <div class="dropdown" v-if="isOpen">
      <button
        class="consolidated-option"
        @click="selectConsolidated"
      >
        <ChartIcon />
        <span>Visao Consolidada</span>
      </button>

      <div class="divider"></div>

      <div class="wallet-list">
        <button
          v-for="wallet in wallets"
          :key="wallet._id"
          :class="['wallet-item', { active: wallet.isActive }]"
          @click="selectWallet(wallet)"
        >
          <span class="wallet-name">{{ wallet.name }}</span>
          <span class="currency-badge">{{ wallet.currency }}</span>
          <CheckIcon v-if="wallet.isActive" class="check-icon" />
        </button>
      </div>

      <div class="divider"></div>

      <button class="create-button" @click="openCreateModal">
        <PlusIcon />
        <span>Nova Carteira</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWalletStore } from '@/stores/wallet-store'
import { useRouter } from 'vue-router'

const walletStore = useWalletStore()
const router = useRouter()

const isOpen = ref(false)

const wallets = computed(() => walletStore.wallets)
const activeWallet = computed(() => walletStore.activeWallet)

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const selectWallet = async (wallet) => {
  await walletStore.activateWallet(wallet._id)
  isOpen.value = false
}

const selectConsolidated = () => {
  walletStore.setConsolidatedMode(true)
  router.push('/consolidated')
  isOpen.value = false
}

const openCreateModal = () => {
  walletStore.openCreateModal()
  isOpen.value = false
}

onMounted(() => {
  walletStore.fetchWallets()
})
</script>
```

#### CreateWalletModal.vue

```vue
<template>
  <Modal :isOpen="isOpen" @close="close">
    <template #header>
      <h2>Nova Carteira</h2>
    </template>

    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="name">Nome da Carteira</label>
        <input
          id="name"
          v-model="form.name"
          type="text"
          placeholder="Ex: Longo Prazo"
          maxlength="50"
          :disabled="isLoading"
          required
        />
        <span class="char-count">{{ form.name.length }}/50</span>
        <span v-if="errors.name" class="error">{{ errors.name }}</span>
      </div>

      <div class="form-group">
        <label for="currency">Moeda</label>
        <select id="currency" v-model="form.currency" :disabled="isLoading">
          <option value="BRL">BRL - Real Brasileiro</option>
          <option value="USD">USD - Dolar Americano</option>
          <option value="EUR">EUR - Euro</option>
        </select>
      </div>

      <div class="actions">
        <Button type="button" variant="secondary" @click="close">
          Cancelar
        </Button>
        <Button type="submit" variant="primary" :loading="isLoading">
          Criar Carteira
        </Button>
      </div>
    </form>
  </Modal>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { useWalletStore } from '@/stores/wallet-store'
import Modal from '@/components/ui/Modal.vue'
import Button from '@/components/ui/Button.vue'

const walletStore = useWalletStore()

const props = defineProps({
  isOpen: Boolean,
})

const emit = defineEmits(['close'])

const form = reactive({
  name: '',
  currency: 'BRL',
})

const errors = reactive({
  name: '',
})

const isLoading = ref(false)

const close = () => {
  form.name = ''
  form.currency = 'BRL'
  errors.name = ''
  emit('close')
}

const handleSubmit = async () => {
  isLoading.value = true
  errors.name = ''

  try {
    await walletStore.createWallet({
      name: form.name,
      currency: form.currency,
    })
    close()
  } catch (error) {
    if (error.message.includes('ja existe')) {
      errors.name = 'Ja existe uma carteira com este nome'
    } else {
      errors.name = error.message
    }
  } finally {
    isLoading.value = false
  }
}
</script>
```

#### DeleteWalletDialog.vue

```vue
<template>
  <Modal :isOpen="isOpen" @close="close">
    <template #header>
      <h2>Excluir Carteira</h2>
    </template>

    <div class="warning">
      <WarningIcon />
      <p>Esta acao nao pode ser desfeita. A carteira "{{ wallet?.name }}" sera excluida.</p>
    </div>

    <div class="form-group">
      <label>Para confirmar, digite o nome da carteira:</label>
      <input
        v-model="confirmName"
        type="text"
        :placeholder="wallet?.name"
      />
    </div>

    <div class="actions">
      <Button variant="secondary" @click="close">
        Cancelar
      </Button>
      <Button
        variant="danger"
        :disabled="!isConfirmed"
        :loading="isLoading"
        @click="handleDelete"
      >
        Excluir Carteira
      </Button>
    </div>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWalletStore } from '@/stores/wallet-store'
import Modal from '@/components/ui/Modal.vue'
import Button from '@/components/ui/Button.vue'

const walletStore = useWalletStore()

const props = defineProps({
  isOpen: Boolean,
  wallet: Object,
})

const emit = defineEmits(['close', 'deleted'])

const confirmName = ref('')
const isLoading = ref(false)

const isConfirmed = computed(() => {
  return confirmName.value.toLowerCase() === props.wallet?.name?.toLowerCase()
})

const close = () => {
  confirmName.value = ''
  emit('close')
}

const handleDelete = async () => {
  isLoading.value = true

  try {
    await walletStore.deleteWallet(props.wallet._id)
    emit('deleted')
    close()
  } catch (error) {
    console.error('Erro ao excluir:', error)
  } finally {
    isLoading.value = false
  }
}
</script>
```

### 3.3 Services

#### wallet-service.js

```javascript
import api from './api'

class WalletService {
  async getWallets() {
    return await api.get('/wallets')
  }

  async getWallet(walletId) {
    return await api.get(`/wallets/${walletId}`)
  }

  async createWallet(data) {
    return await api.post('/wallets', data)
  }

  async updateWallet(walletId, data) {
    return await api.put(`/wallets/${walletId}`, data)
  }

  async deleteWallet(walletId) {
    return await api.delete(`/wallets/${walletId}`)
  }

  async activateWallet(walletId) {
    return await api.put(`/wallets/${walletId}/activate`)
  }

  async getConsolidated() {
    return await api.get('/wallets/consolidated')
  }
}

export default new WalletService()
```

### 3.4 Store/State

#### wallet-store.js (Pinia)

```javascript
import { defineStore } from 'pinia'
import walletService from '@/services/wallet-service'

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    wallets: [],
    activeWallet: null,
    isConsolidatedMode: false,
    isCreateModalOpen: false,
    isLoading: false,
    error: null,
  }),

  getters: {
    hasWallets: (state) => state.wallets.length > 0,
    walletCount: (state) => state.wallets.length,
  },

  actions: {
    async fetchWallets() {
      this.isLoading = true
      this.error = null

      try {
        const wallets = await walletService.getWallets()
        this.wallets = wallets
        this.activeWallet = wallets.find((w) => w.isActive) || null
      } catch (error) {
        this.error = error.message
      } finally {
        this.isLoading = false
      }
    },

    async createWallet(data) {
      this.isLoading = true
      this.error = null

      try {
        const wallet = await walletService.createWallet(data)
        this.wallets.push(wallet)
        
        // Se for a primeira carteira, definir como ativa
        if (wallet.isActive) {
          this.activeWallet = wallet
        }
        
        return wallet
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async updateWallet(walletId, data) {
      this.isLoading = true
      this.error = null

      try {
        const updatedWallet = await walletService.updateWallet(walletId, data)
        
        const index = this.wallets.findIndex((w) => w._id === walletId)
        if (index !== -1) {
          this.wallets[index] = updatedWallet
        }
        
        if (this.activeWallet?._id === walletId) {
          this.activeWallet = updatedWallet
        }
        
        return updatedWallet
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async deleteWallet(walletId) {
      this.isLoading = true
      this.error = null

      try {
        const result = await walletService.deleteWallet(walletId)
        
        this.wallets = this.wallets.filter((w) => w._id !== walletId)
        
        if (this.activeWallet?._id === walletId) {
          this.activeWallet = this.wallets.find((w) => w.isActive) || null
        }
        
        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async activateWallet(walletId) {
      this.isLoading = true
      this.error = null
      this.isConsolidatedMode = false

      try {
        const activatedWallet = await walletService.activateWallet(walletId)
        
        // Atualizar estado local
        this.wallets = this.wallets.map((w) => ({
          ...w,
          isActive: w._id === walletId,
        }))
        
        this.activeWallet = activatedWallet
        
        return activatedWallet
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async getConsolidated() {
      this.isLoading = true
      this.error = null

      try {
        return await walletService.getConsolidated()
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    setConsolidatedMode(value) {
      this.isConsolidatedMode = value
      if (value) {
        this.activeWallet = null
      }
    },

    openCreateModal() {
      this.isCreateModalOpen = true
    },

    closeCreateModal() {
      this.isCreateModalOpen = false
    },
  },
})
```

---

## 4. API Contracts

### OpenAPI Specification

```yaml
openapi: 3.0.0
info:
  title: MoneyTrackr Wallet API
  version: 1.0.0

paths:
  /wallets:
    get:
      summary: Listar carteiras do usuario
      tags: [Wallets]
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Lista de carteiras
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Wallet'

    post:
      summary: Criar nova carteira
      tags: [Wallets]
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name:
                  type: string
                  minLength: 1
                  maxLength: 50
                currency:
                  type: string
                  enum: [BRL, USD, EUR]
                  default: BRL
      responses:
        '201':
          description: Carteira criada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Wallet'
        '400':
          description: Nome invalido
        '409':
          description: Nome ja existe

  /wallets/{id}:
    get:
      summary: Obter carteira por ID
      tags: [Wallets]
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Carteira encontrada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Wallet'
        '404':
          description: Carteira nao encontrada

    put:
      summary: Editar carteira
      tags: [Wallets]
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                currency:
                  type: string
                  enum: [BRL, USD, EUR]
      responses:
        '200':
          description: Carteira atualizada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Wallet'
        '409':
          description: Nome ja existe
        '422':
          description: Nao pode alterar moeda com transacoes

    delete:
      summary: Excluir carteira (soft delete)
      tags: [Wallets]
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Carteira excluida
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                  activatedWallet:
                    $ref: '#/components/schemas/Wallet'
        '422':
          description: Nao pode excluir unica carteira

  /wallets/{id}/activate:
    put:
      summary: Ativar carteira
      tags: [Wallets]
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Carteira ativada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Wallet'
        '404':
          description: Carteira nao encontrada

  /wallets/consolidated:
    get:
      summary: Visao consolidada de todas as carteiras
      tags: [Wallets]
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Dados consolidados
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Consolidated'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Wallet:
      type: object
      properties:
        _id:
          type: string
        userId:
          type: string
        name:
          type: string
        currency:
          type: string
          enum: [BRL, USD, EUR]
        isActive:
          type: boolean
        isDeleted:
          type: boolean
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    Consolidated:
      type: object
      properties:
        totalBRL:
          type: number
        exchangeRateDate:
          type: string
          format: date
        exchangeAvailable:
          type: boolean
        wallets:
          type: array
          items:
            type: object
            properties:
              _id:
                type: string
              name:
                type: string
              currency:
                type: string
              subtotalOriginal:
                type: number
              subtotalBRL:
                type: number
              exchangeRate:
                type: number
```

---

## 5. Fluxos de Dados

### Sequencia: Criar Carteira

```
+--------+    +------------+    +--------------+    +-------+
|Usuario |    | Frontend   |    |WalletManager |    |MongoDB|
+--------+    +------------+    +--------------+    +-------+
    |              |                   |               |
    | nome, moeda  |                   |               |
    |------------->|                   |               |
    |              | POST /wallets     |               |
    |              |------------------>|               |
    |              |                   | validateName  |
    |              |                   |---------------|
    |              |                   |               |
    |              |                   | findByUserIdAndName
    |              |                   |-------------->|
    |              |                   |<--------------|
    |              |                   |   null        |
    |              |                   |               |
    |              |                   | countByUserId |
    |              |                   |-------------->|
    |              |                   |<--------------|
    |              |                   |   count       |
    |              |                   |               |
    |              |                   | create()      |
    |              |                   |-------------->|
    |              |                   |<--------------|
    |              |                   |   wallet      |
    |              |                   |               |
    |              | { wallet }        |               |
    |              |<------------------|               |
    |              |                   |               |
    | { wallet }   |                   |               |
    |<-------------|                   |               |
```

### Sequencia: Ativar Carteira

```
+--------+    +------------+    +--------------+    +-------+    +-------+
|Usuario |    | Frontend   |    |WalletManager |    |MongoDB|    | Redis |
+--------+    +------------+    +--------------+    +-------+    +-------+
    |              |                   |               |            |
    | seleciona    |                   |               |            |
    | carteira     |                   |               |            |
    |------------->|                   |               |            |
    |              | PUT /activate     |               |            |
    |              |------------------>|               |            |
    |              |                   | findById()    |            |
    |              |                   |-------------->|            |
    |              |                   |<--------------|            |
    |              |                   |   wallet      |            |
    |              |                   |               |            |
    |              |                   | deactivateAll()|           |
    |              |                   |-------------->|            |
    |              |                   |<--------------|            |
    |              |                   |               |            |
    |              |                   | activate()    |            |
    |              |                   |-------------->|            |
    |              |                   |<--------------|            |
    |              |                   |   updated     |            |
    |              |                   |               |            |
    |              |                   | SET activeWallet:{userId}
    |              |                   |---------------------------->|
    |              |                   |                            |
    |              | { wallet }        |               |            |
    |              |<------------------|               |            |
    |              |                   |               |            |
    | { wallet }   |                   |               |            |
    |<-------------|                   |               |            |
```

---

## 6. Estrutura de Arquivos

```
investment-service/
|-- src/
|   |-- app/
|   |   |-- wallet/
|   |   |   |-- wallet-model.js
|   |   |   |-- wallet-dao.js
|   |   |   |-- wallet-manager.js
|   |   |   |-- wallet-router.js
|   |   |-- app-constants.js
|   |   |-- app-manager.js
|   |-- __tests__/
|       |-- wallet.test.js

investment-app/
|-- src/
|   |-- pages/
|   |   |-- WalletSettingsPage.vue
|   |   |-- ConsolidatedView.vue
|   |-- components/
|   |   |-- wallet/
|   |   |   |-- WalletSelector.vue
|   |   |   |-- CreateWalletModal.vue
|   |   |   |-- EditWalletModal.vue
|   |   |   |-- DeleteWalletDialog.vue
|   |-- services/
|   |   |-- wallet-service.js
|   |-- stores/
|       |-- wallet-store.js
```

---

## 7. Ordem de Implementacao

### Fase 1: Backend - CRUD Basico (Prioridade: Alta)

1. Criar `wallet-model.js` com schema e indices
2. Criar `wallet-dao.js` com metodos de CRUD
3. Adicionar constantes de erro em `app-constants.js`
4. Implementar `wallet-manager.js` - criar e listar
5. Implementar `wallet-router.js` - rotas basicas

### Fase 2: Backend - Ativacao e Edicao (Prioridade: Alta)

1. Implementar metodo `activate` no manager
2. Implementar metodo `update` no manager
3. Implementar metodo `delete` (soft delete) no manager
4. Adicionar rotas correspondentes no router

### Fase 3: Backend - Visao Consolidada (Prioridade: Media)

1. Implementar metodo `getConsolidated` no manager
2. Integrar com PositionManager (EP05) para subtotais
3. Integrar com servico de cambio (EP06) para conversao

### Fase 4: Frontend - UI de Carteiras (Prioridade: Alta)

1. Criar `wallet-store.js` (Pinia)
2. Criar `wallet-service.js`
3. Implementar `WalletSelector.vue`
4. Implementar `CreateWalletModal.vue`
5. Implementar `WalletSettingsPage.vue`

### Fase 5: Frontend - Edicao e Exclusao (Prioridade: Media)

1. Implementar `EditWalletModal.vue`
2. Implementar `DeleteWalletDialog.vue`
3. Implementar `ConsolidatedView.vue`

### Fase 6: Testes e Validacao (Prioridade: Alta)

1. Testes unitarios do `wallet-manager.js`
2. Testes de integracao das rotas
3. Testes E2E dos fluxos de carteira

---

## 8. Riscos Tecnicos

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|:-------------:|:------:|-----------|
| Condicao de corrida ao ativar carteira | Media | Alto | Usar transacao MongoDB com session |
| Nome duplicado em requisicoes concorrentes | Baixa | Medio | Indice unico no MongoDB |
| Soft delete causa inconsistencia em carteira ativa | Baixa | Alto | Auto-ativar carteira mais antiga |
| Performance da visao consolidada | Baixa | Medio | Cache Redis de 5 minutos |
| Conversao cambial indisponivel | Alta | Medio | Fallback com aviso |

---

## 9. Dependencias

### Backend

Nenhuma dependencia adicional alem das ja existentes.

### Frontend

Nenhuma dependencia adicional alem das ja existentes.

---

## 10. Checklist de Implementacao

### Backend
- [ ] Wallet Model com schema completo
- [ ] Wallet DAO com todos os metodos
- [ ] Wallet Manager - criar implementado
- [ ] Wallet Manager - listar implementado
- [ ] Wallet Manager - ativar implementado
- [ ] Wallet Manager - editar implementado
- [ ] Wallet Manager - excluir implementado
- [ ] Wallet Manager - consolidado implementado
- [ ] Wallet Router com todas as rotas
- [ ] Constantes de erro adicionadas
- [ ] Testes unitarios >= 90% cobertura
- [ ] Testes de integracao passando

### Frontend
- [ ] Wallet Store (Pinia) implementada
- [ ] Wallet Service implementado
- [ ] WalletSelector funcional
- [ ] CreateWalletModal funcional
- [ ] EditWalletModal funcional
- [ ] DeleteWalletDialog funcional
- [ ] WalletSettingsPage funcional
- [ ] ConsolidatedView funcional
- [ ] Rotas configuradas

### Integracao
- [ ] Cache Redis funcionando
- [ ] Soft delete preservando dados
- [ ] Auto-ativacao de carteira funcionando
- [ ] Isolamento por usuario validado

---

*Documento criado pelo Architect - MoneyTrackr V3*
