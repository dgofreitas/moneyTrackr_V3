<template>
  <AuthLayout subtitle="Crie sua conta gratuitamente">
    <div class="register-page">
      <h2 class="page-title">Criar Conta</h2>
      
      <RegisterForm 
        :is-loading="isLoading" 
        :error="error" 
        @submit="handleRegister" 
      />
      
      <div class="login-link">
        <p>Ja tem uma conta? <router-link to="/login">Faca login</router-link></p>
      </div>
    </div>
  </AuthLayout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth-store'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import RegisterForm from '@/components/auth/RegisterForm.vue'

const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(false)
const error = ref('')

const handleRegister = async (data) => {
  isLoading.value = true
  error.value = ''

  try {
    await authStore.register(data)
    router.push('/dashboard')
  } catch (err) {
    error.value = err.message || 'Erro ao criar conta'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.register-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a2e;
  text-align: center;
  margin-bottom: 0.5rem;
}

.login-link {
  text-align: center;
  margin-top: 1rem;
  font-size: 0.9rem;
  color: #666;
}

.login-link a {
  color: #1a1a2e;
  font-weight: 500;
  text-decoration: none;
}

.login-link a:hover {
  text-decoration: underline;
}
</style>
