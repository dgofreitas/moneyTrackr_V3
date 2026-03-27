const express = require('express')
const rateLimit = require('express-rate-limit')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const jwtMiddleware = require('./jwt-middleware')

const logger = new JsonLog(SERVICE_NAME)

// Skip rate limiting in test environment
const skipRateLimit = process.env.NODE_ENV === 'test'

// Rate limiter for login endpoint - 5 attempts per 15 minutes per IP
const loginLimiter = skipRateLimit ? (req, res, next) => next() : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: { message: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.log('Rate limit exceeded for login', {
      ip: req.ip,
      email: req.body?.email,
      internal: { method: 'loginLimiter', filename: 'auth-router.js' },
    })
    res.status(429).send({ message: 'Muitas tentativas de login. Tente novamente em 15 minutos.' })
  },
})

// Rate limiter for register endpoint - 100 requests per 15 minutes per IP
const registerLimiter = skipRateLimit ? (req, res, next) => next() : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: { message: 'Muitas solicitacoes de registro. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.log('Rate limit exceeded for register', {
      ip: req.ip,
      internal: { method: 'registerLimiter', filename: 'auth-router.js' },
    })
    res.status(429).send({ message: 'Muitas solicitacoes de registro. Tente novamente mais tarde.' })
  },
})

// Rate limiter for forgot-password endpoint - 3 requests per 15 minutes per IP
const forgotPasswordLimiter = skipRateLimit ? (req, res, next) => next() : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per windowMs
  message: { message: 'Muitas solicitacoes de recuperacao de senha. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.log('Rate limit exceeded for forgot-password', {
      ip: req.ip,
      email: req.body?.email,
      internal: { method: 'forgotPasswordLimiter', filename: 'auth-router.js' },
    })
    res.status(429).send({ message: 'Muitas solicitacoes de recuperacao de senha. Tente novamente em 15 minutos.' })
  },
})

class AuthRouter {
  static handleError(exception, res) {
    logger.error(exception, { statusCode: exception.statusCode })
    const message = exception.message || 'Server Error'
    res.status(exception.statusCode || 500).send({ message })
  }

  static getPublicRoutes(appManager, _config) {
    const router = express.Router()
    const authManager = appManager.getAuthManager()

    // POST /api/auth/register - Registro com email/senha
    router.post('/auth/register', registerLimiter, async (req, res) => {
      try {
        const { name, email, password, confirmPassword } = req.body
        const result = await authManager.register({ name, email, password, confirmPassword })
        res.status(201).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    // POST /api/auth/login - Login com email/senha
    router.post('/auth/login', loginLimiter, async (req, res) => {
      try {
        const { email, password } = req.body
        const result = await authManager.login({ email, password })
        res.status(200).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    // POST /api/auth/google - Login/registro com Google OAuth
    router.post('/auth/google', async (req, res) => {
      try {
        const { code } = req.body
        const result = await authManager.googleAuth({ code })
        res.status(200).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    // POST /api/auth/forgot-password - Solicitar reset de senha
    router.post('/auth/forgot-password', forgotPasswordLimiter, async (req, res) => {
      try {
        const { email } = req.body
        const result = await authManager.forgotPassword({ email })
        res.status(200).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    // POST /api/auth/reset-password - Redefinir senha
    router.post('/auth/reset-password', async (req, res) => {
      try {
        const { token, password, confirmPassword } = req.body
        const result = await authManager.resetPassword({ token, password, confirmPassword })
        res.status(200).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    return router
  }

  static getProtectedRoutes(appManager, config) {
    const router = express.Router()
    const authManager = appManager.getAuthManager()

    // Aplicar middleware JWT para todas as rotas protegidas
    router.use(jwtMiddleware(appManager, config))

    // POST /api/auth/logout - Encerrar sessao
    router.post('/auth/logout', async (req, res) => {
      try {
        const result = await authManager.logout({
          userId: req.user.userId,
          sessionId: req.user.sessionId,
        })
        res.status(200).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    // GET /api/auth/me - Obter perfil do usuario logado
    router.get('/auth/me', async (req, res) => {
      try {
        const result = await authManager.getProfile({ userId: req.user.userId })
        res.status(200).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    // PUT /api/auth/me - Atualizar perfil
    router.put('/auth/me', async (req, res) => {
      try {
        const { name, avatar } = req.body
        const result = await authManager.updateProfile({
          userId: req.user.userId,
          name,
          avatar,
        })
        res.status(200).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    return router
  }
}

module.exports = AuthRouter
