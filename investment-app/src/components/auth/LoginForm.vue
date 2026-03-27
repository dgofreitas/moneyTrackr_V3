<template>
  <form @submit.prevent="handleSubmit" class="login-form">
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div class="form-group">
      <label for="email">Email</label>
      <input
        id="email"
        v-model="form.email"
        type="email"
        placeholder="seu@email.com"
        :disabled="isLoading"
        required
        autocomplete="email"
      />
      <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
    </div>

    <div class="form-group">
      <label for="password">Senha</label>
      <input
        id="password"
        v-model="form.password"
        type="password"
        placeholder="Sua senha"
        :disabled="isLoading"
        required
        autocomplete="current-password"
      />
      <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
    </div>

    <div class="form-actions">
      <Button type="submit" :disabled="isLoading" variant="primary" class="full-width">
        <span v-if="isLoading">Entrando...</span>
        <span v-else>Entrar</span>
      </Button>
    </div>

    <div class="form-links">
      <router-link to="/forgot-password" class="link">Esqueci minha senha</router-link>
      <router-link to="/register" class="link">Criar conta</router-link>
    </div>
  </form>
</template>

<script setup>
import { ref, reactive } from 'vue'
import Button from '../ui/Button.vue'

const emit = defineEmits(['submit'])

const props = defineProps({
  isLoading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
})

const form = reactive({
  email: '',
  password: '',
})

const errors = reactive({
  email: '',
  password: '',
})

const validateForm = () => {
  let isValid = true

  // Reset errors
  errors.email = ''
  errors.password = ''

  // Validate email
  if (!form.email) {
    errors.email = 'Email e obrigatorio'
    isValid = false
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Email invalido'
    isValid = false
  }

  // Validate password
  if (!form.password) {
    errors.password = 'Senha e obrigatoria'
    isValid = false
  }

  return isValid
}

const handleSubmit = () => {
  if (validateForm()) {
    emit('submit', { ...form })
  }
}
</script>

<style scoped>
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 500;
  font-size: 0.9rem;
  color: #333;
}

input {
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

input:focus {
  outline: none;
  border-color: #1a1a2e;
}

input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.error-message {
  background-color: #fee;
  color: #c00;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.9rem;
  text-align: center;
}

.field-error {
  color: #c00;
  font-size: 0.8rem;
}

.form-actions {
  margin-top: 0.5rem;
}

.full-width {
  width: 100%;
}

.form-links {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
}

.link {
  color: #1a1a2e;
  text-decoration: none;
  font-size: 0.9rem;
}

.link:hover {
  text-decoration: underline;
}

@media (max-width: 480px) {
  .form-links {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
}
</style>
