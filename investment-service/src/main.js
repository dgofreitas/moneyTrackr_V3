const AppService = require('./app/app-service')
const appService = new AppService()
const { JsonLog } = require('json-log-middleware')
const APP_CONSTANTS = require('./app/app-constants')

process.title = 'investment-service'

const loadConfig = function () {
  const config = require('../config/app.json')
  config.db.url = process.env.DATABASE_URL_INVESTMENT || config.db.url
  config.db.name = process.env.DATABASE_NAME_PREFIX ? process.env.DATABASE_NAME_PREFIX + config.db.name : config.db.name
  return config
}

const start = async () => {
  const config = loadConfig()
  const logger = new JsonLog(APP_CONSTANTS.SERVICE_NAME)
  JsonLog.setLogLevel('DEBUG')
  appService.initialize(config)
    .then(() => {
      if (process.env.NODE_ENV === 'dev') {
        const swaggerUi = require('swagger-ui-express')
        const YAML = require('yamljs')
        const swaggerDocument = YAML.load('./docs/openapi.yml')
        appService.getApp().use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
      }
      appService.getApp().listen(config.port, () => {
        logger.log('Servico iniciado na porta', { port: config.port })
      })
    })
    .catch((error) => {
      logger.error('Erro ao iniciar servico', error)
    })
}

start()
