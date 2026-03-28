const AppDAO = require('../app-dao')
const { positionSchema } = require('./position-model')

class PositionDAO extends AppDAO {
  constructor(db) {
    super(db)
    this.objectModel = this.initializeDBModel(db)
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
        options,
      )
      .lean()
      .exec()
  }

  // ==================== READ ====================

  async findByWallet(walletId, userId, options = {}) {
    const query = { walletId, userId }

    if (options.status) {
      query.status = options.status
    }
    if (options.ticker) {
      query.ticker = options.ticker
    }

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
    const options = session
      ? { session, new: true }
      : { new: true }
    return await this.objectModel
      .findOneAndUpdate(
        { walletId, userId, ticker: ticker.toUpperCase() },
        { $set: updateData },
        options,
      )
      .lean()
      .exec()
  }

  // ==================== DELETE ====================

  async delete(walletId, userId, ticker, session = null) {
    const options = session ? { session } : {}
    return await this.objectModel
      .deleteOne({ walletId, userId, ticker: ticker.toUpperCase() }, options)
      .lean()
      .exec()
  }
}

module.exports = PositionDAO
