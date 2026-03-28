import api from './api'

class TransactionService {
  async getTransactions(params) {
    return await api.get('/v1/transactions', params)
  }

  async getTransaction(transactionId) {
    return await api.get(`/v1/transactions/${transactionId}`)
  }

  async createTransaction(data) {
    return await api.post('/v1/transactions', data)
  }

  async updateTransaction(transactionId, data) {
    return await api.put(`/v1/transactions/${transactionId}`, data)
  }

  async deleteTransaction(transactionId) {
    return await api.delete(`/v1/transactions/${transactionId}`)
  }

  async getPositions(params) {
    return await api.get('/v1/positions', params)
  }

  async getPosition(ticker, walletId) {
    return await api.get(`/v1/positions/${ticker}`, { walletId })
  }
}

export default new TransactionService()
