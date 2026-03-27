import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    isLoading: false,
    error: null,
    user: null,
  }),

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
  },
})
