const mongoose = require('mongoose')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('./app-constants')
const logger = new JsonLog(SERVICE_NAME)

class AppDB {
  constructor(dbConfig) {
    this.config = dbConfig
    this.db = null
  }

  async initialize() {
    const connectionString = this.config.url + this.config.name

    try {
      await mongoose.connect(connectionString, {
        serverSelectionTimeoutMS: 5000,
      })
      this.db = mongoose.connection
      logger.log('Conexao MongoDB estabelecida com sucesso', { internal: { method: 'initialize', filename: 'app-db.js' } })
    } catch (error) {
      logger.error('Erro ao conectar MongoDB', error, { internal: { method: 'initialize', filename: 'app-db.js' } })
      throw error
    }
  }

  getDb() {
    return this.db
  }

  async disconnect() {
    await mongoose.disconnect()
  }
}

module.exports = AppDB
