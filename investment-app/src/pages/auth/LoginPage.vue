<template>
  <AuthLayout subtitle="Entre na sua conta">
    <div class="login-page">
      <h2 class="page-title">Login</h2>
      
      <GoogleLoginButton 
        @success="handleGoogleSuccess" 
        @error="handleGoogleError" 
      />
      
      <div class="divider">
        <span>ou</span>
      </div>
      
      <LoginForm 
        :is-loading="isLoading" 
        :error="error" 
        @submit="handleLogin" 
      />
    </div>
  </AuthLayout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth-store'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import LoginForm from '@/components/auth/LoginForm.vue'
import GoogleLoginButton from '@/components/auth/GoogleLoginButton.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isLoading = ref(false)
const error = ref('')

const handleLogin = async (credentials) => {
  isLoading.value = true
  error.value = ''

  try {
    await authStore.login(credentials)
    const returnUrl = route.query.returnUrl || '/dashboard'
    router.push(returnUrl)
  } catch (err) {
    error.value = err.message || 'Email ou senha incorretos'
  } finally {
    isLoading.value = false
  }
}

const handleGoogleSuccess = async () => {
  const returnUrl = route.query.returnUrl || '/dashboard'
  router.push(returnUrl)
}

const handleGoogleError = (err) => {
  error.value = err.message || 'Falha ao autenticar com Google'
}
</script>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a2e;
  text-align: center;
  margin-bottom: 0.5rem;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: #666;
  font-size: 0.9rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #ddd;
}

.divider span {
  padding: 0 1rem;
}
</style>
