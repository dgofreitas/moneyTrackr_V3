const express = require('express')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('./app-constants')
const WalletRouter = require('./wallet/wallet-router')
const InvestmentRouter = require('./investment/investment-router')
const logger = new JsonLog(SERVICE_NAME)

class AppRouter {
  static handleError(exception, res) {
    logger.error(exception, { statusCode: exception.statusCode })
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getPublicRoutes(appManager) {
    const router = express.Router()

    router.get('/v1/healthy', (req, res) => {
      res.sendStatus(200)
    })

    // Wallet routes
    router.use('/v1', WalletRouter.getRoutes(appManager))

    // Investment routes
    router.use('/v1/public', InvestmentRouter.getPublicRoutes(appManager))

    return router
  }
}

module.exports = AppRouter
