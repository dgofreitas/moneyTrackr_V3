import authService from './auth-service'

const API_BASE_URL = '/api'

let isRedirecting = false

async function request(method, path, data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  }

  // Add Authorization header if token exists
  const token = authService.getToken()
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`
  }

  if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
    options.body = JSON.stringify(data)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, options)

  // Handle X-New-Token header for token refresh
  const newToken = response.headers.get('X-New-Token')
  if (newToken) {
    authService.setToken(newToken)
  }

  if (!response.ok) {
    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401 && !isRedirecting) {
      isRedirecting = true
      authService.removeToken()
      
      // Use window.location to redirect to login
      const currentPath = window.location.pathname
      const returnUrl = currentPath !== '/login' ? `?returnUrl=${encodeURIComponent(currentPath)}` : ''
      window.location.href = `/login${returnUrl}`
      
      // Reset flag after a delay
      setTimeout(() => {
        isRedirecting = false
      }, 1000)
    }

    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export default {
  get: (path) => request('GET', path),
  post: (path, data) => request('POST', path, data),
  put: (path, data) => request('PUT', path, data),
  patch: (path, data) => request('PATCH', path, data),
  delete: (path) => request('DELETE', path),
}
