<template>
  <AuthLayout subtitle="Defina uma nova senha">
    <div class="reset-password-page">
      <h2 class="page-title">Redefinir Senha</h2>
      
      <p v-if="!isValidToken" class="error-message">
        Link invalido ou expirado. Solicite um novo link de recuperacao.
      </p>
      
      <template v-else>
        <p class="description">
          Digite sua nova senha abaixo.
        </p>
        
        <ResetPasswordForm 
          :is-loading="isLoading" 
          :error="error" 
          :success="success"
          @submit="handleResetPassword" 
        />
      </template>
      
      <div class="back-link">
        <router-link to="/login">Voltar para o login</router-link>
      </div>
    </div>
  </AuthLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth-store'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import ResetPasswordForm from '@/components/auth/ResetPasswordForm.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isLoading = ref(false)
const error = ref('')
const success = ref('')
const isValidToken = ref(true)
const token = ref('')

onMounted(() => {
  token.value = route.query.token || ''
  if (!token.value) {
    isValidToken.value = false
  }
})

const handleResetPassword = async (data) => {
  isLoading.value = true
  error.value = ''
  success.value = ''

  try {
    const response = await authStore.resetPassword({
      token: token.value,
      password: data.password,
      confirmPassword: data.confirmPassword,
    })
    success.value = response.message || 'Senha redefinida com sucesso!'
    
    // Redirect to login after 3 seconds
    setTimeout(() => {
      router.push('/login')
    }, 3000)
  } catch (err) {
    if (err.message.includes('invalido') || err.message.includes('expirado')) {
      isValidToken.value = false
    }
    error.value = err.message || 'Erro ao redefinir senha'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.reset-password-page {
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

.error-message {
  background-color: #fee;
  color: #c00;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.9rem;
  text-align: center;
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
