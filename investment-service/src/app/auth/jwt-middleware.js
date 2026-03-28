const jwt = require('jsonwebtoken')

/**
 * JWT Middleware for authentication
 * Validates JWT tokens and attaches user info to request
 * @param {Object} appManager - Application manager instance
 * @param {Object} config - Configuration object
 * @returns {Function} Express middleware function
 */
function jwtMiddleware(appManager, config) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).send('Token nao fornecido')
    }

    const token = authHeader.split(' ')[1]

    // Get JWT secret - throw error if not configured
    const secret = process.env.JWT_SECRET || config?.jwtSecret || config?.tokenSecret
    if (!secret) {
      throw new Error('JWT_SECRET is not configured')
    }

    try {
      const decoded = jwt.verify(token, secret)
const APP_CONSTANTS = require('../app-constants')
const { JsonLog } = require('json-log-middleware')
const logger = new JsonLog(APP_CONSTANTS.SERVICE_NAME)

// Validate JWT_SECRET at module load time
if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is not set', new Error('JWT_SECRET not configured'), {
    internal: { method: 'module', filename: 'jwt-middleware.js' },
  })
  throw new Error('FATAL: JWT_SECRET environment variable is required')
}

const JWT_SECRET = process.env.JWT_SECRET

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.split(' ')[1]
}

/**
 * Verify and decode JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { error: 'TOKEN_EXPIRED' }
    }
    return { error: 'TOKEN_INVALID' }
  }
}

/**
 * Find session in Redis that matches the token
 */
async function findSession(redisClient, userId, token) {
  const sessionPattern = `session:${userId}:*`
  const keys = await redisClient.keys(sessionPattern)

  // Handle case where keys might not be an array (redis-mock compatibility)
  if (!keys || !Array.isArray(keys) || keys.length === 0) {
    return { found: false, sessionId: null }
  }

  for (const key of keys) {
    const sessionData = await redisClient.get(key)
    if (sessionData) {
      const session = JSON.parse(sessionData)
      if (session.token === token) {
        return {
          found: true,
          sessionId: key.split(':')[2],
        }
      }
    }
  }

  return { found: false, sessionId: null }
}

/**
 * Refresh token if it's close to expiration
 */
async function refreshTokenIfNeeded(redisClient, decoded, sessionId, config) {
  const expiresAt = decoded.exp * 1000
  const oneHour = 60 * 60 * 1000

  if (expiresAt - Date.now() >= oneHour) {
    return
  }

  const newToken = jwt.sign(
    { userId: decoded.userId, email: decoded.email, name: decoded.name },
    JWT_SECRET,
    { expiresIn: config.auth?.jwtExpiresIn || '24h' },
  )

  const sessionKey = `session:${decoded.userId}:${sessionId}`
  await redisClient.set(sessionKey, JSON.stringify({
    token: newToken,
    createdAt: Date.now(),
    expiresAt: decoded.exp * 1000,
  }), { EX: config.auth?.sessionTTLSeconds || 86400 })

  return newToken
}

/**
 * Create JWT middleware for Express
 */
function jwtMiddleware(appManager, config) {
  const redisClient = appManager.getRedisClient()

  return async (req, res, next) => {
    try {
      // Extract token from header
      const token = extractToken(req.headers.authorization)
      if (!token) {
        return res.status(401).send({ message: APP_CONSTANTS.ERRORS.TOKEN_NOT_PROVIDED.message })
      }

      // Verify JWT
      const decoded = verifyToken(token)
      if (decoded.error === 'TOKEN_EXPIRED') {
        return res.status(401).send({ message: APP_CONSTANTS.ERRORS.TOKEN_EXPIRED.message })
      }
      if (decoded.error === 'TOKEN_INVALID') {
        return res.status(401).send({ message: APP_CONSTANTS.ERRORS.TOKEN_INVALID.message })
      }

      // Validate session in Redis
      const session = await findSession(redisClient, decoded.userId, token)
      if (!session.found) {
        return res.status(401).send({ message: APP_CONSTANTS.ERRORS.SESSION_INVALID.message })
      }

      // Attach user data to request
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name,
      }
      next()
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).send('Token expirado')
      }
      return res.status(401).send('Token invalido')
        sessionId: session.sessionId,
      }

      // Also set req.credentials for backward compatibility with existing routes
      req.credentials = {
        domain: decoded.userId, // Use userId as domain for now
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name,
      }

      // Refresh token if needed
      const newToken = await refreshTokenIfNeeded(redisClient, decoded, session.sessionId, config)
      if (newToken) {
        res.setHeader('X-New-Token', newToken)
      }

      next()
    } catch (error) {
      logger.error('Erro na autenticacao', error, { internal: { method: 'jwtMiddleware', filename: 'jwt-middleware.js' } })
      return res.status(500).send({ message: APP_CONSTANTS.ERRORS.AUTH_ERROR.message })
    }
  }
}

module.exports = jwtMiddleware
