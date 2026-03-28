import { jwtDecode } from 'jwt-decode'
import api from './api'

const TOKEN_KEY = 'token'

class AuthService {
  // API calls
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

  // Token management
  getToken() {
    return localStorage.getItem(TOKEN_KEY)
  }

  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token)
  }

  removeToken() {
    localStorage.removeItem(TOKEN_KEY)
  }

  isAuthenticated() {
    const token = this.getToken()
    if (!token) {
      return false
    }

    try {
      const decoded = this.decodeToken(token)
      const currentTime = Date.now() / 1000
      return decoded.exp > currentTime
    } catch {
      return false
    }
  }

  decodeToken(token) {
    if (!token) {
      token = this.getToken()
    }
    if (!token) {
      return null
    }

    try {
      return jwtDecode(token)
    } catch {
      return null
    }
  }

  getTokenExpiration() {
    const decoded = this.decodeToken()
    if (!decoded || !decoded.exp) {
      return null
    }

    return new Date(decoded.exp * 1000)
  }

  isTokenExpiringSoon(minutesThreshold = 60) {
    const expiration = this.getTokenExpiration()
    if (!expiration) {
      return true
    }

    const now = new Date()
    const diffMs = expiration.getTime() - now.getTime()
    const diffMinutes = diffMs / (1000 * 60)

    return diffMinutes < minutesThreshold
  }

  getUserId() {
    const decoded = this.decodeToken()
    return decoded?.userId || null
  }

  getUserEmail() {
    const decoded = this.decodeToken()
    return decoded?.email || null
  }

  getUserName() {
    const decoded = this.decodeToken()
    return decoded?.name || null
  }
}

export default new AuthService()
