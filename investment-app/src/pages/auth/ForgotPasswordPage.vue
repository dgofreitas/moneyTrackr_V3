<template>
  <AuthLayout subtitle="Recupere sua senha">
    <div class="forgot-password-page">
      <h2 class="page-title">Esqueci Minha Senha</h2>
      
      <p class="description">
        Digite seu email e enviaremos um link para redefinir sua senha.
      </p>
      
      <ForgotPasswordForm 
        :is-loading="isLoading" 
        :error="error" 
        :success="success"
        @submit="handleForgotPassword" 
      />
      
      <div class="back-link">
        <router-link to="/login">Voltar para o login</router-link>
      </div>
    </div>
  </AuthLayout>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth-store'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm.vue'

const authStore = useAuthStore()

const isLoading = ref(false)
const error = ref('')
const success = ref('')

const handleForgotPassword = async (data) => {
  isLoading.value = true
  error.value = ''
  success.value = ''

  try {
    const response = await authStore.forgotPassword(data)
    success.value = response.message || 'Se o email estiver cadastrado, voce recebera um link de recuperacao.'
  } catch (err) {
    error.value = err.message || 'Erro ao solicitar recuperacao de senha'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.forgot-password-page {
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

.description {
  text-align: center;
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.back-link {
  text-align: center;
  margin-top: 1rem;
}

.back-link a {
  color: #1a1a2e;
  font-weight: 500;
  text-decoration: none;
  font-size: 0.9rem;
}

.back-link a:hover {
  text-decoration: underline;
}
</style>
