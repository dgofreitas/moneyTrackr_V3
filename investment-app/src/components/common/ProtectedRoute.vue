<template>
  <div v-if="isLoading" class="loading-container">
    <Loading message="Verificando autenticacao..." />
  </div>
  <slot v-else-if="isAuthenticated" />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth-store'
import Loading from '@/components/ui/Loading.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isLoading = ref(true)
const isAuthenticated = ref(false)

onMounted(async () => {
  // Check if token exists
  if (!authStore.token) {
    redirectToLogin()
    return
  }

  try {
    // Validate session with backend
    await authStore.getProfile()
    isAuthenticated.value = true
  } catch (error) {
    // Session invalid - clear and redirect
    authStore.clearToken()
    redirectToLogin()
  } finally {
    isLoading.value = false
  }
})

const redirectToLogin = () => {
  const currentPath = route.fullPath
  const returnUrl = currentPath !== '/login' ? encodeURIComponent(currentPath) : ''
  router.push(`/login${returnUrl ? `?returnUrl=${returnUrl}` : ''}`)
  isLoading.value = false
}
</script>

<style scoped>
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f5f5f5;
}
</style>
