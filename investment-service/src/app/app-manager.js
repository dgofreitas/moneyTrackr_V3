const AppDB = require('./app-db')
const { SERVICE_NAME } = require('./app-constants')
const InvestmentManager = require('./investment/investment-manager')
const { JsonLog } = require('json-log-middleware')
const redis = require('redis')
const logger = new JsonLog(SERVICE_NAME)

class Exception extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
  }
}

class AppManager {
  constructor() {
    this.domainsMap = new Map()
  }

  async initialize(config) {
    this.config = config

    // Initialize MongoDB connection
    this.appDB = new AppDB(config.db)
    await this.appDB.initialize()

    // Initialize Redis connection
    this.redisClient = this._createRedisClient(config.redis)

    this.investmentManager = new InvestmentManager(this, this.appDB)
    this.investmentManager.inicialize(this)

    logger.log('Servico inicializado com sucesso', { internal: { method: 'initialize', filename: 'app-manager.js' } })
  }

  _createRedisClient(redisConfig) {
    const client = redis.createClient({
      host: redisConfig.host,
      port: redisConfig.port,
    })
    client.on('error', (err) => {
      logger.error('Erro Redis', err, { internal: { method: '_createRedisClient', filename: 'app-manager.js' } })
    })
    return client
  }

  handleError(obj) {
    throw new Exception(obj.statusCode, obj.message)
  }

  getInvestmentManager() {
    return this.investmentManager
  }

  getRedisClient() {
    return this.redisClient
  }

  getDomain(domain) {
    return this.domainsMap.get(domain)
  }

  getDb() {
    return this.appDB.getDb()
  }
}

module.exports = AppManager
