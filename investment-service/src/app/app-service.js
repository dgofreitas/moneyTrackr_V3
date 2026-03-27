const express = require('express')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const cors = require('cors')
const AppRouter = require('./app-router')
const AppManager = require('./app-manager')

class AppService {
  constructor() {
    this.app = express()
    this.appManager = new AppManager()
  }

  async initialize(config) {
    await this.appManager.initialize(config)
    this._setupMiddlewares()
    this._setupRoutes()
  }

  _setupMiddlewares() {
    this.app.use(helmet())
    this.app.use(cors())
    this.app.use(cookieParser())
    this.app.use(bodyParser.json())
    this.app.use(bodyParser.urlencoded({ extended: false }))
  }

  _setupRoutes() {
    this.app.use('/', AppRouter.getPublicRoutes(this.appManager))
  }

  getApp() {
    return this.app
  }

  getAppManager() {
    return this.appManager
  }
}

module.exports = AppService
