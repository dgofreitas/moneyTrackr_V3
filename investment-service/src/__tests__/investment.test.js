/*eslint-env jest*/
jest.setTimeout(60000)

// Mock interact-utils - Jest will automatically use __mocks__/interact-utils.js
jest.mock('interact-utils')

const AppTest = require('../__mocks__/app-base-test.js')
const config = require('../__mocks__/app.config.js')
const { Permissions } = require('interact-utils')
const jwt = require('jsonwebtoken')
const { userSchema } = require('../app/auth/user-model')
const { v4: uuidv4 } = require('uuid')

describe('Investment API', () => {
  let appTest
  let loggedAgent
  let token
  let testUser

  const credentials = {
    domain: 'test',
    login: 'testuser',
    permissions: [Permissions.SERVICES],
  }

  beforeAll(async () => {
    appTest = await AppTest.createApp(config)
    loggedAgent = await AppTest.createAgent(appTest, credentials, config.tokenSecret)

    // Create User model
    const User = appTest.database.model('user', userSchema)

    // Create test user
    testUser = await User.create({
      _id: uuidv4(),
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedpassword',
      provider: 'local',
      status: 'active',
    })

    // Create JWT token with correct payload structure
    const payload = {
      userId: testUser._id,
      email: testUser.email,
      name: testUser.name,
    }
    token = jwt.sign(payload, process.env.JWT_SECRET || config.auth.jwtSecret, { expiresIn: '24h' })

    // Create session in Redis
    const sessionId = uuidv4()
    const sessionKey = `session:${testUser._id}:${sessionId}`
    const decoded = jwt.decode(token)
    const ttl = config.auth.sessionTTLSeconds || 86400
    await appTest.service.appManager.getRedisClient().set(sessionKey, JSON.stringify({
      token,
      createdAt: Date.now(),
      expiresAt: decoded.exp * 1000,
    }), { EX: ttl })
  })

  beforeEach(async () => {
    await AppTest.clearMocks(appTest)
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await AppTest.flushPromises()
  })

  afterAll(async () => {
    await AppTest.clearApp(appTest)
    AppTest.returnConsoleLog()
  })

  describe('POST /v1/public/investment', () => {
    it('should create a new investment', async () => {
      const investmentData = {
        portfolioId: 'portfolio-123',
        symbol: 'PETR4',
        name: 'Petrobras PN',
        type: 'STOCK',
        quantity: 100,
        averagePrice: 30.50,
        totalCost: 3050,
        currentPrice: 32.00,
        currentValue: 3200,
        broker: 'XP Investimentos',
      }

      const response = await loggedAgent
        .post('/v1/public/investment')
        .set('Authorization', `Bearer ${token}`)
        .send(investmentData)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('investmentId')
    })

    it('should return 400 when required fields are missing', async () => {
      const investmentData = {
        symbol: 'PETR4',
        name: 'Petrobras PN',
      }

      const response = await loggedAgent
        .post('/v1/public/investment')
        .set('Authorization', `Bearer ${token}`)
        .send(investmentData)

      expect(response.status).toBe(400)
    })
  })

  describe('GET /v1/public/investment/:investmentId', () => {
    it('should return 404 for non-existent investment', async () => {
      const response = await loggedAgent
        .get('/v1/public/investment/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
      expect(response.status).toBe(404)
    })
  })

  describe('GET /v1/public/investment/portfolio/:portfolioId', () => {
    it('should return empty array for non-existent portfolio', async () => {
      const response = await loggedAgent
        .get('/v1/public/investment/portfolio/non-existent-portfolio')
        .set('Authorization', `Bearer ${token}`)
      expect(response.status).toBe(200)
      expect(response.body).toEqual([])
    })
  })
})
