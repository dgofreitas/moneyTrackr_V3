const express = require('express')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const logger = new JsonLog(SERVICE_NAME)
const { Permissions, Authorizer } = require('interact-utils')

class InvestmentRouter {
  static handleError(exception, res) {
    logger.error(exception, { statusCode: exception.statusCode })
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getPublicRoutes(appManager) {
    const router = express.Router()
    const investmentManager = appManager.getInvestmentManager()

    router.post('/investment', Authorizer.getMiddleware(Permissions.SERVICES), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const investmentInfo = req.body
        const resp = await investmentManager.createInvestment({ domain, investmentInfo })
        res.status(201).send({ investmentId: resp._id })
      } catch (exception) {
        InvestmentRouter.handleError(exception, res)
      }
    })

    router.put('/investment/:investmentId', Authorizer.getMiddleware(Permissions.SERVICES), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const investmentId = req.params.investmentId
        const investmentInfo = req.body
        const resp = await investmentManager.updateInvestment({ domain, investmentId, investmentInfo })
        res.status(200).send(resp)
      } catch (exception) {
        InvestmentRouter.handleError(exception, res)
      }
    })

    router.get('/investment/:investmentId', Authorizer.getMiddleware(Permissions.SERVICES), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const investmentId = req.params.investmentId
        const resp = await investmentManager.getInvestment({ domain, investmentId })
        res.status(200).send(resp)
      } catch (exception) {
        InvestmentRouter.handleError(exception, res)
      }
    })

    router.get('/investment/portfolio/:portfolioId', Authorizer.getMiddleware(Permissions.SERVICES), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const portfolioId = req.params.portfolioId
        const options = {
          sort: req.query.sort,
          limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
          skip: req.query.skip ? parseInt(req.query.skip, 10) : undefined,
        }
        const resp = await investmentManager.getInvestmentsByPortfolio({ domain, portfolioId, options })
        res.status(200).send(resp)
      } catch (exception) {
        InvestmentRouter.handleError(exception, res)
      }
    })

    router.delete('/investment/:investmentId', Authorizer.getMiddleware(Permissions.SERVICES), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const investmentId = req.params.investmentId
        await investmentManager.deleteInvestment({ domain, investmentId })
        res.sendStatus(200)
      } catch (exception) {
        InvestmentRouter.handleError(exception, res)
      }
    })

    router.post('/investment/:investmentId/transaction', Authorizer.getMiddleware(Permissions.SERVICES), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const investmentId = req.params.investmentId
        const transaction = req.body
        const resp = await investmentManager.addTransaction({ domain, investmentId, transaction })
        res.status(200).send(resp)
      } catch (exception) {
        InvestmentRouter.handleError(exception, res)
      }
    })

    router.patch('/investment/:investmentId/price', Authorizer.getMiddleware(Permissions.SERVICES), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const investmentId = req.params.investmentId
        const { currentPrice } = req.body
        const resp = await investmentManager.updateCurrentPrice({ domain, investmentId, currentPrice })
        res.status(200).send(resp)
      } catch (exception) {
        InvestmentRouter.handleError(exception, res)
      }
    })

    return router
  }
}

module.exports = InvestmentRouter
