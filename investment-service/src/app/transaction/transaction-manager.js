const TransactionDAO = require('./transaction-dao')
const PositionManager = require('../position/position-manager')
const APP_CONSTANTS = require('../app-constants')
const { JsonLog } = require('json-log-middleware')
const logger = new JsonLog(APP_CONSTANTS.SERVICE_NAME)

class TransactionManager {
  constructor(appManager, appDB) {
    this.appDB = appDB
    this.transactionDAO = new TransactionDAO(this.appDB.getDb())
    this.positionManager = new PositionManager(appManager, appDB)
    this.appManager = appManager
    this.handleError = appManager.handleError.bind(appManager)
  }

  inicialize(_appManager) {
    logger.log('TransactionManager inicializado', { internal: { method: 'inicialize', filename: 'transaction-manager.js' } })
  }

  // ==================== HELPERS ====================

  _supportsTransactions() {
    const db = this.appDB.getDb()
    return db.client && db.client.topology && db.client.topology.hasSessionSupport
  }

  async _startSession() {
    if (!this._supportsTransactions()) {
      return null
    }
    const session = await this.appDB.getDb().startSession()
    session.startTransaction()
    return session
  }

  async _commitSession(session) {
    if (session) {
      await session.commitTransaction()
    }
  }

  async _abortSession(session) {
    if (session) {
      await session.abortTransaction()
    }
  }

  _endSession(session) {
    if (session) {
      session.endSession()
    }
  }

  // ==================== CRIAR TRANSACAO ====================

  async create({ userId, walletId, ticker, type, quantity, price, fees = 0, date, currency = 'BRL', notes = '' }) {
    logger.log('Criando transacao', { userId, walletId, ticker, type, quantity, price, fees, internal: { method: 'create', filename: 'transaction-manager.js' } })

    // Validacoes basicas
    this._validateTransactionData({ ticker, type, quantity, price, fees, date })

    // Normalizar ticker
    const normalizedTicker = ticker.toUpperCase().trim()

    // Se for venda, validar quantidade disponivel
    if (type === 'SELL') {
      await this._validateSellQuantity({ userId, walletId, ticker: normalizedTicker, quantity })
    }

    const session = await this._startSession()

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
          currency,
        },
        session,
      })

      // Commit da transacao se suportado
      await this._commitSession(session)

      return {
        transaction,
        position,
      }
    } catch (error) {
      await this._abortSession(session)
      throw error
    } finally {
      this._endSession(session)
    }
  }

  // ==================== LISTAR TRANSACOES ====================

  async list({ userId, walletId, type, ticker, startDate, endDate, sortBy = 'date', sortOrder = 'desc', page = 1, limit = 50 }) {
    logger.log('Listando transacoes', { userId, walletId, type, ticker, startDate, endDate, sortBy, sortOrder, page, limit, internal: { method: 'list', filename: 'transaction-manager.js' } })

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

    const total = await this.transactionDAO.countByWallet(walletId, userId, {
      type,
      ticker,
      startDate,
      endDate,
    })

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

  // ==================== OBTER TRANSACAO POR ID ====================

  async getById({ userId, transactionId }) {
    logger.log('Buscando transacao por ID', { userId, transactionId, internal: { method: 'getById', filename: 'transaction-manager.js' } })

    const transaction = await this.transactionDAO.findById(transactionId)

    // Validar existencia e propriedade
    if (!transaction || transaction.userId !== userId) {
      this.handleError(APP_CONSTANTS.ERRORS.TRANSACTION_NOT_FOUND)
    }

    // Validar se nao foi excluida
    if (transaction.isDeleted) {
      this.handleError(APP_CONSTANTS.ERRORS.TRANSACTION_ALREADY_DELETED)
    }

    return transaction
  }

  // ==================== EDITAR TRANSACAO ====================

  async update({ userId, transactionId, ...updateData }) {
    logger.log('Editando transacao', { userId, transactionId, updateData, internal: { method: 'update', filename: 'transaction-manager.js' } })

    // Buscar transacao existente
    const existingTransaction = await this._getExistingTransaction(userId, transactionId)

    // Validar novos dados - only validate fields that are being updated
    this._validateUpdateData(existingTransaction, updateData)

    const session = await this._startSession()

    try {
      // Atualizar transacao
      const updatedTransaction = await this.transactionDAO.update(
        transactionId,
        userId,
        updateData,
        session,
      )

      // Recalcular posicao do zero
      const position = await this.positionManager.fullRecalculate({
        userId,
        walletId: existingTransaction.walletId,
        ticker: existingTransaction.ticker,
        session,
      })

      await this._commitSession(session)

      return {
        transaction: updatedTransaction,
        position,
      }
    } catch (error) {
      await this._abortSession(session)
      throw error
    } finally {
      this._endSession(session)
    }
  }

  // ==================== EXCLUIR TRANSACAO ====================

  async delete({ userId, transactionId }) {
    logger.log('Excluindo transacao', { userId, transactionId, internal: { method: 'delete', filename: 'transaction-manager.js' } })

    // Buscar transacao existente
    const existingTransaction = await this._getExistingTransaction(userId, transactionId)

    const session = await this._startSession()

    try {
      // Soft delete
      const deletedTransaction = await this.transactionDAO.softDelete(
        transactionId,
        userId,
        session,
      )

      // Recalcular posicao
      const position = await this.positionManager.fullRecalculate({
        userId,
        walletId: existingTransaction.walletId,
        ticker: existingTransaction.ticker,
        session,
      })

      await this._commitSession(session)

      return {
        transaction: deletedTransaction,
        position,
      }
    } catch (error) {
      await this._abortSession(session)
      throw error
    } finally {
      this._endSession(session)
    }
  }

  // ==================== HELPERS ====================

  async _getExistingTransaction(userId, transactionId) {
    const existingTransaction = await this.transactionDAO.findById(transactionId)
    if (!existingTransaction || existingTransaction.userId !== userId) {
      this.handleError(APP_CONSTANTS.ERRORS.TRANSACTION_NOT_FOUND)
    }

    if (existingTransaction.isDeleted) {
      this.handleError(APP_CONSTANTS.ERRORS.TRANSACTION_ALREADY_DELETED)
    }

    return existingTransaction
  }

  // ==================== VALIDACOES ====================

  _validateTransactionData({ ticker, type, quantity, price, fees, date }) {
    this._validateTicker(ticker)
    this._validateType(type)
    this._validateQuantity(quantity)
    this._validatePrice(price)
    this._validateFees(fees)
    this._validateDate(date)
  }

  _validateUpdateData(existingTransaction, updateData) {
    // Convert existing transaction to plain object and merge with update data
    const existingData = existingTransaction.toObject ? existingTransaction.toObject() : existingTransaction
    const mergedData = { ...existingData, ...updateData }

    // Only validate fields that are being updated
    if (updateData.ticker !== undefined) {
      this._validateTicker(updateData.ticker)
    }
    if (updateData.type !== undefined) {
      this._validateType(updateData.type)
    }
    if (updateData.quantity !== undefined) {
      this._validateQuantity(updateData.quantity)
    }
    if (updateData.price !== undefined) {
      this._validatePrice(updateData.price)
    }
    if (updateData.fees !== undefined) {
      this._validateFees(updateData.fees)
    }
    if (updateData.date !== undefined) {
      this._validateDate(updateData.date)
    }

    // Validate that the merged data is still valid
    this._validateTicker(mergedData.ticker)
    this._validateType(mergedData.type)
    this._validateQuantity(mergedData.quantity)
    this._validatePrice(mergedData.price)
    this._validateFees(mergedData.fees)
    this._validateDate(mergedData.date)
  }

  _validateTicker(ticker) {
    if (!ticker || ticker.trim().length === 0) {
      this.handleError(APP_CONSTANTS.ERRORS.TICKER_REQUIRED)
    }
  }

  _validateType(type) {
    if (!type || !['BUY', 'SELL'].includes(type)) {
      this.handleError(APP_CONSTANTS.ERRORS.INVALID_TRANSACTION_TYPE)
    }
  }

  _validateQuantity(quantity) {
    if (!quantity || quantity <= 0) {
      this.handleError(APP_CONSTANTS.ERRORS.INVALID_QUANTITY)
    }
  }

  _validatePrice(price) {
    if (!price || price <= 0) {
      this.handleError(APP_CONSTANTS.ERRORS.INVALID_PRICE)
    }
  }

  _validateFees(fees) {
    if (fees < 0) {
      this.handleError(APP_CONSTANTS.ERRORS.INVALID_FEES)
    }
  }

  _validateDate(date) {
    if (!date) {
      this.handleError(APP_CONSTANTS.ERRORS.DATE_REQUIRED)
    }

    const transactionDate = new Date(date)
    if (isNaN(transactionDate.getTime())) {
      this.handleError(APP_CONSTANTS.ERRORS.DATE_REQUIRED)
    }

    const today = new Date()
    today.setHours(23, 59, 59, 999)

    if (transactionDate > today) {
      this.handleError(APP_CONSTANTS.ERRORS.FUTURE_DATE_NOT_ALLOWED)
    }
  }

  async _validateSellQuantity({ userId, walletId, ticker, quantity }) {
    const position = await this.positionManager.getPosition({ userId, walletId, ticker })

    if (!position || position.quantity <= 0) {
      this.handleError(APP_CONSTANTS.ERRORS.NO_POSITION_FOR_ASSET)
    }

    if (quantity > position.quantity) {
      const error = {
        ...APP_CONSTANTS.ERRORS.INSUFFICIENT_QUANTITY,
        message: `Quantidade insuficiente. Voce possui ${position.quantity} unidades de ${ticker} e tentou vender ${quantity}.`,
      }
      this.handleError(error)
    }
  }

  _calculateRealizedPnL({ quantity, sellPrice, averagePrice, fees }) {
    const grossProfit = (sellPrice * quantity) - (averagePrice * quantity)
    return grossProfit - fees
  }
}

module.exports = TransactionManager
