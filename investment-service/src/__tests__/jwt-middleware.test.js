/*eslint-env jest*/
jest.setTimeout(60000)

const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const express = require('express')
const supertest = require('supertest')
const jwtMiddleware = require('../app/auth/jwt-middleware')
const APP_CONSTANTS = require('../app/app-constants')

// Mock Redis client
const createRedisMock = () => {
  const store = new Map()
  return {
    get: jest.fn((key) => Promise.resolve(store.get(key))),
    set: jest.fn((key, value, options) => {
      store.set(key, value)
      return Promise.resolve('OK')
    }),
    del: jest.fn((key) => {
      if (Array.isArray(key)) {
        key.forEach((k) => store.delete(k))
      } else {
        store.delete(key)
      }
      return Promise.resolve(1)
    }),
    keys: jest.fn((pattern) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
      const matchingKeys = Array.from(store.keys()).filter((k) => regex.test(k))
      return Promise.resolve(matchingKeys)
    }),
    _store: store,
  }
}

describe('JWT Middleware', () => {
  let app
  let request
  let redisClient
  let mockAppManager

  const testConfig = {
    auth: {
      jwtSecret: 'test-jwt-secret-key-for-testing-purposes',
      jwtExpiresIn: '24h',
      sessionTTLSeconds: 86400,
    },
  }

  const createTestApp = () => {
    app = express()
    app.use(express.json())

    // Protected route using middleware
    app.get('/protected', jwtMiddleware(mockAppManager, testConfig), (req, res) => {
      res.status(200).json({ user: req.user })
    })

    request = supertest(app)
  }

  beforeAll(() => {
    process.env.JWT_SECRET = testConfig.auth.jwtSecret
  })

  beforeEach(() => {
    redisClient = createRedisMock()

    mockAppManager = {
      getRedisClient: () => redisClient,
      config: testConfig,
    }

    createTestApp()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // ==================== VALID TOKEN TESTS ====================

  describe('Valid Token', () => {
    it('should call next() with valid token', async () => {
      const userId = 'user-123'
      const sessionId = 'session-456'
      const token = jwt.sign(
        { userId, email: 'test@example.com', name: 'Test User' },
        testConfig.auth.jwtSecret,
        { expiresIn: '24h' },
      )

      // Store session in Redis
      const sessionKey = `session:${userId}:${sessionId}`
      await redisClient.set(sessionKey, JSON.stringify({
        token,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }))

      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.user).toBeDefined()
      expect(response.body.user.userId).toBe(userId)
      expect(response.body.user.email).toBe('test@example.com')
      expect(response.body.user.name).toBe('Test User')
      expect(response.body.user.sessionId).toBe(sessionId)
    })

    it('should attach req.user with decoded payload', async () => {
      const userId = 'user-789'
      const sessionId = 'session-012'
      const token = jwt.sign(
        { userId, email: 'attached@example.com', name: 'Attached User' },
        testConfig.auth.jwtSecret,
        { expiresIn: '24h' },
      )

      const sessionKey = `session:${userId}:${sessionId}`
      await redisClient.set(sessionKey, JSON.stringify({
        token,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }))

      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.user.userId).toBe(userId)
      expect(response.body.user.email).toBe('attached@example.com')
      expect(response.body.user.name).toBe('Attached User')
    })
  })

  // ==================== MISSING TOKEN TESTS ====================

  describe('Missing Token', () => {
    it('should return 401 when no Authorization header', async () => {
      const response = await request.get('/protected')

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.TOKEN_NOT_PROVIDED.message)
    })

    it('should return 401 when Authorization header does not start with Bearer', async () => {
      const response = await request
        .get('/protected')
        .set('Authorization', 'Token abc123')

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.TOKEN_NOT_PROVIDED.message)
    })

    it('should return 401 when Authorization header is empty', async () => {
      const response = await request
        .get('/protected')
        .set('Authorization', '')

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.TOKEN_NOT_PROVIDED.message)
    })

    it('should return 401 when Bearer token is empty', async () => {
      const response = await request
        .get('/protected')
        .set('Authorization', 'Bearer ')

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.TOKEN_NOT_PROVIDED.message)
    })
  })

  // ==================== EXPIRED TOKEN TESTS ====================

  describe('Expired Token', () => {
    it('should return 401 with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'user-expired', email: 'expired@example.com', name: 'Expired User' },
        testConfig.auth.jwtSecret,
        { expiresIn: '-1h' },
      )

      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer ${expiredToken}`)

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.TOKEN_EXPIRED.message)
    })

    it('should return 401 with token that just expired', async () => {
      const justExpiredToken = jwt.sign(
        { userId: 'user-just-expired', email: 'just@example.com', name: 'Just Expired' },
        testConfig.auth.jwtSecret,
        { expiresIn: '-1s' },
      )

      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer ${justExpiredToken}`)

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.TOKEN_EXPIRED.message)
    })
  })

  // ==================== INVALID TOKEN TESTS ====================

  describe('Invalid Token', () => {
    it('should return 401 with malformed token', async () => {
      const response = await request
        .get('/protected')
        .set('Authorization', 'Bearer not-a-valid-jwt-token')

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.TOKEN_INVALID.message)
    })

    it('should return 401 with token signed with wrong secret', async () => {
      const wrongSecretToken = jwt.sign(
        { userId: 'user-wrong', email: 'wrong@example.com', name: 'Wrong Secret' },
        'wrong-secret-key',
        { expiresIn: '24h' },
      )

      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer ${wrongSecretToken}`)

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.TOKEN_INVALID.message)
    })

    it('should return 401 with tampered token', async () => {
      const token = jwt.sign(
        { userId: 'user-tampered', email: 'tampered@example.com', name: 'Tampered' },
        testConfig.auth.jwtSecret,
        { expiresIn: '24h' },
      )

      // Tamper with the token
      const tamperedToken = token.slice(0, -5) + 'xxxxx'

      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer ${tamperedToken}`)

      expect(response.status).toBe(401)
    })
  })

  // ==================== SESSION VALIDATION TESTS ====================

  describe('Session Validation', () => {
    it('should return 401 when token not in Redis session', async () => {
      const token = jwt.sign(
        { userId: 'user-no-session', email: 'nosession@example.com', name: 'No Session' },
        testConfig.auth.jwtSecret,
        { expiresIn: '24h' },
      )

      // No session stored in Redis

      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.SESSION_INVALID.message)
    })

    it('should return 401 when session exists but token does not match', async () => {
      const userId = 'user-mismatch'
      const sessionId = 'session-mismatch'
      const token = jwt.sign(
        { userId, email: 'mismatch@example.com', name: 'Mismatch' },
        testConfig.auth.jwtSecret,
        { expiresIn: '24h' },
      )

      // Store session with different token
      const sessionKey = `session:${userId}:${sessionId}`
      await redisClient.set(sessionKey, JSON.stringify({
        token: 'different-token-value',
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }))

      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.SESSION_INVALID.message)
    })

    it('should return 401 when session was deleted (logout)', async () => {
      const userId = 'user-logout'
      const sessionId = 'session-logout'
      const token = jwt.sign(
        { userId, email: 'logout@example.com', name: 'Logout User' },
        testConfig.auth.jwtSecret,
        { expiresIn: '24h' },
      )

      // Store session then delete it
      const sessionKey = `session:${userId}:${sessionId}`
      await redisClient.set(sessionKey, JSON.stringify({
        token,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }))

      // Simulate logout
      await redisClient.del(sessionKey)

      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.SESSION_INVALID.message)
    })
  })

  // ==================== TOKEN REFRESH TESTS ====================

  describe('Token Refresh', () => {
    it('should set X-New-Token header when token expires in less than 1 hour', async () => {
      const userId = 'user-refresh'
      const sessionId = 'session-refresh'
      // Create token that expires in 30 minutes
      const token = jwt.sign(
        { userId, email: 'refresh@example.com', name: 'Refresh User' },
        testConfig.auth.jwtSecret,
        { expiresIn: '30m' },
      )

      const sessionKey = `session:${userId}:${sessionId}`
      await redisClient.set(sessionKey, JSON.stringify({
        token,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000,
      }))

      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.headers['x-new-token']).toBeDefined()

      // Verify new token is valid
      const newToken = response.headers['x-new-token']
      const decoded = jwt.verify(newToken, testConfig.auth.jwtSecret)
      expect(decoded.userId).toBe(userId)
      expect(decoded.email).toBe('refresh@example.com')
    })

    it('should not set X-New-Token header when token expires in more than 1 hour', async () => {
      const userId = 'user-no-refresh'
      const sessionId = 'session-no-refresh'
      // Create token that expires in 2 hours
      const token = jwt.sign(
        { userId, email: 'norefresh@example.com', name: 'No Refresh User' },
        testConfig.auth.jwtSecret,
        { expiresIn: '2h' },
      )

      const sessionKey = `session:${userId}:${sessionId}`
      await redisClient.set(sessionKey, JSON.stringify({
        token,
        createdAt: Date.now(),
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      }))

      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.headers['x-new-token']).toBeUndefined()
    })

    it('should update session in Redis when refreshing token', async () => {
      const userId = 'user-update-session'
      const sessionId = 'session-update'
      const token = jwt.sign(
        { userId, email: 'updatesession@example.com', name: 'Update Session' },
        testConfig.auth.jwtSecret,
        { expiresIn: '30m' },
      )

      const sessionKey = `session:${userId}:${sessionId}`
      await redisClient.set(sessionKey, JSON.stringify({
        token,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000,
      }))

      await request
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)

      // Verify session was updated with new token
      const sessionData = await redisClient.get(sessionKey)
      const session = JSON.parse(sessionData)
      expect(session.token).toBeDefined()
      expect(session.token).not.toBe(token) // Should be new token
    })
  })

  // ==================== EDGE CASES ====================

  describe('Edge Cases', () => {
    it('should handle multiple sessions for same user', async () => {
      const userId = 'user-multi'
      const sessionId1 = 'session-1'
      const sessionId2 = 'session-2'

      const token1 = jwt.sign(
        { userId, email: 'multi@example.com', name: 'Multi User' },
        testConfig.auth.jwtSecret,
        { expiresIn: '24h' },
      )

      const token2 = jwt.sign(
        { userId, email: 'multi@example.com', name: 'Multi User' },
        testConfig.auth.jwtSecret,
        { expiresIn: '24h' },
      )

      // Store both sessions
      await redisClient.set(`session:${userId}:${sessionId1}`, JSON.stringify({
        token: token1,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }))

      await redisClient.set(`session:${userId}:${sessionId2}`, JSON.stringify({
        token: token2,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }))

      // Both tokens should work
      const response1 = await request
        .get('/protected')
        .set('Authorization', `Bearer ${token1}`)

      const response2 = await request
        .get('/protected')
        .set('Authorization', `Bearer ${token2}`)

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
    })

    it('should handle case-sensitive Authorization header', async () => {
      const userId = 'user-case'
      const sessionId = 'session-case'
      const token = jwt.sign(
        { userId, email: 'case@example.com', name: 'Case User' },
        testConfig.auth.jwtSecret,
        { expiresIn: '24h' },
      )

      await redisClient.set(`session:${userId}:${sessionId}`, JSON.stringify({
        token,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }))

      // Test with lowercase 'bearer' - should fail as middleware expects 'Bearer'
      const response = await request
        .get('/protected')
        .set('authorization', `bearer ${token}`)

      // Middleware expects 'Bearer' with capital B
      expect(response.status).toBe(401)
    })

    it('should handle token with extra whitespace', async () => {
      const userId = 'user-whitespace'
      const sessionId = 'session-whitespace'
      const token = jwt.sign(
        { userId, email: 'whitespace@example.com', name: 'Whitespace User' },
        testConfig.auth.jwtSecret,
        { expiresIn: '24h' },
      )

      await redisClient.set(`session:${userId}:${sessionId}`, JSON.stringify({
        token,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }))

      // Extra whitespace in token would cause it to be invalid
      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer  ${token}  `)

      // Should fail because token has extra whitespace
      expect(response.status).toBe(401)
    })

    it('should return 500 on unexpected error', async () => {
      // Mock Redis to throw error
      redisClient.keys = jest.fn(() => Promise.reject(new Error('Redis error')))

      const token = jwt.sign(
        { userId: 'user-error', email: 'error@example.com', name: 'Error User' },
        testConfig.auth.jwtSecret,
        { expiresIn: '24h' },
      )

      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(500)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.AUTH_ERROR.message)
    })
  })

  // ==================== SECURITY TESTS ====================

  describe('Security', () => {
    it('should not expose sensitive data in error messages', async () => {
      const response = await request
        .get('/protected')
        .set('Authorization', 'Bearer invalid')

      expect(response.status).toBe(401)
      expect(response.body.message).not.toContain('secret')
      expect(response.body.message).not.toContain('key')
    })

    it('should validate token signature', async () => {
      // Create token with different secret
      const fakeToken = jwt.sign(
        { userId: 'fake-user', email: 'fake@example.com', name: 'Fake' },
        'different-secret',
        { expiresIn: '24h' },
      )

      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer ${fakeToken}`)

      expect(response.status).toBe(401)
    })

    it('should not accept token without userId', async () => {
      const token = jwt.sign(
        { email: 'nouserid@example.com', name: 'No UserId' },
        testConfig.auth.jwtSecret,
        { expiresIn: '24h' },
      )

      const response = await request
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)

      // Should fail because no session can be found without userId
      expect(response.status).toBe(401)
    })

    it('should handle concurrent requests with same token', async () => {
      const userId = 'user-concurrent'
      const sessionId = 'session-concurrent'
      const token = jwt.sign(
        { userId, email: 'concurrent@example.com', name: 'Concurrent User' },
        testConfig.auth.jwtSecret,
        { expiresIn: '24h' },
      )

      await redisClient.set(`session:${userId}:${sessionId}`, JSON.stringify({
        token,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }))

      // Make multiple concurrent requests
      const requests = Array(5).fill(null).map(() =>
        request
          .get('/protected')
          .set('Authorization', `Bearer ${token}`),
      )

      const responses = await Promise.all(requests)

      responses.forEach((response) => {
        expect(response.status).toBe(200)
      })
    })
  })
})
