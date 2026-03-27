<template>
  <form @submit.prevent="handleSubmit" class="reset-password-form">
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="success" class="success-message">
      {{ success }}
      <p class="redirect-info">Redirecionando para o login...</p>
    </div>

    <template v-if="!success">
      <div class="form-group">
        <label for="password">Nova Senha</label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          placeholder="Minimo 8 caracteres"
          :disabled="isLoading"
          required
          autocomplete="new-password"
          @input="handlePasswordInput"
          @blur="validateField('password')"
        />
        <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
        <PasswordStrengthMeter :password="form.password" />
      </div>

      <div class="form-group">
        <label for="confirmPassword">Confirmar Nova Senha</label>
        <input
          id="confirmPassword"
          v-model="form.confirmPassword"
          type="password"
          placeholder="Confirme sua nova senha"
          :disabled="isLoading"
          required
          autocomplete="new-password"
          @blur="validateField('confirmPassword')"
        />
        <span v-if="errors.confirmPassword" class="field-error">{{ errors.confirmPassword }}</span>
      </div>

      <div class="form-actions">
        <Button type="submit" :disabled="isLoading" variant="primary" class="full-width">
          <span v-if="isLoading">Redefinindo...</span>
          <span v-else>Redefinir Senha</span>
        </Button>
      </div>
    </template>
  </form>
</template>

<script setup>
import { reactive } from 'vue'
import Button from '../ui/Button.vue'
import PasswordStrengthMeter from './PasswordStrengthMeter.vue'

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
  success: {
    type: String,
    default: '',
  },
})

const form = reactive({
  password: '',
  confirmPassword: '',
})

const errors = reactive({
  password: '',
  confirmPassword: '',
})

const passwordRequirements = {
  minLength: false,
  hasUppercase: false,
  hasLowercase: false,
  hasNumber: false,
  hasSpecial: false,
}

const updatePasswordRequirements = () => {
  const password = form.password
  passwordRequirements.minLength = password.length >= 8
  passwordRequirements.hasUppercase = /[A-Z]/.test(password)
  passwordRequirements.hasLowercase = /[a-z]/.test(password)
  passwordRequirements.hasNumber = /[0-9]/.test(password)
  passwordRequirements.hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)
}

const handlePasswordInput = () => {
  updatePasswordRequirements()
  if (form.password) {
    validateField('password')
  }
}

const validateField = (field) => {
  switch (field) {
    case 'password':
      if (!form.password) {
        errors.password = 'Senha e obrigatoria'
      } else if (form.password.length < 8) {
        errors.password = 'Senha deve ter no minimo 8 caracteres'
      } else if (!passwordRequirements.hasUppercase || 
                 !passwordRequirements.hasLowercase || 
                 !passwordRequirements.hasNumber || 
                 !passwordRequirements.hasSpecial) {
        errors.password = 'Senha deve conter maiuscula, minuscula, numero e caractere especial'
      } else {
        errors.password = ''
      }
      break

    case 'confirmPassword':
      if (!form.confirmPassword) {
        errors.confirmPassword = 'Confirmacao de senha e obrigatoria'
      } else if (form.confirmPassword !== form.password) {
        errors.confirmPassword = 'As senhas nao conferem'
      } else {
        errors.confirmPassword = ''
      }
      break
  }
}

const validateForm = () => {
  validateField('password')
  validateField('confirmPassword')

  return !errors.password && !errors.confirmPassword
}

const handleSubmit = () => {
  if (validateForm()) {
    emit('submit', { ...form })
  }
}
</script>

<style scoped>
.reset-password-form {
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

.success-message {
  background-color: #efe;
  color: #060;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.9rem;
  text-align: center;
}

.redirect-info {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #666;
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
</style>
