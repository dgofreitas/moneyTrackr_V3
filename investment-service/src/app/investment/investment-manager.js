const APP_CONSTANTS = require('../app-constants')
const { JsonLog } = require('json-log-middleware')
const logger = new JsonLog(APP_CONSTANTS.SERVICE_NAME)
const InvestmentDAO = require('./investment-dao')
const { v4: uuidv4 } = require('uuid')

class InvestmentManager {

  constructor(appManager, appDB) {
    this.appDB = appDB
    this.investmentDAO = new InvestmentDAO(this.appDB.getDb())
    this.appManager = appManager
    this.handleError = appManager.handleError.bind(appManager)
  }

  inicialize(_appManager) {
    logger.log('InvestmentManager inicializado', { internal: { method: 'inicialize', filename: 'investment-manager.js' } })
  }

  async createInvestment({ domain, investmentInfo }) {
    logger.log('Criando investimento', { domain, investmentInfo: JSON.stringify(investmentInfo), internal: { filename: 'investment-manager.js', method: 'createInvestment' } })

    // Validate required fields
    const requiredFields = ['portfolioId', 'symbol', 'name', 'type']
    for (const field of requiredFields) {
      if (!investmentInfo[field]) {
        this.handleError(APP_CONSTANTS.ERRORS.VALIDATION_ERROR)
      }
    }

    const existingInvestment = await this.investmentDAO.findOne({
      domain,
      portfolioId: investmentInfo.portfolioId,
      symbol: investmentInfo.symbol,
      status: 'ACTIVE',
    })

    if (existingInvestment) {
      this.handleError(APP_CONSTANTS.ERRORS.INVESTMENT_EXIST)
    }

    const _id = uuidv4()
    investmentInfo._id = _id
    investmentInfo.domain = domain

    try {
      const query = { _id }
      const update = { $set: investmentInfo }
      const options = { upsert: true, new: true }
      const resp = await this.investmentDAO.findOneAndUpdate(query, update, options)
      return resp
    } catch (error) {
      logger.error('Erro ao criar investimento', error, {
        domain,
        investmentInfo: JSON.stringify(investmentInfo),
        internal: { filename: 'investment-manager.js', method: 'createInvestment' },
      })
      this.handleError(APP_CONSTANTS.ERRORS.INVESTMENT_CREATE_ERROR)
    }
  }

  async updateInvestment({ domain, investmentId, investmentInfo }) {
    logger.log('Atualizando investimento', { domain, investmentId, internal: { filename: 'investment-manager.js', method: 'updateInvestment' } })

    const existingInvestment = await this.investmentDAO.findOne({ _id: investmentId, domain })
    if (!existingInvestment) {
      this.handleError(APP_CONSTANTS.ERRORS.INVESTMENT_NOT_FOUND)
    }

    investmentInfo.updatedAt = new Date()

    try {
      const query = { _id: investmentId, domain }
      const update = { $set: investmentInfo }
      const options = { new: true }
      const resp = await this.investmentDAO.findOneAndUpdate(query, update, options)
      return resp
    } catch (error) {
      logger.error('Erro ao atualizar investimento', error, {
        domain,
        investmentId,
        internal: { filename: 'investment-manager.js', method: 'updateInvestment' },
      })
      this.handleError(APP_CONSTANTS.ERRORS.INVESTMENT_UPDATE_ERROR)
    }
  }

  async getInvestment({ domain, investmentId }) {
    logger.log('Buscando investimento', { domain, investmentId, internal: { filename: 'investment-manager.js', method: 'getInvestment' } })

    try {
      const investment = await this.investmentDAO.findOne({ _id: investmentId, domain })
      if (!investment) {
        this.handleError(APP_CONSTANTS.ERRORS.INVESTMENT_NOT_FOUND)
      }
      return investment
    } catch (error) {
      // If error already has a statusCode, rethrow it
      if (error.statusCode) {
        throw error
      }
      logger.error('Erro ao buscar investimento', error, {
        domain,
        investmentId,
        internal: { filename: 'investment-manager.js', method: 'getInvestment' },
      })
      this.handleError(APP_CONSTANTS.ERRORS.INVESTMENT_FETCH_ERROR)
    }
  }

  async getInvestmentsByPortfolio({ domain, portfolioId, options = {} }) {
    logger.log('Buscando investimentos por portfolio', { domain, portfolioId, internal: { filename: 'investment-manager.js', method: 'getInvestmentsByPortfolio' } })

    try {
      const investments = await this.investmentDAO.findByPortfolio(domain, portfolioId, options)
      return investments
    } catch (error) {
      logger.error('Erro ao buscar investimentos', error, {
        domain,
        portfolioId,
        internal: { filename: 'investment-manager.js', method: 'getInvestmentsByPortfolio' },
      })
      this.handleError(APP_CONSTANTS.ERRORS.INVESTMENT_FETCH_ERROR)
    }
  }

  async deleteInvestment({ domain, investmentId }) {
    logger.log('Deletando investimento', { domain, investmentId, internal: { filename: 'investment-manager.js', method: 'deleteInvestment' } })

    const existingInvestment = await this.investmentDAO.findOne({ _id: investmentId, domain })
    if (!existingInvestment) {
      this.handleError(APP_CONSTANTS.ERRORS.INVESTMENT_NOT_FOUND)
    }

    try {
      await this.investmentDAO.removeOneSorted({ _id: investmentId, domain })
    } catch (error) {
      logger.error('Erro ao deletar investimento', error, {
        domain,
        investmentId,
        internal: { filename: 'investment-manager.js', method: 'deleteInvestment' },
      })
      this.handleError(APP_CONSTANTS.ERRORS.INVESTMENT_DELETE_ERROR)
    }
  }

  async addTransaction({ domain, investmentId, transaction }) {
    logger.log('Adicionando transacao', { domain, investmentId, internal: { filename: 'investment-manager.js', method: 'addTransaction' } })

    const existingInvestment = await this.investmentDAO.findOne({ _id: investmentId, domain })
    if (!existingInvestment) {
      this.handleError(APP_CONSTANTS.ERRORS.INVESTMENT_NOT_FOUND)
    }

    try {
      const query = { _id: investmentId, domain }
      const update = {
        $push: { transactions: transaction },
        $set: { updatedAt: new Date() },
      }
      const options = { new: true }
      const resp = await this.investmentDAO.findOneAndUpdate(query, update, options)
      return resp
    } catch (error) {
      logger.error('Erro ao adicionar transacao', error, {
        domain,
        investmentId,
        internal: { filename: 'investment-manager.js', method: 'addTransaction' },
      })
      this.handleError(APP_CONSTANTS.ERRORS.INVESTMENT_UPDATE_ERROR)
    }
  }

  async updateCurrentPrice({ domain, investmentId, currentPrice }) {
    logger.log('Atualizando preco atual', { domain, investmentId, currentPrice, internal: { filename: 'investment-manager.js', method: 'updateCurrentPrice' } })

    const existingInvestment = await this.investmentDAO.findOne({ _id: investmentId, domain })
    if (!existingInvestment) {
      this.handleError(APP_CONSTANTS.ERRORS.INVESTMENT_NOT_FOUND)
    }

    const currentValue = existingInvestment.quantity * currentPrice
    const profitLoss = currentValue - existingInvestment.totalCost
    const profitLossPercent = existingInvestment.totalCost > 0 ? ((profitLoss / existingInvestment.totalCost) * 100) : 0

    try {
      const query = { _id: investmentId, domain }
      const update = {
        $set: {
          currentPrice,
          currentValue,
          profitLoss,
          profitLossPercent,
          updatedAt: new Date(),
        },
      }
      const options = { new: true }
      const resp = await this.investmentDAO.findOneAndUpdate(query, update, options)
      return resp
    } catch (error) {
      logger.error('Erro ao atualizar preco', error, {
        domain,
        investmentId,
        internal: { filename: 'investment-manager.js', method: 'updateCurrentPrice' },
      })
      this.handleError(APP_CONSTANTS.ERRORS.INVESTMENT_UPDATE_ERROR)
    }
  }
}

module.exports = InvestmentManager
