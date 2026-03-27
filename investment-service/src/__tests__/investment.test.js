/*eslint-env jest*/
jest.setTimeout(60000)

const AppTest = require('../__mocks__/app-base-test.js')
const config = require('../__mocks__/app.config.js')
const { Permissions } = require('interact-utils')

describe('Investment API', () => {
  let appTest
  let loggedAgent

  const credentials = {
    domain: 'test',
    login: 'testuser',
    permissions: [Permissions.SERVICES],
  }

  beforeAll(async () => {
    appTest = await AppTest.createApp(config)
    loggedAgent = await AppTest.createAgent(appTest, credentials, config.tokenSecret)
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
        .send(investmentData)

      expect(response.status).toBe(400)
    })
  })

  describe('GET /v1/public/investment/:investmentId', () => {
    it('should return 404 for non-existent investment', async () => {
      const response = await loggedAgent.get('/v1/public/investment/non-existent-id')
      expect(response.status).toBe(404)
    })
  })

  describe('GET /v1/public/investment/portfolio/:portfolioId', () => {
    it('should return empty array for non-existent portfolio', async () => {
      const response = await loggedAgent.get('/v1/public/investment/portfolio/non-existent-portfolio')
      expect(response.status).toBe(200)
      expect(response.body).toEqual([])
    })
  })
})
