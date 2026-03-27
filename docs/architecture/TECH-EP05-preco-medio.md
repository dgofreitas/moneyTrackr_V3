# Plano Tecnico - EP05: Preco Medio

## 1. Visao Geral da Arquitetura

```
+------------------------------------------------------------------+
|                    ARQUITETURA DE PRECO MEDIO                     |
+------------------------------------------------------------------+

  +------------------+     +------------------+     +------------------+
  | Position Manager |---->| Average Price    |---->| Transaction DAO  |
  | (Orquestracao)   |     | Calculator       |     | (Dados)           |
  +------------------+     | (Funcao Pura)    |     +------------------+
           |               +------------------+              |
           |                        |                        |
           v                        |                        v
  +------------------+              |              +------------------+
  |   Position DAO   |<-------------+              | Transaction Model|
  | (Persistencia)   |                            +------------------+
  +------------------+
           |
           v
  +------------------+
  |  Position Model  |
  +------------------+
```

### Diagrama de Calculo de Preco Medio

```
+------------------------------------------------------------------+
|                    FLUXO DE CALCULO                               |
+------------------------------------------------------------------+

  [Transacoes do Ativo]
          |
          | 1. Buscar todas as transacoes ativas
          v
  +------------------+
  | Transaction DAO  |
  +------------------+
          |
          | 2. Ordenar por data (crescente)
          v
  +------------------+
  | Lista Ordenada   |
  | [T1, T2, T3...]  |
  +------------------+
          |
          | 3. Iterar e calcular
          v
  +------------------+
  | Average Price    |
  | Calculator       |
  +------------------+
          |
          | 4. Retornar resultado
          v
  +------------------+
  | {                |
  |   quantity,      |
  |   averagePrice,  |
  |   totalInvested, |
  |   totalFees,     |
  |   status         |
  | }                |
  +------------------+
          |
          | 5. Persistir
          v
  +------------------+
  | Position DAO     |
  | upsert()         |
  +------------------+
```

---

## 2. Componentes Backend

### 2.1 Models (Mongoose Schemas)

#### position-model.js (Atualizado)

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const positionSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    default: uuidv4,
  },
  walletId: {
    type: String,
    required: true,
    ref: 'wallet',
  },
  userId: {
    type: String,
    required: true,
  },
  ticker: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  assetType: {
    type: String,
    required: true,
    enum: ['STOCK', 'FII', 'ETF', 'BDR', 'CRYPTO', 'REIT', 'OTHER'],
    default: 'STOCK',
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  averagePrice: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  totalInvested: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  totalFees: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  currency: {
    type: String,
    default: 'BRL',
    enum: ['BRL', 'USD', 'EUR'],
  },
  status: {
    type: String,
    default: 'ACTIVE',
    enum: ['ACTIVE', 'CLOSED'],
  },
  lastTransactionDate: {
    type: Date,
    default: null,
  },
  lastCalculatedAt: {
    type: Date,
    default: Date.now,
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
positionSchema.index({ walletId: 1, userId: 1, ticker: 1 }, { unique: true })
positionSchema.index({ walletId: 1, userId: 1, status: 1 })
positionSchema.index({ userId: 1, status: 1 })

module.exports = { positionSchema }
```

### 2.2 Utilitarios

#### average-price-calculator.js

```javascript
/**
 * Calcula o preco medio via replay cronologico de transacoes.
 * 
 * @param {Array} transactions - Lista de transacoes ordenadas por data (ascendente)
 *   Cada transacao: { type: 'BUY'|'SELL', quantity, unitPrice, fees, date }
 * @returns {Object} { quantity, averagePrice, totalInvested, totalFees, status }
 * 
 * Regras:
 * - Compras: acumulam quantidade e custo (preco * qtd + taxas)
 * - Vendas parciais: reduzem quantidade proporcionalmente, NAO alteram preco medio
 * - Venda total: zera quantidade e reseta preco medio
 * - Nao permite posicao negativa em nenhum ponto da timeline
 */
function calculateAveragePrice(transactions) {
  // Estado inicial
  let quantity = 0
  let totalInvested = 0
  let totalFees = 0

  // Processar cada transacao em ordem cronologica
  for (const tx of transactions) {
    if (tx.type === 'BUY') {
      // Compra: acumular
      const txCost = (tx.unitPrice * tx.quantity) + (tx.fees || 0)
      totalInvested += txCost
      totalFees += (tx.fees || 0)
      quantity += tx.quantity
    } else if (tx.type === 'SELL') {
      // Venda: validar quantidade disponivel
      if (tx.quantity > quantity) {
        throw {
          statusCode: 422,
          code: 'INSUFFICIENT_QUANTITY',
          message: `Quantidade insuficiente para venda. Disponivel: ${quantity}, Solicitado: ${tx.quantity}`,
        }
      }

      // Calcular proporcao da venda
      const sellRatio = tx.quantity / quantity

      // Reduzir proporcionalmente
      totalInvested -= totalInvested * sellRatio
      totalFees -= totalFees * sellRatio
      quantity -= tx.quantity

      // Se zerou, resetar tudo
      if (quantity === 0) {
        totalInvested = 0
        totalFees = 0
      }
    }
  }

  // Calcular preco medio final
  const averagePrice = quantity > 0 ? totalInvested / quantity : 0
  const status = quantity > 0 ? 'ACTIVE' : 'CLOSED'

  // Arredondar para 2 casas decimais (padrao BRL)
  // Para cripto, usar 8 casas (definido em configuracao futura)
  return {
    quantity: Math.round(quantity * 100000000) / 100000000, // 8 casas para cripto
    averagePrice: Math.round(averagePrice * 100) / 100,    // 2 casas para BRL
    totalInvested: Math.round(totalInvested * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    status,
  }
}

/**
 * Calcula o lucro/prejuizo realizado de uma venda.
 * 
 * @param {Object} params
 * @param {number} params.quantity - Quantidade vendida
 * @param {number} params.sellPrice - Preco unitario de venda
 * @param {number} params.averagePrice - Preco medio de aquisicao
 * @param {number} params.fees - Taxas da venda
 * @returns {number} Lucro/prejuizo realizado (positivo = lucro, negativo = prejuizo)
 */
function calculateRealizedPnL({ quantity, sellPrice, averagePrice, fees }) {
  const grossProfit = (sellPrice * quantity) - (averagePrice * quantity)
  return grossProfit - fees
}

/**
 * Calcula o lucro/prejuizo nao realizado.
 * 
 * @param {Object} params
 * @param {number} params.quantity - Quantidade em posicao
 * @param {number} params.averagePrice - Preco medio de aquisicao
 * @param {number} params.currentPrice - Preco atual de mercado
 * @returns {Object} { pnlAbsolute, pnlPercentage }
 */
function calculateUnrealizedPnL({ quantity, averagePrice, currentPrice }) {
  if (quantity === 0 || averagePrice === 0) {
    return { pnlAbsolute: 0, pnlPercentage: 0 }
  }

  const costBasis = averagePrice * quantity
  const marketValue = currentPrice * quantity
  const pnlAbsolute = marketValue - costBasis
  const pnlPercentage = ((currentPrice - averagePrice) / averagePrice) * 100

  return {
    pnlAbsolute: Math.round(pnlAbsolute * 100) / 100,
    pnlPercentage: Math.round(pnlPercentage * 100) / 100,
  }
}

/**
 * Valida se uma lista de transacoes e valida para calculo.
 * 
 * @param {Array} transactions - Lista de transacoes
 * @returns {boolean} True se valida
 */
function validateTransactions(transactions) {
  if (!Array.isArray(transactions)) {
    throw { statusCode: 400, message: 'Transacoes deve ser um array' }
  }

  for (const tx of transactions) {
    if (!['BUY', 'SELL'].includes(tx.type)) {
      throw { statusCode: 400, message: `Tipo de transacao invalido: ${tx.type}` }
    }
    if (typeof tx.quantity !== 'number' || tx.quantity <= 0) {
      throw { statusCode: 400, message: 'Quantidade deve ser um numero positivo' }
    }
    if (typeof tx.unitPrice !== 'number' || tx.unitPrice < 0) {
      throw { statusCode: 400, message: 'Preco unitario deve ser um numero nao negativo' }
    }
    if (tx.fees !== undefined && (typeof tx.fees !== 'number' || tx.fees < 0)) {
      throw { statusCode: 400, message: 'Taxas devem ser um numero nao negativo' }
    }
  }

  return true
}

module.exports = {
  calculateAveragePrice,
  calculateRealizedPnL,
  calculateUnrealizedPnL,
  validateTransactions,
}
```

### 2.3 Managers

#### position-manager.js (Atualizado)

```javascript
const PositionDAO = require('./position-dao')
const TransactionDAO = require('../transaction/transaction-dao')
const { calculateAveragePrice, calculateRealizedPnL, calculateUnrealizedPnL } = require('../utils/average-price-calculator')
const APP_CONSTANTS = require('../app-constants')

class PositionManager {
  constructor(appManager) {
    this.appManager = appManager
    this.positionDAO = new PositionDAO(appManager.getDb())
    this.transactionDAO = new TransactionDAO(appManager.getDb())
    this.redisClient = appManager.getRedisClient()
  }

  // ==================== OBTER POSICAO ====================

  async getPosition({ userId, walletId, ticker }) {
    const position = await this.positionDAO.findByTicker(walletId, userId, ticker)
    return position || {
      quantity: 0,
      averagePrice: 0,
      totalInvested: 0,
      totalFees: 0,
      status: 'CLOSED',
    }
  }

  // ==================== LISTAR POSICOES ====================

  async list({ userId, walletId, status, includeClosed = false }) {
    const query = { walletId, userId }
    
    if (status) {
      query.status = status
    } else if (!includeClosed) {
      query.quantity = { $gt: 0 }
    }

    return await this.positionDAO.findByWallet(walletId, userId, { status })
  }

  // ==================== ATUALIZAR POSICAO (INCREMENTAL) ====================

  async updatePosition({ userId, walletId, ticker, transaction, session = null }) {
    // Buscar posicao atual
    let position = await this.positionDAO.findByTicker(walletId, userId, ticker)

    if (!position) {
      // Criar nova posicao
      position = {
        walletId,
        userId,
        ticker,
        quantity: 0,
        averagePrice: 0,
        totalInvested: 0,
        totalFees: 0,
        currency: transaction.currency || 'BRL',
        status: 'ACTIVE',
        assetType: 'STOCK', // TODO: Detectar tipo de ativo
      }
    }

    // Aplicar transacao
    if (transaction.type === 'BUY') {
      const newInvestment = (transaction.quantity * transaction.price) + transaction.fees
      position.totalInvested += newInvestment
      position.totalFees += transaction.fees
      position.quantity += transaction.quantity
      position.averagePrice = position.quantity > 0
        ? position.totalInvested / position.quantity
        : 0
    } else if (transaction.type === 'SELL') {
      // Venda parcial: reduz quantidade proporcionalmente
      const sellRatio = transaction.quantity / position.quantity
      position.totalInvested -= position.totalInvested * sellRatio
      position.totalFees -= position.totalFees * sellRatio
      position.quantity -= transaction.quantity
      position.averagePrice = position.quantity > 0
        ? position.totalInvested / position.quantity
        : 0
    }

    // Atualizar status
    position.status = position.quantity > 0 ? 'ACTIVE' : 'CLOSED'
    position.lastTransactionDate = transaction.date
    position.lastCalculatedAt = new Date()

    // Arredondar valores
    position.averagePrice = Math.round(position.averagePrice * 100) / 100
    position.totalInvested = Math.round(position.totalInvested * 100) / 100
    position.totalFees = Math.round(position.totalFees * 100) / 100

    // Salvar posicao
    const savedPosition = await this.positionDAO.upsert(position, session)

    // Invalidar cache
    await this._invalidatePositionCache(userId, walletId, ticker)

    return savedPosition
  }

  // ==================== RECALCULO COMPLETO ====================

  async fullRecalculate({ userId, walletId, ticker, session = null }) {
    // Buscar todas as transacoes ativas do ativo
    const transactions = await this.transactionDAO.findByTicker(
      walletId,
      userId,
      ticker,
      session
    )

    // Se nao ha transacoes, zerar posicao
    if (transactions.length === 0) {
      const closedPosition = await this.positionDAO.upsert({
        walletId,
        userId,
        ticker,
        quantity: 0,
        averagePrice: 0,
        totalInvested: 0,
        totalFees: 0,
        status: 'CLOSED',
        lastCalculatedAt: new Date(),
      }, session)

      await this._invalidatePositionCache(userId, walletId, ticker)
      return closedPosition
    }

    // Converter transacoes para formato do calculador
    const calculatorTransactions = transactions.map((tx) => ({
      type: tx.type,
      quantity: tx.quantity,
      unitPrice: tx.price,
      fees: tx.fees || 0,
      date: tx.date,
    }))

    // Calcular usando funcao pura
    const result = calculateAveragePrice(calculatorTransactions)

    // Determinar tipo de ativo (TODO: integrar com servico de classificacao)
    const assetType = this._detectAssetType(ticker)

    // Salvar posicao
    const position = await this.positionDAO.upsert({
      walletId,
      userId,
      ticker,
      assetType,
      quantity: result.quantity,
      averagePrice: result.averagePrice,
      totalInvested: result.totalInvested,
      totalFees: result.totalFees,
      currency: transactions[0].currency || 'BRL',
      status: result.status,
      lastTransactionDate: transactions[transactions.length - 1].date,
      lastCalculatedAt: new Date(),
    }, session)

    // Invalidar cache
    await this._invalidatePositionCache(userId, walletId, ticker)

    return position
  }

  // ==================== CALCULAR P/L NAO REALIZADO ====================

  async calculateUnrealizedPnLForPosition({ userId, walletId, ticker, currentPrice }) {
    const position = await this.getPosition({ userId, walletId, ticker })

    if (position.quantity === 0) {
      return {
        pnlAbsolute: 0,
        pnlPercentage: 0,
        marketValue: 0,
        costBasis: 0,
      }
    }

    const pnl = calculateUnrealizedPnL({
      quantity: position.quantity,
      averagePrice: position.averagePrice,
      currentPrice,
    })

    return {
      ...pnl,
      marketValue: Math.round((currentPrice * position.quantity) * 100) / 100,
      costBasis: Math.round((position.averagePrice * position.quantity) * 100) / 100,
    }
  }

  // ==================== RESUMO DA CARTEIRA ====================

  async getPortfolioSummary({ userId, walletId }) {
    const positions = await this.positionDAO.findActive(walletId, userId)

    let totalInvested = 0
    let totalFees = 0
    let positionCount = 0

    for (const position of positions) {
      totalInvested += position.totalInvested
      totalFees += position.totalFees
      positionCount++
    }

    return {
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      positionCount,
      activePositions: positions.filter((p) => p.status === 'ACTIVE').length,
      closedPositions: positions.filter((p) => p.status === 'CLOSED').length,
    }
  }

  // ==================== HELPERS ====================

  _detectAssetType(ticker) {
    // Heuristica simples para detectar tipo de ativo
    const tickerUpper = ticker.toUpperCase()

    if (tickerUpper.endsWith('11')) return 'FII'
    if (tickerUpper.endsWith('34') || tickerUpper.endsWith('35')) return 'BDR'
    if (tickerUpper.endsWith('4') || tickerUpper.endsWith('3')) return 'STOCK'
    if (tickerUpper.includes('USD') || tickerUpper.includes('BTC') || tickerUpper.includes('ETH')) return 'CRYPTO'
    if (tickerUpper.startsWith('BOVA') || tickerUpper.startsWith('SMAL')) return 'ETF'

    return 'STOCK'
  }

  async _invalidatePositionCache(userId, walletId, ticker) {
    const pattern = `position:${userId}:${walletId}:${ticker}*`
    const keys = await this.redisClient.keys(pattern)
    if (keys.length > 0) {
      await this.redisClient.del(keys)
    }
  }
}

module.exports = PositionManager
```

### 2.4 Routers

#### position-router.js

```javascript
const express = require('express')
const APP_CONSTANTS = require('../app-constants')
const jwtMiddleware = require('../auth/jwt-middleware')

class PositionRouter {
  static handleError(exception, res) {
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getRoutes(appManager) {
    const router = express.Router()
    const positionManager = appManager.getPositionManager()

    // Aplicar middleware JWT
    router.use(jwtMiddleware(appManager, appManager.config))

    // GET /api/positions - Listar posicoes
    router.get('/positions', async (req, res) => {
      try {
        const positions = await positionManager.list({
          userId: req.user.userId,
          ...req.query,
        })
        res.status(200).send(positions)
      } catch (exception) {
        PositionRouter.handleError(exception, res)
      }
    })

    // GET /api/positions/:ticker - Obter posicao por ticker
    router.get('/positions/:ticker', async (req, res) => {
      try {
        const position = await positionManager.getPosition({
          userId: req.user.userId,
          walletId: req.query.walletId,
          ticker: req.params.ticker,
        })
        res.status(200).send(position)
      } catch (exception) {
        PositionRouter.handleError(exception, res)
      }
    })

    // GET /api/positions/:ticker/pnl - Calcular P/L nao realizado
    router.get('/positions/:ticker/pnl', async (req, res) => {
      try {
        const pnl = await positionManager.calculateUnrealizedPnLForPosition({
          userId: req.user.userId,
          walletId: req.query.walletId,
          ticker: req.params.ticker,
          currentPrice: parseFloat(req.query.currentPrice),
        })
        res.status(200).send(pnl)
      } catch (exception) {
        PositionRouter.handleError(exception, res)
      }
    })

    // GET /api/portfolio/summary - Resumo da carteira
    router.get('/portfolio/summary', async (req, res) => {
      try {
        const summary = await positionManager.getPortfolioSummary({
          userId: req.user.userId,
          walletId: req.query.walletId,
        })
        res.status(200).send(summary)
      } catch (exception) {
        PositionRouter.handleError(exception, res)
      }
    })

    // POST /api/positions/:ticker/recalculate - Forcar recalculo
    router.post('/positions/:ticker/recalculate', async (req, res) => {
      try {
        const position = await positionManager.fullRecalculate({
          userId: req.user.userId,
          walletId: req.query.walletId,
          ticker: req.params.ticker,
        })
        res.status(200).send(position)
      } catch (exception) {
        PositionRouter.handleError(exception, res)
      }
    })

    return router
  }
}

module.exports = PositionRouter
```

---

## 3. Componentes Frontend

### 3.1 Pages

| Pagina | Arquivo | Rota | Descricao |
|--------|---------|------|-----------|
| PortfolioPage | `src/pages/PortfolioPage.vue` | `/portfolio` | Visao de portfolio |
| PositionDetailPage | `src/pages/PositionDetailPage.vue` | `/positions/:ticker` | Detalhes de posicao |

### 3.2 Components

#### PortfolioTable.vue

```vue
<template>
  <div class="portfolio-table">
    <div class="table-header">
      <h2>Minhas Posicoes</h2>
      <div class="filters">
        <select v-model="filterStatus">
          <option value="">Todas</option>
          <option value="ACTIVE">Ativas</option>
          <option value="CLOSED">Encerradas</option>
        </select>
      </div>
    </div>

    <div v-if="isLoading" class="loading">
      <LoadingSpinner />
    </div>

    <div v-else-if="positions.length === 0" class="empty">
      <p>Nenhuma posicao encontrada</p>
    </div>

    <table v-else class="table">
      <thead>
        <tr>
          <th>Ativo</th>
          <th>Tipo</th>
          <th class="number">Quantidade</th>
          <th class="number">Preco Medio</th>
          <th class="number">Preco Atual</th>
          <th class="number">Custo Total</th>
          <th class="number">Valor Mercado</th>
          <th class="number">P/L (R$)</th>
          <th class="number">P/L (%)</th>
        </tr>
      </thead>
      <tbody>
        <PositionRow
          v-for="position in filteredPositions"
          :key="position._id"
          :position="position"
          :marketPrice="getMarketPrice(position.ticker)"
        />
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="5"><strong>Total</strong></td>
          <td class="number">{{ formatCurrency(totalCostBasis) }}</td>
          <td class="number">{{ formatCurrency(totalMarketValue) }}</td>
          <td :class="['number', 'pnl', { profit: totalPnL >= 0, loss: totalPnL < 0 }]">
            {{ formatCurrency(totalPnL) }}
          </td>
          <td :class="['number', 'pnl', { profit: totalPnLPercentage >= 0, loss: totalPnLPercentage < 0 }]">
            {{ formatPercent(totalPnLPercentage) }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePositionStore } from '@/stores/position-store'
import { useMarketStore } from '@/stores/market-store'
import PositionRow from './PositionRow.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const positionStore = usePositionStore()
const marketStore = useMarketStore()

const filterStatus = ref('')
const isLoading = ref(true)

const positions = computed(() => positionStore.positions)

const filteredPositions = computed(() => {
  if (!filterStatus.value) return positions.value
  return positions.value.filter((p) => p.status === filterStatus.value)
})

const getMarketPrice = (ticker) => {
  return marketStore.getPrice(ticker)
}

const totalCostBasis = computed(() => {
  return filteredPositions.value.reduce((sum, p) => {
    return sum + (p.averagePrice * p.quantity)
  }, 0)
})

const totalMarketValue = computed(() => {
  return filteredPositions.value.reduce((sum, p) => {
    const price = getMarketPrice(p.ticker) || p.averagePrice
    return sum + (price * p.quantity)
  }, 0)
})

const totalPnL = computed(() => {
  return totalMarketValue.value - totalCostBasis.value
})

const totalPnLPercentage = computed(() => {
  if (totalCostBasis.value === 0) return 0
  return ((totalMarketValue.value - totalCostBasis.value) / totalCostBasis.value) * 100
})

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const formatPercent = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
  }).format(value / 100)
}

onMounted(async () => {
  await positionStore.fetchPositions()
  isLoading.value = false
})
</script>
```

#### PositionRow.vue

```vue
<template>
  <tr :class="['position-row', { closed: position.status === 'CLOSED' }]">
    <td class="ticker">
      <span class="ticker-name">{{ position.ticker }}</span>
      <span v-if="position.status === 'CLOSED'" class="closed-badge">Encerrada</span>
    </td>
    <td>
      <span :class="['type-badge', position.assetType.toLowerCase()]">
        {{ formatAssetType(position.assetType) }}
      </span>
    </td>
    <td class="number">{{ formatNumber(position.quantity) }}</td>
    <td class="number">{{ formatCurrency(position.averagePrice) }}</td>
    <td class="number">
      <span v-if="marketPrice">{{ formatCurrency(marketPrice) }}</span>
      <span v-else class="unavailable">Indisponivel</span>
    </td>
    <td class="number">{{ formatCurrency(costBasis) }}</td>
    <td class="number">
      <span v-if="marketPrice">{{ formatCurrency(marketValue) }}</span>
      <span v-else class="unavailable">—</span>
    </td>
    <td :class="['number', 'pnl', pnlClass]">
      <span v-if="marketPrice">{{ formatCurrency(pnlAbsolute) }}</span>
      <span v-else class="unavailable">—</span>
    </td>
    <td :class="['number', 'pnl', pnlClass]">
      <span v-if="marketPrice">{{ formatPercent(pnlPercentage) }}</span>
      <span v-else class="unavailable">—</span>
    </td>
  </tr>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  position: Object,
  marketPrice: Number,
})

const costBasis = computed(() => {
  return props.position.averagePrice * props.position.quantity
})

const marketValue = computed(() => {
  if (!props.marketPrice) return null
  return props.marketPrice * props.position.quantity
})

const pnlAbsolute = computed(() => {
  if (!props.marketPrice) return null
  return marketValue.value - costBasis.value
})

const pnlPercentage = computed(() => {
  if (!props.marketPrice || costBasis.value === 0) return null
  return ((props.marketPrice - props.position.averagePrice) / props.position.averagePrice) * 100
})

const pnlClass = computed(() => {
  if (pnlAbsolute.value === null) return ''
  return pnlAbsolute.value >= 0 ? 'profit' : 'loss'
})

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const formatNumber = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(value)
}

const formatPercent = (value) => {
  const sign = value >= 0 ? '+' : ''
  return sign + new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
  }).format(value / 100)
}

const formatAssetType = (type) => {
  const types = {
    STOCK: 'Acao',
    FII: 'FII',
    ETF: 'ETF',
    BDR: 'BDR',
    CRYPTO: 'Cripto',
    REIT: 'REIT',
    OTHER: 'Outro',
  }
  return types[type] || type
}
</script>
```

#### GainLossIndicator.vue

```vue
<template>
  <div :class="['gain-loss-indicator', variant]">
    <span class="icon">
      <TrendingUpIcon v-if="value > 0" />
      <TrendingDownIcon v-else-if="value < 0" />
      <MinusIcon v-else />
    </span>
    <span class="value">{{ formattedValue }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: Number,
  type: {
    type: String,
    default: 'currency', // 'currency' | 'percent'
  },
})

const variant = computed(() => {
  if (props.value > 0) return 'profit'
  if (props.value < 0) return 'loss'
  return 'neutral'
})

const formattedValue = computed(() => {
  if (props.type === 'percent') {
    const sign = props.value >= 0 ? '+' : ''
    return sign + new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: 2,
    }).format(props.value / 100)
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(props.value)
})
</script>

<style scoped>
.gain-loss-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.gain-loss-indicator.profit {
  color: #22c55e;
  background-color: rgba(34, 197, 94, 0.1);
}

.gain-loss-indicator.loss {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
}

.gain-loss-indicator.neutral {
  color: #6b7280;
  background-color: rgba(107, 114, 128, 0.1);
}
</style>
```

### 3.3 Services

#### position-service.js

```javascript
import api from './api'

class PositionService {
  async getPositions(params) {
    return await api.get('/positions', params)
  }

  async getPosition(ticker, walletId) {
    return await api.get(`/positions/${ticker}`, { walletId })
  }

  async getPnL(ticker, walletId, currentPrice) {
    return await api.get(`/positions/${ticker}/pnl`, { walletId, currentPrice })
  }

  async getPortfolioSummary(walletId) {
    return await api.get('/portfolio/summary', { walletId })
  }

  async recalculatePosition(ticker, walletId) {
    return await api.post(`/positions/${ticker}/recalculate`, null, { walletId })
  }
}

export default new PositionService()
```

### 3.4 Store/State

#### position-store.js (Pinia)

```javascript
import { defineStore } from 'pinia'
import positionService from '@/services/position-service'

export const usePositionStore = defineStore('position', {
  state: () => ({
    positions: [],
    summary: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    activePositions: (state) => state.positions.filter((p) => p.status === 'ACTIVE' && p.quantity > 0),
    closedPositions: (state) => state.positions.filter((p) => p.status === 'CLOSED' || p.quantity === 0),
    totalInvested: (state) => state.positions.reduce((sum, p) => sum + p.totalInvested, 0),
    positionCount: (state) => state.positions.length,
  },

  actions: {
    async fetchPositions(walletId) {
      this.isLoading = true
      this.error = null

      try {
        this.positions = await positionService.getPositions({ walletId })
        return this.positions
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async fetchPosition(ticker, walletId) {
      try {
        return await positionService.getPosition(ticker, walletId)
      } catch (error) {
        return { quantity: 0, averagePrice: 0 }
      }
    },

    async fetchPortfolioSummary(walletId) {
      try {
        this.summary = await positionService.getPortfolioSummary(walletId)
        return this.summary
      } catch (error) {
        this.error = error.message
        throw error
      }
    },

    async recalculatePosition(ticker, walletId) {
      try {
        const position = await positionService.recalculatePosition(ticker, walletId)
        
        const index = this.positions.findIndex((p) => p.ticker === ticker)
        if (index !== -1) {
          this.positions[index] = position
        }
        
        return position
      } catch (error) {
        this.error = error.message
        throw error
      }
    },

    updatePositionFromTransaction(transaction, position) {
      const index = this.positions.findIndex((p) => p.ticker === transaction.ticker)
      
      if (index !== -1) {
        this.positions[index] = position
      } else if (position.quantity > 0) {
        this.positions.push(position)
      }
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
  title: MoneyTrackr Position API
  version: 1.0.0

paths:
  /positions:
    get:
      summary: Listar posicoes
      tags: [Positions]
      security:
        - bearerAuth: []
      parameters:
        - name: walletId
          in: query
          required: true
          schema:
            type: string
        - name: status
          in: query
          schema:
            type: string
            enum: [ACTIVE, CLOSED]
      responses:
        '200':
          description: Lista de posicoes
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Position'

  /positions/{ticker}:
    get:
      summary: Obter posicao por ticker
      tags: [Positions]
      security:
        - bearerAuth: []
      parameters:
        - name: ticker
          in: path
          required: true
          schema:
            type: string
        - name: walletId
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Posicao encontrada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Position'

  /positions/{ticker}/pnl:
    get:
      summary: Calcular P/L nao realizado
      tags: [Positions]
      security:
        - bearerAuth: []
      parameters:
        - name: ticker
          in: path
          required: true
          schema:
            type: string
        - name: walletId
          in: query
          required: true
          schema:
            type: string
        - name: currentPrice
          in: query
          required: true
          schema:
            type: number
      responses:
        '200':
          description: P/L calculado
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PnLResult'

  /positions/{ticker}/recalculate:
    post:
      summary: Forcar recalculo de posicao
      tags: [Positions]
      security:
        - bearerAuth: []
      parameters:
        - name: ticker
          in: path
          required: true
          schema:
            type: string
        - name: walletId
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Posicao recalculada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Position'

  /portfolio/summary:
    get:
      summary: Resumo do portfolio
      tags: [Portfolio]
      security:
        - bearerAuth: []
      parameters:
        - name: walletId
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Resumo do portfolio
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PortfolioSummary'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Position:
      type: object
      properties:
        _id:
          type: string
        walletId:
          type: string
        userId:
          type: string
        ticker:
          type: string
        assetType:
          type: string
          enum: [STOCK, FII, ETF, BDR, CRYPTO, REIT, OTHER]
        quantity:
          type: number
        averagePrice:
          type: number
        totalInvested:
          type: number
        totalFees:
          type: number
        currency:
          type: string
        status:
          type: string
          enum: [ACTIVE, CLOSED]
        lastTransactionDate:
          type: string
          format: date-time
        lastCalculatedAt:
          type: string
          format: date-time
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    PnLResult:
      type: object
      properties:
        pnlAbsolute:
          type: number
        pnlPercentage:
          type: number
        marketValue:
          type: number
        costBasis:
          type: number

    PortfolioSummary:
      type: object
      properties:
        totalInvested:
          type: number
        totalFees:
          type: number
        positionCount:
          type: integer
        activePositions:
          type: integer
        closedPositions:
          type: integer
```

---

## 5. Fluxos de Dados

### Sequencia: Calculo de Preco Medio

```
+------------------+    +------------------+    +------------------+
| Transaction DAO  |    | Average Price    |    | Position DAO     |
+------------------+    | Calculator       |    +------------------+
         |              +------------------+             |
         |                       |                        |
         | 1. findByTicker()     |                        |
         |<----------------------|                        |
         |                       |                        |
         | 2. [T1, T2, T3...]    |                        |
         |---------------------->|                        |
         |                       |                        |
         |                       | 3. calculate()        |
         |                       |-----------------------|
         |                       |                        |
         |                       | 4. { quantity,         |
         |                       |      averagePrice,    |
         |                       |      totalInvested,   |
         |                       |      totalFees,       |
         |                       |      status }         |
         |                       |<-----------------------|
         |                       |                        |
         |                       | 5. upsert()            |
         |                       |---------------------->|
         |                       |                        |
         |                       | 6. position saved      |
         |                       |<----------------------|
         |                       |                        |
```

### Sequencia: Recalculo apos Edicao

```
+--------+    +------------------+    +------------------+    +-------+
|Usuario |    |TransactionManager|    | PositionManager  |    |MongoDB|
+--------+    +------------------+    +------------------+    +-------+
    |                 |                       |                   |
    | edita transacao |                       |                   |
    |---------------->|                       |                   |
    |                 | update()              |                   |
    |                 |---------------------------------------->|
    |                 |<----------------------------------------|
    |                 |   updated             |                   |
    |                 |                       |                   |
    |                 | fullRecalculate()     |                   |
    |                 |---------------------->|                   |
    |                 |                       | findByTicker()    |
    |                 |                       |------------------>|
    |                 |                       |<------------------|
    |                 |                       |   all txs         |
    |                 |                       |                   |
    |                 |                       | calculate()       |
    |                 |                       |-------------------|
    |                 |                       |                   |
    |                 |                       | upsert()          |
    |                 |                       |------------------>|
    |                 |                       |<------------------|
    |                 |                       |   position        |
    |                 |<----------------------|                   |
    |                 |   position            |                   |
    |<----------------|                       |                   |
    |   success       |                       |                   |
```

---

## 6. Estrutura de Arquivos

```
investment-service/
|-- src/
|   |-- app/
|   |   |-- position/
|   |   |   |-- position-model.js
|   |   |   |-- position-dao.js
|   |   |   |-- position-manager.js
|   |   |   |-- position-router.js
|   |   |-- utils/
|   |   |   |-- average-price-calculator.js
|   |   |-- app-constants.js
|   |-- __tests__/
|       |-- average-price-calculator.test.js
|       |-- position-manager.test.js
|       |-- position.integration.test.js

investment-app/
|-- src/
|   |-- pages/
|   |   |-- PortfolioPage.vue
|   |   |-- PositionDetailPage.vue
|   |-- components/
|   |   |-- portfolio/
|   |   |   |-- PortfolioTable.vue
|   |   |   |-- PositionRow.vue
|   |   |   |-- GainLossIndicator.vue
|   |   |   |-- PortfolioSummary.vue
|   |-- services/
|   |   |-- position-service.js
|   |-- stores/
|       |-- position-store.js
```

---

## 7. Ordem de Implementacao

### Fase 1: Backend - Calculadora (Prioridade: Alta)

1. Criar `average-price-calculator.js` com funcoes puras
2. Testes unitarios da calculadora (100% cobertura)
3. Validar todas as formulas

### Fase 2: Backend - Position Manager (Prioridade: Alta)

1. Atualizar `position-model.js` com novos campos
2. Atualizar `position-dao.js` com novos metodos
3. Implementar `position-manager.js` - calculo incremental
4. Implementar `position-manager.js` - recalculo completo
5. Implementar `position-manager.js` - P/L nao realizado

### Fase 3: Backend - Router (Prioridade: Alta)

1. Implementar `position-router.js` - todas as rotas
2. Integrar com JWT middleware

### Fase 4: Frontend - UI de Portfolio (Prioridade: Alta)

1. Criar `position-store.js` (Pinia)
2. Criar `position-service.js`
3. Implementar `PortfolioTable.vue`
4. Implementar `PositionRow.vue`
5. Implementar `GainLossIndicator.vue`

### Fase 5: Frontend - Detalhes (Prioridade: Media)

1. Implementar `PortfolioSummary.vue`
2. Implementar `PositionDetailPage.vue`

### Fase 6: Testes e Validacao (Prioridade: Alta)

1. Testes unitarios do calculador
2. Testes de integracao das rotas
3. Testes E2E dos fluxos

---

## 8. Riscos Tecnicos

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|:-------------:|:------:|-----------|
| Precisao de ponto flutuante | Media | Alto | Arredondamento explicito; considerar decimal.js |
| Performance de replay com muitas transacoes | Baixa | Medio | Indexar corretamente; cache de posicao |
| Concorrencia em transacoes simultaneas | Baixa | Alto | Locks otimistas via version no MongoDB |
| Preco de mercado indisponivel | Media | Medio | Estado gracioso no frontend |
| Inconsistencia Position/Transactions | Baixa | Alto | Transacoes atomicas; job de reconciliacao |

---

## 9. Dependencias

### Backend

Nenhuma dependencia adicional alem das ja existentes.

### Frontend

Nenhuma dependencia adicional alem das ja existentes.

---

## 10. Checklist de Implementacao

### Backend
- [ ] Average Price Calculator implementado
- [ ] Testes unitarios do calculador >= 95%
- [ ] Position Model atualizado
- [ ] Position DAO atualizado
- [ ] Position Manager - calculo incremental
- [ ] Position Manager - recalculo completo
- [ ] Position Manager - P/L nao realizado
- [ ] Position Router com todas as rotas
- [ ] Testes de integracao passando

### Frontend
- [ ] Position Store (Pinia) implementada
- [ ] Position Service implementado
- [ ] PortfolioTable funcional
- [ ] PositionRow funcional
- [ ] GainLossIndicator funcional
- [ ] PortfolioSummary funcional
- [ ] Rotas configuradas

### Integracao
- [ ] Calculo de preco medio correto
- [ ] Venda parcial nao altera preco medio
- [ ] Venda total reseta preco medio
- [ ] Recalculo apos edicao funcionando
- [ ] P/L calculado corretamente

---

## 11. Formulas de Negocio

### Preco Medio (Compra)

```
novoTotalInvestido = totalInvestidoAnterior + (quantidade * preco) + taxas
novaQuantidade = quantidadeAnterior + quantidade
precoMedio = novoTotalInvestido / novaQuantidade
```

### Lucro/Prejuizo Realizado (Venda)

```
realizedPnL = (precoVenda * quantidade) - (precoMedio * quantidade) - taxas
```

### Venda Parcial (Impacto na Posicao)

```
novaQuantidade = quantidadeAnterior - quantidadeVendida
sellRatio = quantidadeVendida / quantidadeAnterior
novoTotalInvestido = totalInvestidoAnterior * (1 - sellRatio)
precoMedio = inalterado
```

### Lucro/Prejuizo Nao Realizado

```
pnlAbsolute = (precoAtual - precoMedio) * quantidade
pnlPercentage = ((precoAtual - precoMedio) / precoMedio) * 100
valorMercado = precoAtual * quantidade
custoTotal = precoMedio * quantidade
```

---

*Documento criado pelo Architect - MoneyTrackr V3*
