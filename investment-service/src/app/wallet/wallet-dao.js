const { walletSchema } = require('./wallet-model')
const AppDAO = require('../app-dao')

class WalletDAO extends AppDAO {

  constructor(db) {
    super(db)
    this.objectModel = this.initializeDBModel(db)
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
    // Escape special regex characters to prevent NoSQL injection
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return await this.objectModel
      .findOne({
        userId,
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') }, // case-insensitive
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
        { new: true },
      )
      .lean()
      .exec()
  }

  async activate(walletId, userId) {
    return await this.objectModel
      .findOneAndUpdate(
        { _id: walletId, userId, isDeleted: false },
        { $set: { isActive: true, updatedAt: new Date() } },
        { new: true },
      )
      .lean()
      .exec()
  }

  async deactivateAll(userId) {
    return await this.objectModel
      .updateMany(
        { userId, isDeleted: false },
        { $set: { isActive: false, updatedAt: new Date() } },
      )
  }

  // ==================== DELETE ====================

  async softDelete(walletId, userId) {
    return await this.objectModel
      .findOneAndUpdate(
        { _id: walletId, userId },
        { $set: { isDeleted: true, isActive: false, updatedAt: new Date() } },
        { new: true },
      )
      .lean()
      .exec()
  }
}

module.exports = WalletDAO
