const AppDAO = require('../app-dao')
const { transactionSchema } = require('./transaction-model')

class TransactionDAO extends AppDAO {
  constructor(db) {
    super(db)
    this.objectModel = this.initializeDBModel(db)
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

    if (options.type) {
      query.type = options.type
    }
    if (options.ticker) {
      query.ticker = options.ticker
    }
    if (options.startDate || options.endDate) {
      query.date = {}
      if (options.startDate) {
        query.date.$gte = new Date(options.startDate)
      }
      if (options.endDate) {
        query.date.$lte = new Date(options.endDate)
      }
    }

    let queryBuilder = this.objectModel.find(query)

    if (options.sort) {
      queryBuilder = queryBuilder.sort(options.sort)
    } else {
      queryBuilder = queryBuilder.sort({ date: -1 })
    }

    if (options.limit) {
      queryBuilder = queryBuilder.limit(options.limit)
    }
    if (options.skip) {
      queryBuilder = queryBuilder.skip(options.skip)
    }

    return await queryBuilder.lean().exec()
  }

  async findByTicker(walletId, userId, ticker, session = null) {
    let query = this.objectModel
      .find({
        walletId,
        userId,
        ticker: ticker.toUpperCase(),
        isDeleted: false,
      })
      .sort({ date: 1 })

    if (session) {
      query = query.session(session)
    }

    return await query.lean().exec()
  }

  async countByWallet(walletId, userId, options = {}) {
    const query = { walletId, userId, isDeleted: false }

    if (options.type) query.type = options.type
    if (options.ticker) query.ticker = options.ticker
    if (options.startDate || options.endDate) {
      query.date = {}
      if (options.startDate) query.date.$gte = new Date(options.startDate)
      if (options.endDate) query.date.$lte = new Date(options.endDate)
    }

    return await this.objectModel
      .countDocuments(query)
      .exec()
  }

  // ==================== UPDATE ====================

  async update(transactionId, userId, updateData, session = null) {
    const options = session
      ? { session, new: true }
      : { new: true }
    return await this.objectModel
      .findOneAndUpdate(
        { _id: transactionId, userId, isDeleted: false },
        { $set: { ...updateData, updatedAt: new Date() } },
        options,
      )
      .lean()
      .exec()
  }

  // ==================== DELETE ====================

  async softDelete(transactionId, userId, session = null) {
    const options = session
      ? { session, new: true }
      : { new: true }
    return await this.objectModel
      .findOneAndUpdate(
        { _id: transactionId, userId, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        options,
      )
      .lean()
      .exec()
  }

  // ==================== AGGREGATION ====================

  async getTransactionSummary(walletId, userId) {
    return await this.objectModel
      .aggregate([
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
      .exec()
  }
}

module.exports = TransactionDAO
