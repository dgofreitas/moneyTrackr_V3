# Plano Tecnico - EP02: Autenticacao e Gestao de Sessao

## 1. Visao Geral da Arquitetura

```
+------------------------------------------------------------------+
|                    FLUXO DE AUTENTICACAO                          |
+------------------------------------------------------------------+

  [Browser]                    [Backend]                    [External]
      |                            |                             |
      | 1. Login Request           |                             |
      |--------------------------->|                             |
      |                            |                             |
      |                            | 2. Validate Credentials     |
      |                            |--------> [MongoDB]          |
      |                            |<------- user found          |
      |                            |                             |
      |                            | 3. Create Session          |
      |                            |--------> [Redis]           |
      |                            |         session:{userId}    |
      |                            |                             |
      | 4. JWT Token               |                             |
      |<---------------------------|                             |
      |                            |                             |
      |                            |                             |
      | 5. Google OAuth            |                             |
      |--------------------------->|                             |
      |                            | 6. Exchange Code            |
      |                            |--------------------------->|
      |                            |                     [Google OAuth]
      |                            |<---------------------------|
      |                            |         access_token        |
      |                            |                             |
      |                            | 7. Get User Info            |
      |                            |--------------------------->|
      |                            |<---------------------------|
      |                            |     profile data            |
      |                            |                             |
      | 8. JWT Token               |                             |
      |<---------------------------|                             |
```

### Diagrama de Componentes

```
+------------------------------------------------------------------+
|                    ARQUITETURA DE AUTENTICACAO                    |
+------------------------------------------------------------------+

  +------------------+     +------------------+     +-------------+
  |   Auth Router    |---->|   Auth Manager   |---->|  Auth DAO   |
  | (Express Routes) |     | (Business Logic) |     | (MongoDB)   |
  +------------------+     +------------------+     +-------------+
           |                       |                       |
           |                       |                       v
           |                       |              +------------------+
           |                       |              |   User Model     |
           |                       |              | (Mongoose Schema)|
           |                       |              +------------------+
           |                       |
           v                       v
  +------------------+     +------------------+
  | JWT Middleware   |     |  Email Service   |
  | (Token Validation)|    | (SMTP/SendGrid)  |
  +------------------+     +------------------+
           |                       |
           v                       v
  +------------------+     +------------------+
  |     Redis        |     |  Google OAuth     |
  | (Session Store)  |     |     Service      |
  +------------------+     +------------------+
```

---

## 2. Componentes Backend

### 2.1 Models (Mongoose Schemas)

#### user-model.js

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const userSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    default: uuidv4,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
  },
  password: {
    type: String,
    default: null, // null para login apenas Google
  },
  googleId: {
    type: String,
    default: null,
    sparse: true,
    unique: true,
  },
  avatar: {
    type: String,
    default: null,
  },
  provider: {
    type: String,
    enum: ['local', 'google', 'both'],
    default: 'local',
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active',
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockedUntil: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  versionKey: false,
  timestamps: true,
})

// Indices
userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ googleId: 1 }, { sparse: true, unique: true })
userSchema.index({ status: 1 })

module.exports = { userSchema }
```

### 2.2 DAOs

#### auth-dao.js

```javascript
const AppDAO = require('../app-dao')
const { userSchema } = require('./user-model')

class AuthDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    return db.model('user', userSchema)
  }

  async findByEmail(email) {
    return await this.objectModel
      .findOne({ email: email.toLowerCase() })
      .lean()
      .exec()
  }

  async findByGoogleId(googleId) {
    return await this.objectModel
      .findOne({ googleId })
      .lean()
      .exec()
  }

  async findById(userId) {
    return await this.objectModel
      .findById(userId)
      .lean()
      .exec()
  }

  async create(userData) {
    const user = new this.objectModel(userData)
    return await user.save()
  }

  async updateById(userId, updateData) {
    return await this.objectModel
      .findByIdAndUpdate(
        userId,
        { $set: { ...updateData, updatedAt: new Date() } },
        { new: true }
      )
      .lean()
      .exec()
  }

  async updatePassword(userId, passwordHash) {
    return await this.objectModel
      .findByIdAndUpdate(
        userId,
        { $set: { password: passwordHash, updatedAt: new Date() } },
        { new: true }
      )
      .lean()
      .exec()
  }

  async incrementLoginAttempts(userId) {
    return await this.objectModel
      .findByIdAndUpdate(
        userId,
        { $inc: { loginAttempts: 1 } },
        { new: true }
      )
      .lean()
      .exec()
  }

  async resetLoginAttempts(userId) {
    return await this.objectModel
      .findByIdAndUpdate(
        userId,
        { $set: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } },
        { new: true }
      )
      .lean()
      .exec()
  }

  async lockAccount(userId, lockUntil) {
    return await this.objectModel
      .findByIdAndUpdate(
        userId,
        { $set: { lockedUntil: lockUntil } },
        { new: true }
      )
      .lean()
      .exec()
  }
}

module.exports = AuthDAO
```

### 2.3 Managers

#### auth-manager.js

```javascript
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const AuthDAO = require('./auth-dao')
const APP_CONSTANTS = require('../app-constants')

class AuthManager {
  constructor(appManager, config) {
    this.appManager = appManager
    this.config = config.auth
    this.googleConfig = config.google
    this.authDAO = new AuthDAO(appManager.getDb())
    this.redisClient = appManager.getRedisClient()
  }

  // ==================== REGISTRO ====================

  async register({ name, email, password, confirmPassword }) {
    // Validacoes
    this._validateRegistrationData({ name, email, password, confirmPassword })

    // Verificar se email ja existe
    const existingUser = await this.authDAO.findByEmail(email)
    if (existingUser) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.EMAIL_ALREADY_EXISTS)
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, this.config.bcryptSaltRounds)

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
    await this._createSession(user._id, token)

    return {
      user: this._sanitizeUser(user),
      token,
    }
  }

  // ==================== LOGIN ====================

  async login({ email, password }) {
    // Verificar bloqueio por tentativas
    await this._checkLoginAttempts(email)

    // Buscar usuario
    const user = await this.authDAO.findByEmail(email)
    if (!user || !user.password) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.INVALID_CREDENTIALS)
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      await this._handleFailedLogin(user)
      this.appManager.handleError(APP_CONSTANTS.ERRORS.INVALID_CREDENTIALS)
    }

    // Login com sucesso
    await this.authDAO.resetLoginAttempts(user._id)

    // Gerar JWT e criar sessao
    const token = this._generateJWT(user)
    await this._createSession(user._id, token)

    return {
      user: this._sanitizeUser(user),
      token,
    }
  }

  // ==================== GOOGLE OAUTH ====================

  async googleAuth({ code }) {
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
    await this._createSession(user._id, token)

    return {
      user: this._sanitizeUser(user),
      token,
    }
  }

  // ==================== RECUPERACAO DE SENHA ====================

  async forgotPassword({ email }) {
    const user = await this.authDAO.findByEmail(email)
    
    // Sempre retornar mensagem generica (seguranca)
    if (!user) {
      return { message: 'Se o email estiver cadastrado, voce recebera um link de recuperacao.' }
    }

    // Gerar token de reset
    const resetToken = uuidv4()
    const redisKey = `reset:${resetToken}`

    // Armazenar no Redis com TTL de 1 hora
    await this.redisClient.set(redisKey, user._id, { EX: this.config.resetTokenTTLSeconds })

    // Enviar email (implementar EmailService)
    // await this.emailService.sendResetEmail(user.email, resetToken)

    return { message: 'Se o email estiver cadastrado, voce recebera um link de recuperacao.' }
  }

  async resetPassword({ token, password, confirmPassword }) {
    // Validar token no Redis
    const redisKey = `reset:${token}`
    const userId = await this.redisClient.get(redisKey)

    if (!userId) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.INVALID_RESET_TOKEN)
    }

    // Validar nova senha
    this._validatePassword(password, confirmPassword)

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(password, this.config.bcryptSaltRounds)

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
    const sessionKey = `session:${userId}:${sessionId}`
    await this.redisClient.del(sessionKey)
    return { message: 'Logout realizado com sucesso' }
  }

  async getProfile({ userId }) {
    const user = await this.authDAO.findById(userId)
    if (!user) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.USER_NOT_FOUND)
    }
    return { user: this._sanitizeUser(user) }
  }

  async updateProfile({ userId, name, avatar }) {
    const updateData = {}
    if (name) updateData.name = name
    if (avatar) updateData.avatar = avatar

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
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: this.config.jwtExpiresIn,
    })
  }

  async _createSession(userId, token) {
    const sessionId = uuidv4()
    const sessionKey = `session:${userId}:${sessionId}`
    const decoded = jwt.decode(token)
    
    await this.redisClient.set(sessionKey, JSON.stringify({
      token,
      createdAt: Date.now(),
      expiresAt: decoded.exp * 1000,
    }), { EX: this.config.sessionTTLSeconds })

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
      this.appManager.handleError(APP_CONSTANTS.ERRORS.NAME_REQUIRED)
    }

    if (!email || !this._isValidEmail(email)) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.INVALID_EMAIL)
    }

    this._validatePassword(password, confirmPassword)
  }

  _validatePassword(password, confirmPassword) {
    if (!password || password.length < 8) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.PASSWORD_TOO_SHORT)
    }

    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.INVALID_PASSWORD_FORMAT)
    }

    if (password !== confirmPassword) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.PASSWORDS_DONT_MATCH)
    }
  }

  _isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  async _checkLoginAttempts(email) {
    const user = await this.authDAO.findByEmail(email)
    
    if (user && user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.ACCOUNT_LOCKED)
    }
  }

  async _handleFailedLogin(user) {
    const attempts = await this.authDAO.incrementLoginAttempts(user._id)
    
    if (attempts.loginAttempts >= this.config.maxLoginAttempts) {
      const lockUntil = new Date(Date.now() + this.config.lockDurationMinutes * 60 * 1000)
      await this.authDAO.lockAccount(user._id, lockUntil)
    }
  }

  async _exchangeGoogleCode(code) {
    const response = await fetch(this.googleConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    if (!response.ok) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.GOOGLE_AUTH_FAILED)
    }

    return response.json()
  }

  async _getGoogleProfile(accessToken) {
    const response = await fetch(this.googleConfig.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      this.appManager.handleError(APP_CONSTANTS.ERRORS.GOOGLE_AUTH_FAILED)
    }

    return response.json()
  }

  _sanitizeUser(user) {
    const { password, loginAttempts, lockedUntil, ...sanitized } = user
    return sanitized
  }
}

module.exports = AuthManager
```

### 2.4 Routers

#### auth-router.js

```javascript
const express = require('express')
const APP_CONSTANTS = require('../app-constants')
const jwtMiddleware = require('./jwt-middleware')

class AuthRouter {
  static handleError(exception, res) {
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getPublicRoutes(appManager, config) {
    const router = express.Router()
    const authManager = appManager.getAuthManager()

    // POST /api/auth/register
    router.post('/auth/register', async (req, res) => {
      try {
        const result = await authManager.register(req.body)
        res.status(201).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    // POST /api/auth/login
    router.post('/auth/login', async (req, res) => {
      try {
        const result = await authManager.login(req.body)
        res.status(200).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    // POST /api/auth/google
    router.post('/auth/google', async (req, res) => {
      try {
        const result = await authManager.googleAuth(req.body)
        res.status(200).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    // POST /api/auth/forgot-password
    router.post('/auth/forgot-password', async (req, res) => {
      try {
        const result = await authManager.forgotPassword(req.body)
        res.status(200).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    // POST /api/auth/reset-password
    router.post('/auth/reset-password', async (req, res) => {
      try {
        const result = await authManager.resetPassword(req.body)
        res.status(200).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    return router
  }

  static getProtectedRoutes(appManager, config) {
    const router = express.Router()
    const authManager = appManager.getAuthManager()

    // Aplicar middleware JWT
    router.use(jwtMiddleware(appManager, config))

    // POST /api/auth/logout
    router.post('/auth/logout', async (req, res) => {
      try {
        const result = await authManager.logout({
          userId: req.user.userId,
          sessionId: req.user.sessionId,
        })
        res.status(200).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    // GET /api/auth/me
    router.get('/auth/me', async (req, res) => {
      try {
        const result = await authManager.getProfile({ userId: req.user.userId })
        res.status(200).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    // PUT /api/auth/me
    router.put('/auth/me', async (req, res) => {
      try {
        const result = await authManager.updateProfile({
          userId: req.user.userId,
          ...req.body,
        })
        res.status(200).send(result)
      } catch (exception) {
        AuthRouter.handleError(exception, res)
      }
    })

    return router
  }
}

module.exports = AuthRouter
```

#### jwt-middleware.js

```javascript
const jwt = require('jsonwebtoken')
const APP_CONSTANTS = require('../app-constants')

function jwtMiddleware(appManager, config) {
  const redisClient = appManager.getRedisClient()

  return async (req, res, next) => {
    try {
      // Extrair token do header Authorization
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send({ message: 'Token nao fornecido' })
      }

      const token = authHeader.split(' ')[1]

      // Verificar JWT
      let decoded
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET)
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).send({ message: 'Token expirado' })
        }
        return res.status(401).send({ message: 'Token invalido' })
      }

      // Verificar sessao no Redis
      const sessionPattern = `session:${decoded.userId}:*`
      const keys = await redisClient.keys(sessionPattern)
      
      let sessionFound = false
      for (const key of keys) {
        const sessionData = await redisClient.get(key)
        if (sessionData) {
          const session = JSON.parse(sessionData)
          if (session.token === token) {
            sessionFound = true
            break
          }
        }
      }

      if (!sessionFound) {
        return res.status(401).send({ message: 'Sessao invalida' })
      }

      // Anexar dados do usuario ao request
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name,
      }

      // Refresh token se proximo da expiracao (< 1 hora)
      const expiresAt = decoded.exp * 1000
      const oneHour = 60 * 60 * 1000
      if (expiresAt - Date.now() < oneHour) {
        const newToken = jwt.sign(
          { userId: decoded.userId, email: decoded.email, name: decoded.name },
          process.env.JWT_SECRET,
          { expiresIn: config.auth.jwtExpiresIn }
        )
        res.setHeader('X-New-Token', newToken)
      }

      next()
    } catch (error) {
      return res.status(500).send({ message: 'Erro na autenticacao' })
    }
  }
}

module.exports = jwtMiddleware
```

---

## 3. Componentes Frontend

### 3.1 Pages

| Pagina | Arquivo | Rota | Descricao |
|--------|---------|------|-----------|
| LoginPage | `src/pages/auth/LoginPage.vue` | `/login` | Formulario de login |
| RegisterPage | `src/pages/auth/RegisterPage.vue` | `/register` | Formulario de cadastro |
| ForgotPasswordPage | `src/pages/auth/ForgotPasswordPage.vue` | `/forgot-password` | Solicitar reset |
| ResetPasswordPage | `src/pages/auth/ResetPasswordPage.vue` | `/reset-password` | Redefinir senha |

### 3.2 Components

#### LoginForm.vue

```vue
<template>
  <form @submit.prevent="handleSubmit" class="login-form">
    <div class="form-group">
      <label for="email">Email</label>
      <input
        id="email"
        v-model="form.email"
        type="email"
        placeholder="seu@email.com"
        :disabled="isLoading"
        required
      />
      <span v-if="errors.email" class="error">{{ errors.email }}</span>
    </div>

    <div class="form-group">
      <label for="password">Senha</label>
      <input
        id="password"
        v-model="form.password"
        type="password"
        placeholder="Sua senha"
        :disabled="isLoading"
        required
      />
      <span v-if="errors.password" class="error">{{ errors.password }}</span>
    </div>

    <Button type="submit" :loading="isLoading" variant="primary">
      Entrar
    </Button>

    <div class="links">
      <router-link to="/forgot-password">Esqueci minha senha</router-link>
      <router-link to="/register">Criar conta</router-link>
    </div>
  </form>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth-store'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  email: '',
  password: '',
})

const errors = reactive({
  email: '',
  password: '',
})

const isLoading = ref(false)

const handleSubmit = async () => {
  isLoading.value = true
  errors.email = ''
  errors.password = ''

  try {
    await authStore.login(form)
    router.push('/dashboard')
  } catch (error) {
    if (error.message.includes('credenciais')) {
      errors.email = 'Email ou senha incorretos'
    } else {
      errors.email = error.message
    }
  } finally {
    isLoading.value = false
  }
}
</script>
```

#### GoogleLoginButton.vue

```vue
<template>
  <button
    type="button"
    class="google-login-btn"
    :disabled="isLoading"
    @click="handleGoogleLogin"
  >
    <img src="@/assets/icons/google.svg" alt="Google" />
    <span>{{ isLoading ? 'Entrando...' : 'Entrar com Google' }}</span>
  </button>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth-store'

const authStore = useAuthStore()
const isLoading = ref(false)

const handleGoogleLogin = async () => {
  isLoading.value = true

  // Abrir popup do Google OAuth
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI
  const scope = 'openid email profile'

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scope)}`

  const width = 500
  const height = 600
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2

  const popup = window.open(
    authUrl,
    'GoogleLogin',
    `width=${width},height=${height},left=${left},top=${top}`
  )

  // Escutar mensagem do popup
  window.addEventListener('message', async (event) => {
    if (event.data.type === 'GOOGLE_AUTH_CODE') {
      try {
        await authStore.googleLogin({ code: event.data.code })
      } catch (error) {
        console.error('Google login failed:', error)
      } finally {
        isLoading.value = false
      }
    }
  })
}
</script>
```

#### ProtectedRoute.vue

```vue
<template>
  <div v-if="isLoading" class="loading-container">
    <LoadingSpinner />
  </div>
  <slot v-else-if="isAuthenticated" />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth-store'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(true)
const isAuthenticated = ref(false)

onMounted(async () => {
  if (!authStore.token) {
    router.push('/login')
    return
  }

  try {
    await authStore.getProfile()
    isAuthenticated.value = true
  } catch (error) {
    authStore.logout()
    router.push('/login')
  } finally {
    isLoading.value = false
  }
})
</script>
```

### 3.3 Services

#### auth-service.js

```javascript
import api from './api'

class AuthService {
  async register(data) {
    return await api.post('/auth/register', data)
  }

  async login(data) {
    return await api.post('/auth/login', data)
  }

  async googleAuth(data) {
    return await api.post('/auth/google', data)
  }

  async forgotPassword(data) {
    return await api.post('/auth/forgot-password', data)
  }

  async resetPassword(data) {
    return await api.post('/auth/reset-password', data)
  }

  async logout() {
    return await api.post('/auth/logout')
  }

  async getProfile() {
    return await api.get('/auth/me')
  }

  async updateProfile(data) {
    return await api.put('/auth/me', data)
  }
}

export default new AuthService()
```

### 3.4 Store/State

#### auth-store.js (Pinia)

```javascript
import { defineStore } from 'pinia'
import authService from '@/services/auth-service'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token') || null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token && !!state.user,
  },

  actions: {
    setToken(token) {
      this.token = token
      localStorage.setItem('token', token)
    },

    clearToken() {
      this.token = null
      this.user = null
      localStorage.removeItem('token')
    },

    async login(credentials) {
      const response = await authService.login(credentials)
      this.setToken(response.token)
      this.user = response.user
      return response
    },

    async register(data) {
      const response = await authService.register(data)
      this.setToken(response.token)
      this.user = response.user
      return response
    },

    async googleLogin(data) {
      const response = await authService.googleAuth(data)
      this.setToken(response.token)
      this.user = response.user
      return response
    },

    async logout() {
      try {
        await authService.logout()
      } finally {
        this.clearToken()
      }
    },

    async getProfile() {
      const response = await authService.getProfile()
      this.user = response.user
      return response
    },

    async updateProfile(data) {
      const response = await authService.updateProfile(data)
      this.user = response.user
      return response
    },
  },
})
```

---

## 4. API Contracts

### OpenAPI Specification

```yaml
openapi: 3.0.0
info:
  title: MoneyTrackr Auth API
  version: 1.0.0

paths:
  /auth/register:
    post:
      summary: Registrar novo usuario
      tags: [Auth]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, email, password, confirmPassword]
              properties:
                name:
                  type: string
                  minLength: 2
                  maxLength: 100
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
                confirmPassword:
                  type: string
      responses:
        '201':
          description: Usuario criado com sucesso
          content:
            application/json:
              schema:
                type: object
                properties:
                  user:
                    $ref: '#/components/schemas/User'
                  token:
                    type: string
        '400':
          description: Dados invalidos
        '409':
          description: Email ja cadastrado

  /auth/login:
    post:
      summary: Login com email/senha
      tags: [Auth]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
      responses:
        '200':
          description: Login bem-sucedido
          content:
            application/json:
              schema:
                type: object
                properties:
                  user:
                    $ref: '#/components/schemas/User'
                  token:
                    type: string
        '401':
          description: Credenciais invalidas
        '429':
          description: Conta bloqueada por tentativas excessivas

  /auth/google:
    post:
      summary: Login/registro com Google OAuth
      tags: [Auth]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [code]
              properties:
                code:
                  type: string
                  description: Authorization code do Google
      responses:
        '200':
          description: Autenticacao bem-sucedida
          content:
            application/json:
              schema:
                type: object
                properties:
                  user:
                    $ref: '#/components/schemas/User'
                  token:
                    type: string
        '401':
          description: Falha na autenticacao Google

  /auth/forgot-password:
    post:
      summary: Solicitar reset de senha
      tags: [Auth]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email]
              properties:
                email:
                  type: string
                  format: email
      responses:
        '200':
          description: Email enviado (se cadastrado)

  /auth/reset-password:
    post:
      summary: Redefinir senha
      tags: [Auth]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [token, password, confirmPassword]
              properties:
                token:
                  type: string
                password:
                  type: string
                  minLength: 8
                confirmPassword:
                  type: string
      responses:
        '200':
          description: Senha redefinida com sucesso
        '400':
          description: Token invalido ou expirado

  /auth/logout:
    post:
      summary: Encerrar sessao
      tags: [Auth]
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Logout realizado

  /auth/me:
    get:
      summary: Obter perfil do usuario
      tags: [Auth]
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Perfil do usuario
          content:
            application/json:
              schema:
                type: object
                properties:
                  user:
                    $ref: '#/components/schemas/User'
        '401':
          description: Token invalido

    put:
      summary: Atualizar perfil
      tags: [Auth]
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                avatar:
                  type: string
      responses:
        '200':
          description: Perfil atualizado

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        _id:
          type: string
        email:
          type: string
        name:
          type: string
        avatar:
          type: string
        provider:
          type: string
          enum: [local, google, both]
        status:
          type: string
          enum: [active, inactive, blocked]
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
```

---

## 5. Fluxos de Dados

### Sequencia: Login com Email/Senha

```
+--------+    +------------+    +------------+    +-------+    +-------+
|Usuario |    | Frontend   |    | AuthManager|    |MongoDB|    | Redis |
+--------+    +------------+    +------------+    +-------+    +-------+
    |              |                 |               |            |
    | email/senha  |                 |               |            |
    |------------->|                 |               |            |
    |              | POST /auth/login|               |            |
    |              |---------------->|               |            |
    |              |                 | findByEmail() |            |
    |              |                 |-------------->|            |
    |              |                 |<--------------|            |
    |              |                 |   user        |            |
    |              |                 |               |            |
    |              |                 | bcrypt.compare|            |
    |              |                 |---------------|            |
    |              |                 |               |            |
    |              |                 | SET session:{userId}:{sid}  |
    |              |                 |---------------------------->|
    |              |                 |                            |
    |              | { user, token } |               |            |
    |              |<----------------|               |            |
    |              |                 |               |            |
    | { user, token }               |               |            |
    |<-------------|                 |               |            |
```

### Sequencia: Google OAuth

```
+--------+    +------------+    +----------+    +-------+
|Usuario |    | Frontend   |    | Google   |    |Backend|
+--------+    +------------+    +----------+    +-------+
    |              |                 |             |
    | click Google |                 |             |
    |------------->|                 |             |
    |              | open popup      |             |
    |              |----------------->|             |
    |              |                 |             |
    | authorize    |                 |             |
    |------------------------------>|             |
    |              | redirect code   |             |
    |              |<----------------|             |
    |              |                 |             |
    |              | POST /auth/google { code }    |
    |              |------------------------------->|
    |              |                 |             |
    |              |                 | exchange    |
    |              |                 | code for    |
    |              |                 | token       |
    |              |                 |------------>|
    |              |                 |<------------|
    |              |                 | access_token|
    |              |                 |             |
    |              |                 | get profile |
    |              |                 |------------>|
    |              |                 |<------------|
    |              |                 | profile     |
    |              |                 |             |
    |              | { user, token } |             |
    |              |<-------------------------------|
    |              |                 |             |
    | { user, token }               |             |
    |<-------------|                 |             |
```

---

## 6. Estrutura de Arquivos

```
investment-service/
|-- src/
|   |-- main.js
|   |-- app/
|   |   |-- app-constants.js
|   |   |-- app-manager.js
|   |   |-- app-service.js
|   |   |-- auth/
|   |   |   |-- auth-router.js
|   |   |   |-- auth-manager.js
|   |   |   |-- auth-dao.js
|   |   |   |-- user-model.js
|   |   |   |-- jwt-middleware.js
|   |   |-- services/
|   |       |-- email-service.js
|   |-- __tests__/
|       |-- auth.test.js
|       |-- jwt-middleware.test.js
|   |-- __mocks__/
|       |-- google-oauth-mock.js
|       |-- email-service-mock.js

investment-app/
|-- src/
|   |-- pages/
|   |   |-- auth/
|   |       |-- LoginPage.vue
|   |       |-- RegisterPage.vue
|   |       |-- ForgotPasswordPage.vue
|   |       |-- ResetPasswordPage.vue
|   |-- components/
|   |   |-- auth/
|   |   |   |-- LoginForm.vue
|   |   |   |-- RegisterForm.vue
|   |   |   |-- GoogleLoginButton.vue
|   |   |   |-- ForgotPasswordForm.vue
|   |   |   |-- ResetPasswordForm.vue
|   |   |   |-- PasswordStrengthMeter.vue
|   |   |   |-- AuthLayout.vue
|   |   |-- common/
|   |       |-- ProtectedRoute.vue
|   |-- services/
|   |   |-- auth-service.js
|   |-- stores/
|   |   |-- auth-store.js
|   |-- router/
|       |-- index.js
```

---

## 7. Ordem de Implementacao

### Fase 1: Backend - Fundacao (Prioridade: Alta)

1. Criar `user-model.js` com schema completo
2. Criar `auth-dao.js` com todos os metodos
3. Adicionar constantes de erro em `app-constants.js`
4. Implementar `jwt-middleware.js`
5. Implementar `auth-manager.js` - registro e login
6. Implementar `auth-router.js` - rotas publicas

### Fase 2: Backend - OAuth e Recuperacao (Prioridade: Alta)

1. Implementar Google OAuth no `auth-manager.js`
2. Implementar `forgotPassword` e `resetPassword`
3. Implementar rotas protegidas no `auth-router.js`
4. Criar `email-service.js` (stub inicial)

### Fase 3: Frontend - Autenticacao Basica (Prioridade: Alta)

1. Criar `auth-store.js` (Pinia)
2. Criar `auth-service.js`
3. Implementar `LoginPage.vue`
4. Implementar `RegisterPage.vue`
5. Implementar `ProtectedRoute.vue`
6. Configurar rotas no Vue Router

### Fase 4: Frontend - OAuth e Recuperacao (Prioridade: Media)

1. Implementar `GoogleLoginButton.vue`
2. Implementar `ForgotPasswordPage.vue`
3. Implementar `ResetPasswordPage.vue`
4. Implementar `PasswordStrengthMeter.vue`

### Fase 5: Testes e Validacao (Prioridade: Alta)

1. Testes unitarios do `auth-manager.js`
2. Testes de integracao das rotas
3. Testes do `jwt-middleware.js`
4. Testes E2E dos fluxos de auth

---

## 8. Riscos Tecnicos

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|:-------------:|:------:|-----------|
| JWT secret exposto | Baixa | Alto | Usar variavel de ambiente; rotacao periodica |
| Ataque de forca bruta | Media | Alto | Rate limiting; bloqueio apos 5 tentativas |
| OAuth CSRF | Baixa | Alto | Usar state parameter; validar redirect_uri |
| Redis indisponivel | Media | Alto | Fallback para validacao JWT offline |
| Email nao entregue | Media | Medio | Usar provedor confiavel (SendGrid); retry |
| Token nao refresh | Baixa | Medio | Interceptor Axios para X-New-Token |
| Sessao nao invalidada | Baixa | Medio | TTL no Redis; invalidacao em cascata |

---

## 9. Dependencias

### Backend

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "uuid": "^9.0.1"
  }
}
```

### Frontend

```json
{
  "dependencies": {
    "jwt-decode": "^4.0.0"
  }
}
```

### Variaveis de Ambiente

```bash
# Backend
JWT_SECRET=your-super-secret-key-min-256-bits
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://moneytrackr.com/api/auth/google/callback
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@moneytrackr.com
FRONTEND_URL=https://moneytrackr.com

# Frontend
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_REDIRECT_URI=https://moneytrackr.com/auth/callback
```

---

## 10. Checklist de Implementacao

### Backend
- [ ] User Model implementado com indices
- [ ] Auth DAO com todos os metodos
- [ ] JWT Middleware funcional
- [ ] Auth Manager - registro implementado
- [ ] Auth Manager - login implementado
- [ ] Auth Manager - Google OAuth implementado
- [ ] Auth Manager - forgot/reset password implementado
- [ ] Auth Router - rotas publicas
- [ ] Auth Router - rotas protegidas
- [ ] Email Service (stub)
- [ ] Constantes de erro adicionadas
- [ ] Testes unitarios >= 90% cobertura
- [ ] Testes de integracao passando

### Frontend
- [ ] Auth Store (Pinia) implementada
- [ ] Auth Service implementado
- [ ] LoginPage funcional
- [ ] RegisterPage funcional
- [ ] GoogleLoginButton funcional
- [ ] ForgotPasswordPage funcional
- [ ] ResetPasswordPage funcional
- [ ] ProtectedRoute guard
- [ ] PasswordStrengthMeter
- [ ] Interceptor Axios para token refresh
- [ ] Rotas configuradas

### Seguranca
- [ ] Senhas hasheadas com bcrypt
- [ ] JWT secret em variavel de ambiente
- [ ] Rate limiting configurado
- [ ] HTTPS em producao
- [ ] CORS restrito
- [ ] Headers de seguranca (helmet)

---

*Documento criado pelo Architect - MoneyTrackr V3*
