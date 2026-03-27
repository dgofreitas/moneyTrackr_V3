const { userSchema } = require('./user-model')
const AppDAO = require('../app-dao')

class AuthDAO extends AppDAO {

  constructor(db) {
    super(db)
    this.objectModel = this.initializeDBModel(db)
  }

  initializeDBModel(db) {
    return db.model('user', userSchema)
  }

  async findByEmail(email) {
    return await this.objectModel
      .findOne({ email: email.toLowerCase() })
      .lean()
      .exec()
  }

  async findByGoogleId(googleId) {
    return await this.objectModel
      .findOne({ googleId })
      .lean()
      .exec()
  }

  async findById(userId) {
    return await this.objectModel
      .findById(userId)
      .lean()
      .exec()
  }

  async create(userData) {
    const user = new this.objectModel(userData)
    return await user.save()
  }

  async updateById(userId, updateData) {
    return await this.objectModel
      .findByIdAndUpdate(
        userId,
        { $set: { ...updateData, updatedAt: new Date() } },
        { new: true },
      )
      .lean()
      .exec()
  }

  async updatePassword(userId, passwordHash) {
    return await this.objectModel
      .findByIdAndUpdate(
        userId,
        { $set: { password: passwordHash, updatedAt: new Date() } },
        { new: true },
      )
      .lean()
      .exec()
  }

  async incrementLoginAttempts(userId) {
    return await this.objectModel
      .findByIdAndUpdate(
        userId,
        { $inc: { loginAttempts: 1 } },
        { new: true },
      )
      .lean()
      .exec()
  }

  async resetLoginAttempts(userId) {
    return await this.objectModel
      .findByIdAndUpdate(
        userId,
        { $set: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } },
        { new: true },
      )
      .lean()
      .exec()
  }

  async lockAccount(userId, lockUntil) {
    return await this.objectModel
      .findByIdAndUpdate(
        userId,
        { $set: { lockedUntil: lockUntil } },
        { new: true },
      )
      .lean()
      .exec()
  }
}

module.exports = AuthDAO
