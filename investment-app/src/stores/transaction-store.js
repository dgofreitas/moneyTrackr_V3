import { defineStore } from 'pinia'
import transactionService from '../services/transaction-service'

export const useTransactionStore = defineStore('transaction', {
  state: () => ({
    transactions: [],
    positions: [],
    pagination: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    activePositions: (state) => {
      return state.positions.filter((p) => p.status === 'ACTIVE' && p.quantity > 0)
    },
    closedPositions: (state) => {
      return state.positions.filter((p) => p.status === 'CLOSED' || p.quantity === 0)
    },
    getTransactionById: (state) => (id) => {
      return state.transactions.find((t) => t._id === id)
    },
    getPositionByTicker: (state) => (ticker) => {
      return state.positions.find((p) => p.ticker === ticker?.toUpperCase())
    },
    totalTransactions: (state) => {
      return state.pagination?.total || state.transactions.length
    },
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

    async fetchTransactions(params) {
      this.setLoading(true)
      this.clearError()

      try {
        const result = await transactionService.getTransactions(params)
        this.transactions = result.data || []
        this.pagination = result.pagination || null
        return result
      } catch (error) {
        this.setError(error.message || 'Erro ao carregar transacoes')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async getTransaction(transactionId) {
      this.setLoading(true)
      this.clearError()

      try {
        const transaction = await transactionService.getTransaction(transactionId)
        return transaction
      } catch (error) {
        this.setError(error.message || 'Erro ao carregar transacao')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async createTransaction(data) {
      this.setLoading(true)
      this.clearError()

      try {
        const result = await transactionService.createTransaction(data)
        const newTransaction = result.transaction || result
        
        // Add to beginning of list
        this.transactions.unshift(newTransaction)
        
        // Update positions if returned
        if (result.position) {
          const existingIndex = this.positions.findIndex(
            (p) => p.ticker === result.position.ticker
          )
          if (existingIndex !== -1) {
            this.positions[existingIndex] = result.position
          } else {
            this.positions.push(result.position)
          }
        }
        
        return result
      } catch (error) {
        this.setError(error.message || 'Erro ao criar transacao')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async updateTransaction(transactionId, data) {
      this.setLoading(true)
      this.clearError()

      try {
        const result = await transactionService.updateTransaction(transactionId, data)
        const updatedTransaction = result.transaction || result
        
        // Update in list
        const index = this.transactions.findIndex((t) => t._id === transactionId)
        if (index !== -1) {
          this.transactions[index] = updatedTransaction
        }
        
        // Update positions if returned
        if (result.position) {
          const existingIndex = this.positions.findIndex(
            (p) => p.ticker === result.position.ticker
          )
          if (existingIndex !== -1) {
            this.positions[existingIndex] = result.position
          } else {
            this.positions.push(result.position)
          }
        }
        
        return result
      } catch (error) {
        this.setError(error.message || 'Erro ao atualizar transacao')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async deleteTransaction(transactionId) {
      this.setLoading(true)
      this.clearError()

      try {
        const result = await transactionService.deleteTransaction(transactionId)
        
        // Remove from list
        this.transactions = this.transactions.filter((t) => t._id !== transactionId)
        
        // Update positions if returned
        if (result.position) {
          const existingIndex = this.positions.findIndex(
            (p) => p.ticker === result.position.ticker
          )
          if (existingIndex !== -1) {
            this.positions[existingIndex] = result.position
          }
        }
        
        return result
      } catch (error) {
        this.setError(error.message || 'Erro ao excluir transacao')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async fetchPositions(walletId) {
      this.setLoading(true)
      this.clearError()

      try {
        const positions = await transactionService.getPositions({ walletId })
        this.positions = positions || []
        return this.positions
      } catch (error) {
        this.setError(error.message || 'Erro ao carregar posicoes')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async getPosition(ticker, walletId) {
      try {
        const position = await transactionService.getPosition(ticker, walletId)
        return position || { quantity: 0, averagePrice: 0, totalInvested: 0 }
      } catch (error) {
        // Return empty position if not found
        return { quantity: 0, averagePrice: 0, totalInvested: 0 }
      }
    },

    clearTransactions() {
      this.transactions = []
      this.pagination = null
    },

    clearPositions() {
      this.positions = []
    },
  },
})
