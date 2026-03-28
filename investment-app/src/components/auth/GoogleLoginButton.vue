<template>
  <button
    type="button"
    class="google-login-btn"
    :disabled="isLoading"
    @click="handleGoogleLogin"
  >
    <svg class="google-icon" viewBox="0 0 24 24" width="24" height="24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
    <span>{{ isLoading ? 'Entrando...' : 'Entrar com Google' }}</span>
  </button>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth-store'

const emit = defineEmits(['success', 'error'])

const authStore = useAuthStore()
const isLoading = ref(false)

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const GOOGLE_REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/callback`

let messageHandler = null

const handleGoogleLogin = async () => {
  isLoading.value = true

  const scope = 'openid email profile'
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scope)}&` +
    `access_type=offline`

  const width = 500
  const height = 600
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2

  const popup = window.open(
    authUrl,
    'GoogleLogin',
    `width=${width},height=${height},left=${left},top=${top}`
  )

  if (!popup) {
    isLoading.value = false
    emit('error', new Error('Popup bloqueado. Permita popups para este site.'))
    return
  }

  // Set up message handler for popup communication
  messageHandler = async (event) => {
    // Security check - only accept messages from our origin
    if (event.origin !== window.location.origin) {
      return
    }

    if (event.data.type === 'GOOGLE_AUTH_CODE') {
      try {
        await authStore.googleLogin({ code: event.data.code })
        emit('success')
      } catch (error) {
        emit('error', error)
      } finally {
        isLoading.value = false
        popup.close()
      }
    } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
      isLoading.value = false
      popup.close()
      emit('error', new Error(event.data.message || 'Autorizacao cancelada'))
    }
  }

  window.addEventListener('message', messageHandler)

  // Check if popup was closed manually
  const checkClosed = setInterval(() => {
    if (popup.closed) {
      clearInterval(checkClosed)
      isLoading.value = false
      window.removeEventListener('message', messageHandler)
    }
  }, 500)
}

onUnmounted(() => {
  if (messageHandler) {
    window.removeEventListener('message', messageHandler)
  }
})
</script>

<style scoped>
.google-login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;
}

.google-login-btn:hover:not(:disabled) {
  background-color: #f8f8f8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.google-login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.google-icon {
  flex-shrink: 0;
}
</style>
