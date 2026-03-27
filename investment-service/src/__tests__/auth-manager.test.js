/*eslint-env jest*/
jest.setTimeout(60000)

const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const AuthManager = require('../app/auth/auth-manager')
const AuthDAO = require('../app/auth/auth-dao')
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

describe('AuthManager', () => {
  let authManager
  let authDAO
  let redisClient
  let mockAppManager
  let mockAppDB
  let db

  const testConfig = {
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

  beforeAll(async () => {
    // Set JWT_SECRET for tests
    process.env.JWT_SECRET = testConfig.auth.jwtSecret
  })

  beforeEach(async () => {
    // Create in-memory database connection
    const connection = await mongoose.createConnection(global.__MONGO_URI__)
    db = connection.useDb(global.__MONGO_DB_NAME__ + '_auth_test_' + Date.now())

    // Create mock Redis client
    redisClient = createRedisMock()

    // Create mock AppDB
    mockAppDB = {
      getDb: () => db,
    }

    // Create mock AppManager
    mockAppManager = {
      getDb: () => db,
      getRedisClient: () => redisClient,
      handleError: jest.fn((obj) => {
        const error = new Error(obj.message)
        error.statusCode = obj.statusCode
        throw error
      }),
      config: testConfig,
    }

    // Create AuthManager instance
    authManager = new AuthManager(mockAppManager, mockAppDB)
    authDAO = authManager.authDAO
  })

  afterEach(async () => {
    await db.dropDatabase()
    await db.close()
    jest.restoreAllMocks()
  })

  // ==================== REGISTER TESTS ====================

  describe('register()', () => {
    it('should create user and return token with valid data', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      }

      const result = await authManager.register(userData)

      expect(result).toHaveProperty('user')
      expect(result).toHaveProperty('token')
      expect(result).toHaveProperty('sessionId')
      expect(result.user.email).toBe(userData.email.toLowerCase())
      expect(result.user.name).toBe(userData.name)
      expect(result.user).not.toHaveProperty('password')

      // Verify token is valid
      const decoded = jwt.verify(result.token, testConfig.auth.jwtSecret)
      expect(decoded.email).toBe(userData.email.toLowerCase())

      // Verify user was created in database
      const user = await authDAO.findByEmail(userData.email)
      expect(user).toBeTruthy()
      expect(user.password).not.toBe(userData.password) // Should be hashed
    })

    it('should throw EMAIL_ALREADY_EXISTS when email is already registered', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      }

      // Register first user
      await authManager.register(userData)

      // Try to register with same email
      await expect(authManager.register(userData)).rejects.toThrow(APP_CONSTANTS.ERRORS.EMAIL_ALREADY_EXISTS.message)
    })

    it('should throw NAME_REQUIRED when name is missing', async () => {
      const userData = {
        name: '',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      }

      await expect(authManager.register(userData)).rejects.toThrow(APP_CONSTANTS.ERRORS.NAME_REQUIRED.message)
    })

    it('should throw NAME_REQUIRED when name is too short', async () => {
      const userData = {
        name: 'A',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      }

      await expect(authManager.register(userData)).rejects.toThrow(APP_CONSTANTS.ERRORS.NAME_REQUIRED.message)
    })

    it('should throw INVALID_EMAIL when email is invalid', async () => {
      const userData = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      }

      await expect(authManager.register(userData)).rejects.toThrow(APP_CONSTANTS.ERRORS.INVALID_EMAIL.message)
    })

    it('should throw INVALID_EMAIL when email is missing', async () => {
      const userData = {
        name: 'Test User',
        email: '',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      }

      await expect(authManager.register(userData)).rejects.toThrow(APP_CONSTANTS.ERRORS.INVALID_EMAIL.message)
    })

    it('should throw PASSWORD_TOO_SHORT when password is too short', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Short1@',
        confirmPassword: 'Short1@',
      }

      await expect(authManager.register(userData)).rejects.toThrow(APP_CONSTANTS.ERRORS.PASSWORD_TOO_SHORT.message)
    })

    it('should throw INVALID_PASSWORD_FORMAT when password lacks complexity', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'simplepassword',
        confirmPassword: 'simplepassword',
      }

      await expect(authManager.register(userData)).rejects.toThrow(APP_CONSTANTS.ERRORS.INVALID_PASSWORD_FORMAT.message)
    })

    it('should throw PASSWORDS_DONT_MATCH when passwords do not match', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'DifferentPass@456',
      }

      await expect(authManager.register(userData)).rejects.toThrow(APP_CONSTANTS.ERRORS.PASSWORDS_DONT_MATCH.message)
    })

    it('should hash password with bcrypt', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      }

      await authManager.register(userData)

      const user = await authDAO.findByEmail(userData.email)
      const isHashed = await bcrypt.compare(userData.password, user.password)
      expect(isHashed).toBe(true)
    })

    it('should create session in Redis', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      }

      const result = await authManager.register(userData)

      // Verify session was created
      const sessionKey = `session:${result.user._id}:${result.sessionId}`
      expect(redisClient._store.has(sessionKey)).toBe(true)
    })
  })

  // ==================== LOGIN TESTS ====================

  describe('login()', () => {
    beforeEach(async () => {
      // Create a test user
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      }
      await authManager.register(userData)
    })

    it('should return token with valid credentials', async () => {
      const result = await authManager.login({
        email: 'test@example.com',
        password: 'ValidPass@123',
      })

      expect(result).toHaveProperty('user')
      expect(result).toHaveProperty('token')
      expect(result).toHaveProperty('sessionId')
      expect(result.user.email).toBe('test@example.com')
      expect(result.user).not.toHaveProperty('password')

      // Verify token is valid
      const decoded = jwt.verify(result.token, testConfig.auth.jwtSecret)
      expect(decoded.email).toBe('test@example.com')
    })

    it('should throw INVALID_CREDENTIALS with wrong password', async () => {
      await expect(authManager.login({
        email: 'test@example.com',
        password: 'WrongPassword@123',
      })).rejects.toThrow(APP_CONSTANTS.ERRORS.INVALID_CREDENTIALS.message)
    })

    it('should throw INVALID_CREDENTIALS with non-existent email', async () => {
      await expect(authManager.login({
        email: 'nonexistent@example.com',
        password: 'ValidPass@123',
      })).rejects.toThrow(APP_CONSTANTS.ERRORS.INVALID_CREDENTIALS.message)
    })

    it('should increment login attempts on failed login', async () => {
      const user = await authDAO.findByEmail('test@example.com')
      expect(user.loginAttempts).toBe(0)

      // Failed login attempt
      try {
        await authManager.login({
          email: 'test@example.com',
          password: 'WrongPassword@123',
        })
      } catch (e) {
        // Expected
      }

      const updatedUser = await authDAO.findByEmail('test@example.com')
      expect(updatedUser.loginAttempts).toBe(1)
    })

    it('should reset login attempts on successful login', async () => {
      // First, make some failed attempts
      for (let i = 0; i < 2; i++) {
        try {
          await authManager.login({
            email: 'test@example.com',
            password: 'WrongPassword@123',
          })
        } catch (e) {
          // Expected
        }
      }

      let user = await authDAO.findByEmail('test@example.com')
      expect(user.loginAttempts).toBe(2)

      // Successful login
      await authManager.login({
        email: 'test@example.com',
        password: 'ValidPass@123',
      })

      user = await authDAO.findByEmail('test@example.com')
      expect(user.loginAttempts).toBe(0)
    })

    it('should throw ACCOUNT_LOCKED after 5 failed attempts', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        try {
          await authManager.login({
            email: 'test@example.com',
            password: 'WrongPassword@123',
          })
        } catch (e) {
          // Expected
        }
      }

      // 6th attempt should be locked
      await expect(authManager.login({
        email: 'test@example.com',
        password: 'ValidPass@123',
      })).rejects.toThrow(APP_CONSTANTS.ERRORS.ACCOUNT_LOCKED.message)
    })

    it('should update lastLoginAt on successful login', async () => {
      const beforeLogin = new Date()

      await authManager.login({
        email: 'test@example.com',
        password: 'ValidPass@123',
      })

      const user = await authDAO.findByEmail('test@example.com')
      expect(user.lastLoginAt).toBeTruthy()
      expect(new Date(user.lastLoginAt).getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime())
    })
  })

  // ==================== GOOGLE OAUTH TESTS ====================

  describe('googleAuth()', () => {
    let mockFetch

    beforeEach(() => {
      mockFetch = jest.fn()
      global.fetch = mockFetch
    })

    afterEach(() => {
      delete global.fetch
    })

    it('should create new user with Google account', async () => {
      // Mock Google token exchange
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-access-token' }),
        })
        // Mock Google profile fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'google-user-123',
            email: 'googleuser@example.com',
            name: 'Google User',
            picture: 'https://example.com/avatar.jpg',
          }),
        })

      const result = await authManager.googleAuth({ code: 'mock-auth-code' })

      expect(result).toHaveProperty('user')
      expect(result).toHaveProperty('token')
      expect(result).toHaveProperty('sessionId')
      expect(result.user.email).toBe('googleuser@example.com')
      expect(result.user.googleId).toBe('google-user-123')
      expect(result.user.provider).toBe('google')
      expect(result.user).not.toHaveProperty('password')

      // Verify user was created in database
      const user = await authDAO.findByGoogleId('google-user-123')
      expect(user).toBeTruthy()
    })

    it('should link Google account to existing email user', async () => {
      // First create a user with email/password
      await authManager.register({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })

      // Mock Google token exchange with same email
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
            picture: 'https://example.com/newavatar.jpg',
          }),
        })

      const result = await authManager.googleAuth({ code: 'mock-auth-code' })

      expect(result.user.provider).toBe('both')
      expect(result.user.googleId).toBe('google-user-456')

      // Verify user can still login with password
      const loginResult = await authManager.login({
        email: 'existing@example.com',
        password: 'ValidPass@123',
      })
      expect(loginResult).toHaveProperty('token')
    })

    it('should login existing Google user', async () => {
      // First create a Google user
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'google-user-789',
            email: 'returning@example.com',
            name: 'Returning User',
            picture: 'https://example.com/avatar.jpg',
          }),
        })

      await authManager.googleAuth({ code: 'mock-auth-code-1' })

      // Login again with same Google account
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-access-token-2' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'google-user-789',
            email: 'returning@example.com',
            name: 'Returning User Updated',
            picture: 'https://example.com/newavatar.jpg',
          }),
        })

      const result = await authManager.googleAuth({ code: 'mock-auth-code-2' })

      expect(result.user.name).toBe('Returning User Updated')
      expect(result.user.avatar).toBe('https://example.com/newavatar.jpg')
    })

    it('should throw GOOGLE_AUTH_FAILED when token exchange fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      })

      await expect(authManager.googleAuth({ code: 'invalid-code' }))
        .rejects.toThrow(APP_CONSTANTS.ERRORS.GOOGLE_AUTH_FAILED.message)
    })

    it('should throw GOOGLE_AUTH_FAILED when profile fetch fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        })

      await expect(authManager.googleAuth({ code: 'mock-auth-code' }))
        .rejects.toThrow(APP_CONSTANTS.ERRORS.GOOGLE_AUTH_FAILED.message)
    })
  })

  // ==================== FORGOT PASSWORD TESTS ====================

  describe('forgotPassword()', () => {
    beforeEach(async () => {
      await authManager.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })
    })

    it('should create reset token in Redis for existing email', async () => {
      const result = await authManager.forgotPassword({ email: 'test@example.com' })

      expect(result.message).toBe('Se o email estiver cadastrado, voce recebera um link de recuperacao.')

      // Verify reset token was created in Redis
      const keys = Array.from(redisClient._store.keys())
      const resetKey = keys.find((k) => k.startsWith('reset:'))
      expect(resetKey).toBeTruthy()
    })

    it('should return generic message for non-existent email', async () => {
      const result = await authManager.forgotPassword({ email: 'nonexistent@example.com' })

      expect(result.message).toBe('Se o email estiver cadastrado, voce recebera um link de recuperacao.')

      // Verify no reset token was created
      const keys = Array.from(redisClient._store.keys())
      const resetKey = keys.find((k) => k.startsWith('reset:'))
      expect(resetKey).toBeFalsy()
    })

    it('should not reveal if email exists or not', async () => {
      const existingResult = await authManager.forgotPassword({ email: 'test@example.com' })
      const nonExistentResult = await authManager.forgotPassword({ email: 'nonexistent@example.com' })

      expect(existingResult.message).toBe(nonExistentResult.message)
    })
  })

  // ==================== RESET PASSWORD TESTS ====================

  describe('resetPassword()', () => {
    let resetToken

    beforeEach(async () => {
      await authManager.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })

      // Create reset token
      await authManager.forgotPassword({ email: 'test@example.com' })

      // Get the reset token from Redis
      const keys = Array.from(redisClient._store.keys())
      const resetKey = keys.find((k) => k.startsWith('reset:'))
      resetToken = resetKey.replace('reset:', '')
    })

    it('should update password with valid token', async () => {
      const result = await authManager.resetPassword({
        token: resetToken,
        password: 'NewValidPass@456',
        confirmPassword: 'NewValidPass@456',
      })

      expect(result.message).toBe('Senha redefinida com sucesso. Faca login.')

      // Verify can login with new password
      const loginResult = await authManager.login({
        email: 'test@example.com',
        password: 'NewValidPass@456',
      })
      expect(loginResult).toHaveProperty('token')

      // Verify cannot login with old password
      await expect(authManager.login({
        email: 'test@example.com',
        password: 'ValidPass@123',
      })).rejects.toThrow(APP_CONSTANTS.ERRORS.INVALID_CREDENTIALS.message)
    })

    it('should throw INVALID_RESET_TOKEN for invalid token', async () => {
      await expect(authManager.resetPassword({
        token: 'invalid-token',
        password: 'NewValidPass@456',
        confirmPassword: 'NewValidPass@456',
      })).rejects.toThrow(APP_CONSTANTS.ERRORS.INVALID_RESET_TOKEN.message)
    })

    it('should throw INVALID_RESET_TOKEN for already used token', async () => {
      // Use token once
      await authManager.resetPassword({
        token: resetToken,
        password: 'NewValidPass@456',
        confirmPassword: 'NewValidPass@456',
      })

      // Try to use same token again
      await expect(authManager.resetPassword({
        token: resetToken,
        password: 'AnotherPass@789',
        confirmPassword: 'AnotherPass@789',
      })).rejects.toThrow(APP_CONSTANTS.ERRORS.INVALID_RESET_TOKEN.message)
    })

    it('should invalidate all sessions after password reset', async () => {
      // Login to create session
      const loginResult = await authManager.login({
        email: 'test@example.com',
        password: 'ValidPass@123',
      })

      // Verify session exists
      const sessionKey = `session:${loginResult.user._id}:${loginResult.sessionId}`
      expect(redisClient._store.has(sessionKey)).toBe(true)

      // Reset password
      await authManager.resetPassword({
        token: resetToken,
        password: 'NewValidPass@456',
        confirmPassword: 'NewValidPass@456',
      })

      // Verify session was invalidated
      expect(redisClient._store.has(sessionKey)).toBe(false)
    })

    it('should validate new password format', async () => {
      await expect(authManager.resetPassword({
        token: resetToken,
        password: 'weak',
        confirmPassword: 'weak',
      })).rejects.toThrow()
    })
  })

  // ==================== LOGOUT TESTS ====================

  describe('logout()', () => {
    it('should remove session from Redis', async () => {
      // Register and login
      const result = await authManager.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })

      // Verify session exists
      const sessionKey = `session:${result.user._id}:${result.sessionId}`
      expect(redisClient._store.has(sessionKey)).toBe(true)

      // Logout
      const logoutResult = await authManager.logout({
        userId: result.user._id,
        sessionId: result.sessionId,
      })

      expect(logoutResult.message).toBe('Logout realizado com sucesso')

      // Verify session was removed
      expect(redisClient._store.has(sessionKey)).toBe(false)
    })
  })

  // ==================== GET PROFILE TESTS ====================

  describe('getProfile()', () => {
    it('should return user without password', async () => {
      const registerResult = await authManager.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })

      const result = await authManager.getProfile({ userId: registerResult.user._id })

      expect(result.user).toBeTruthy()
      expect(result.user.email).toBe('test@example.com')
      expect(result.user.name).toBe('Test User')
      expect(result.user).not.toHaveProperty('password')
      expect(result.user).not.toHaveProperty('loginAttempts')
      expect(result.user).not.toHaveProperty('lockedUntil')
    })

    it('should throw USER_NOT_FOUND for non-existent user', async () => {
      await expect(authManager.getProfile({ userId: 'non-existent-id' }))
        .rejects.toThrow(APP_CONSTANTS.ERRORS.USER_NOT_FOUND.message)
    })
  })

  // ==================== UPDATE PROFILE TESTS ====================

  describe('updateProfile()', () => {
    let userId

    beforeEach(async () => {
      const result = await authManager.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })
      userId = result.user._id
    })

    it('should update name', async () => {
      const result = await authManager.updateProfile({
        userId,
        name: 'Updated Name',
      })

      expect(result.user.name).toBe('Updated Name')
    })

    it('should update avatar', async () => {
      const result = await authManager.updateProfile({
        userId,
        avatar: 'https://example.com/newavatar.jpg',
      })

      expect(result.user.avatar).toBe('https://example.com/newavatar.jpg')
    })

    it('should update both name and avatar', async () => {
      const result = await authManager.updateProfile({
        userId,
        name: 'New Name',
        avatar: 'https://example.com/avatar.jpg',
      })

      expect(result.user.name).toBe('New Name')
      expect(result.user.avatar).toBe('https://example.com/avatar.jpg')
    })

    it('should throw NAME_TOO_SHORT for short name', async () => {
      await expect(authManager.updateProfile({
        userId,
        name: 'A',
      })).rejects.toThrow(APP_CONSTANTS.ERRORS.NAME_TOO_SHORT.message)
    })

    it('should not update if no fields provided', async () => {
      const result = await authManager.updateProfile({ userId })

      expect(result.user.name).toBe('Test User')
    })
  })

  // ==================== HELPER METHOD TESTS ====================

  describe('_generateJWT()', () => {
    it('should generate valid JWT token', async () => {
      const result = await authManager.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })

      const decoded = jwt.verify(result.token, testConfig.auth.jwtSecret)
      expect(decoded.userId).toBe(result.user._id)
      expect(decoded.email).toBe('test@example.com')
      expect(decoded.name).toBe('Test User')
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000)
    })
  })

  describe('_sanitizeUser()', () => {
    it('should remove sensitive fields from user object', async () => {
      const result = await authManager.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })

      expect(result.user).not.toHaveProperty('password')
      expect(result.user).not.toHaveProperty('loginAttempts')
      expect(result.user).not.toHaveProperty('lockedUntil')
    })
  })

  describe('_validatePassword()', () => {
    it('should accept valid password', async () => {
      const result = await authManager.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPass@123',
        confirmPassword: 'ValidPass@123',
      })

      expect(result).toHaveProperty('token')
    })

    it('should reject password without uppercase', async () => {
      await expect(authManager.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'lowercase123@',
        confirmPassword: 'lowercase123@',
      })).rejects.toThrow(APP_CONSTANTS.ERRORS.INVALID_PASSWORD_FORMAT.message)
    })

    it('should reject password without lowercase', async () => {
      await expect(authManager.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'UPPERCASE123@',
        confirmPassword: 'UPPERCASE123@',
      })).rejects.toThrow(APP_CONSTANTS.ERRORS.INVALID_PASSWORD_FORMAT.message)
    })

    it('should reject password without number', async () => {
      await expect(authManager.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'NoNumbers@',
        confirmPassword: 'NoNumbers@',
      })).rejects.toThrow(APP_CONSTANTS.ERRORS.INVALID_PASSWORD_FORMAT.message)
    })

    it('should reject password without special character', async () => {
      await expect(authManager.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'NoSpecial123',
        confirmPassword: 'NoSpecial123',
      })).rejects.toThrow(APP_CONSTANTS.ERRORS.INVALID_PASSWORD_FORMAT.message)
    })
  })
})
