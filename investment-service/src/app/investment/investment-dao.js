const { investmentModelSchema } = require('./investment-model')
const AppDAO = require('../app-dao')

class InvestmentDAO extends AppDAO {

  constructor(db) {
    super(db)
    this.objectModel = this.initializeDBModel(db)
  }

  initializeDBModel(db) {
    const investmentModel = db.model('investment', investmentModelSchema)
    return investmentModel
  }

  async findOne(query, update, options) {
    return await this.objectModel.findOne(query, update, options).lean().exec()
  }

  async findOneAndUpdate(query, update, options) {
    return await this.objectModel.findOneAndUpdate(query, update, options).lean().exec()
  }

  async findByPortfolio(domain, portfolioId, options = {}) {
    let queryBuilder = this.objectModel.find({ domain, portfolioId })
    if (options.sort) {
      queryBuilder = queryBuilder.sort(options.sort)
    }
    if (options.limit) {
      queryBuilder = queryBuilder.limit(options.limit)
    }
    if (options.skip) {
      queryBuilder = queryBuilder.skip(options.skip)
    }
    return await queryBuilder.lean().exec()
  }

  async findBySymbol(domain, symbol) {
    return await this.objectModel.find({ domain, symbol }).lean().exec()
  }

  async countByPortfolio(domain, portfolioId) {
    return await this.objectModel.countDocuments({ domain, portfolioId }).exec()
  }
}

module.exports = InvestmentDAO
