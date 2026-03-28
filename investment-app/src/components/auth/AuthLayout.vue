<template>
  <div class="auth-layout">
    <div class="auth-container">
      <div class="auth-header">
        <router-link to="/" class="logo">
          <h1>MoneyTrackr</h1>
        </router-link>
        <p class="subtitle">{{ subtitle }}</p>
      </div>
      
      <Card class="auth-card">
        <slot />
      </Card>

      <div class="auth-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup>
import Card from '../ui/Card.vue'

defineProps({
  subtitle: {
    type: String,
    default: 'Sistema de gestao de investimentos',
  },
})
</script>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
  padding: 1rem;
}

.auth-container {
  width: 100%;
  max-width: 400px;
}

.auth-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.logo {
  text-decoration: none;
  color: inherit;
}

.logo h1 {
  color: #1a1a2e;
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #666;
  font-size: 0.9rem;
}

.auth-card {
  padding: 2rem;
}

.auth-footer {
  text-align: center;
  margin-top: 1rem;
}

@media (max-width: 480px) {
  .auth-card {
    padding: 1.5rem;
  }

  .logo h1 {
    font-size: 1.5rem;
  }
}
</style>
