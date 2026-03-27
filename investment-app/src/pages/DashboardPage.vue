<template>
  <ProtectedRoute>
    <div class="dashboard-page">
      <header class="dashboard-header">
        <h1>Dashboard</h1>
        <Button variant="secondary" @click="handleLogout">Sair</Button>
      </header>
      
      <main class="dashboard-content">
        <div class="welcome-card">
          <h2>Bem-vindo, {{ userName }}!</h2>
          <p>Seu painel de investimentos sera exibido aqui.</p>
        </div>
      </main>
    </div>
  </ProtectedRoute>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth-store'
import ProtectedRoute from '@/components/common/ProtectedRoute.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const authStore = useAuthStore()

const userName = computed(() => authStore.user?.name || 'Usuario')

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.dashboard-header h1 {
  color: #1a1a2e;
  font-size: 1.5rem;
  margin: 0;
}

.dashboard-content {
  padding: 2rem;
}

.welcome-card {
  background-color: white;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.welcome-card h2 {
  color: #1a1a2e;
  margin-bottom: 0.5rem;
}

.welcome-card p {
  color: #666;
}
</style>
