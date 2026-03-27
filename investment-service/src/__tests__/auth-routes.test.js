/*eslint-env jest*/
jest.setTimeout(60000)

const mongoose = require('mongoose')
const supertest = require('supertest')
const jwt = require('jsonwebtoken')
const AppService = require('../app/app-service')
const APP_CONSTANTS = require('../app/app-constants')

// Mock Redis client
const createRedisMock = () => {
  const redisMock = require('redis-mock')
  const originalCreateClient = redisMock.createClient

  redisMock.createClient = (options) => {
    const client = originalCreateClient(options)
    // Add promise-based methods for Redis v4 API
    client.connect = () => Promise.resolve()
    client.quit = () => Promise.resolve()
    client.disconnect = () => Promise.resolve()

    // Promisify the callback-based methods
    const originalGet = client.get.bind(client)
    const originalSet = client.set.bind(client)
    const originalDel = client.del.bind(client)
    const originalKeys = client.keys.bind(client)

    client.get = (key) => {
      return new Promise((resolve, reject) => {
        originalGet(key, (err, reply) => {
          if (err) {
            reject(err)
          } else {
            resolve(reply)
          }
        })
      })
    }

    client.set = (key, value, options) => {
      return new Promise((resolve, reject) => {
        if (options && options.EX) {
          originalSet(key, value, 'EX', options.EX, (err, reply) => {
            if (err) {
              reject(err)
            } else {
              resolve(reply)
            }
          })
        } else {
          originalSet(key, value, (err, reply) => {
            if (err) {
              reject(err)
            } else {
              resolve(reply)
            }
          })
        }
      })
    }

    client.del = (keys) => {
      return new Promise((resolve, reject) => {
        const keyArray = Array.isArray(keys) ? keys : [keys]
        let pending = keyArray.length
        let error = null
        keyArray.forEach((k) => {
          originalDel(k, (err, reply) => {
            if (err) {
              error = err
            }
            pending--
            if (pending === 0) {
              if (error) {
                reject(error)
              } else {
                resolve(reply)
              }
            }
          })
        })
        if (keyArray.length === 0) {
          resolve(0)
        }
      })
    }

    client.keys = (pattern) => {
      return new Promise((resolve, reject) => {
        originalKeys(pattern, (err, reply) => {
          if (err) {
            reject(err)
          } else {
            resolve(reply || [])
          }
        })
      })
    }

    return client
  }

  return redisMock
}

jest.mock('redis', () => createRedisMock())

const { JsonLog } = require('json-log-middleware')
JsonLog.setLogLevel('DEBUG')

const flushPromises = function (timeout = 150) {
  return new Promise((resolve) => setTimeout(resolve, timeout))
}

const testConfig = {
  port: 3001,
  tokenSecret: 'interact-secret',
  db: {
    url: global.__MONGO_URI__,
    name: global.__MONGO_DB_NAME__,
  },
  redis: {
    host: 'localhost',
    port: 6379,
  },
  auth: {
    jwtSecret: 'test-jwt-secret-key-for-testing-purposes',
    jwtExpiresIn: '24h',
    bcryptSaltRounds: 10,
    maxLoginAttempts: 5,
    lockDurationMinutes: 15,
    resetTokenTTLSeconds: 3600,
    sessionTTLSeconds: 86400,
  },
  google: {
    clientId: 'test-google-client-id',
    clientSecret: 'test-google-client-secret',
    redirectUri: 'http://localhost:3000/auth/callback',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  },
}

describe('Auth Routes Integration Tests', () => {
  let app
  let appService
  let appManager
  let request
  let redisClient

  beforeAll(async () => {
    process.env.JWT_SECRET = testConfig.auth.jwtSecret
    process.env.CONSOLE_LOG_DISABLE = 'true'

    appService = new AppService()
    await appService.initialize(testConfig)
    app = appService.getApp()
    appManager = appService.getAppManager()
    redisClient = appManager.getRedisClient()
    request = supertest(app)
  })

  afterAll(async () => {
    if (appManager && appManager.appDB) {
      await appManager.appDB.getDb().dropDatabase()
      await appManager.appDB.getDb().close()
    }
    await mongoose.disconnect()
  })

  beforeEach(async () => {
    await appManager.appDB.getDb().dropDatabase()
    // Clear Redis - handle both callback and promise-based redis-mock
    try {
      const keys = await redisClient.keys('*')
      if (keys && Array.isArray(keys) && keys.length > 0) {
        await redisClient.del(keys)
      }
    } catch (e) {
      // Ignore Redis clear errors
    }
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await flushPromises()
  })

  // ==================== REGISTER ROUTE TESTS ====================

  describe('POST /auth/register', () => {
    it('should return 201 with valid data', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      }

      const response = await request
        .post('/auth/register')
        .send(userData)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('user')
      expect(response.body).toHaveProperty('token')
      expect(response.body).toHaveProperty('sessionId')
      expect(response.body.user.email).toBe(userData.email.toLowerCase())
      expect(response.body.user).not.toHaveProperty('password')
    })

    it('should return 409 with duplicate email', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      }

      // First registration
      await request.post('/auth/register').send(userData)

      // Second registration with same email
      const response = await request
        .post('/auth/register')
        .send(userData)

      expect(response.status).toBe(409)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.EMAIL_ALREADY_EXISTS.message)
    })

    it('should return 400 with missing name', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      }

      const response = await request
        .post('/auth/register')
        .send(userData)

      expect(response.status).toBe(400)
    })

    it('should return 400 with invalid email', async () => {
      const userData = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      }

      const response = await request
        .post('/auth/register')
        .send(userData)

      expect(response.status).toBe(400)
    })

    it('should return 400 with weak password', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'weak',
        confirmPassword: 'weak',
      }

      const response = await request
        .post('/auth/register')
        .send(userData)

      expect(response.status).toBe(400)
    })

    it('should return 400 with mismatched passwords', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'DifferentPass@456',
      }

      const response = await request
        .post('/auth/register')
        .send(userData)

      expect(response.status).toBe(400)
    })
  })

  // ==================== LOGIN ROUTE TESTS ====================

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Register a test user
      await request.post('/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })
    })

    it('should return 200 with valid credentials', async () => {
      const response = await request
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'ValidPass@123',
        })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('user')
      expect(response.body).toHaveProperty('token')
      expect(response.body).toHaveProperty('sessionId')
    })

    it('should return 401 with invalid password', async () => {
      const response = await request
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword@123',
        })

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.INVALID_CREDENTIALS.message)
    })

    it('should return 401 with non-existent email', async () => {
      const response = await request
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'ValidPass@123',
        })

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.INVALID_CREDENTIALS.message)
    })

    it('should return 429 after 5 failed attempts', async () => {
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'WrongPassword@123',
          })
      }

      // 6th attempt should be locked
      const response = await request
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'ValidPass@123',
        })

      expect(response.status).toBe(429)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.ACCOUNT_LOCKED.message)
    })

    it('should return same error for wrong email and wrong password', async () => {
      const wrongPasswordResponse = await request
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword@123',
        })

      const wrongEmailResponse = await request
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'ValidPass@123',
        })

      expect(wrongPasswordResponse.status).toBe(wrongEmailResponse.status)
      expect(wrongPasswordResponse.body.message).toBe(wrongEmailResponse.body.message)
    })
  })

  // ==================== GOOGLE OAUTH ROUTE TESTS ====================

  describe('POST /auth/google', () => {
    let mockFetch

    beforeEach(() => {
      mockFetch = jest.fn()
      global.fetch = mockFetch
    })

    afterEach(() => {
      delete global.fetch
    })

    it('should return 200 with valid code', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'google-user-123',
            email: 'googleuser@example.com',
            name: 'Google User',
            picture: 'https://example.com/avatar.jpg',
          }),
        })

      const response = await request
        .post('/auth/google')
        .send({ code: 'mock-auth-code' })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('user')
      expect(response.body).toHaveProperty('token')
      expect(response.body.user.googleId).toBe('google-user-123')
    })

    it('should return 401 with invalid code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      })

      const response = await request
        .post('/auth/google')
        .send({ code: 'invalid-code' })

      expect(response.status).toBe(401)
    })

    it('should link existing email account', async () => {
      // Register user with email
      await request.post('/auth/register').send({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })

      // Google auth with same email
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'google-user-456',
            email: 'existing@example.com',
            name: 'Existing User',
            picture: 'https://example.com/avatar.jpg',
          }),
        })

      const response = await request
        .post('/auth/google')
        .send({ code: 'mock-auth-code' })

      expect(response.status).toBe(200)
      expect(response.body.user.provider).toBe('both')
    })
  })

  // ==================== FORGOT PASSWORD ROUTE TESTS ====================

  describe('POST /auth/forgot-password', () => {
    beforeEach(async () => {
      await request.post('/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })
    })

    it('should return 200 with generic message for existing email', async () => {
      const response = await request
        .post('/auth/forgot-password')
        .send({ email: 'test@example.com' })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Se o email estiver cadastrado, voce recebera um link de recuperacao.')
    })

    it('should return 200 with same generic message for non-existent email', async () => {
      const response = await request
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Se o email estiver cadastrado, voce recebera um link de recuperacao.')
    })

    it('should not reveal if email exists', async () => {
      const existingResponse = await request
        .post('/auth/forgot-password')
        .send({ email: 'test@example.com' })

      const nonExistentResponse = await request
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })

      expect(existingResponse.status).toBe(nonExistentResponse.status)
      expect(existingResponse.body.message).toBe(nonExistentResponse.body.message)
    })
  })

  // ==================== RESET PASSWORD ROUTE TESTS ====================

  describe('POST /auth/reset-password', () => {
    let resetToken

    beforeEach(async () => {
      await request.post('/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })

      // Request password reset
      await request
        .post('/auth/forgot-password')
        .send({ email: 'test@example.com' })

      // Get reset token from Redis
      const keys = await redisClient.keys('reset:*')
      if (keys.length > 0) {
        resetToken = keys[0].replace('reset:', '')
      }
    })

    it('should return 200 with valid token', async () => {
      const response = await request
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          password: 'NewValidPass@456',
          confirmPassword: 'NewValidPass@456',
        })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Senha redefinida com sucesso. Faca login.')
    })

    it('should return 400 with invalid token', async () => {
      const response = await request
        .post('/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewValidPass@456',
          confirmPassword: 'NewValidPass@456',
        })

      expect(response.status).toBe(400)
    })

    it('should return 400 with already used token', async () => {
      // Use token once
      await request
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          password: 'NewValidPass@456',
          confirmPassword: 'NewValidPass@456',
        })

      // Try to use same token again
      const response = await request
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          password: 'AnotherPass@789',
          confirmPassword: 'AnotherPass@789',
        })

      expect(response.status).toBe(400)
    })

    it('should return 400 with weak password', async () => {
      const response = await request
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          password: 'weak',
          confirmPassword: 'weak',
        })

      expect(response.status).toBe(400)
    })
  })

  // ==================== LOGOUT ROUTE TESTS ====================

  describe('POST /auth/logout', () => {
    let token

    beforeEach(async () => {
      const response = await request.post('/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })
      token = response.body.token
    })

    it('should return 200 when authenticated', async () => {
      const response = await request
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Logout realizado com sucesso')
    })

    it('should return 401 when not authenticated', async () => {
      const response = await request
        .post('/auth/logout')

      expect(response.status).toBe(401)
    })

    it('should invalidate session after logout', async () => {
      // Logout
      await request
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)

      // Try to access protected route
      const response = await request
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(401)
    })
  })

  // ==================== GET PROFILE ROUTE TESTS ====================

  describe('GET /auth/me', () => {
    let token

    beforeEach(async () => {
      const response = await request.post('/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })
      token = response.body.token
    })

    it('should return 200 when authenticated', async () => {
      const response = await request
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('user')
      expect(response.body.user.email).toBe('test@example.com')
      expect(response.body.user).not.toHaveProperty('password')
    })

    it('should return 401 when not authenticated', async () => {
      const response = await request
        .get('/auth/me')

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.TOKEN_NOT_PROVIDED.message)
    })

    it('should return 401 with invalid token', async () => {
      const response = await request
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(401)
    })

    it('should return 401 with expired token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: 'test-id', email: 'test@example.com', name: 'Test' },
        testConfig.auth.jwtSecret,
        { expiresIn: '-1h' },
      )

      const response = await request
        .get('/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(APP_CONSTANTS.ERRORS.TOKEN_EXPIRED.message)
    })
  })

  // ==================== UPDATE PROFILE ROUTE TESTS ====================

  describe('PUT /auth/me', () => {
    let token

    beforeEach(async () => {
      const response = await request.post('/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })
      token = response.body.token
    })

    it('should return 200 when authenticated', async () => {
      const response = await request
        .put('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' })

      expect(response.status).toBe(200)
      expect(response.body.user.name).toBe('Updated Name')
    })

    it('should return 401 when not authenticated', async () => {
      const response = await request
        .put('/auth/me')
        .send({ name: 'Updated Name' })

      expect(response.status).toBe(401)
    })

    it('should update avatar', async () => {
      const response = await request
        .put('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ avatar: 'https://example.com/newavatar.jpg' })

      expect(response.status).toBe(200)
      expect(response.body.user.avatar).toBe('https://example.com/newavatar.jpg')
    })

    it('should return 400 with short name', async () => {
      const response = await request
        .put('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'A' })

      expect(response.status).toBe(400)
    })
  })

  // ==================== TOKEN REFRESH TESTS ====================

  describe('Token Refresh', () => {
    it('should set X-New-Token header when token expires soon', async () => {
      // Register user
      const registerResponse = await request.post('/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })

      // Create a token that expires in 30 minutes
      const shortLivedToken = jwt.sign(
        {
          userId: registerResponse.body.user._id,
          email: 'test@example.com',
          name: 'Test User',
        },
        testConfig.auth.jwtSecret,
        { expiresIn: '30m' },
      )

      // Store session in Redis
      const sessionId = 'test-session-id'
      const sessionKey = `session:${registerResponse.body.user._id}:${sessionId}`
      await redisClient.set(sessionKey, JSON.stringify({
        token: shortLivedToken,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000,
      }), { EX: 3600 })

      const response = await request
        .get('/auth/me')
        .set('Authorization', `Bearer ${shortLivedToken}`)

      expect(response.status).toBe(200)
      expect(response.headers['x-new-token']).toBeDefined()
    })
  })

  // ==================== HEALTH CHECK ====================

  describe('GET /v1/healthy', () => {
    it('should return 200', async () => {
      const response = await request.get('/v1/healthy')
      expect(response.status).toBe(200)
    })
  })
})
