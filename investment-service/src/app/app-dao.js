class AppDAO {
  constructor(db) {
    this.db = db
  }

  initializeDBModel(_db) {
    throw new Error('initializeDBModel deve ser implementado pela subclasse')
  }

  async findOne(query, update, options) {
    return await this.objectModel.findOne(query, update, options).lean().exec()
  }

  async findOneAndUpdate(query, update, options) {
    return await this.objectModel.findOneAndUpdate(query, update, options).lean().exec()
  }

  async findMany(query, options = {}) {
    let queryBuilder = this.objectModel.find(query)
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

  async create(data) {
    const doc = new this.objectModel(data)
    return await doc.save()
  }

  async updateOne(query, updateData) {
    return await this.objectModel
      .updateOne(query, { $set: updateData })
      .lean()
      .exec()
  }

  async deleteOne(query) {
    return await this.objectModel.deleteOne(query).lean().exec()
  }

  async removeOneSorted(query) {
    return await this.objectModel.findOneAndDelete(query).lean().exec()
  }

  async count(query) {
    return await this.objectModel.countDocuments(query).exec()
  }
}

module.exports = AppDAO
