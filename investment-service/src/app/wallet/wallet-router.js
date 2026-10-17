const express = require('express')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const logger = new JsonLog(SERVICE_NAME)
const jwtMiddleware = require('../auth/jwt-middleware')

class WalletRouter {
  static handleError(exception, res) {
    logger.error(exception, { statusCode: exception.statusCode })
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getRoutes(appManager) {
    const router = express.Router()
    const walletManager = appManager.getWalletManager()
    const config = appManager.config

    // JWT Middleware - use shared middleware from auth module
    router.use(jwtMiddleware(appManager, config))

    // GET /v1/wallets - Listar carteiras
    router.get('/wallets', async (req, res) => {
      try {
        const wallets = await walletManager.listByUser({
          userId: req.user.userId,
        })
        res.status(200).send(wallets)
      } catch (exception) {
        WalletRouter.handleError(exception, res)
      }
    })

    // POST /v1/wallets - Criar carteira
    router.post('/wallets', async (req, res) => {
      try {
        const { name, currency } = req.body
        const wallet = await walletManager.create({
          userId: req.user.userId,
          name,
          currency,
        })
        res.status(201).send(wallet)
      } catch (exception) {
        WalletRouter.handleError(exception, res)
      }
    })

    // GET /v1/wallets/consolidated - Visao consolidada
    router.get('/wallets/consolidated', async (req, res) => {
      try {
        const consolidated = await walletManager.getConsolidated({
          userId: req.user.userId,
        })
        res.status(200).send(consolidated)
      } catch (exception) {
        WalletRouter.handleError(exception, res)
      }
    })

    // GET /v1/wallets/:id - Obter carteira especifica
    router.get('/wallets/:id', async (req, res) => {
      try {
        const wallet = await walletManager.getById({
          userId: req.user.userId,
          walletId: req.params.id,
        })
        res.status(200).send(wallet)
      } catch (exception) {
        WalletRouter.handleError(exception, res)
      }
    })

    // PUT /v1/wallets/:id - Editar carteira
    router.put('/wallets/:id', async (req, res) => {
      try {
        const { name, currency } = req.body
        const wallet = await walletManager.update({
          userId: req.user.userId,
          walletId: req.params.id,
          name,
          currency,
        })
        res.status(200).send(wallet)
      } catch (exception) {
        WalletRouter.handleError(exception, res)
      }
    })

    // DELETE /v1/wallets/:id - Excluir carteira
    router.delete('/wallets/:id', async (req, res) => {
      try {
        const result = await walletManager.delete({
          userId: req.user.userId,
          walletId: req.params.id,
        })
        res.status(200).send({
          message: 'Carteira excluida com sucesso',
          activatedWallet: result.activated,
        })
      } catch (exception) {
        WalletRouter.handleError(exception, res)
      }
    })

    // PUT /v1/wallets/:id/activate - Ativar carteira
    router.put('/wallets/:id/activate', async (req, res) => {
      try {
        const wallet = await walletManager.activate({
          userId: req.user.userId,
          walletId: req.params.id,
        })
        res.status(200).send(wallet)
      } catch (exception) {
        WalletRouter.handleError(exception, res)
      }
    })

    return router
  }
}

module.exports = WalletRouter
