const PositionDAO = require('./position-dao')
const TransactionDAO = require('../transaction/transaction-dao')
const APP_CONSTANTS = require('../app-constants')
const { JsonLog } = require('json-log-middleware')
const logger = new JsonLog(APP_CONSTANTS.SERVICE_NAME)

class PositionManager {
  constructor(appManager, appDB) {
    this.appDB = appDB
    this.positionDAO = new PositionDAO(this.appDB.getDb())
    this.transactionDAO = new TransactionDAO(this.appDB.getDb())
    this.appManager = appManager
    this.handleError = appManager.handleError.bind(appManager)
  }

  inicialize(_appManager) {
    logger.log('PositionManager inicializado', { internal: { method: 'inicialize', filename: 'position-manager.js' } })
  }

  // ==================== OBTER POSICAO ====================

  async getPosition({ userId, walletId, ticker }) {
    logger.log('Buscando posicao por ticker', { userId, walletId, ticker, internal: { method: 'getPosition', filename: 'position-manager.js' } })

    const position = await this.positionDAO.findByTicker(walletId, userId, ticker)
    return position || { quantity: 0, averagePrice: 0, totalInvested: 0 }
  }

  // ==================== LISTAR POSICOES ====================

  async list({ userId, walletId, status }) {
    logger.log('Listando posicoes', { userId, walletId, status, internal: { method: 'list', filename: 'position-manager.js' } })

    return await this.positionDAO.findByWallet(walletId, userId, { status })
  }

  // ==================== ATUALIZAR POSICAO ====================

  async updatePosition({ userId, walletId, ticker, transaction, session = null }) {
    logger.log('Atualizando posicao', { userId, walletId, ticker, transactionType: transaction.type, internal: { method: 'updatePosition', filename: 'position-manager.js' } })

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
      // Preco medio permanece inalterado em venda parcial
      position.averagePrice = position.quantity > 0
        ? position.totalInvested / position.quantity
        : 0
    }

    // Atualizar status
    position.status = position.quantity > 0 ? 'ACTIVE' : 'CLOSED'
    position.lastTransactionDate = transaction.date

    // Arredondar valores (2 casas para precos, 8 para cripto)
    position.quantity = this._roundQuantity(position.quantity)
    position.averagePrice = this._roundPrice(position.averagePrice)
    position.totalInvested = this._roundPrice(position.totalInvested)
    position.totalFees = this._roundPrice(position.totalFees)

    // Salvar posicao
    return await this.positionDAO.upsert(position, session)
  }

  // ==================== RECALCULO COMPLETO ====================

  async fullRecalculate({ userId, walletId, ticker, session = null }) {
    logger.log('Recalculando posicao completa', { userId, walletId, ticker, internal: { method: 'fullRecalculate', filename: 'position-manager.js' } })

    // Buscar todas as transacoes ativas do ativo (ordenadas por data)
    const transactions = await this.transactionDAO.findByTicker(
      walletId,
      userId,
      ticker,
      session,
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
            message: `A alteracao resultaria em posicao negativa de ${ticker} na data ${tx.date.toISOString().split('T')[0]}.`,
          }
          this.handleError(error)
        }

        // Guard against division by zero
        if (quantity <= 0) {
          const error = {
            ...APP_CONSTANTS.ERRORS.POSITION_CONFLICT,
            message: `A alteracao resultaria em posicao negativa de ${ticker} na data ${tx.date.toISOString().split('T')[0]}.`,
          }
          this.handleError(error)
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
      quantity: this._roundQuantity(quantity),
      averagePrice: this._roundPrice(averagePrice),
      totalInvested: this._roundPrice(totalInvested),
      totalFees: this._roundPrice(totalFees),
      status,
      lastTransactionDate,
    }, session)
  }

  // ==================== HELPERS ====================

  _roundPrice(value) {
    return Math.round(value * 100) / 100
  }

  _roundQuantity(value) {
    return Math.round(value * 100000000) / 100000000
  }
}

module.exports = PositionManager
