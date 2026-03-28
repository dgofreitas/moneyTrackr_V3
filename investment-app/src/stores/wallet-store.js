import { defineStore } from 'pinia'
import api from '../services/api'

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    wallets: [],
    activeWallet: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    activeWalletId: (state) => state.activeWallet?._id || null,
    hasWallets: (state) => state.wallets.length > 0,
    getWalletById: (state) => (id) => state.wallets.find((w) => w._id === id),
  },

  actions: {
    setLoading(status) {
      this.isLoading = status
    },

    setError(error) {
      this.error = error
    },

    clearError() {
      this.error = null
    },

    async fetchWallets() {
      this.setLoading(true)
      this.clearError()

      try {
        const response = await api.get('/v1/wallets')
        this.wallets = response.data || response || []
        
        // Set first wallet as active if none selected
        if (!this.activeWallet && this.wallets.length > 0) {
          this.activeWallet = this.wallets[0]
        }
        
        return this.wallets
      } catch (error) {
        this.setError(error.message || 'Erro ao carregar carteiras')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    setActiveWallet(wallet) {
      this.activeWallet = wallet
    },

    setActiveWalletById(walletId) {
      const wallet = this.wallets.find((w) => w._id === walletId)
      if (wallet) {
        this.activeWallet = wallet
      }
    },

    async createWallet(data) {
      this.setLoading(true)
      this.clearError()

      try {
        const response = await api.post('/v1/wallets', data)
        const newWallet = response.wallet || response
        this.wallets.push(newWallet)
        
        // Set as active if first wallet
        if (this.wallets.length === 1) {
          this.activeWallet = newWallet
        }
        
        return newWallet
      } catch (error) {
        this.setError(error.message || 'Erro ao criar carteira')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async updateWallet(walletId, data) {
      this.setLoading(true)
      this.clearError()

      try {
        const response = await api.put(`/v1/wallets/${walletId}`, data)
        const updatedWallet = response.wallet || response
        
        const index = this.wallets.findIndex((w) => w._id === walletId)
        if (index !== -1) {
          this.wallets[index] = updatedWallet
        }
        
        if (this.activeWallet?._id === walletId) {
          this.activeWallet = updatedWallet
        }
        
        return updatedWallet
      } catch (error) {
        this.setError(error.message || 'Erro ao atualizar carteira')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async deleteWallet(walletId) {
      this.setLoading(true)
      this.clearError()

      try {
        await api.delete(`/v1/wallets/${walletId}`)
        
        this.wallets = this.wallets.filter((w) => w._id !== walletId)
        
        if (this.activeWallet?._id === walletId) {
          this.activeWallet = this.wallets[0] || null
        }
        
        return true
      } catch (error) {
        this.setError(error.message || 'Erro ao excluir carteira')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    initializeWallet() {
      // Load wallets from API if not already loaded
      if (this.wallets.length === 0) {
        this.fetchWallets()
      }
    },
  },
})
