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
    }
  }
}

module.exports = jwtMiddleware
