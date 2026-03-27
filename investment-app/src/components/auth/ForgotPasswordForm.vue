<template>
  <form @submit.prevent="handleSubmit" class="forgot-password-form">
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="success" class="success-message">
      {{ success }}
    </div>

    <div v-if="!success" class="form-group">
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

    <div v-if="!success" class="form-actions">
      <Button type="submit" :disabled="isLoading" variant="primary" class="full-width">
        <span v-if="isLoading">Enviando...</span>
        <span v-else>Enviar Link de Recuperacao</span>
      </Button>
    </div>
  </form>
</template>

<script setup>
import { reactive } from 'vue'
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
  success: {
    type: String,
    default: '',
  },
})

const form = reactive({
  email: '',
})

const errors = reactive({
  email: '',
})

const validateForm = () => {
  let isValid = true

  // Reset errors
  errors.email = ''

  // Validate email
  if (!form.email) {
    errors.email = 'Email e obrigatorio'
    isValid = false
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Email invalido'
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
.forgot-password-form {
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
