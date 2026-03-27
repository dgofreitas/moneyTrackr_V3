# Plano Técnico - Épicos 23-28 (Qualidade e Segurança)

> **Produto**: MoneyTrackr — Gestor de Investimentos
> **Escopo**: Concerns transversais que afetam toda a aplicação
> **Data de criação**: 2026-03-27
> **Autor**: @architect

---

## 1. Visão Geral da Arquitetura de Qualidade e Segurança

### 1.1 Diagrama de Arquitetura Cross-Cutting

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    MONEYTRACKR - QUALIDADE E SEGURANÇA                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         EP-27: SEGURANÇA FRONTEND                         │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │   │
│  │  │  JWT Context    │  │  XSS Prevention  │  │  CSRF Protection       │   │   │
│  │  │                 │  │                  │  │                         │   │   │
│  │  │ - userId from   │  │ - Input sanitize │  │ - Double Submit Cookie  │   │   │
│  │  │   JWT only      │  │ - DOMPurify      │  │ - SameSite cookies      │   │   │
│  │  │ - SecureDAO     │  │ - CSP headers    │  │ - CSRF token header     │   │   │
│  │  │ - 404 on other  │  │ - Helmet.js      │  │ - httpOnly cookies      │   │   │
│  │  │   user data     │  │                  │  │                         │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         EP-25: AUDITORIA E CONSISTÊNCIA                  │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │   │
│  │  │  Audit Log      │  │  Soft Delete    │  │  Change History        │   │   │
│  │  │                 │  │                  │  │                         │   │   │
│  │  │ - Middleware    │  │ - deletedAt     │  │ - Timeline UI          │   │   │
│  │  │ - Immutable     │  │ - deletedBy     │  │ - Diff Viewer          │   │   │
│  │  │ - prev/new data │  │ - Auto filter   │  │ - Restore UI           │   │   │
│  │  │ - All entities  │  │ - Restore       │  │ - Trash Bin            │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         EP-26: PERFORMANCE                                │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │   │
│  │  │  Bundle Split   │  │  Virtual Scroll │  │  Redis Cache           │   │   │
│  │  │                 │  │                  │  │                         │   │   │
│  │  │ - Route chunks  │  │ - 60fps scroll  │  │ - Market data          │   │   │
│  │  │ - Vendor chunk  │  │ - Buffer items  │  │ - Dashboard agg        │   │   │
│  │  │ - Lazy imports  │  │ - Auto disable  │  │ - TTL by type          │   │   │
│  │  │ - < 200KB gzip  │  │ - Search int.   │  │ - Invalidation         │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │   │
│  │  │                      MongoDB Indexes                                │  │   │
│  │  │  - Compound indexes for all queries                                 │  │   │
│  │  │  - Pagination mixin (max 200 items)                                 │  │   │
│  │  │  - Explain analysis for all queries                                 │  │   │
│  │  └─────────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         EP-23: FEEDBACK UX                                │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │   │
│  │  │  Loading States │  │  Error Messages │  │  Success Confirm       │   │   │
│  │  │                 │  │                  │  │                         │   │   │
│  │  │ - Skeleton      │  │ - Inline errors │  │ - Toast success        │   │   │
│  │  │ - Button spinner│  │ - Toast errors  │  │ - Confirm modal         │   │   │
│  │  │ - Top progress  │  │ - Offline banner│  │ - Delete confirm       │   │   │
│  │  │ - Suspense      │  │ - Retry button  │  │ - Import summary       │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │   │
│  │  │                      Empty States                                    │  │   │
│  │  │  - Contextual illustrations                                          │  │   │
│  │  │  - Clear messages + CTA buttons                                      │  │   │
│  │  │  - Per-section customization                                         │  │   │
│  │  └─────────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         EP-24: EDITOR DE GRÁFICOS                         │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │   │
│  │  │  Chart Type     │  │  Comparisons   │  │  Color Custom          │   │   │
│  │  │                 │  │                  │  │                         │   │   │
│  │  │ - Line/Bar      │  │ - Wallets      │  │ - 12 color palette     │   │   │
│  │  │ - Pie/Donut     │  │ - Indices      │  │ - WCAG AA contrast     │   │   │
│  │  │ - Live preview  │  │ - Asset groups │  │ - Color blind safe     │   │   │
│  │  │ - Type warning  │  │ - Normalized   │  │ - Custom hex input     │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │   │
│  │  │                      Chart Config Persistence                        │  │   │
│  │  │  - Per wallet + user                                                 │  │   │
│  │  │  - CRUD endpoints                                                    │  │   │
│  │  │  - Default config for new wallets                                    │  │   │
│  │  └─────────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         EP-28: RESPONSIVIDADE                            │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │   │
│  │  │  Breakpoints    │  │  Sidebar Resp.  │  │  Touch Friendly        │   │   │
│  │  │                 │  │                  │  │                         │   │   │
│  │  │ - Mobile < 768  │  │ - Hidden mobile │  │ - 44x44px targets      │   │   │
│  │  │ - Tablet 768-   │  │ - Collapsed tab │  │ - Swipe actions        │   │   │
│  │  │   1024          │  │ - Expanded desk │  │ - Long press select   │   │   │
│  │  │ - Desktop >1024 │  │ - Overlay anim  │  │ - Pull to refresh      │   │   │
│  │  │ - Fluid trans.  │  │ - Swipe close   │  │ - No sticky hover      │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Fluxo de Segurança

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Request   │────►│   CSRF      │────►│   JWT       │────►│   SecureDAO │
│   Client    │     │   Token     │     │   Verify    │     │   (userId)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │                   │                   │
                          ▼                   ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
                    │   Invalid   │     │   Expired   │     │   404 for   │
                    │   → 403     │     │   → 401     │     │   other user│
                    └─────────────┘     └─────────────┘     └─────────────┘
```

---

## 2. Estrutura de Pastas (Adições)

```
frontend/
├── src/
│   ├── components/
│   │   ├── feedback/
│   │   │   ├── SkeletonLoader.vue          # Skeleton com variantes
│   │   │   ├── SkeletonLoader.test.js
│   │   │   ├── ButtonSpinner.vue           # Botão com spinner
│   │   │   ├── ButtonSpinner.test.js
│   │   │   ├── TopProgressBar.vue          # Barra progresso global
│   │   │   ├── TopProgressBar.test.js
│   │   │   ├── ToastNotification.vue       # Toast individual
│   │   │   ├── ToastNotification.test.js
│   │   │   ├── ToastContainer.vue          # Container toasts
│   │   │   ├── ToastContainer.test.js
│   │   │   ├── InlineError.vue             # Erro inline formulários
│   │   │   ├── InlineError.test.js
│   │   │   ├── OfflineBanner.vue           # Banner sem conexão
│   │   │   ├── OfflineBanner.test.js
│   │   │   ├── EmptyState.vue              # Empty state genérico
│   │   │   ├── EmptyState.test.js
│   │   │   ├── ConfirmModal.vue            # Modal confirmação
│   │   │   └── ConfirmModal.test.js
│   │   │
│   │   ├── charts/
│   │   │   ├── ChartEditor.vue             # Painel principal editor
│   │   │   ├── ChartEditor.test.js
│   │   │   ├── ChartTypeSelector.vue       # Seletor tipo gráfico
│   │   │   ├── ChartTypeSelector.test.js
│   │   │   ├── ChartPreview.vue            # Preview tempo real
│   │   │   ├── ChartPreview.test.js
│   │   │   ├── ComparisonPanel.vue         # Painel comparações
│   │   │   ├── ComparisonPanel.test.js
│   │   │   ├── ChartLegend.vue             # Legenda interativa
│   │   │   ├── ChartLegend.test.js
│   │   │   └── ColorPicker.vue             # Seletor de cor
│   │   │
│   │   ├── audit/
│   │   │   ├── ChangeHistoryTimeline.vue   # Timeline alterações
│   │   │   ├── ChangeHistoryTimeline.test.js
│   │   │   ├── DiffViewer.vue              # Visualização diff
│   │   │   ├── DiffViewer.test.js
│   │   │   ├── AuditEntry.vue              # Entrada individual
│   │   │   ├── AuditEntry.test.js
│   │   │   ├── TrashBin.vue                 # Página lixeira
│   │   │   ├── TrashBin.test.js
│   │   │   ├── DeletedItemBadge.vue        # Badge item excluído
│   │   │   └── RestoreModal.vue            # Modal restauração
│   │   │
│   │   └── touch/
│   │       ├── SwipeActions.vue            # Ações por swipe
│   │       ├── SwipeActions.test.js
│   │       ├── PullToRefresh.vue           # Pull-to-refresh
│   │       └── PullToRefresh.test.js
│   │
│   ├── composables/
│   │   ├── useLoading.js                   # Estado loading
│   │   ├── useLoading.test.js
│   │   ├── useToast.js                     # Toast notifications
│   │   ├── useToast.test.js
│   │   ├── useConfirm.js                   # Modal confirmação
│   │   ├── useConfirm.test.js
│   │   ├── useBreakpoint.js                # Hook breakpoint
│   │   ├── useBreakpoint.test.js
│   │   ├── useMediaQuery.js                # Hook media queries
│   │   ├── useTouchDevice.js               # Detecta touch
│   │   ├── useTouchDevice.test.js
│   │   ├── useGesture.js                   # Detecção gestos
│   │   └── useGesture.test.js
│   │
│   ├── services/
│   │   ├── audit-service.js                # API audit logs
│   │   ├── chart-comparison-service.js     # API comparações
│   │   └── chart-config-service.js         # API config gráficos
│   │
│   ├── store/
│   │   └── chart-config.store.js           # State config gráficos
│   │
│   ├── constants/
│   │   ├── error-messages.js               # Mapa erros PT-BR
│   │   ├── success-messages.js             # Mensagens sucesso
│   │   ├── chart-types.js                  # Tipos gráfico
│   │   └── chart-palette.js                # Paleta cores
│   │
│   ├── utils/
│   │   ├── sanitize.js                     # Wrapper DOMPurify
│   │   ├── sanitize.test.js
│   │   └── color-utils.js                  # Utilitários cores
│   │
│   ├── plugins/
│   │   ├── axios-loading-interceptor.js    # Interceptor loading
│   │   ├── axios-error-interceptor.js      # Interceptor erros
│   │   └── axios-csrf-interceptor.js       # Interceptor CSRF
│   │
│   └── styles/
│       ├── touch.css                       # Touch targets
│       └── gestures.css                    # Animações gestos
│
├── backend/
│   └── src/
│       ├── middleware/
│       │   ├── auth-middleware.js           # Middleware JWT
│       │   ├── auth-middleware.test.js
│       │   ├── csrf-middleware.js           # Config CSRF
│       │   ├── csrf-middleware.test.js
│       │   ├── cors-config.js               # Config CORS
│       │   ├── security-headers.js          # Helmet/CSP
│       │   ├── input-sanitizer.js           # Sanitização global
│       │   └── input-sanitizer.test.js
│       │
│       ├── common/
│       │   ├── secure-dao.js                # DAO base userId
│       │   ├── secure-dao.test.js
│       │   ├── pagination-mixin.js          # Mixin paginação
│       │   ├── pagination-mixin.test.js
│       │   ├── restore-mixin.js             # Mixin restauração
│       │   └── soft-delete-plugin.js        # Plugin Mongoose
│       │
│       ├── cache/
│       │   ├── cache-manager.js             # Abstração Redis
│       │   ├── cache-manager.test.js
│       │   ├── cache-keys.js                # Constantes TTL
│       │   ├── cache-invalidation.js        # Invalidação tags
│       │   ├── cache-middleware.js          # Middleware cache
│       │   └── cache-middleware.test.js
│       │
│       ├── plugins/
│       │   ├── soft-delete-plugin.js        # Plugin soft delete
│       │   └── soft-delete-plugin.test.js
│       │
│       ├── scripts/
│       │   ├── explain-queries.js           # Análise queries
│       │   ├── create-indexes.js            # Criação índices
│       │   └── analyze-bundle.js            # Análise bundle
│       │
│       └── app/
│           ├── audit/
│           │   ├── audit-log-model.js       # Schema AuditLog
│           │   ├── audit-log-dao.js         # DAO auditoria
│           │   ├── audit-log-manager.js     # Manager consulta
│           │   ├── audit-log-router.js      # Rotas auditoria
│           │   ├── audit-middleware.js      # Middleware intercepta
│           │   └── audit-middleware.test.js
│           │
│           ├── chart-config/
│           │   ├── chart-config-model.js     # Schema ChartConfig
│           │   ├── chart-config-dao.js       # DAO config
│           │   ├── chart-config-manager.js   # Manager config
│           │   └── chart-config-router.js    # Rotas CRUD
│           │
│           └── chart/
│               ├── chart-router.js          # Rotas dados gráfico
│               ├── chart-manager.js          # Agregação/normalização
│               └── chart-dao.js              # Queries históricos
│
└── migrations/
    └── add-soft-delete-fields.js            # Migration docs existentes
```

---

## 3. Componentes por Épico

### EP23 - Feedback UX

#### 3.1.1 Indicadores de Carregamento (Loading States)

**Objetivo**: Feedback visual imediato para todas as operações.

**Componentes**:

| Componente | Variante | Uso |
|------------|----------|-----|
| `SkeletonLoader` | `text` | Textos, títulos |
| `SkeletonLoader` | `card` | Cards, widgets |
| `SkeletonLoader` | `table-row` | Linhas de tabela |
| `SkeletonLoader` | `chart` | Placeholders de gráfico |
| `ButtonSpinner` | - | Botões de ação |
| `TopProgressBar` | - | Barra estilo NProgress |

**Implementação SkeletonLoader**:
```vue
<!-- components/feedback/SkeletonLoader.vue -->
<template>
  <div class="skeleton" :class="`skeleton--${variant}`">
    <div v-for="n in lines" :key="n" class="skeleton__line" />
  </div>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'text',
    validator: (v) => ['text', 'card', 'table-row', 'chart'].includes(v)
  },
  lines: { type: Number, default: 1 }
})
</script>

<style scoped>
.skeleton__line {
  background: linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary) 50%, var(--color-bg-secondary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
```

**Interceptor de Loading**:
```javascript
// plugins/axios-loading-interceptor.js
import { useLoadingStore } from '@/store/loading.store'

let pendingRequests = 0
let debounceTimer = null

api.interceptors.request.use((config) => {
  pendingRequests++
  
  // Debounce de 300ms para evitar flash
  if (!debounceTimer) {
    debounceTimer = setTimeout(() => {
      if (pendingRequests > 0) {
        useLoadingStore().startLoading()
      }
    }, 300)
  }
  
  return config
})

api.interceptors.response.use(
  (response) => {
    pendingRequests--
    if (pendingRequests === 0) {
      clearTimeout(debounceTimer)
      debounceTimer = null
      useLoadingStore().stopLoading()
    }
    return response
  },
  (error) => {
    pendingRequests--
    if (pendingRequests === 0) {
      clearTimeout(debounceTimer)
      debounceTimer = null
      useLoadingStore().stopLoading()
    }
    return Promise.reject(error)
  }
)
```

---

#### 3.1.2 Mensagens de Erro (Toast e Inline)

**Objetivo**: Erros claros e contextuais.

**Componentes**:

| Componente | Tipo | Uso |
|------------|------|-----|
| `ToastNotification` | `error` | Erros de API, rede |
| `ToastNotification` | `warning` | Avisos importantes |
| `ToastNotification` | `info` | Informações |
| `InlineError` | - | Validação de formulários |
| `OfflineBanner` | - | Banner persistente offline |

**Mapa de Erros**:
```javascript
// constants/error-messages.js
export const errorMessages = {
  // Erros de autenticação
  'AUTH_INVALID_CREDENTIALS': 'Email ou senha incorretos',
  'AUTH_TOKEN_EXPIRED': 'Sessão expirada. Faça login novamente.',
  'AUTH_UNAUTHORIZED': 'Você não tem permissão para esta ação',
  
  // Erros de transação
  'TRANSACTION_NOT_FOUND': 'Transação não encontrada',
  'TRANSACTION_INVALID_TYPE': 'Tipo de transação inválido',
  'TRANSACTION_INSUFFICIENT_SHARES': 'Quantidade insuficiente de ações para esta operação',
  'TRANSACTION_INVALID_DATE': 'Data da transação inválida',
  
  // Erros de carteira
  'WALLET_NOT_FOUND': 'Carteira não encontrada',
  'WALLET_NAME_EXISTS': 'Já existe uma carteira com este nome',
  
  // Erros de ativo
  'ASSET_NOT_FOUND': 'Ativo não encontrado',
  'ASSET_INVALID_TICKER': 'Ticker inválido',
  
  // Erros de rede
  'NETWORK_ERROR': 'Sem conexão com a internet',
  'TIMEOUT_ERROR': 'Tempo de espera esgotado. Tente novamente.',
  'SERVER_ERROR': 'Erro inesperado. Tente novamente.',
  
  // Erros genéricos
  'VALIDATION_ERROR': 'Dados inválidos. Verifique os campos.',
  'UNKNOWN_ERROR': 'Erro inesperado. Tente novamente.'
}

export function getErrorMessage(errorCode, fallback = 'Erro inesperado') {
  return errorMessages[errorCode] || fallback
}
```

**Hook useToast**:
```javascript
// composables/useToast.js
import { ref } from 'vue'

const toasts = ref([])
const MAX_TOASTS = 3

export function useToast() {
  const showError = (message, options = {}) => {
    addToast({ type: 'error', message, duration: 8000, ...options })
  }
  
  const showSuccess = (message, options = {}) => {
    addToast({ type: 'success', message, duration: 5000, ...options })
  }
  
  const showWarning = (message, options = {}) => {
    addToast({ type: 'warning', message, duration: 6000, ...options })
  }
  
  const showInfo = (message, options = {}) => {
    addToast({ type: 'info', message, duration: 5000, ...options })
  }
  
  const addToast = (toast) => {
    const id = Date.now()
    
    // Limitar a 3 toasts
    if (toasts.value.length >= MAX_TOASTS) {
      toasts.value.shift()
    }
    
    toasts.value.push({ id, ...toast })
    
    // Auto-remove após duração
    if (toast.duration > 0) {
      setTimeout(() => removeToast(id), toast.duration)
    }
  }
  
  const removeToast = (id) => {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }
  
  return {
    toasts: readonly(toasts),
    showError,
    showSuccess,
    showWarning,
    showInfo,
    removeToast
  }
}
```

---

#### 3.1.3 Confirmações de Sucesso

**Objetivo**: Feedback positivo para ações bem-sucedidas.

**Mensagens de Sucesso**:
```javascript
// constants/success-messages.js
export const successMessages = {
  'TRANSACTION_CREATED': 'Transação criada com sucesso',
  'TRANSACTION_UPDATED': 'Transação atualizada com sucesso',
  'TRANSACTION_DELETED': 'Transação excluída com sucesso',
  'TRANSACTION_RESTORED': 'Transação restaurada com sucesso',
  
  'WALLET_CREATED': 'Carteira criada com sucesso',
  'WALLET_UPDATED': 'Carteira atualizada com sucesso',
  'WALLET_DELETED': 'Carteira excluída com sucesso',
  
  'IMPORT_COMPLETED': '{count} transações importadas com sucesso',
  'CHART_CONFIG_SAVED': 'Configuração do gráfico salva',
  
  'SYNC_COMPLETED': '{count} transações sincronizadas com sucesso'
}
```

**Hook useConfirm**:
```javascript
// composables/useConfirm.js
import { ref } from 'vue'

const confirmState = ref({
  isOpen: false,
  title: '',
  message: '',
  resolve: null
})

export function useConfirm() {
  const confirm = (title, message) => {
    return new Promise((resolve) => {
      confirmState.value = {
        isOpen: true,
        title,
        message,
        resolve
      }
    })
  }
  
  const accept = () => {
    confirmState.value.resolve(true)
    confirmState.value.isOpen = false
  }
  
  const reject = () => {
    confirmState.value.resolve(false)
    confirmState.value.isOpen = false
  }
  
  return {
    confirmState: readonly(confirmState),
    confirm,
    accept,
    reject
  }
}
```

---

#### 3.1.4 Empty States

**Objetivo**: Mensagens informativas para seções sem dados.

**Componente**:
```vue
<!-- components/feedback/EmptyState.vue -->
<template>
  <div class="empty-state">
    <img :src="illustration" :alt="title" class="empty-state__illustration" />
    <h3 class="empty-state__title">{{ title }}</h3>
    <p class="empty-state__description">{{ description }}</p>
    <RouterLink
      v-if="actionRoute"
      :to="actionRoute"
      class="btn btn-primary"
    >
      {{ actionLabel }}
    </RouterLink>
  </div>
</template>

<script setup>
defineProps({
  illustration: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  actionRoute: { type: String, default: '' }
})
</script>
```

**Configurações por Seção**:
| Seção | Ilustração | Título | Ação |
|-------|------------|--------|------|
| Transações | `empty-transactions.svg` | "Nenhuma transação encontrada" | "Registrar primeira transação" |
| Dashboard | `empty-wallet.svg` | "Crie sua primeira carteira" | "Criar Carteira" |
| Busca | `empty-search.svg` | "Nenhum resultado" | "Limpar filtros" |
| Gráfico | `empty-chart.svg` | "Sem dados suficientes" | - |

---

### EP24 - Editor de Gráficos

#### 3.2.1 Seleção de Tipo de Gráfico

**Objetivo**: Permitir escolha entre linha, barra, pizza e donut.

**Tipos Suportados**:
| Tipo | Uso | Dados |
|------|-----|-------|
| `line` | Evolução temporal | Séries contínuas |
| `bar` | Comparações | Valores discretos |
| `pie` | Distribuição atual | Proporções |
| `donut` | Distribuição atual | Proporções (com centro) |

**Componente ChartTypeSelector**:
```vue
<!-- components/charts/ChartTypeSelector.vue -->
<template>
  <div class="chart-type-selector">
    <button
      v-for="type in chartTypes"
      :key="type.id"
      class="chart-type-option"
      :class="{ 'chart-type-option--active': modelValue === type.id }"
      @click="$emit('update:modelValue', type.id)"
    >
      <component :is="type.icon" class="chart-type-option__icon" />
      <span class="chart-type-option__label">{{ type.label }}</span>
    </button>
  </div>
</template>

<script setup>
import { LineChart, BarChart, PieChart, DonutChart } from 'lucide-vue-next'

defineProps({ modelValue: String })
defineEmits(['update:modelValue'])

const chartTypes = [
  { id: 'line', label: 'Linha', icon: LineChart },
  { id: 'bar', label: 'Barra', icon: BarChart },
  { id: 'pie', label: 'Pizza', icon: PieChart },
  { id: 'donut', label: 'Donut', icon: DonutChart }
]
</script>
```

---

#### 3.2.2 Opções de Comparação

**Objetivo**: Adicionar linhas de comparação (carteiras, índices, grupos).

**Comparações Disponíveis**:
| Tipo | Fonte | Exemplos |
|------|-------|----------|
| Carteiras | API do usuário | "Carteira Aposentadoria" |
| Índices | Constante | CDI, IBOV, IPCA, S&P 500 |
| Grupos | Tipos de ativos | Ações BR, FIIs, Cripto |

**Endpoint Backend**:
```
GET /api/charts/comparison-data
  ?walletIds[]=uuid1&walletIds[]=uuid2
  &indices[]=CDI&indices[]=IBOV
  &groups[]=ACOES_BR&groups[]=FIIS
  &startDate=2025-01-01
  &endDate=2026-03-27
  &baseCurrency=BRL
```

**Resposta Normalizada**:
```json
{
  "series": [
    {
      "id": "wallet-main",
      "label": "Minha Carteira",
      "data": [{ "date": "2025-01-01", "value": 100.0 }, ...]
    },
    {
      "id": "index-cdi",
      "label": "CDI",
      "data": [{ "date": "2025-01-01", "value": 100.0 }, ...]
    }
  ],
  "baseValue": 100
}
```

---

#### 3.2.3 Customização de Cores

**Objetivo**: Personalizar cores das séries.

**Paleta Padrão (12 cores WCAG AA)**:
```javascript
// constants/chart-palette.js
export const chartPalette = [
  '#3b82f6', // Azul
  '#10b981', // Verde
  '#f59e0b', // Amarelo
  '#8b5cf6', // Roxo
  '#ec4899', // Rosa
  '#06b6d4', // Ciano
  '#f97316', // Laranja
  '#84cc16', // Lima
  '#6366f1', // Índigo
  '#14b8a6', // Teal
  '#a855f7', // Violeta
  '#64748b'  // Cinza
]

// Função para próxima cor disponível
export function getNextColor(usedColors = []) {
  const available = chartPalette.filter(c => !usedColors.includes(c))
  return available[0] || chartPalette[usedColors.length % chartPalette.length]
}
```

---

#### 3.2.4 Salvar Configuração de Gráfico

**Objetivo**: Persistir configurações por carteira.

**Modelo Backend**:
```javascript
// backend/src/app/chart-config/chart-config-model.js
const chartConfigSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  userId: { type: String, required: true },
  walletId: { type: String, required: true },
  chartType: { 
    type: String, 
    enum: ['line', 'bar', 'pie', 'donut'], 
    default: 'line' 
  },
  comparisons: {
    walletIds: [String],
    indices: [String],
    groups: [String]
  },
  colors: { type: Map, of: String },  // seriesId → hex color
  gridPosition: {
    x: Number,
    y: Number,
    w: Number,
    h: Number
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false })

// Índice composto
chartConfigSchema.index({ userId: 1, walletId: 1 })
```

---

### EP25 - Auditoria e Consistência

#### 3.3.1 Modelo e Middleware de Audit Log

**Objetivo**: Registrar todas as alterações automaticamente.

**Modelo AuditLog**:
```javascript
// backend/src/app/audit/audit-log-model.js
const auditLogSchema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  userId: { type: String, required: true, index: true },
  entityType: { 
    type: String, 
    required: true, 
    enum: ['transaction', 'wallet', 'asset', 'dividend', 'chart-config'] 
  },
  entityId: { type: String, required: true, index: true },
  action: { 
    type: String, 
    required: true, 
    enum: ['CREATE', 'UPDATE', 'DELETE', 'RESTORE'] 
  },
  previousData: { type: mongoose.Schema.Types.Mixed, default: null },
  newData: { type: mongoose.Schema.Types.Mixed, default: null },
  metadata: {
    ip: String,
    userAgent: String
  },
  timestamp: { type: Date, required: true, default: Date.now }
}, { versionKey: false })

// Índices
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 })
auditLogSchema.index({ userId: 1, timestamp: -1 })

// Impedir edição/exclusão
auditLogSchema.pre('updateOne', function() { 
  throw new Error('Audit logs are immutable') 
})
auditLogSchema.pre('deleteOne', function() { 
  throw new Error('Audit logs cannot be deleted') 
})
```

**Middleware de Auditoria**:
```javascript
// backend/src/app/audit/audit-middleware.js
class AuditMiddleware {
  constructor(auditLogDAO) {
    this.auditLogDAO = auditLogDAO
  }

  wrapDAO(dao, entityType) {
    const originalCreate = dao.create.bind(dao)
    const originalUpdate = dao.update.bind(dao)
    const originalDelete = dao.delete.bind(dao)

    // Intercepta create
    dao.create = async (data, userId, metadata) => {
      const result = await originalCreate(data)
      this.logAsync({
        userId,
        entityType,
        entityId: result._id,
        action: 'CREATE',
        previousData: null,
        newData: result,
        metadata
      })
      return result
    }

    // Intercepta update
    dao.update = async (id, data, userId, metadata) => {
      const previous = await dao.findById(id)
      const result = await originalUpdate(id, data)
      this.logAsync({
        userId,
        entityType,
        entityId: id,
        action: 'UPDATE',
        previousData: previous,
        newData: result,
        metadata
      })
      return result
    }

    // Intercepta delete
    dao.delete = async (id, userId, metadata) => {
      const previous = await dao.findById(id)
      await originalDelete(id)
      this.logAsync({
        userId,
        entityType,
        entityId: id,
        action: 'DELETE',
        previousData: previous,
        newData: null,
        metadata
      })
    }

    return dao
  }

  // Log assíncrono (fire-and-forget)
  async logAsync(logData) {
    try {
      await this.auditLogDAO.create(logData)
    } catch (error) {
      // Log do erro, mas não falha a operação principal
      logger.error('Failed to create audit log', error)
    }
  }
}
```

---

#### 3.3.2 Soft Delete em Todas as Entidades

**Objetivo**: Marcar como inativo em vez de remover.

**Plugin Mongoose**:
```javascript
// backend/src/plugins/soft-delete-plugin.js
const softDeletePlugin = (schema) => {
  // Adicionar campos
  schema.add({
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null }
  })

  // Sobrescrever deleteOne
  schema.pre('deleteOne', async function() {
    const doc = await this.model.findOne(this.getFilter())
    if (doc) {
      doc.deletedAt = new Date()
      doc.deletedBy = this.options.userId
      await doc.save()
    }
    this.skip = true // Cancela o delete real
  })

  // Filtro automático em find
  schema.pre(/^find/, function() {
    if (this.getOptions().includeDeleted !== true) {
      this.where({ deletedAt: null })
    }
  })

  // Método para restaurar
  schema.methods.restore = async function(userId) {
    this.deletedAt = null
    this.deletedBy = null
    return this.save()
  }

  // Método estático para buscar com excluídos
  schema.statics.findWithDeleted = function() {
    return this.find({}).setOptions({ includeDeleted: true })
  }
}

module.exports = softDeletePlugin
```

**Aplicação nos Modelos**:
```javascript
// backend/src/app/transaction/transaction-model.js
const softDeletePlugin = require('../../plugins/soft-delete-plugin')

const transactionSchema = new mongoose.Schema({
  // ... campos existentes
})

transactionSchema.plugin(softDeletePlugin)
```

---

#### 3.3.3 Histórico de Alterações por Transação (Frontend)

**Objetivo**: Visualizar timeline de alterações.

**Componente ChangeHistoryTimeline**:
```vue
<!-- components/audit/ChangeHistoryTimeline.vue -->
<template>
  <div class="change-history">
    <div v-if="loading" class="change-history__loading">
      <SkeletonLoader variant="text" :lines="3" />
    </div>
    
    <div v-else-if="entries.length === 0" class="change-history__empty">
      <p>Nenhum histórico disponível</p>
    </div>
    
    <div v-else class="change-history__timeline">
      <AuditEntry
        v-for="entry in entries"
        :key="entry._id"
        :entry="entry"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { auditService } from '@/services/audit-service'

const props = defineProps({
  entityType: { type: String, required: true },
  entityId: { type: String, required: true }
})

const loading = ref(true)
const entries = ref([])

onMounted(async () => {
  try {
    const response = await auditService.getHistory({
      entityType: props.entityType,
      entityId: props.entityId
    })
    entries.value = response.data
  } finally {
    loading.value = false
  }
})
</script>
```

**Componente DiffViewer**:
```vue
<!-- components/audit/DiffViewer.vue -->
<template>
  <div class="diff-viewer">
    <div
      v-for="field in changedFields"
      :key="field.name"
      class="diff-field"
    >
      <span class="diff-field__name">{{ field.label }}</span>
      <span class="diff-field__old">{{ formatValue(field.old) }}</span>
      <span class="diff-field__arrow">→</span>
      <span class="diff-field__new">{{ formatValue(field.new) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  previousData: { type: Object, default: null },
  newData: { type: Object, default: null }
})

const changedFields = computed(() => {
  if (!props.previousData || !props.newData) return []
  
  const fields = []
  const allKeys = new Set([
    ...Object.keys(props.previousData),
    ...Object.keys(props.newData)
  ])
  
  for (const key of allKeys) {
    if (props.previousData[key] !== props.newData[key]) {
      fields.push({
        name: key,
        label: fieldLabels[key] || key,
        old: props.previousData[key],
        new: props.newData[key]
      })
    }
  }
  
  return fields
})
</script>
```

---

#### 3.3.4 Restauração de Itens Excluídos (Frontend)

**Objetivo**: Permitir recuperar itens da lixeira.

**Página TrashBin**:
```vue
<!-- components/audit/TrashBin.vue -->
<template>
  <div class="trash-bin">
    <h1>Lixeira</h1>
    
    <div v-if="loading" class="trash-bin__loading">
      <SkeletonLoader variant="card" :lines="5" />
    </div>
    
    <EmptyState
      v-else-if="items.length === 0"
      illustration="/illustrations/empty-trash.svg"
      title="Lixeira vazia"
      description="Nenhum item excluído"
    />
    
    <div v-else class="trash-bin__list">
      <div
        v-for="item in items"
        :key="item._id"
        class="trash-item"
      >
        <div class="trash-item__info">
          <span class="trash-item__type">{{ item.entityType }}</span>
          <span class="trash-item__date">{{ formatDate(item.deletedAt) }}</span>
        </div>
        <button class="btn btn-secondary" @click="restore(item)">
          Restaurar
        </button>
      </div>
    </div>
  </div>
</template>
```

---

### EP26 - Performance

#### 3.4.1 Lazy Loading e Bundle Splitting

**Objetivo**: Bundle inicial < 200KB gzipped.

**Configuração Vite**:
```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk
          'vendor': ['vue', 'vue-router', 'pinia'],
          // Charts chunk (pesado)
          'charts': ['chart.js', 'vue-chartjs'],
          // Grid layout chunk
          'grid': ['vue-grid-layout'],
          // Table chunk
          'table': ['@tanstack/vue-table']
        }
      }
    },
    chunkSizeWarningLimit: 500
  }
})
```

**Lazy Loading de Componentes Pesados**:
```javascript
// components/charts/PerformanceChart.vue
import { defineAsyncComponent } from 'vue'

export default {
  components: {
    Chart: defineAsyncComponent(() => 
      import('chart.js').then(() => import('./ChartImpl.vue'))
    )
  }
}
```

---

#### 3.4.2 Virtual Scrolling para Listas Grandes

**Objetivo**: 60fps com 5000+ itens.

**Implementação**:
```vue
<!-- components/common/VirtualList.vue -->
<template>
  <div ref="container" class="virtual-list" @scroll="onScroll">
    <div class="virtual-list__spacer" :style="{ height: totalHeight + 'px' }">
      <div
        class="virtual-list__content"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div
          v-for="item in visibleItems"
          :key="item.id"
          class="virtual-list__item"
        >
          <slot :item="item" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  items: { type: Array, required: true },
  itemHeight: { type: Number, default: 48 },
  buffer: { type: Number, default: 5 }
})

const container = ref(null)
const scrollTop = ref(0)
const containerHeight = ref(0)

const totalHeight = computed(() => props.items.length * props.itemHeight)

const visibleRange = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.buffer)
  const end = Math.min(
    props.items.length,
    Math.ceil((scrollTop.value + containerHeight.value) / props.itemHeight) + props.buffer
  )
  return { start, end }
})

const visibleItems = computed(() => 
  props.items.slice(visibleRange.value.start, visibleRange.value.end)
)

const offsetY = computed(() => visibleRange.value.start * props.itemHeight)

const onScroll = () => {
  scrollTop.value = container.value.scrollTop
}

onMounted(() => {
  containerHeight.value = container.value.clientHeight
})
</script>
```

---

#### 3.4.3 Estratégia de Cache Redis (Backend)

**Objetivo**: Reduzir latência e carga no MongoDB.

**CacheManager**:
```javascript
// backend/src/cache/cache-manager.js
class CacheManager {
  constructor(redisClient) {
    this.redis = redisClient
  }

  async get(key) {
    const cached = await this.redis.get(key)
    return cached ? JSON.parse(cached) : null
  }

  async set(key, value, ttlSeconds) {
    await this.redis.setex(key, ttlSeconds, JSON.stringify(value))
  }

  async invalidate(pattern) {
    const keys = await this.redis.keys(pattern)
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
  }

  async getOrSet(key, fetchFn, ttlSeconds) {
    const cached = await this.get(key)
    if (cached) {
      return { data: cached, source: 'cache' }
    }
    
    const data = await fetchFn()
    await this.set(key, data, ttlSeconds)
    return { data, source: 'database' }
  }
}
```

**TTLs por Tipo de Dado**:
| Tipo | TTL | Chave |
|------|-----|-------|
| Cotações ações BR | 5 min | `price:PETR4` |
| Cotações cripto | 1 min | `price:BTC` |
| Índices (CDI, IPCA) | 24h | `index:CDI:2026-03-27` |
| Dashboard agregado | 10 min | `dashboard:{userId}:{walletId}` |
| Dados de câmbio | 30 min | `fx:USD-BRL` |

---

#### 3.4.4 Indexação e Otimização de Queries

**Objetivo**: Queries < 100ms com 100k documentos.

**Índices MongoDB**:
```javascript
// backend/src/scripts/create-indexes.js

// Transactions
db.transactions.createIndex({ userId: 1, walletId: 1, date: -1 })
db.transactions.createIndex({ userId: 1, walletId: 1, assetType: 1 })
db.transactions.createIndex({ userId: 1, ticker: 1 })
db.transactions.createIndex({ deletedAt: 1 }, { partialFilterExpression: { deletedAt: null } })

// Wallets
db.wallets.createIndex({ userId: 1, deletedAt: 1 })

// AuditLog
db.auditlogs.createIndex({ entityType: 1, entityId: 1, timestamp: -1 })
db.auditlogs.createIndex({ userId: 1, timestamp: -1 })

// ChartConfig
db.chartconfigs.createIndex({ userId: 1, walletId: 1 })

// Dividends
db.dividends.createIndex({ userId: 1, walletId: 1, paymentDate: -1 })
```

**Mixin de Paginação**:
```javascript
// backend/src/common/pagination-mixin.js
class PaginationMixin {
  static parsePagination(query) {
    const page = Math.max(1, parseInt(query.page) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(query.limit) || 50))
    const skip = (page - 1) * limit
    return { page, limit, skip }
  }

  static formatResponse(data, total, { page, limit }) {
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  }
}
```

---

### EP27 - Segurança Frontend

#### 3.5.1 Isolamento de Dados por Usuário (JWT Context)

**Objetivo**: userId sempre do JWT, nunca do frontend.

**Middleware de Autenticação**:
```javascript
// backend/src/middleware/auth-middleware.js
const jwt = require('jsonwebtoken')

const authMiddleware = (req, res, next) => {
  try {
    const token = req.cookies.accessToken
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    // userId vem EXCLUSIVAMENTE do JWT
    req.userId = decoded.userId
    req.userDomain = decoded.domain
    
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired', 
        code: 'TOKEN_EXPIRED' 
      })
    }
    return res.status(401).json({ error: 'Unauthorized' })
  }
}
```

**SecureDAO**:
```javascript
// backend/src/common/secure-dao.js
class SecureDAO extends AppDAO {
  find(query, userId) {
    return this.objectModel
      .find({ ...query, userId, deletedAt: null })
      .lean()
      .exec()
  }

  findOne(query, userId) {
    return this.objectModel
      .findOne({ ...query, userId, deletedAt: null })
      .lean()
      .exec()
  }

  findById(id, userId) {
    return this.objectModel
      .findOne({ _id: id, userId, deletedAt: null })
      .lean()
      .exec()
  }

  update(id, data, userId) {
    return this.objectModel
      .findOneAndUpdate(
        { _id: id, userId, deletedAt: null },
        data,
        { new: true }
      )
      .lean()
      .exec()
  }

  delete(id, userId) {
    return this.objectModel
      .findOneAndUpdate(
        { _id: id, userId, deletedAt: null },
        { deletedAt: new Date(), deletedBy: userId },
        { new: true }
      )
      .lean()
      .exec()
  }
}
```

---

#### 3.5.2 Prevenção de XSS e Sanitização de Input

**Objetivo**: Prevenir injeção de scripts maliciosos.

**Headers de Segurança (Helmet)**:
```javascript
// backend/src/middleware/security-headers.js
const helmet = require('helmet')

app.use(helmet())
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: [
      "'self'",
      'https://api.brapi.dev',
      'https://query1.finance.yahoo.com'
    ],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"]
  }
}))
```

**Middleware de Sanitização**:
```javascript
// backend/src/middleware/input-sanitizer.js
const mongoSanitize = require('express-mongo-sanitize')
const xss = require('xss-clean')

app.use(mongoSanitize())  // Previne NoSQL injection
app.use(xss())            // Sanitiza input contra XSS
```

**DOMPurify no Frontend**:
```javascript
// src/utils/sanitize.js
import DOMPurify from 'dompurify'

export function sanitizeHTML(dirty) {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  })
}
```

---

#### 3.5.3 Proteção CSRF e Armazenamento Seguro de Tokens

**Objetivo**: Proteger contra CSRF e armazenar tokens de forma segura.

**Configuração de Cookies**:
```javascript
// backend/src/app/auth/auth-router.js
// Login
res.cookie('accessToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000,  // 15 minutos
  path: '/'
})

res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 dias
  path: '/api/auth/refresh'
})

// Logout
res.clearCookie('accessToken')
res.clearCookie('refreshToken')
```

**CSRF Protection**:
```javascript
// backend/src/middleware/csrf-middleware.js
const csrf = require('csurf')

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
})

// Endpoint para obter CSRF token
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() })
})

// Aplicar em rotas que modificam dados
app.post('/api/*', csrfProtection)
app.put('/api/*', csrfProtection)
app.delete('/api/*', csrfProtection)
```

**CORS Configuration**:
```javascript
// backend/src/middleware/cors-config.js
const cors = require('cors')

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token']
}))
```

---

### EP28 - Responsividade

#### 3.6.1 Layout Mobile-First e Sistema de Breakpoints

**Objetivo**: Adaptação fluida entre dispositivos.

**Variáveis CSS**:
```css
/* styles/breakpoints.css */
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}

/* Mobile-first: estilos base são mobile */
.container {
  padding: 16px;
  font-size: 14px;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    padding: 24px;
    font-size: 15px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    padding: 32px;
    font-size: 16px;
  }
}
```

**Hook useBreakpoint**:
```javascript
// composables/useBreakpoint.js
import { ref, onMounted, onUnmounted } from 'vue'

export function useBreakpoint() {
  const isMobile = ref(false)
  const isTablet = ref(false)
  const isDesktop = ref(false)
  const breakpoint = ref('mobile')

  const checkBreakpoint = () => {
    const width = window.innerWidth
    
    isMobile.value = width < 768
    isTablet.value = width >= 768 && width < 1024
    isDesktop.value = width >= 1024
    
    if (width < 768) breakpoint.value = 'mobile'
    else if (width < 1024) breakpoint.value = 'tablet'
    else breakpoint.value = 'desktop'
  }

  onMounted(() => {
    checkBreakpoint()
    window.addEventListener('resize', checkBreakpoint)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', checkBreakpoint)
  })

  return { isMobile, isTablet, isDesktop, breakpoint }
}
```

---

#### 3.6.2 Sidebar Responsiva

**Objetivo**: Sidebar overlay em mobile, fixa em desktop.

**Estados da Sidebar**:
| Viewport | Estado | Comportamento |
|----------|--------|---------------|
| Mobile (< 768px) | `hidden` | Oculta, abre como overlay |
| Tablet (768-1024px) | `collapsed` | Apenas ícones, 64px |
| Desktop (> 1024px) | `expanded` | Ícones + labels, 260px |

**Transições**:
```css
/* Sidebar mobile overlay */
.sidebar--mobile {
  position: fixed;
  top: 0;
  left: 0;
  width: 260px;
  height: 100vh;
  z-index: 50;
  transform: translateX(-100%);
  transition: transform 300ms ease;
}

.sidebar--mobile.open {
  transform: translateX(0);
}

/* Backdrop */
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 40;
  opacity: 0;
  transition: opacity 300ms ease;
}

.sidebar-backdrop.visible {
  opacity: 1;
}
```

---

#### 3.6.3 Interações Touch-Friendly

**Objetivo**: Otimizar para dispositivos touch.

**Touch Targets (44x44px mínimo)**:
```css
/* styles/touch.css */
.btn,
.link,
.checkbox,
.radio,
.menu-item {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Espaçamento entre elementos touch */
.touch-group > * + * {
  margin-left: 8px;
}
```

**Swipe Actions**:
```vue
<!-- components/touch/SwipeActions.vue -->
<template>
  <div
    ref="container"
    class="swipe-actions"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div
      class="swipe-actions__content"
      :style="{ transform: `translateX(${translateX}px)` }"
    >
      <slot />
    </div>
    
    <div class="swipe-actions__actions">
      <button
        v-for="action in actions"
        :key="action.label"
        :class="`swipe-action swipe-action--${action.color}`"
        @click="action.handler"
      >
        <component :is="action.icon" />
        {{ action.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  actions: {
    type: Array,
    default: () => [
      { label: 'Editar', color: 'blue', icon: 'Edit', handler: () => {} },
      { label: 'Excluir', color: 'red', icon: 'Trash', handler: () => {} }
    ]
  }
})

const container = ref(null)
const translateX = ref(0)
const startX = ref(0)
const isDragging = ref(false)

const onTouchStart = (e) => {
  startX.value = e.touches[0].clientX
  isDragging.value = true
}

const onTouchMove = (e) => {
  if (!isDragging.value) return
  
  const currentX = e.touches[0].clientX
  const diff = startX.value - currentX
  
  // Swipe left only
  if (diff > 0) {
    translateX.value = Math.max(-150, -diff)
  }
}

const onTouchEnd = () => {
  isDragging.value = false
  
  // Snap to open or closed
  if (translateX.value < -75) {
    translateX.value = -150
  } else {
    translateX.value = 0
  }
}
</script>
```

**Eliminação de Sticky Hover**:
```css
/* Eliminar hover em touch devices */
@media (hover: none) {
  .btn:hover,
  .link:hover,
  .menu-item:hover {
    background: inherit;
  }
  
  /* Usar :active em vez de :hover */
  .btn:active {
    transform: scale(0.98);
  }
}
```

---

## 4. State Management (Adições)

### 4.1 Loading Store

```javascript
// store/loading.store.js
export const useLoadingStore = defineStore('loading', {
  state: () => ({
    isLoading: false,
    loadingCount: 0,
    progress: 0
  }),
  
  actions: {
    startLoading() {
      this.loadingCount++
      this.isLoading = true
    },
    
    stopLoading() {
      this.loadingCount = Math.max(0, this.loadingCount - 1)
      this.isLoading = this.loadingCount > 0
    },
    
    setProgress(value) {
      this.progress = value
    }
  }
})
```

### 4.2 Chart Config Store

```javascript
// store/chart-config.store.js
export const useChartConfigStore = defineStore('chartConfig', {
  state: () => ({
    configs: {},  // walletId -> config
    activeEditor: null
  }),
  
  getters: {
    getConfig: (state) => (walletId) => state.configs[walletId] || null
  },
  
  actions: {
    async loadConfig(walletId) {
      const config = await chartConfigService.get(walletId)
      this.configs[walletId] = config
    },
    
    async saveConfig(walletId, config) {
      await chartConfigService.save(walletId, config)
      this.configs[walletId] = config
    },
    
    openEditor(chartId) {
      this.activeEditor = chartId
    },
    
    closeEditor() {
      this.activeEditor = null
    }
  }
})
```

---

## 5. API Integration (Adições)

### 5.1 Audit Service

```javascript
// services/audit-service.js
import api from './api'

export const auditService = {
  getHistory(params) {
    return api.get('/audit-logs', { params })
  },
  
  getDeletedItems(params) {
    return api.get('/trash', { params })
  },
  
  restoreItem(entityType, entityId) {
    return api.patch(`/${entityType}/${entityId}/restore`)
  }
}
```

### 5.2 Chart Comparison Service

```javascript
// services/chart-comparison-service.js
import api from './api'

export const chartComparisonService = {
  getComparisonData(params) {
    return api.get('/charts/comparison-data', { params })
  }
}
```

### 5.3 Chart Config Service

```javascript
// services/chart-config-service.js
import api from './api'

export const chartConfigService = {
  get(walletId) {
    return api.get(`/chart-configs`, { params: { walletId } })
  },
  
  save(walletId, config) {
    return api.put(`/chart-configs/${config._id}`, config)
  },
  
  create(walletId, config) {
    return api.post(`/chart-configs`, { ...config, walletId })
  },
  
  delete(configId) {
    return api.delete(`/chart-configs/${configId}`)
  }
}
```

---

## 6. Bibliotecas e Dependências (Adições)

### 6.1 Novas Dependências Frontend

```json
{
  "dependencies": {
    "@use-gesture/vue": "^10.0.0",
    "dompurify": "^3.0.0",
    "nprogress": "^0.2.0"
  },
  "devDependencies": {
    "eslint-plugin-no-unsanitized": "^4.0.0"
  }
}
```

### 6.2 Novas Dependências Backend

```json
{
  "dependencies": {
    "helmet": "^7.1.0",
    "express-mongo-sanitize": "^2.2.0",
    "xss-clean": "^0.1.4",
    "csurf": "^1.11.0",
    "redis": "^4.6.0"
  }
}
```

---

## 7. Ordem de Implementação

### 7.1 Sprint N: Segurança (EP-27)

```
Semana 1:
├── STORY-2701: Isolamento de Dados por Usuário (JWT Context)
│   ├── Middleware JWT
│   ├── SecureDAO base
│   └── Testes de isolamento
│
├── STORY-2702: Prevenção XSS e Sanitização
│   ├── Helmet + CSP
│   ├── Input sanitizer
│   └── DOMPurify frontend
│
└── STORY-2703: Proteção CSRF e Token Storage
    ├── Cookies httpOnly
    ├── CSRF middleware
    └── CORS config
```

### 7.2 Sprint N+1: Auditoria (EP-25)

```
Semana 2:
├── STORY-2501: Modelo e Middleware de Audit Log
│   ├── Schema AuditLog
│   ├── AuditMiddleware
│   └── Imutabilidade
│
├── STORY-2502: Soft Delete em Todas as Entidades
│   ├── Plugin Mongoose
│   ├── Migration
│   └── Filtros automáticos
│
├── STORY-2503: Histórico de Alterações (Frontend)
│   ├── Timeline component
│   ├── DiffViewer
│   └── API integration
│
└── STORY-2504: Restauração de Itens Excluídos
    ├── TrashBin page
    ├── Restore endpoint
    └── Dependency check
```

### 7.3 Sprint N+2: Performance (EP-26)

```
Semana 3:
├── STORY-2604: Indexação e Otimização de Queries
│   ├── Criar índices
│   ├── Pagination mixin
│   └── Explain analysis
│
├── STORY-2603: Cache Redis
│   ├── CacheManager
│   ├── TTL config
│   └── Invalidation
│
├── STORY-2601: Lazy Loading e Bundle Splitting
│   ├── Route chunks
│   ├── Vendor split
│   └── Bundle analysis
│
└── STORY-2602: Virtual Scrolling
    ├── VirtualList component
    ├── Threshold auto
    └── Search integration
```

### 7.4 Sprint N+3: Feedback UX (EP-23)

```
Semana 4:
├── STORY-2301: Indicadores de Carregamento
│   ├── SkeletonLoader
│   ├── ButtonSpinner
│   ├── TopProgressBar
│   └── Loading interceptors
│
├── STORY-2302: Mensagens de Erro
│   ├── ToastNotification
│   ├── InlineError
│   ├── OfflineBanner
│   └── Error interceptors
│
├── STORY-2303: Confirmações de Sucesso
│   ├── Success toasts
│   ├── ConfirmModal
│   └── useConfirm hook
│
└── STORY-2304: Empty States
    ├── EmptyState component
    ├── Illustrations
    └── Per-section config
```

### 7.5 Sprint N+4: Responsividade (EP-28)

```
Semana 5:
├── STORY-2801: Layout Mobile-First e Breakpoints
│   ├── CSS variables
│   ├── useBreakpoint hook
│   ├── ResponsiveGrid
│   └── ResponsiveTable
│
├── STORY-2802: Sidebar Responsiva
│   ├── 3 estados
│   ├── Overlay animation
│   └── Swipe close
│
└── STORY-2803: Interações Touch-Friendly
    ├── Touch targets
    ├── SwipeActions
    ├── PullToRefresh
    └── No sticky hover
```

### 7.6 Sprint N+5: Editor de Gráficos (EP-24)

```
Semana 6:
├── STORY-2401: Seleção de Tipo de Gráfico
│   ├── ChartEditor
│   ├── ChartTypeSelector
│   └── Live preview
│
├── STORY-2402: Opções de Comparação
│   ├── ComparisonPanel
│   ├── Backend endpoint
│   └── Normalization
│
├── STORY-2403: Customização de Cores
│   ├── ColorPicker
│   ├── Palette
│   └── WCAG contrast
│
└── STORY-2404: Salvar Configuração
    ├── ChartConfig model
    ├── CRUD endpoints
    └── Per-wallet persistence
```

---

## 8. Riscos Técnicos

### 8.1 Matriz de Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Audit log impacta performance | Média | Médio | Log assíncrono, batch writes |
| Redis indisponível quebra sistema | Baixa | Alto | Graceful degradation, fallback MongoDB |
| CSRF token expira em SPAs longas | Média | Médio | Refresh token automático |
| Virtual scroll com itens de altura variável | Média | Médio | Altura fixa ou estimada |
| Cache invalidation complexa | Média | Médio | Tag-based invalidation |
| XSS bypass via edge cases | Baixa | Alto | Testes OWASP, CSP restritivo |
| Touch gestures conflitam com scroll | Média | Médio | Threshold configurável |
| Bundle splitting causa waterfalls | Baixa | Médio | Prefetch, preload hints |

### 8.2 Plano de Contingência

**Cenário 1: Audit log causa lentidão**
- Ação: Mover para fila assíncrona (Bull/Redis)
- Threshold: > 100ms de overhead
- Fallback: Log apenas em memória, flush periódico

**Cenário 2: Redis down**
- Ação: Bypass automático para MongoDB
- Monitoramento: Health check Redis
- Fallback: Cache desabilitado, X-Cache: BYPASS

**Cenário 3: CSRF token inválido**
- Ação: Refresh automático do token
- Fallback: Retry com novo token

---

## 9. Checklist de Implementação

### EP23 - Feedback UX
- [ ] SkeletonLoader com 4 variantes
- [ ] ButtonSpinner funcional
- [ ] TopProgressBar estilo NProgress
- [ ] Interceptor de loading (debounce 300ms)
- [ ] ToastNotification (error, warning, info, success)
- [ ] ToastContainer (max 3, empilhável)
- [ ] InlineError para formulários
- [ ] OfflineBanner persistente
- [ ] Mapa de erros PT-BR
- [ ] Interceptor de erros
- [ ] Toast de sucesso (5s)
- [ ] ConfirmModal reutilizável
- [ ] useConfirm hook
- [ ] EmptyState genérico
- [ ] Ilustrações por seção
- [ ] CTAs contextuais

### EP24 - Editor de Gráficos
- [ ] ChartEditor drawer/modal
- [ ] ChartTypeSelector visual
- [ ] Preview em tempo real
- [ ] Aviso para pizza com dados temporais
- [ ] ComparisonPanel
- [ ] Checkboxes carteiras/índices/grupos
- [ ] Legenda interativa (toggle)
- [ ] Normalização base 100
- [ ] Endpoint comparison-data
- [ ] ColorPicker
- [ ] Paleta 12 cores WCAG AA
- [ ] Input hex custom
- [ ] ChartConfig model
- [ ] CRUD endpoints
- [ ] Persistência por wallet

### EP25 - Auditoria
- [ ] AuditLog schema
- [ ] Middleware de auditoria
- [ ] Interceptação automática DAOs
- [ ] Log assíncrono
- [ ] Imutabilidade (pre hooks)
- [ ] Soft delete plugin
- [ ] Campos deletedAt/deletedBy
- [ ] Filtro automático
- [ ] Método restore
- [ ] Migration para docs existentes
- [ ] ChangeHistoryTimeline
- [ ] DiffViewer
- [ ] AuditEntry
- [ ] TrashBin page
- [ ] DeletedItemBadge
- [ ] RestoreModal
- [ ] Verificação de dependências

### EP26 - Performance
- [ ] Route-level code splitting
- [ ] Vendor chunk separado
- [ ] Charts chunk isolado
- [ ] Bundle < 200KB gzip
- [ ] Lighthouse >= 90
- [ ] VirtualList component
- [ ] 60fps com 5000 itens
- [ ] Auto-disable threshold
- [ ] Search integrado
- [ ] CacheManager Redis
- [ ] TTL por tipo de dado
- [ ] Tag-based invalidation
- [ ] Graceful degradation
- [ ] X-Cache header
- [ ] Índices MongoDB
- [ ] PaginationMixin
- [ ] Explain analysis

### EP27 - Segurança
- [ ] JWT middleware
- [ ] userId exclusivamente do JWT
- [ ] SecureDAO base
- [ ] 404 para dados de outro usuário
- [ ] Helmet configurado
- [ ] CSP headers
- [ ] Input sanitizer
- [ ] DOMPurify frontend
- [ ] NoSQL injection prevention
- [ ] Cookies httpOnly
- [ ] SameSite strict
- [ ] CSRF middleware
- [ ] CSRF token endpoint
- [ ] CORS configurado
- [ ] Token refresh

### EP28 - Responsividade
- [ ] Variáveis CSS breakpoints
- [ ] useBreakpoint hook
- [ ] Mobile-first CSS
- [ ] Transições fluidas
- [ ] Sidebar 3 estados
- [ ] Overlay animation
- [ ] Backdrop
- [ ] Swipe close
- [ ] ESC close
- [ ] Touch targets 44x44px
- [ ] Espaçamento 8px
- [ ] SwipeActions
- [ ] Long press select
- [ ] PullToRefresh
- [ ] No sticky hover
- [ ] Input types adequados
- [ ] scroll-margin-top

---

**Documento criado por**: @architect
**Data**: 2026-03-27
**Status**: Pronto para @tech-lead
