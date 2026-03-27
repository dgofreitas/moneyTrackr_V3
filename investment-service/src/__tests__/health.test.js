/*eslint-env jest*/
jest.setTimeout(60000)

const AppTest = require('../__mocks__/app-base-test.js')
const config = require('../__mocks__/app.config.js')

describe('Health Check', () => {
  let appTest
  let loggedAgent

  beforeAll(async () => {
    appTest = await AppTest.createApp(config)
    loggedAgent = await AppTest.createAgent(appTest, { domain: 'test', login: 'testuser' }, config.tokenSecret)
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

  it('should return 200 for health check endpoint', async () => {
    const response = await loggedAgent.get('/v1/healthy')
    expect(response.status).toBe(200)
  })
})
