<template>
  <div v-if="password" class="password-strength-meter">
    <div class="strength-bar">
      <div 
        class="strength-fill" 
        :style="{ width: strengthPercentage + '%' }"
        :class="strengthClass"
      ></div>
    </div>
    <div class="strength-label" :class="strengthClass">
      {{ strengthLabel }}
    </div>
    <ul class="requirements-list">
      <li :class="{ met: requirements.minLength }">
        <span class="icon">{{ requirements.minLength ? '✓' : '○' }}</span>
        Minimo 8 caracteres
      </li>
      <li :class="{ met: requirements.hasUppercase }">
        <span class="icon">{{ requirements.hasUppercase ? '✓' : '○' }}</span>
        Letra maiuscula
      </li>
      <li :class="{ met: requirements.hasLowercase }">
        <span class="icon">{{ requirements.hasLowercase ? '✓' : '○' }}</span>
        Letra minuscula
      </li>
      <li :class="{ met: requirements.hasNumber }">
        <span class="icon">{{ requirements.hasNumber ? '✓' : '○' }}</span>
        Numero
      </li>
      <li :class="{ met: requirements.hasSpecial }">
        <span class="icon">{{ requirements.hasSpecial ? '✓' : '○' }}</span>
        Caractere especial (!@#$%^&*)
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  password: {
    type: String,
    default: '',
  },
})

const requirements = computed(() => ({
  minLength: props.password.length >= 8,
  hasUppercase: /[A-Z]/.test(props.password),
  hasLowercase: /[a-z]/.test(props.password),
  hasNumber: /[0-9]/.test(props.password),
  hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(props.password),
}))

const metCount = computed(() => {
  return Object.values(requirements.value).filter(Boolean).length
})

const strengthPercentage = computed(() => {
  return (metCount.value / 5) * 100
})

const strengthClass = computed(() => {
  if (metCount.value <= 2) return 'weak'
  if (metCount.value <= 4) return 'medium'
  return 'strong'
})

const strengthLabel = computed(() => {
  if (metCount.value <= 2) return 'Fraca'
  if (metCount.value <= 4) return 'Media'
  return 'Forte'
})
</script>

<style scoped>
.password-strength-meter {
  margin-top: 0.5rem;
}

.strength-bar {
  height: 6px;
  background-color: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
  border-radius: 3px;
}

.strength-fill.weak {
  background-color: #dc3545;
}

.strength-fill.medium {
  background-color: #ffc107;
}

.strength-fill.strong {
  background-color: #28a745;
}

.strength-label {
  font-size: 0.8rem;
  font-weight: 500;
  margin-top: 0.25rem;
}

.strength-label.weak {
  color: #dc3545;
}

.strength-label.medium {
  color: #ffc107;
}

.strength-label.strong {
  color: #28a745;
}

.requirements-list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0 0;
  font-size: 0.75rem;
  color: #666;
}

.requirements-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.requirements-list li.met {
  color: #28a745;
}

.requirements-list .icon {
  width: 1rem;
  text-align: center;
}
</style>
