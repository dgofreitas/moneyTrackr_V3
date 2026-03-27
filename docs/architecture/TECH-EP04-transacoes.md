# Plano Tecnico - EP04: Transacoes

## 1. Visao Geral da Arquitetura

```
+------------------------------------------------------------------+
|                    ARQUITETURA DE TRANSACOES                      |
+------------------------------------------------------------------+

  +------------------+     +------------------+     +------------------+
  |Transaction Router|---->|Transaction Manager|---->| Transaction DAO  |
  +------------------+     +------------------+     +------------------+
           |                       |                       |
           |                       |                       v
           |                       |              +------------------+
           |                       |              |Transaction Model |
           |                       |              +------------------+
           |                       |
           |                       v
           |              +------------------+
           |              | Position Manager |
           |              +------------------+
           |                       |
           |                       v
           |              +------------------+
           |              |   Position DAO   |
           |              +------------------+
           |                       |
           |                       v
           |              +------------------+
           |              |  Position Model  |
           |              +------------------+
           |
           v
  +------------------+
  | JWT Middleware   |
  +------------------+
```

### Diagrama de Fluxo de Transacao

```
+------------------------------------------------------------------+
|                    FLUXO DE REGISTRO DE TRANSACAO                 |
+------------------------------------------------------------------+

  [Usuario Autenticado]
          |
          | 1. Submete transacao
          v
  +------------------+
  | Transaction Router|
  +------------------+
          |
          | 2. Valida request
          v
  +------------------+
  |Transaction Manager|
  +------------------+
          |
          | 3. Valida regras de negocio
          |    - Quantidade > 0
          |    - Preco > 0
          |    - Data <= hoje
          |    - Se SELL: quantidade <= posicao
          v
  +------------------+
  | MongoDB Session  |  <-- Transacao atomica
  +------------------+
          |
          +---> 4a. Criar Transaction
          |
          +---> 4b. Atualizar Position
          |         - Recalcular quantidade
          |         - Recalcular preco medio
          |         - Calcular P/L (se SELL)
          |
          +---> 4c. Commit ou Rollback
          |
          v
  +------------------+
  | Response         |
  | { transaction,   |
  |   position }    |
  +------------------+
```

---

## 2. Componentes Backend

### 2.1 Models (Mongoose Schemas)

#### transaction-model.js

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const transactionSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    default: uuidv4,
  },
  walletId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  ticker: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    maxlength: 20,
  },
  type: {
    type: String,
    required: true,
    enum: ['BUY', 'SELL'],
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.00000001,
  },
  price: {
    type: Number,
    required: true,
    min: 0.00000001,
  },
  fees: {
    type: Number,
    default: 0,
    min: 0,
  },
  date: {
    type: Date,
    required: true,
  },
  currency: {
    type: String,
    default: 'BRL',
    enum: ['BRL', 'USD', 'EUR'],
  },
  notes: {
    type: String,
    maxlength: 500,
    default: '',
  },
  realizedPnL: {
    type: Number,
    default: null,
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
}, {
  versionKey: false,
  timestamps: true,
})

// Indices compostos para queries frequentes
transactionSchema.index({ walletId: 1, userId: 1, isDeleted: 1, date: -1 })
transactionSchema.index({ walletId: 1, userId: 1, ticker: 1, isDeleted: 1, date: 1 })
transactionSchema.index({ walletId: 1, userId: 1, type: 1, isDeleted: 1 })

module.exports = { transactionSchema }
```

#### position-model.js

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
  quantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  averagePrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalInvested: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalFees: {
    type: Number,
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
}, {
  versionKey: false,
  timestamps: true,
})

// Indice unico: um ativo por carteira por usuario
positionSchema.index({ walletId: 1, userId: 1, ticker: 1 }, { unique: true })
positionSchema.index({ walletId: 1, userId: 1, status: 1 })

module.exports = { positionSchema }
```

### 2.2 DAOs

#### transaction-dao.js

```javascript
const AppDAO = require('../app-dao')
const { transactionSchema } = require('./transaction-model')

class TransactionDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    return db.model('transaction', transactionSchema)
  }

  // ==================== CREATE ====================

  async create(transactionData, session = null) {
    const options = session ? { session } : {}
    const transaction = new this.objectModel(transactionData)
    return await transaction.save(options)
  }

  // ==================== READ ====================

  async findById(transactionId) {
    return await this.objectModel
      .findById(transactionId)
      .lean()
      .exec()
  }

  async findByWallet(walletId, userId, options = {}) {
    const query = { walletId, userId, isDeleted: false }

    if (options.type) query.type = options.type
    if (options.ticker) query.ticker = options.ticker
    if (options.startDate || options.endDate) {
      query.date = {}
      if (options.startDate) query.date.$gte = new Date(options.startDate)
      if (options.endDate) query.date.$lte = new Date(options.endDate)
    }

    let queryBuilder = this.objectModel.find(query)

    if (options.sort) {
      queryBuilder = queryBuilder.sort(options.sort)
    } else {
      queryBuilder = queryBuilder.sort({ date: -1 })
    }

    if (options.limit) queryBuilder = queryBuilder.limit(options.limit)
    if (options.skip) queryBuilder = queryBuilder.skip(options.skip)

    return await queryBuilder.lean().exec()
  }

  async findByTicker(walletId, userId, ticker, session = null) {
    const options = session ? { session } : {}
    return await this.objectModel
      .find({
        walletId,
        userId,
        ticker: ticker.toUpperCase(),
        isDeleted: false,
      })
      .sort({ date: 1 })
      .lean()
      .exec()
  }

  async countByWallet(walletId, userId) {
    return await this.objectModel
      .countDocuments({ walletId, userId, isDeleted: false })
  }

  // ==================== UPDATE ====================

  async update(transactionId, userId, updateData, session = null) {
    const options = session ? { session, new: true } : { new: true }
    return await this.objectModel
      .findOneAndUpdate(
        { _id: transactionId, userId, isDeleted: false },
        { $set: { ...updateData, updatedAt: new Date() } },
        options
      )
      .lean()
      .exec()
  }

  // ==================== DELETE ====================

  async softDelete(transactionId, userId, session = null) {
    const options = session ? { session, new: true } : { new: true }
    return await this.objectModel
      .findOneAndUpdate(
        { _id: transactionId, userId, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        options
      )
      .lean()
      .exec()
  }

  // ==================== AGGREGATION ====================

  async getTransactionSummary(walletId, userId) {
    return await this.objectModel.aggregate([
      {
        $match: { walletId, userId, isDeleted: false },
      },
      {
        $group: {
          _id: '$ticker',
          totalBuyQuantity: {
            $sum: { $cond: [{ $eq: ['$type', 'BUY'] }, '$quantity', 0] },
          },
          totalSellQuantity: {
            $sum: { $cond: [{ $eq: ['$type', 'SELL'] }, '$quantity', 0] },
          },
          totalInvested: {
            $sum: {
              $cond: [
                { $eq: ['$type', 'BUY'] },
                { $add: [{ $multiply: ['$quantity', '$price'] }, '$fees'] },
                0,
              ],
            },
          },
          totalRealizedPnL: {
            $sum: { $ifNull: ['$realizedPnL', 0] },
          },
          transactionCount: { $sum: 1 },
        },
      },
    ])
  }
}

module.exports = TransactionDAO
```

#### position-dao.js

```javascript
const AppDAO = require('../app-dao')
const { positionSchema } = require('./position-model')

class PositionDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    return db.model('position', positionSchema)
  }

  // ==================== UPSERT ====================

  async upsert(positionData, session = null) {
    const { walletId, userId, ticker } = positionData
    const options = session
      ? { session, new: true, upsert: true }
      : { new: true, upsert: true }

    return await this.objectModel
      .findOneAndUpdate(
        { walletId, userId, ticker: ticker.toUpperCase() },
        { $set: positionData },
        options
      )
      .lean()
      .exec()
  }

  // ==================== READ ====================

  async findByWallet(walletId, userId, options = {}) {
    const query = { walletId, userId }

    if (options.status) query.status = options.status
    if (options.ticker) query.ticker = options.ticker

    return await this.objectModel
      .find(query)
      .sort({ status: -1, ticker: 1 })
      .lean()
      .exec()
  }

  async findByTicker(walletId, userId, ticker) {
    return await this.objectModel
      .findOne({ walletId, userId, ticker: ticker.toUpperCase() })
      .lean()
      .exec()
  }

  async findActive(walletId, userId) {
    return await this.objectModel
      .find({ walletId, userId, status: 'ACTIVE', quantity: { $gt: 0 } })
      .lean()
      .exec()
  }

  // ==================== UPDATE ====================

  async update(walletId, userId, ticker, updateData, session = null) {
    const options = session ? { session, new: true } : { new: true }
    return await this.objectModel
      .findOneAndUpdate(
        { walletId, userId, ticker: ticker.toUpperCase() },
        { $set: updateData },
        options
      )
      .lean()
      .exec()
  }

  // ==================== DELETE ====================

  async delete(walletId, userId, ticker, session = null) {
    const options = session ? { session } : {}
    return await this.objectModel
      .deleteOne({ walletId, userId, ticker: ticker.toUpperCase() }, options)
  }
}

module.exports = PositionDAO
```

### 2.3 Managers

#### transaction-manager.js

```javascript
const TransactionDAO = require('./transaction-dao')
const PositionManager = require('../position/position-manager')
const APP_CONSTANTS = require('../app-constants')

class TransactionManager {
  constructor(appManager) {
    this.appManager = appManager
    this.transactionDAO = new TransactionDAO(appManager.getDb())
    this.positionManager = new PositionManager(appManager)
  }

  // ==================== CRIAR TRANSACAO ====================

  async create({ userId, walletId, ticker, type, quantity, price, fees = 0, date, currency = 'BRL', notes = '' }) {
    // Validacoes basicas
    this._validateTransactionData({ ticker, type, quantity, price, fees, date })

    // Normalizar ticker
    const normalizedTicker = ticker.toUpperCase().trim()

    // Se for venda, validar quantidade disponivel
    if (type === 'SELL') {
      await this._validateSellQuantity({ userId, walletId, ticker: normalizedTicker, quantity })
    }

    // Usar sessao MongoDB para atomicidade
    const session = await this.appManager.getDb().startSession()
    session.startTransaction()

    try {
      // Criar transacao
      const transaction = await this.transactionDAO.create({
        walletId,
        userId,
        ticker: normalizedTicker,
        type,
        quantity,
        price,
        fees,
        date: new Date(date),
        currency,
        notes,
        isDeleted: false,
      }, session)

      // Calcular realizedPnL se for venda
      if (type === 'SELL') {
        const position = await this.positionManager.getPosition({ userId, walletId, ticker: normalizedTicker })
        const realizedPnL = this._calculateRealizedPnL({
          quantity,
          sellPrice: price,
          averagePrice: position.averagePrice,
          fees,
        })
        
        // Atualizar transacao com realizedPnL
        await this.transactionDAO.update(transaction._id, userId, { realizedPnL }, session)
        transaction.realizedPnL = realizedPnL
      }

      // Atualizar posicao
      const position = await this.positionManager.updatePosition({
        userId,
        walletId,
        ticker: normalizedTicker,
        transaction: {
          type,
          quantity,
          price,
          fees,
          date: new Date(date),
        },
        session,
      })

      // Commit da transacao
      await session.commitTransaction()

      return {
        transaction,
        position,
      }
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  // ==================== LISTAR TRANSACOES ====================

  async list({ userId, walletId, type, ticker, startDate, endDate, sortBy = 'date', sortOrder = 'desc', page = 1, limit = 50 }) {
    const skip = (page - 1) * limit
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 }

    const transactions = await this.transactionDAO.findByWallet(walletId, userId, {
      type,
      ticker,
      startDate,
      endDate,
      sort,
      limit,
      skip,
    })

    const total = await this.transactionDAO.countByWallet(walletId, userId)

    return {
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  // ==================== EDITAR TRANSACAO ====================

  async update({ userId, transactionId, ...updateData }) {
    // Buscar transacao existente
    const existingTransaction = await this.transactionDAO.findById(transactionId)
    if (!existingTransaction || existingTransaction.userId !== userId) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.TRANSACTION_NOT_FOUND)
    }

    if (existingTransaction.isDeleted) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.TRANSACTION_ALREADY_DELETED)
    }

    // Validar novos dados
    const newData = { ...existingTransaction, ...updateData }
    this._validateTransactionData(newData)

    // Usar sessao MongoDB
    const session = await this.appManager.getDb().startSession()
    session.startTransaction()

    try {
      // Atualizar transacao
      const updatedTransaction = await this.transactionDAO.update(
        transactionId,
        userId,
        updateData,
        session
      )

      // Recalcular posicao do zero
      const position = await this.positionManager.fullRecalculate({
        userId,
        walletId: existingTransaction.walletId,
        ticker: existingTransaction.ticker,
        session,
      })

      await session.commitTransaction()

      return {
        transaction: updatedTransaction,
        position,
      }
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  // ==================== EXCLUIR TRANSACAO ====================

  async delete({ userId, transactionId }) {
    // Buscar transacao existente
    const existingTransaction = await this.transactionDAO.findById(transactionId)
    if (!existingTransaction || existingTransaction.userId !== userId) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.TRANSACTION_NOT_FOUND)
    }

    if (existingTransaction.isDeleted) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.TRANSACTION_ALREADY_DELETED)
    }

    // Usar sessao MongoDB
    const session = await this.appManager.getDb().startSession()
    session.startTransaction()

    try {
      // Soft delete
      const deletedTransaction = await this.transactionDAO.softDelete(
        transactionId,
        userId,
        session
      )

      // Recalcular posicao
      const position = await this.positionManager.fullRecalculate({
        userId,
        walletId: existingTransaction.walletId,
        ticker: existingTransaction.ticker,
        session,
      })

      await session.commitTransaction()

      return {
        transaction: deletedTransaction,
        position,
      }
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  // ==================== VALIDACOES ====================

  _validateTransactionData({ ticker, type, quantity, price, fees, date }) {
    if (!ticker || ticker.trim().length === 0) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.TICKER_REQUIRED)
    }

    if (!type || !['BUY', 'SELL'].includes(type)) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.INVALID_TRANSACTION_TYPE)
    }

    if (!quantity || quantity <= 0) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.INVALID_QUANTITY)
    }

    if (!price || price <= 0) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.INVALID_PRICE)
    }

    if (fees < 0) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.INVALID_FEES)
    }

    if (!date) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.DATE_REQUIRED)
    }

    const transactionDate = new Date(date)
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    if (transactionDate > today) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.FUTURE_DATE_NOT_ALLOWED)
    }
  }

  async _validateSellQuantity({ userId, walletId, ticker, quantity }) {
    const position = await this.positionManager.getPosition({ userId, walletId, ticker })

    if (!position || position.quantity <= 0) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.NO_POSITION_FOR_ASSET)
    }

    if (quantity > position.quantity) {
      const error = {
        ...APP_CONSTANTS.ERRORS.INSUFFICIENT_QUANTITY,
        message: `Quantidade insuficiente. Voce possui ${position.quantity} unidades de ${ticker} e tentou vender ${quantity}.`,
      }
      this.appManager.handleError(error)
    }
  }

  _calculateRealizedPnL({ quantity, sellPrice, averagePrice, fees }) {
    const grossProfit = (sellPrice * quantity) - (averagePrice * quantity)
    return grossProfit - fees
  }
}

module.exports = TransactionManager
```

#### position-manager.js

```javascript
const PositionDAO = require('./position-dao')
const TransactionDAO = require('../transaction/transaction-dao')
const APP_CONSTANTS = require('../app-constants')

class PositionManager {
  constructor(appManager) {
    this.appManager = appManager
    this.positionDAO = new PositionDAO(appManager.getDb())
    this.transactionDAO = new TransactionDAO(appManager.getDb())
  }

  // ==================== OBTER POSICAO ====================

  async getPosition({ userId, walletId, ticker }) {
    const position = await this.positionDAO.findByTicker(walletId, userId, ticker)
    return position || { quantity: 0, averagePrice: 0, totalInvested: 0 }
  }

  // ==================== LISTAR POSICOES ====================

  async list({ userId, walletId, status }) {
    return await this.positionDAO.findByWallet(walletId, userId, { status })
  }

  // ==================== ATUALIZAR POSICAO ====================

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

    // Arredondar valores
    position.averagePrice = Math.round(position.averagePrice * 100) / 100
    position.totalInvested = Math.round(position.totalInvested * 100) / 100
    position.totalFees = Math.round(position.totalFees * 100) / 100

    // Salvar posicao
    return await this.positionDAO.upsert(position, session)
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
      return await this.positionDAO.upsert({
        walletId,
        userId,
        ticker,
        quantity: 0,
        averagePrice: 0,
        totalInvested: 0,
        totalFees: 0,
        status: 'CLOSED',
      }, session)
    }

    // Replay cronologico
    let quantity = 0
    let totalInvested = 0
    let totalFees = 0
    let lastTransactionDate = null

    for (const tx of transactions) {
      if (tx.type === 'BUY') {
        totalInvested += (tx.quantity * tx.price) + tx.fees
        totalFees += tx.fees
        quantity += tx.quantity
      } else if (tx.type === 'SELL') {
        // Validar se ha quantidade suficiente
        if (tx.quantity > quantity) {
          const error = {
            ...APP_CONSTANTS.ERRORS.POSITION_CONFLICT,
            message: `A alteracao resultaria em posicao negativa de ${ticker} na data ${tx.date}.`,
          }
          this.appManager.handleError(error)
        }

        // Reduzir proporcionalmente
        const sellRatio = tx.quantity / quantity
        totalInvested -= totalInvested * sellRatio
        totalFees -= totalFees * sellRatio
        quantity -= tx.quantity
      }

      lastTransactionDate = tx.date
    }

    // Calcular preco medio
    const averagePrice = quantity > 0 ? totalInvested / quantity : 0
    const status = quantity > 0 ? 'ACTIVE' : 'CLOSED'

    // Salvar posicao
    return await this.positionDAO.upsert({
      walletId,
      userId,
      ticker,
      quantity: Math.round(quantity * 100000000) / 100000000, // 8 casas para cripto
      averagePrice: Math.round(averagePrice * 100) / 100,
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      status,
      lastTransactionDate,
    }, session)
  }
}

module.exports = PositionManager
```

### 2.4 Routers

#### transaction-router.js

```javascript
const express = require('express')
const APP_CONSTANTS = require('../app-constants')
const jwtMiddleware = require('../auth/jwt-middleware')

class TransactionRouter {
  static handleError(exception, res) {
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getRoutes(appManager) {
    const router = express.Router()
    const transactionManager = appManager.getTransactionManager()
    const positionManager = appManager.getPositionManager()

    // Aplicar middleware JWT
    router.use(jwtMiddleware(appManager, appManager.config))

    // GET /api/transactions - Listar transacoes
    router.get('/transactions', async (req, res) => {
      try {
        const result = await transactionManager.list({
          userId: req.user.userId,
          ...req.query,
        })
        res.status(200).send(result)
      } catch (exception) {
        TransactionRouter.handleError(exception, res)
      }
    })

    // POST /api/transactions - Criar transacao
    router.post('/transactions', async (req, res) => {
      try {
        const result = await transactionManager.create({
          userId: req.user.userId,
          ...req.body,
        })
        res.status(201).send(result)
      } catch (exception) {
        TransactionRouter.handleError(exception, res)
      }
    })

    // GET /api/transactions/:id - Obter transacao
    router.get('/transactions/:id', async (req, res) => {
      try {
        const transaction = await transactionManager.getById({
          userId: req.user.userId,
          transactionId: req.params.id,
        })
        res.status(200).send(transaction)
      } catch (exception) {
        TransactionRouter.handleError(exception, res)
      }
    })

    // PUT /api/transactions/:id - Editar transacao
    router.put('/transactions/:id', async (req, res) => {
      try {
        const result = await transactionManager.update({
          userId: req.user.userId,
          transactionId: req.params.id,
          ...req.body,
        })
        res.status(200).send(result)
      } catch (exception) {
        TransactionRouter.handleError(exception, res)
      }
    })

    // DELETE /api/transactions/:id - Excluir transacao
    router.delete('/transactions/:id', async (req, res) => {
      try {
        const result = await transactionManager.delete({
          userId: req.user.userId,
          transactionId: req.params.id,
        })
        res.status(200).send(result)
      } catch (exception) {
        TransactionRouter.handleError(exception, res)
      }
    })

    // GET /api/positions - Listar posicoes
    router.get('/positions', async (req, res) => {
      try {
        const positions = await positionManager.list({
          userId: req.user.userId,
          ...req.query,
        })
        res.status(200).send(positions)
      } catch (exception) {
        TransactionRouter.handleError(exception, res)
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
        TransactionRouter.handleError(exception, res)
      }
    })

    return router
  }
}

module.exports = TransactionRouter
```

---

## 3. Componentes Frontend

### 3.1 Pages

| Pagina | Arquivo | Rota | Descricao |
|--------|---------|------|-----------|
| TransactionsPage | `src/pages/TransactionsPage.vue` | `/transactions` | Lista de transacoes |
| TransactionFormPage | `src/pages/TransactionFormPage.vue` | `/transactions/new` | Formulario de transacao |
| PositionsPage | `src/pages/PositionsPage.vue` | `/positions` | Lista de posicoes |

### 3.2 Components

#### TransactionForm.vue

```vue
<template>
  <form @submit.prevent="handleSubmit" class="transaction-form">
    <!-- Tipo de Transacao -->
    <div class="form-group">
      <label>Tipo</label>
      <div class="type-selector">
        <button
          type="button"
          :class="['type-btn', 'buy', { active: form.type === 'BUY' }]"
          @click="form.type = 'BUY'"
        >
          Compra
        </button>
        <button
          type="button"
          :class="['type-btn', 'sell', { active: form.type === 'SELL' }]"
          @click="form.type = 'SELL'"
        >
          Venda
        </button>
      </div>
    </div>

    <!-- Ticker -->
    <div class="form-group">
      <label for="ticker">Ativo (Ticker)</label>
      <input
        id="ticker"
        v-model="form.ticker"
        type="text"
        placeholder="Ex: PETR4"
        maxlength="20"
        :disabled="isLoading"
        @blur="normalizeTicker"
        required
      />
      <span v-if="errors.ticker" class="error">{{ errors.ticker }}</span>
      
      <!-- Posicao disponivel (apenas para venda) -->
      <div v-if="form.type === 'SELL' && availableQuantity !== null" class="available-info">
        Disponivel: {{ availableQuantity }} unidades
      </div>
    </div>

    <!-- Quantidade -->
    <div class="form-group">
      <label for="quantity">Quantidade</label>
      <input
        id="quantity"
        v-model.number="form.quantity"
        type="number"
        step="0.00000001"
        min="0"
        placeholder="0"
        :disabled="isLoading"
        required
      />
      <span v-if="errors.quantity" class="error">{{ errors.quantity }}</span>
    </div>

    <!-- Preco -->
    <div class="form-group">
      <label for="price">Preco Unitario ({{ walletCurrency }})</label>
      <input
        id="price"
        v-model.number="form.price"
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        :disabled="isLoading"
        required
      />
      <span v-if="errors.price" class="error">{{ errors.price }}</span>
    </div>

    <!-- Taxas -->
    <div class="form-group">
      <label for="fees">Taxas ({{ walletCurrency }})</label>
      <input
        id="fees"
        v-model.number="form.fees"
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        :disabled="isLoading"
      />
    </div>

    <!-- Data -->
    <div class="form-group">
      <label for="date">Data da Operacao</label>
      <input
        id="date"
        v-model="form.date"
        type="date"
        :max="todayDate"
        :disabled="isLoading"
        required
      />
      <span v-if="errors.date" class="error">{{ errors.date }}</span>
    </div>

    <!-- Observacoes -->
    <div class="form-group">
      <label for="notes">Observacoes (opcional)</label>
      <textarea
        id="notes"
        v-model="form.notes"
        maxlength="500"
        placeholder="Notas sobre a operacao..."
        :disabled="isLoading"
      />
    </div>

    <!-- Total Calculado -->
    <div class="total-section">
      <div class="total-row">
        <span>Total:</span>
        <span class="total-value">{{ formattedTotal }}</span>
      </div>
      <div v-if="form.type === 'SELL' && estimatedPnL !== null" class="pnl-row">
        <span>P/L Estimado:</span>
        <span :class="['pnl-value', { profit: estimatedPnL >= 0, loss: estimatedPnL < 0 }]">
          {{ formatCurrency(estimatedPnL) }}
        </span>
      </div>
    </div>

    <!-- Botoes -->
    <div class="actions">
      <Button type="button" variant="secondary" @click="handleCancel">
        Cancelar
      </Button>
      <Button type="submit" variant="primary" :loading="isLoading">
        {{ isEditing ? 'Salvar' : 'Registrar' }}
      </Button>
    </div>
  </form>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTransactionStore } from '@/stores/transaction-store'
import { useWalletStore } from '@/stores/wallet-store'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const transactionStore = useTransactionStore()
const walletStore = useWalletStore()

const props = defineProps({
  initialData: Object,
  isEditing: Boolean,
})

const emit = defineEmits(['submit', 'cancel'])

const form = reactive({
  type: 'BUY',
  ticker: '',
  quantity: null,
  price: null,
  fees: 0,
  date: new Date().toISOString().split('T')[0],
  notes: '',
})

const errors = reactive({
  ticker: '',
  quantity: '',
  price: '',
  date: '',
})

const isLoading = ref(false)
const availableQuantity = ref(null)

const walletCurrency = computed(() => walletStore.activeWallet?.currency || 'BRL')

const todayDate = computed(() => new Date().toISOString().split('T')[0])

const total = computed(() => {
  if (!form.quantity || !form.price) return 0
  return (form.quantity * form.price) + (form.fees || 0)
})

const formattedTotal = computed(() => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: walletCurrency.value,
  }).format(total.value)
})

const estimatedPnL = computed(() => {
  if (form.type !== 'SELL' || !availableQuantity.value) return null
  // TODO: Calcular com base no preco medio real
  return null
})

const normalizeTicker = () => {
  form.ticker = form.ticker.toUpperCase().trim()
}

const fetchAvailableQuantity = async () => {
  if (form.type === 'SELL' && form.ticker) {
    try {
      const position = await transactionStore.getPosition(form.ticker)
      availableQuantity.value = position?.quantity || 0
    } catch {
      availableQuantity.value = 0
    }
  }
}

watch(() => form.type, () => {
  if (form.type === 'SELL') {
    fetchAvailableQuantity()
  } else {
    availableQuantity.value = null
  }
})

watch(() => form.ticker, () => {
  if (form.type === 'SELL') {
    fetchAvailableQuantity()
  }
})

const validate = () => {
  let isValid = true

  if (!form.ticker || form.ticker.trim().length === 0) {
    errors.ticker = 'Ticker e obrigatorio'
    isValid = false
  } else {
    errors.ticker = ''
  }

  if (!form.quantity || form.quantity <= 0) {
    errors.quantity = 'Quantidade deve ser maior que zero'
    isValid = false
  } else if (form.type === 'SELL' && availableQuantity.value && form.quantity > availableQuantity.value) {
    errors.quantity = `Quantidade maxima: ${availableQuantity.value}`
    isValid = false
  } else {
    errors.quantity = ''
  }

  if (!form.price || form.price <= 0) {
    errors.price = 'Preco deve ser maior que zero'
    isValid = false
  } else {
    errors.price = ''
  }

  if (!form.date) {
    errors.date = 'Data e obrigatoria'
    isValid = false
  } else if (new Date(form.date) > new Date()) {
    errors.date = 'Data nao pode ser futura'
    isValid = false
  } else {
    errors.date = ''
  }

  return isValid
}

const handleSubmit = async () => {
  if (!validate()) return

  isLoading.value = true

  try {
    const data = {
      walletId: walletStore.activeWallet._id,
      ...form,
    }

    if (props.isEditing) {
      await transactionStore.updateTransaction(props.initialData._id, data)
    } else {
      await transactionStore.createTransaction(data)
    }

    emit('submit')
    router.push('/transactions')
  } catch (error) {
    console.error('Erro ao salvar:', error)
  } finally {
    isLoading.value = false
  }
}

const handleCancel = () => {
  emit('cancel')
  router.push('/transactions')
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: walletCurrency.value,
  }).format(value)
}

onMounted(() => {
  if (props.initialData) {
    Object.assign(form, props.initialData)
    form.date = new Date(props.initialData.date).toISOString().split('T')[0]
  }
})
</script>
```

#### TransactionConfirmDialog.vue

```vue
<template>
  <Modal :isOpen="isOpen" @close="close">
    <template #header>
      <h2>Confirmar Venda</h2>
    </template>

    <div class="confirm-content">
      <div class="summary-row">
        <span>Ativo:</span>
        <strong>{{ transaction.ticker }}</strong>
      </div>
      <div class="summary-row">
        <span>Quantidade:</span>
        <strong>{{ transaction.quantity }}</strong>
      </div>
      <div class="summary-row">
        <span>Preco de Venda:</span>
        <strong>{{ formatCurrency(transaction.price) }}</strong>
      </div>
      <div class="summary-row">
        <span>Taxas:</span>
        <strong>{{ formatCurrency(transaction.fees) }}</strong>
      </div>
      <div class="summary-row">
        <span>Total Bruto:</span>
        <strong>{{ formatCurrency(transaction.quantity * transaction.price) }}</strong>
      </div>
      <div class="summary-row">
        <span>Total Liquido:</span>
        <strong>{{ formatCurrency((transaction.quantity * transaction.price) - transaction.fees) }}</strong>
      </div>

      <div class="divider"></div>

      <div class="pnl-section">
        <div class="summary-row">
          <span>Preco Medio:</span>
          <strong>{{ formatCurrency(position.averagePrice) }}</strong>
        </div>
        <div class="summary-row pnl">
          <span>P/L Estimado:</span>
          <strong :class="['pnl-value', { profit: estimatedPnL >= 0, loss: estimatedPnL < 0 }]">
            {{ formatCurrency(estimatedPnL) }}
          </strong>
        </div>
      </div>

      <div class="divider"></div>

      <div class="position-section">
        <div class="summary-row">
          <span>Posicao Atual:</span>
          <strong>{{ position.quantity }} unidades</strong>
        </div>
        <div class="summary-row">
          <span>Posicao Apos Venda:</span>
          <strong>{{ position.quantity - transaction.quantity }} unidades</strong>
        </div>
      </div>
    </div>

    <div class="actions">
      <Button variant="secondary" @click="close">
        Cancelar
      </Button>
      <Button variant="danger" :loading="isLoading" @click="confirm">
        Confirmar Venda
      </Button>
    </div>
  </Modal>
</template>

<script setup>
import { computed } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Button from '@/components/ui/Button.vue'

const props = defineProps({
  isOpen: Boolean,
  transaction: Object,
  position: Object,
  isLoading: Boolean,
})

const emit = defineEmits(['close', 'confirm'])

const estimatedPnL = computed(() => {
  if (!props.position || !props.transaction) return 0
  const { quantity, price, fees } = props.transaction
  const { averagePrice } = props.position
  return (price * quantity) - (averagePrice * quantity) - fees
})

const close = () => {
  emit('close')
}

const confirm = () => {
  emit('confirm')
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
</script>
```

### 3.3 Services

#### transaction-service.js

```javascript
import api from './api'

class TransactionService {
  async getTransactions(params) {
    return await api.get('/transactions', params)
  }

  async getTransaction(transactionId) {
    return await api.get(`/transactions/${transactionId}`)
  }

  async createTransaction(data) {
    return await api.post('/transactions', data)
  }

  async updateTransaction(transactionId, data) {
    return await api.put(`/transactions/${transactionId}`, data)
  }

  async deleteTransaction(transactionId) {
    return await api.delete(`/transactions/${transactionId}`)
  }

  async getPositions(params) {
    return await api.get('/positions', params)
  }

  async getPosition(ticker, walletId) {
    return await api.get(`/positions/${ticker}`, { walletId })
  }
}

export default new TransactionService()
```

### 3.4 Store/State

#### transaction-store.js (Pinia)

```javascript
import { defineStore } from 'pinia'
import transactionService from '@/services/transaction-service'

export const useTransactionStore = defineStore('transaction', {
  state: () => ({
    transactions: [],
    positions: [],
    pagination: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    activePositions: (state) => state.positions.filter((p) => p.status === 'ACTIVE' && p.quantity > 0),
    closedPositions: (state) => state.positions.filter((p) => p.status === 'CLOSED' || p.quantity === 0),
  },

  actions: {
    async fetchTransactions(params) {
      this.isLoading = true
      this.error = null

      try {
        const result = await transactionService.getTransactions(params)
        this.transactions = result.data
        this.pagination = result.pagination
        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async createTransaction(data) {
      this.isLoading = true
      this.error = null

      try {
        const result = await transactionService.createTransaction(data)
        this.transactions.unshift(result.transaction)
        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async updateTransaction(transactionId, data) {
      this.isLoading = true
      this.error = null

      try {
        const result = await transactionService.updateTransaction(transactionId, data)
        const index = this.transactions.findIndex((t) => t._id === transactionId)
        if (index !== -1) {
          this.transactions[index] = result.transaction
        }
        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async deleteTransaction(transactionId) {
      this.isLoading = true
      this.error = null

      try {
        const result = await transactionService.deleteTransaction(transactionId)
        this.transactions = this.transactions.filter((t) => t._id !== transactionId)
        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async fetchPositions(walletId) {
      this.isLoading = true
      this.error = null

      try {
        this.positions = await transactionService.getPositions({ walletId })
        return this.positions
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async getPosition(ticker, walletId) {
      try {
        return await transactionService.getPosition(ticker, walletId)
      } catch (error) {
        return { quantity: 0, averagePrice: 0 }
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
  title: MoneyTrackr Transaction API
  version: 1.0.0

paths:
  /transactions:
    get:
      summary: Listar transacoes
      tags: [Transactions]
      security:
        - bearerAuth: []
      parameters:
        - name: walletId
          in: query
          required: true
          schema:
            type: string
        - name: type
          in: query
          schema:
            type: string
            enum: [BUY, SELL]
        - name: ticker
          in: query
          schema:
            type: string
        - name: startDate
          in: query
          schema:
            type: string
            format: date
        - name: endDate
          in: query
          schema:
            type: string
            format: date
        - name: sortBy
          in: query
          schema:
            type: string
            default: date
        - name: sortOrder
          in: query
          schema:
            type: string
            enum: [asc, desc]
            default: desc
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
      responses:
        '200':
          description: Lista de transacoes paginada
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Transaction'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

    post:
      summary: Criar transacao
      tags: [Transactions]
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransactionInput'
      responses:
        '201':
          description: Transacao criada
          content:
            application/json:
              schema:
                type: object
                properties:
                  transaction:
                    $ref: '#/components/schemas/Transaction'
                  position:
                    $ref: '#/components/schemas/Position'
        '400':
          description: Dados invalidos
        '422':
          description: Quantidade insuficiente para venda

  /transactions/{id}:
    get:
      summary: Obter transacao por ID
      tags: [Transactions]
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
          description: Transacao encontrada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Transaction'
        '404':
          description: Transacao nao encontrada

    put:
      summary: Editar transacao
      tags: [Transactions]
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
              $ref: '#/components/schemas/TransactionInput'
      responses:
        '200':
          description: Transacao atualizada
          content:
            application/json:
              schema:
                type: object
                properties:
                  transaction:
                    $ref: '#/components/schemas/Transaction'
                  position:
                    $ref: '#/components/schemas/Position'
        '422':
          description: Edicao resultaria em posicao negativa

    delete:
      summary: Excluir transacao (soft delete)
      tags: [Transactions]
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
          description: Transacao excluida
          content:
            application/json:
              schema:
                type: object
                properties:
                  transaction:
                    $ref: '#/components/schemas/Transaction'
                  position:
                    $ref: '#/components/schemas/Position'

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

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Transaction:
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
        type:
          type: string
          enum: [BUY, SELL]
        quantity:
          type: number
        price:
          type: number
        fees:
          type: number
        date:
          type: string
          format: date-time
        currency:
          type: string
        notes:
          type: string
        realizedPnL:
          type: number
        isDeleted:
          type: boolean
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    TransactionInput:
      type: object
      required: [walletId, ticker, type, quantity, price, date]
      properties:
        walletId:
          type: string
        ticker:
          type: string
          maxLength: 20
        type:
          type: string
          enum: [BUY, SELL]
        quantity:
          type: number
          minimum: 0.00000001
        price:
          type: number
          minimum: 0.00000001
        fees:
          type: number
          minimum: 0
          default: 0
        date:
          type: string
          format: date
        currency:
          type: string
          enum: [BRL, USD, EUR]
          default: BRL
        notes:
          type: string
          maxLength: 500

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
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    Pagination:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        totalPages:
          type: integer
```

---

## 5. Fluxos de Dados

### Sequencia: Criar Transacao de Compra

```
+--------+    +------------+    +------------------+    +-------+
|Usuario |    | Frontend   |    |TransactionManager|    |MongoDB|
+--------+    +------------+    +------------------+    +-------+
    |              |                   |                   |
    | dados compra |                   |                   |
    |------------->|                   |                   |
    |              | POST /transactions|                   |
    |              |------------------>|                   |
    |              |                   | validate()        |
    |              |                   |-------------------|
    |              |                   |                   |
    |              |                   | startSession()    |
    |              |                   |------------------>|
    |              |                   |<------------------|
    |              |                   |   session         |
    |              |                   |                   |
    |              |                   | create()          |
    |              |                   |------------------>|
    |              |                   |<------------------|
    |              |                   |   transaction     |
    |              |                   |                   |
    |              |                   | updatePosition()  |
    |              |                   |------------------>|
    |              |                   |<------------------|
    |              |                   |   position        |
    |              |                   |                   |
    |              |                   | commitTransaction()|
    |              |                   |------------------>|
    |              |                   |<------------------|
    |              |                   |                   |
    |              | { transaction,    |                   |
    |              |   position }      |                   |
    |              |<------------------|                   |
    |              |                   |                   |
    | { success }  |                   |                   |
    |<-------------|                   |                   |
```

### Sequencia: Recalculo apos Edicao

```
+--------+    +------------+    +------------------+    +-------+
|Usuario |    | Frontend   |    |TransactionManager|    |MongoDB|
+--------+    +------------+    +------------------+    +-------+
    |              |                   |                   |
    | edita dados  |                   |                   |
    |------------->|                   |                   |
    |              | PUT /transactions/:id                |
    |              |------------------>|                   |
    |              |                   | findById()        |
    |              |                   |------------------>|
    |              |                   |<------------------|
    |              |                   |   existing        |
    |              |                   |                   |
    |              |                   | startSession()    |
    |              |                   |------------------>|
    |              |                   |<------------------|
    |              |                   |                   |
    |              |                   | update()          |
    |              |                   |------------------>|
    |              |                   |<------------------|
    |              |                   |   updated         |
    |              |                   |                   |
    |              |                   | fullRecalculate() |
    |              |                   |------------------>|
    |              |                   |  findByTicker()   |
    |              |                   |------------------>|
    |              |                   |<------------------|
    |              |                   |   all txs         |
    |              |                   |                   |
    |              |                   | replay cronologico|
    |              |                   |-------------------|
    |              |                   |                   |
    |              |                   | upsert()          |
    |              |                   |------------------>|
    |              |                   |<------------------|
    |              |                   |   position        |
    |              |                   |                   |
    |              |                   | commitTransaction()|
    |              |                   |------------------>|
    |              |                   |<------------------|
    |              |                   |                   |
    |              | { transaction,    |                   |
    |              |   position }      |                   |
    |              |<------------------|                   |
```

---

## 6. Estrutura de Arquivos

```
investment-service/
|-- src/
|   |-- app/
|   |   |-- transaction/
|   |   |   |-- transaction-model.js
|   |   |   |-- transaction-dao.js
|   |   |   |-- transaction-manager.js
|   |   |   |-- transaction-router.js
|   |   |-- position/
|   |   |   |-- position-model.js
|   |   |   |-- position-dao.js
|   |   |   |-- position-manager.js
|   |   |-- app-constants.js
|   |-- __tests__/
|       |-- transaction.test.js
|       |-- position.test.js

investment-app/
|-- src/
|   |-- pages/
|   |   |-- TransactionsPage.vue
|   |   |-- TransactionFormPage.vue
|   |   |-- PositionsPage.vue
|   |-- components/
|   |   |-- transaction/
|   |   |   |-- TransactionForm.vue
|   |   |   |-- TransactionConfirmDialog.vue
|   |   |   |-- TransactionTable.vue
|   |   |   |-- TransactionFilters.vue
|   |   |-- position/
|   |       |-- PositionCard.vue
|   |       |-- PositionTable.vue
|   |-- services/
|   |   |-- transaction-service.js
|   |-- stores/
|       |-- transaction-store.js
```

---

## 7. Ordem de Implementacao

### Fase 1: Backend - Models e DAOs (Prioridade: Alta)

1. Criar `transaction-model.js` com schema completo
2. Criar `position-model.js` com schema completo
3. Criar `transaction-dao.js` com metodos de CRUD
4. Criar `position-dao.js` com metodos de CRUD
5. Adicionar constantes de erro em `app-constants.js`

### Fase 2: Backend - Managers (Prioridade: Alta)

1. Implementar `position-manager.js` - calculos de posicao
2. Implementar `transaction-manager.js` - criar transacao
3. Implementar `transaction-manager.js` - listar transacoes
4. Implementar `transaction-manager.js` - editar transacao
5. Implementar `transaction-manager.js` - excluir transacao

### Fase 3: Backend - Router (Prioridade: Alta)

1. Implementar `transaction-router.js` - todas as rotas
2. Integrar com JWT middleware

### Fase 4: Frontend - UI de Transacoes (Prioridade: Alta)

1. Criar `transaction-store.js` (Pinia)
2. Criar `transaction-service.js`
3. Implementar `TransactionForm.vue`
4. Implementar `TransactionConfirmDialog.vue`
5. Implementar `TransactionsPage.vue`

### Fase 5: Frontend - UI de Posicoes (Prioridade: Media)

1. Implementar `PositionsPage.vue`
2. Implementar `PositionCard.vue`
3. Implementar `PositionTable.vue`

### Fase 6: Testes e Validacao (Prioridade: Alta)

1. Testes unitarios dos managers
2. Testes de integracao das rotas
3. Testes E2E dos fluxos

---

## 8. Riscos Tecnicos

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|:-------------:|:------:|-----------|
| Inconsistencia por operacoes concorrentes | Media | Alto | Usar MongoDB sessions/transactions |
| Recalculo lento com muitas transacoes | Baixa | Medio | Indexar corretamente; paginar |
| Edicao retroativa causando posicao negativa | Media | Alto | Validar toda a timeline antes de persistir |
| Perda de dados por delete acidental | Baixa | Alto | Soft delete obrigatorio |
| Precisao de calculo com float | Media | Medio | Arredondamento consistente (2 casas) |

---

## 9. Dependencias

### Backend

Nenhuma dependencia adicional alem das ja existentes.

### Frontend

Nenhuma dependencia adicional alem das ja existentes.

---

## 10. Checklist de Implementacao

### Backend
- [ ] Transaction Model com schema completo
- [ ] Position Model com schema completo
- [ ] Transaction DAO com todos os metodos
- [ ] Position DAO com todos os metodos
- [ ] Position Manager - calculos implementados
- [ ] Transaction Manager - criar implementado
- [ ] Transaction Manager - listar implementado
- [ ] Transaction Manager - editar implementado
- [ ] Transaction Manager - excluir implementado
- [ ] Transaction Router com todas as rotas
- [ ] Constantes de erro adicionadas
- [ ] Testes unitarios >= 90% cobertura
- [ ] Testes de integracao passando

### Frontend
- [ ] Transaction Store (Pinia) implementada
- [ ] Transaction Service implementado
- [ ] TransactionForm funcional
- [ ] TransactionConfirmDialog funcional
- [ ] TransactionsPage funcional
- [ ] PositionsPage funcional
- [ ] Rotas configuradas

### Integracao
- [ ] Transacoes atomicas funcionando
- [ ] Soft delete preservando dados
- [ ] Recalculo de posicao funcionando
- [ ] Validacao de quantidade para venda

---

*Documento criado pelo Architect - MoneyTrackr V3*
