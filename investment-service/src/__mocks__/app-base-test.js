/*eslint-env jest*/

jest.setTimeout(60000)

const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const supertest = require('supertest')
const AppService = require('../app/app-service')

const createRedisMock = () => {
  const redisMock = require('redis-mock')
  const originalCreateClient = redisMock.createClient

  redisMock.createClient = (options) => {
    const client = originalCreateClient(options)
    client.connect = () => Promise.resolve()
    client.quit = () => Promise.resolve()
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

const clearAllNodeTimers = function () {
  const maxTimerId = setTimeout(() => {}, 0)
  for (let id = 1; id < maxTimerId; id++) {
    clearTimeout(id)
    clearInterval(id)
  }
  clearTimeout(maxTimerId)
}

let originalConsoleLog = console.log
let originalConsoleDir = console.dir

const createApp = async function (config) {
  const testConsoleLog = function (log) {
    originalConsoleLog(log)
  }

  if (process.env.CONSOLE_LOG_DISABLE) {
    const consoleError = console.error
    global.console = require('console')
    console.error = consoleError
    originalConsoleLog = console.log
    originalConsoleDir = console.dir
    console.log = jest.fn()
    console.dir = jest.fn()
  }

  const connection = await mongoose.createConnection(config.db.url)
  const database = connection.useDb(config.db.name)

  const service = new AppService()
  await service.initialize(config)
  const app = service.getApp()

  await flushPromises()

  return { connection, database, service, app, testConsoleLog }
}

const clearMocks = async function (appTest) {
  if (appTest && appTest.database) {
    await appTest.database.dropDatabase()
  }
}

const clearApp = async function (appTest) {
  if (!appTest) {
    return
  }

  if (appTest.database) {
    await appTest.database.dropDatabase()
    await appTest.database.close()
  }

  if (appTest.connection) {
    await appTest.connection.close()
  }

  await mongoose.disconnect()
}

const generateToken = (credentials, tokenSecret) => {
  const createdAt = Date.now()
  const token = jwt.sign(JSON.stringify({ createdAt, ...credentials }), tokenSecret, { algorithm: 'HS256' })
  return token
}

const returnConsoleLog = function () {
  if (process.env.CONSOLE_LOG_DISABLE) {
    console.log = originalConsoleLog
    console.dir = originalConsoleDir
  }
}

const createAgent = async (appTest, credentials, tokenSecret) => {
  const agent = supertest.agent(appTest.app)
  const token = jwt.sign(JSON.stringify(credentials), tokenSecret, { algorithm: 'HS256' })
  agent.jar.setCookies(`access_token=${token}`)
  return agent
}

module.exports = {
  createApp,
  clearMocks,
  clearApp,
  createAgent,
  generateToken,
  returnConsoleLog,
  flushPromises,
  clearAllNodeTimers,
}
