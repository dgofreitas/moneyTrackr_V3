import { defineStore } from 'pinia'
import authService from '../services/auth-service'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token') || null,
    isLoading: false,
    error: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token && !!state.user,
    getUser: (state) => state.user,
    getToken: (state) => state.token,
    getIsLoading: (state) => state.isLoading,
    getError: (state) => state.error,
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

    setLoading(status) {
      this.isLoading = status
    },

    setError(error) {
      this.error = error
    },

    clearError() {
      this.error = null
    },

    async login(credentials) {
      this.setLoading(true)
      this.clearError()

      try {
        const response = await authService.login(credentials)
        this.setToken(response.token)
        this.user = response.user
        return response
      } catch (error) {
        this.setError(error.message || 'Erro ao fazer login')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async register(data) {
      this.setLoading(true)
      this.clearError()

      try {
        const response = await authService.register(data)
        this.setToken(response.token)
        this.user = response.user
        return response
      } catch (error) {
        this.setError(error.message || 'Erro ao criar conta')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async googleLogin(data) {
      this.setLoading(true)
      this.clearError()

      try {
        const response = await authService.googleAuth(data)
        this.setToken(response.token)
        this.user = response.user
        return response
      } catch (error) {
        this.setError(error.message || 'Erro ao autenticar com Google')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async logout() {
      this.setLoading(true)

      try {
        await authService.logout()
      } catch (error) {
        // Ignore logout errors
      } finally {
        this.clearToken()
        this.setLoading(false)
      }
    },

    async getProfile() {
      this.setLoading(true)
      this.clearError()

      try {
        const response = await authService.getProfile()
        this.user = response.user
        return response
      } catch (error) {
        this.setError(error.message || 'Erro ao obter perfil')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async updateProfile(data) {
      this.setLoading(true)
      this.clearError()

      try {
        const response = await authService.updateProfile(data)
        this.user = response.user
        return response
      } catch (error) {
        this.setError(error.message || 'Erro ao atualizar perfil')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async forgotPassword(data) {
      this.setLoading(true)
      this.clearError()

      try {
        const response = await authService.forgotPassword(data)
        return response
      } catch (error) {
        this.setError(error.message || 'Erro ao solicitar recuperacao de senha')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async resetPassword(data) {
      this.setLoading(true)
      this.clearError()

      try {
        const response = await authService.resetPassword(data)
        return response
      } catch (error) {
        this.setError(error.message || 'Erro ao redefinir senha')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    initializeAuth() {
      const token = localStorage.getItem('token')
      if (token) {
        this.token = token
      }
    },
  },
})
