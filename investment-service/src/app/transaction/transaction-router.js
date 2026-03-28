const express = require('express')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const logger = new JsonLog(SERVICE_NAME)
const jwtMiddleware = require('../auth/jwt-middleware')

class TransactionRouter {
  static handleError(exception, res) {
    logger.error(exception, { statusCode: exception.statusCode })
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getRoutes(appManager) {
    const router = express.Router()
    const transactionManager = appManager.getTransactionManager()
    const positionManager = appManager.getPositionManager()
    const config = appManager.config

    // JWT Middleware
    router.use(jwtMiddleware(appManager, config))

    // ==================== TRANSACTIONS ====================

    // GET /v1/transactions - Listar transacoes
    router.get('/transactions', async (req, res) => {
      try {
        const { walletId, type, ticker, startDate, endDate, sortBy, sortOrder, page, limit } = req.query
        const result = await transactionManager.list({
          userId: req.user.userId,
          walletId,
          type,
          ticker,
          startDate,
          endDate,
          sortBy,
          sortOrder,
          page: page ? parseInt(page, 10) : 1,
          limit: limit ? parseInt(limit, 10) : 50,
        })
        res.status(200).send(result)
      } catch (exception) {
        TransactionRouter.handleError(exception, res)
      }
    })

    // POST /v1/transactions - Criar transacao
    router.post('/transactions', async (req, res) => {
      try {
        const { walletId, ticker, type, quantity, price, fees, date, currency, notes } = req.body
        const result = await transactionManager.create({
          userId: req.user.userId,
          walletId,
          ticker,
          type,
          quantity,
          price,
          fees,
          date,
          currency,
          notes,
        })
        res.status(201).send(result)
      } catch (exception) {
        TransactionRouter.handleError(exception, res)
      }
    })

    // GET /v1/transactions/:id - Obter transacao
    router.get('/transactions/:id', async (req, res) => {
      try {
        const transaction = await transactionManager.getById({
          userId: req.user.userId,
          transactionId: req.params.id,
        })
        res.status(200).send(transaction)
      } catch (exception) {
        TransactionRouter.handleError(exception, res)
      }
    })

    // PUT /v1/transactions/:id - Editar transacao
    router.put('/transactions/:id', async (req, res) => {
      try {
        // Only include fields that are actually provided in the request
        const updateData = { userId: req.user.userId, transactionId: req.params.id }
        const fields = ['ticker', 'type', 'quantity', 'price', 'fees', 'date', 'currency', 'notes']
        for (const field of fields) {
          if (req.body[field] !== undefined) {
            updateData[field] = req.body[field]
          }
        }
        const result = await transactionManager.update(updateData)
        res.status(200).send(result)
      } catch (exception) {
        TransactionRouter.handleError(exception, res)
      }
    })

    // DELETE /v1/transactions/:id - Excluir transacao (soft delete)
    router.delete('/transactions/:id', async (req, res) => {
      try {
        const result = await transactionManager.delete({
          userId: req.user.userId,
          transactionId: req.params.id,
        })
        res.status(200).send(result)
      } catch (exception) {
        TransactionRouter.handleError(exception, res)
      }
    })

    // ==================== POSITIONS ====================

    // GET /v1/positions - Listar posicoes
    router.get('/positions', async (req, res) => {
      try {
        const { walletId, status } = req.query
        const positions = await positionManager.list({
          userId: req.user.userId,
          walletId,
          status,
        })
        res.status(200).send(positions)
      } catch (exception) {
        TransactionRouter.handleError(exception, res)
      }
    })

    // GET /v1/positions/:ticker - Obter posicao por ticker
    router.get('/positions/:ticker', async (req, res) => {
      try {
        const { walletId } = req.query
        const position = await positionManager.getPosition({
          userId: req.user.userId,
          walletId,
          ticker: req.params.ticker,
        })
        res.status(200).send(position)
      } catch (exception) {
        TransactionRouter.handleError(exception, res)
      }
    })

    return router
  }
}

module.exports = TransactionRouter
