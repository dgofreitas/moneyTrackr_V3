const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const AuthDAO = require('./auth-dao')
const APP_CONSTANTS = require('../app-constants')
const { JsonLog } = require('json-log-middleware')
const EmailService = require('../../services/email-service')
const logger = new JsonLog(APP_CONSTANTS.SERVICE_NAME)

// Validate JWT_SECRET at module load time
if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is not set', new Error('JWT_SECRET not configured'), {
    internal: { method: 'module', filename: 'auth-manager.js' },
  })
  throw new Error('FATAL: JWT_SECRET environment variable is required')
}

class AuthManager {

  constructor(appManager, appDB) {
    this.appDB = appDB
    this.authDAO = new AuthDAO(this.appDB.getDb())
    this.appManager = appManager
    this.handleError = appManager.handleError.bind(appManager)
    this.redisClient = appManager.getRedisClient()
    this.config = appManager.config?.auth || {}
    this.googleConfig = appManager.config?.google || {}
    this.emailService = new EmailService(appManager.config?.email || {})
  }

  inicialize(_appManager) {
    logger.log('AuthManager inicializado', { internal: { method: 'inicialize', filename: 'auth-manager.js' } })
  }

  // ==================== REGISTRO ====================

  async register({ name, email, password, confirmPassword }) {
    logger.log('Registrando usuario', { email, internal: { method: 'register', filename: 'auth-manager.js' } })

    // Validacoes
    this._validateRegistrationData({ name, email, password, confirmPassword })

    // Verificar se email ja existe
    const existingUser = await this.authDAO.findByEmail(email)
    if (existingUser) {
      this.handleError(APP_CONSTANTS.ERRORS.EMAIL_ALREADY_EXISTS)
    }

    // Hash da senha
    const saltRounds = this.config.bcryptSaltRounds || 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Criar usuario
    const user = await this.authDAO.create({
      name,
      email: email.toLowerCase(),
      password: passwordHash,
      provider: 'local',
      status: 'active',
    })

    // Gerar JWT e criar sessao
    const token = this._generateJWT(user)
    const sessionId = await this._createSession(user._id, token)

    return {
      user: this._sanitizeUser(user),
      token,
      sessionId,
    }
  }

  // ==================== LOGIN ====================

  async login({ email, password }) {
    logger.log('Login usuario', { email, internal: { method: 'login', filename: 'auth-manager.js' } })

    // Verificar bloqueio por tentativas
    await this._checkLoginAttempts(email)

    // Buscar usuario
    const user = await this.authDAO.findByEmail(email)
    if (!user || !user.password) {
      this.handleError(APP_CONSTANTS.ERRORS.INVALID_CREDENTIALS)
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      await this._handleFailedLogin(user)
      this.handleError(APP_CONSTANTS.ERRORS.INVALID_CREDENTIALS)
    }

    // Login com sucesso
    await this.authDAO.resetLoginAttempts(user._id)

    // Gerar JWT e criar sessao
    const token = this._generateJWT(user)
    const sessionId = await this._createSession(user._id, token)

    return {
      user: this._sanitizeUser(user),
      token,
      sessionId,
    }
  }

  // ==================== GOOGLE OAUTH ====================

  async googleAuth({ code }) {
    logger.log('Google OAuth', { internal: { method: 'googleAuth', filename: 'auth-manager.js' } })

    // Trocar code por access_token
    const tokens = await this._exchangeGoogleCode(code)

    // Obter perfil do usuario
    const profile = await this._getGoogleProfile(tokens.access_token)

    // Buscar usuario existente
    let user = await this.authDAO.findByGoogleId(profile.id)

    if (!user) {
      // Verificar se existe usuario com mesmo email
      user = await this.authDAO.findByEmail(profile.email)

      if (user) {
        // Vincular conta Google
        user = await this.authDAO.updateById(user._id, {
          googleId: profile.id,
          provider: 'both',
          avatar: profile.picture || user.avatar,
        })
      } else {
        // Criar novo usuario
        user = await this.authDAO.create({
          email: profile.email,
          name: profile.name,
          googleId: profile.id,
          avatar: profile.picture,
          provider: 'google',
          status: 'active',
        })
      }
    } else {
      // Atualizar dados do perfil
      user = await this.authDAO.updateById(user._id, {
        name: profile.name,
        avatar: profile.picture || user.avatar,
        lastLoginAt: new Date(),
      })
    }

    // Gerar JWT e criar sessao
    const token = this._generateJWT(user)
    const sessionId = await this._createSession(user._id, token)

    return {
      user: this._sanitizeUser(user),
      token,
      sessionId,
    }
  }

  // ==================== RECUPERACAO DE SENHA ====================

  async forgotPassword({ email }) {
    logger.log('Forgot password', { email, internal: { method: 'forgotPassword', filename: 'auth-manager.js' } })

    const user = await this.authDAO.findByEmail(email)

    // Sempre retornar mensagem generica (seguranca)
    if (!user) {
      return { message: 'Se o email estiver cadastrado, voce recebera um link de recuperacao.' }
    }

    // Gerar token de reset
    const resetToken = uuidv4()
    const redisKey = `reset:${resetToken}`

    // Armazenar no Redis com TTL de 1 hora
    const ttl = this.config.resetTokenTTLSeconds || 3600
    await this.redisClient.set(redisKey, user._id, { EX: ttl })

    // Enviar email de recuperacao
    try {
      await this.emailService.sendResetEmail(user.email, resetToken)
    } catch (error) {
      // Log error but don't reveal to user (security)
      logger.error('Failed to send reset email', error, {
        email,
        internal: { method: 'forgotPassword', filename: 'auth-manager.js' },
      })
    }

    return { message: 'Se o email estiver cadastrado, voce recebera um link de recuperacao.' }
  }

  async resetPassword({ token, password, confirmPassword }) {
    logger.log('Reset password', { internal: { method: 'resetPassword', filename: 'auth-manager.js' } })

    // Validar token no Redis
    const redisKey = `reset:${token}`
    const userId = await this.redisClient.get(redisKey)

    if (!userId) {
      this.handleError(APP_CONSTANTS.ERRORS.INVALID_RESET_TOKEN)
    }

    // Validar nova senha
    this._validatePassword(password, confirmPassword)

    // Hash da nova senha
    const saltRounds = this.config.bcryptSaltRounds || 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Atualizar senha
    await this.authDAO.updatePassword(userId, passwordHash)

    // Remover token (uso unico)
    await this.redisClient.del(redisKey)

    // Invalidar todas as sessoes do usuario
    await this._invalidateAllSessions(userId)

    return { message: 'Senha redefinida com sucesso. Faca login.' }
  }

  // ==================== SESSAO ====================

  async logout({ userId, sessionId }) {
    logger.log('Logout', { userId, sessionId, internal: { method: 'logout', filename: 'auth-manager.js' } })

    const sessionKey = `session:${userId}:${sessionId}`
    await this.redisClient.del(sessionKey)
    return { message: 'Logout realizado com sucesso' }
  }

  async getProfile({ userId }) {
    logger.log('Get profile', { userId, internal: { method: 'getProfile', filename: 'auth-manager.js' } })

    const user = await this.authDAO.findById(userId)
    if (!user) {
      this.handleError(APP_CONSTANTS.ERRORS.USER_NOT_FOUND)
    }
    return { user: this._sanitizeUser(user) }
  }

  async updateProfile({ userId, name, avatar }) {
    logger.log('Update profile', { userId, internal: { method: 'updateProfile', filename: 'auth-manager.js' } })

    const updateData = {}
    if (name) {
      if (name.trim().length < 2) {
        this.handleError(APP_CONSTANTS.ERRORS.NAME_TOO_SHORT)
      }
      updateData.name = name
    }
    if (avatar) {
      updateData.avatar = avatar
    }

    const user = await this.authDAO.updateById(userId, updateData)
    return { user: this._sanitizeUser(user) }
  }

  // ==================== HELPERS ====================

  _generateJWT(user) {
    const payload = {
      userId: user._id,
      email: user.email,
      name: user.name,
    }
    // JWT_SECRET is validated at module load time, no fallback allowed
    const secret = process.env.JWT_SECRET
    const expiresIn = this.config.jwtExpiresIn || '24h'
    return jwt.sign(payload, secret, { expiresIn })
  }

  async _createSession(userId, token) {
    const sessionId = uuidv4()
    const sessionKey = `session:${userId}:${sessionId}`
    const decoded = jwt.decode(token)

    const ttl = this.config.sessionTTLSeconds || 86400
    await this.redisClient.set(sessionKey, JSON.stringify({
      token,
      createdAt: Date.now(),
      expiresAt: decoded.exp * 1000,
    }), { EX: ttl })

    return sessionId
  }

  async _invalidateAllSessions(userId) {
    // Buscar todas as chaves de sessao do usuario
    const pattern = `session:${userId}:*`
    const keys = await this.redisClient.keys(pattern)

    if (keys.length > 0) {
      await this.redisClient.del(keys)
    }
  }

  _validateRegistrationData({ name, email, password, confirmPassword }) {
    if (!name || name.trim().length < 2) {
      this.handleError(APP_CONSTANTS.ERRORS.NAME_REQUIRED)
    }

    if (!email || !this._isValidEmail(email)) {
      this.handleError(APP_CONSTANTS.ERRORS.INVALID_EMAIL)
    }

    this._validatePassword(password, confirmPassword)
  }

  _validatePassword(password, confirmPassword) {
    if (!password) {
      this.handleError(APP_CONSTANTS.ERRORS.PASSWORD_REQUIRED)
    }

    if (password.length < 8) {
      this.handleError(APP_CONSTANTS.ERRORS.PASSWORD_TOO_SHORT)
    }

    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      this.handleError(APP_CONSTANTS.ERRORS.INVALID_PASSWORD_FORMAT)
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      this.handleError(APP_CONSTANTS.ERRORS.PASSWORDS_DONT_MATCH)
    }
  }

  _isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  async _checkLoginAttempts(email) {
    const user = await this.authDAO.findByEmail(email)

    if (user && user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      this.handleError(APP_CONSTANTS.ERRORS.ACCOUNT_LOCKED)
    }
  }

  async _handleFailedLogin(user) {
    const attempts = await this.authDAO.incrementLoginAttempts(user._id)

    const maxAttempts = this.config.maxLoginAttempts || 5
    if (attempts.loginAttempts >= maxAttempts) {
      const lockMinutes = this.config.lockDurationMinutes || 15
      const lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000)
      await this.authDAO.lockAccount(user._id, lockUntil)
    }
  }

  async _exchangeGoogleCode(code) {
    const tokenUrl = this.googleConfig.tokenUrl || 'https://oauth2.googleapis.com/token'
    const clientId = process.env.GOOGLE_CLIENT_ID || this.googleConfig.clientId
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || this.googleConfig.clientSecret
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || this.googleConfig.redirectUri

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!response.ok) {
      logger.error('Falha ao trocar code Google', { status: response.status }, { internal: { method: '_exchangeGoogleCode', filename: 'auth-manager.js' } })
      this.handleError(APP_CONSTANTS.ERRORS.GOOGLE_AUTH_FAILED)
    }

    return response.json()
  }

  async _getGoogleProfile(accessToken) {
    const userInfoUrl = this.googleConfig.userInfoUrl || 'https://www.googleapis.com/oauth2/v2/userinfo'

    const response = await fetch(userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      logger.error('Falha ao obter perfil Google', { status: response.status }, { internal: { method: '_getGoogleProfile', filename: 'auth-manager.js' } })
      this.handleError(APP_CONSTANTS.ERRORS.GOOGLE_AUTH_FAILED)
    }

    return response.json()
  }

  _sanitizeUser(user) {
    const sanitized = user.toObject ? user.toObject() : { ...user }
    delete sanitized.password
    delete sanitized.loginAttempts
    delete sanitized.lockedUntil
    return sanitized
  }
}

module.exports = AuthManager
