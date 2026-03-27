# Plano Técnico - Épicos 15-22 (Frontend UI)

> **Produto**: MoneyTrackr — Gestor de Investimentos
> **Escopo**: Interface de usuário, PWA, navegação, componentes visuais
> **Data de criação**: 2026-03-27
> **Autor**: @architect

---

## 1. Visão Geral da Arquitetura Frontend

### 1.1 Diagrama de Arquitetura de Componentes

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MONEYTRACKR FRONTEND                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                           APP ENTRY POINT                                 │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐   │   │
│  │  │   main.js   │───►│   App.vue   │───►│      <AppLayout>            │   │   │
│  │  │  (Vite)     │    │  (Root)     │    │  ┌─────────┬───────────────┐ │   │   │
│  │  └─────────────┘    └─────────────┘    │  │ Sidebar │   Content     │ │   │   │
│  │                                        │  │         │   Area        │ │   │   │
│  │                                        │  └─────────┴───────────────┘ │   │   │
│  │                                        └─────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                              LAYOUT LAYER                                 │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │   │
│  │  │ AppSidebar │  │ AppHeader  │  │ AppContent │  │   MobileSidebar    │  │   │
│  │  │            │  │            │  │            │  │     (Overlay)      │  │   │
│  │  │ - Menu     │  │ - Logo     │  │ - Router   │  │                    │  │   │
│  │  │ - Collapse │  │ - Theme    │  │   View     │  │ - Hamburger        │  │   │
│  │  │ - Active   │  │ - Profile  │  │            │  │ - Backdrop         │  │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                              PAGE LAYER                                   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │   │
│  │  │Dashboard │ │Transac-  │ │ Wallets  │ │ Imports  │ │ Registrations│    │   │
│  │  │  Page    │ │  tions   │ │   Page   │ │   Page   │ │     Page     │    │   │
│  │  │          │ │   Page   │ │          │ │          │ │              │    │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                           WIDGET LAYER (Dashboard)                        │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐    │   │
│  │  │ Patrimonio   │ │ Performance  │ │ Distribuição │ │ Últimas       │    │   │
│  │  │   Widget     │ │   Chart      │ │    Chart     │ │ Transações    │    │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                           COMPONENT LAYER                                 │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐             │   │
│  │  │  Charts    │ │  Tables    │ │  Forms     │ │  Modals    │             │   │
│  │  │ - Line     │ │ - DataGrid │ │ - Input    │ │ - Confirm  │             │   │
│  │  │ - Bar      │ │ - Paginate │ │ - Select   │ │ - Drawer   │             │   │
│  │  │ - Pie      │ │ - Sort     │ │ - DatePick │ │ - Toast    │             │   │
│  │  │ - Donut    │ │ - Filter   │ │ - Currency │ │ - Skeleton │             │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘             │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                           STATE MANAGEMENT                                │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐             │   │
│  │  │  AuthStore │ │WalletStore │ │ ChartStore │ │ ThemeStore │             │   │
│  │  │            │ │            │ │            │ │            │             │   │
│  │  │ - user     │ │ - active   │ │ - configs  │ │ - theme    │             │   │
│  │  │ - token    │ │ - list     │ │ - filters   │ │ - system   │             │   │
│  │  │ - session  │ │ - layout    │ │ - period    │ │ - persist  │             │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘             │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                           SERVICE LAYER                                   │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐             │   │
│  │  │  API       │ │  Offline   │ │  Chart     │ │  Theme     │             │   │
│  │  │  Client    │ │  Queue     │ │  Service   │ │  Service   │             │   │
│  │  │  (Axios)   │ │  (IndexedDB│ │            │ │            │             │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘             │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                           PWA LAYER                                       │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐             │   │
│  │  │  Service   │ │  Manifest  │ │  Cache     │ │  Offline   │             │   │
│  │  │  Worker    │ │  .json     │ │  Strategy  │ │  Fallback  │             │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘             │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Fluxo de Dados

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │────►│  Component  │────►│   Store     │────►│   API       │
│  Action     │     │  (Event)    │     │  (State)    │     │  Service    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │                   │                   │
                          │                   │                   │
                          ▼                   ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
                    │   Local     │     │  Composable │     │  Backend    │
                    │   State     │     │  (Logic)    │     │  API        │
                    └─────────────┘     └─────────────┘     └─────────────┘
```

---

## 2. Estrutura de Pastas

```
frontend/
├── public/
│   ├── icons/
│   │   ├── icon-72x72.png
│   │   ├── icon-96x96.png
│   │   ├── icon-128x128.png
│   │   ├── icon-144x144.png
│   │   ├── icon-152x152.png
│   │   ├── icon-192x192.png
│   │   ├── icon-384x384.png
│   │   ├── icon-512x512.png
│   │   ├── apple-touch-icon.png
│   │   └── maskable-icon-512x512.png
│   ├── favicon.ico
│   └── robots.txt
│
├── src/
│   ├── main.js                          # Entry point
│   ├── App.vue                          # Root component
│   │
│   ├── assets/
│   │   ├── brand/
│   │   │   └── logo.svg                 # Logo master
│   │   └── illustrations/
│   │       ├── 404-illustration.svg
│   │       ├── empty-wallet.svg
│   │       ├── empty-transactions.svg
│   │       ├── empty-chart.svg
│   │       └── empty-search.svg
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.vue            # Layout principal
│   │   │   ├── AppLayout.test.js
│   │   │   ├── AppSidebar.vue           # Sidebar container
│   │   │   ├── AppSidebar.test.js
│   │   │   ├── AppHeader.vue            # Header superior
│   │   │   ├── AppHeader.test.js
│   │   │   ├── AppContent.vue           # Área de conteúdo
│   │   │   ├── SidebarMenu.vue          # Lista de menu
│   │   │   ├── SidebarItem.vue          # Item individual
│   │   │   ├── SidebarItem.test.js
│   │   │   ├── SidebarToggle.vue        # Botão colapsar/expandir
│   │   │   ├── MobileSidebar.vue        # Sidebar mobile overlay
│   │   │   ├── MobileSidebar.test.js
│   │   │   ├── MobileBackdrop.vue       # Backdrop escuro
│   │   │   ├── HeaderLogo.vue           # Componente logo
│   │   │   ├── ThemeToggle.vue          # Toggle tema
│   │   │   ├── NotificationBell.vue     # Ícone notificações
│   │   │   ├── UserMenu.vue             # Menu dropdown usuário
│   │   │   └── UserMenu.test.js
│   │   │
│   │   ├── common/
│   │   │   ├── PageLoader.vue           # Loading para lazy loading
│   │   │   ├── ConfirmModal.vue         # Modal confirmação genérico
│   │   │   ├── ConfirmModal.test.js
│   │   │   ├── VirtualList.vue          # Wrapper virtual scrolling
│   │   │   ├── VirtualList.test.js
│   │   │   ├── ListSearch.vue           # Busca integrada
│   │   │   ├── ResponsiveGrid.vue       # Grid adaptável
│   │   │   ├── ResponsiveTable.vue       # Tabela → cards mobile
│   │   │   └── FloatingActionButton.vue  # FAB
│   │   │
│   │   ├── feedback/
│   │   │   ├── SkeletonLoader.vue       # Skeleton com variantes
│   │   │   ├── SkeletonLoader.test.js
│   │   │   ├── ButtonSpinner.vue        # Botão com spinner
│   │   │   ├── ButtonSpinner.test.js
│   │   │   ├── ToastNotification.vue    # Toast individual
│   │   │   ├── ToastContainer.vue       # Container toasts
│   │   │   ├── InlineError.vue          # Erro inline formulários
│   │   │   ├── OfflineBanner.vue        # Banner sem conexão
│   │   │   └── EmptyState.vue           # Empty state genérico
│   │   │
│   │   ├── dashboard/
│   │   │   ├── DashboardGrid.vue        # Container do grid
│   │   │   ├── DashboardGrid.test.js
│   │   │   ├── WidgetContainer.vue      # Wrapper de cada widget
│   │   │   ├── AddWidgetModal.vue       # Modal adicionar widget
│   │   │   ├── AddWidgetModal.test.js
│   │   │   ├── WidgetRemoveButton.vue   # Botão remover widget
│   │   │   └── widgets/
│   │   │       ├── PatrimonioWidget.vue
│   │   │       ├── PerformanceWidget.vue
│   │   │       ├── DistribuicaoWidget.vue
│   │   │       ├── UltimasTransacoesWidget.vue
│   │   │       └── ProventosWidget.vue
│   │   │
│   │   ├── charts/
│   │   │   ├── PerformanceChart.vue     # Gráfico performance
│   │   │   ├── PerformanceChart.test.js
│   │   │   ├── ChartTooltip.vue         # Tooltip customizado
│   │   │   ├── ChartLegend.vue          # Legenda customizada
│   │   │   ├── BenchmarkSelector.vue    # Seletor benchmarks
│   │   │   ├── BenchmarkSelector.test.js
│   │   │   ├── AssetClassFilter.vue     # Filtro classes
│   │   │   ├── AssetClassFilter.test.js
│   │   │   ├── StackedAreaChart.vue     # Gráfico empilhado
│   │   │   ├── DateRangeSelector.vue    # Seletor período
│   │   │   └── DateRangeSelector.test.js
│   │   │
│   │   ├── transactions/
│   │   │   ├── TransactionsTable.vue    # Tabela principal
│   │   │   ├── TransactionsTable.test.js
│   │   │   ├── TransactionRow.vue       # Linha tabela
│   │   │   ├── TransactionCard.vue      # Card mobile
│   │   │   ├── TransactionCard.test.js
│   │   │   ├── TransactionFilters.vue   # Barra filtros
│   │   │   ├── TransactionFilters.test.js
│   │   │   ├── TransactionFiltersDrawer.vue # Drawer mobile
│   │   │   ├── FilterDateRange.vue      # Filtro data
│   │   │   ├── FilterType.vue           # Filtro tipo
│   │   │   ├── FilterTicker.vue         # Filtro ticker
│   │   │   ├── FilterWallet.vue         # Filtro carteira
│   │   │   ├── Pagination.vue           # Controles paginação
│   │   │   ├── Pagination.test.js
│   │   │   └── SortableHeader.vue       # Cabeçalho ordenável
│   │   │
│   │   └── forms/
│   │       ├── TransactionForm.vue      # Formulário transação
│   │       ├── TransactionForm.test.js
│   │       ├── TransactionTypeSelect.vue
│   │       ├── TickerInput.vue          # Input autocomplete
│   │       ├── CurrencyInput.vue        # Input moeda
│   │       ├── DatePicker.vue           # Seletor data
│   │       ├── WalletSelect.vue         # Dropdown carteira
│   │       ├── FieldError.vue           # Erro inline
│   │       └── ValidatedInput.vue       # Input validado
│   │
│   ├── composables/
│   │   ├── useAuth.js                   # Hook autenticação
│   │   ├── useAuth.test.js
│   │   ├── useTheme.js                  # Hook tema
│   │   ├── useTheme.test.js
│   │   ├── useSidebar.js                # Estado sidebar
│   │   ├── useSidebar.test.js
│   │   ├── useOnlineStatus.js           # Estado online/offline
│   │   ├── useOnlineStatus.test.js
│   │   ├── useOfflineQueue.js           # Fila offline
│   │   ├── useOfflineQueue.test.js
│   │   ├── useBreakpoint.js             # Hook breakpoint reativo
│   │   ├── useBreakpoint.test.js
│   │   ├── useMediaQuery.js             # Hook media queries
│   │   ├── useDashboardLayout.js        # Gerenciar layout
│   │   ├── useTransactions.js           # Dados transações
│   │   ├── useTransactionFilters.js     # Estado filtros
│   │   ├── useTransactionForm.js        # Lógica formulário
│   │   ├── useTransactionForm.test.js
│   │   ├── useChartFilters.js           # Estado filtros gráfico
│   │   ├── useLoading.js                # Estado loading
│   │   ├── useLoading.test.js
│   │   ├── useToast.js                  # Toast notifications
│   │   ├── useToast.test.js
│   │   ├── useConfirm.js                # Modal confirmação
│   │   ├── useConfirm.test.js
│   │   ├── useVirtualList.js            # Virtual scrolling
│   │   ├── useVirtualList.test.js
│   │   └── useQueryParams.js             # Sincronizar URL
│   │
│   ├── pages/
│   │   ├── Dashboard.vue                # Página Dashboard
│   │   ├── Transactions.vue             # Página Transações
│   │   ├── Wallets.vue                  # Página Carteiras
│   │   ├── Imports.vue                  # Página Importação
│   │   ├── Registrations.vue            # Página Cadastros
│   │   ├── Settings.vue                 # Página Configurações
│   │   ├── NotFound.vue                 # Página 404
│   │   ├── NotFound.test.js
│   │   ├── EditTransaction.vue          # Página edição
│   │   └── OfflineFallback.vue          # Fallback offline
│   │
│   ├── router/
│   │   ├── index.js                     # Configuração router
│   │   ├── routes.js                    # Definição rotas
│   │   └── guards.js                    # Navigation guards
│   │
│   ├── store/
│   │   ├── index.js                     # Configuração store
│   │   ├── auth.store.js                # Store autenticação
│   │   ├── wallet.store.js              # Store carteiras
│   │   ├── chart.store.js               # Store gráficos
│   │   ├── theme.store.js               # Store tema
│   │   ├── transaction.store.js         # Store transações
│   │   └── dashboard.store.js           # Store dashboard
│   │
│   ├── services/
│   │   ├── api/
│   │   │   ├── index.js                  # Axios instance
│   │   │   ├── auth.service.js
│   │   │   ├── transaction.service.js
│   │   │   ├── wallet.service.js
│   │   │   ├── asset.service.js
│   │   │   ├── benchmark.service.js
│   │   │   └── dashboard.service.js
│   │   │
│   │   ├── offline-queue/
│   │   │   ├── index.js                 # Gerenciador fila
│   │   │   ├── indexeddb.js             # Wrapper IndexedDB
│   │   │   └── sync-manager.js          # Lógica sincronização
│   │   │
│   │   └── chart-config-service.js      # API config gráficos
│   │
│   ├── service-worker/
│   │   ├── index.js                     # Entry point SW
│   │   ├── strategies/
│   │   │   ├── api-cache.js             # Estratégia APIs
│   │   │   └── static-cache.js          # Estratégia assets
│   │   └── handlers/
│   │       └── sync-handler.js          # Background sync
│   │
│   ├── plugins/
│   │   ├── axios-loading-interceptor.js # Interceptor loading
│   │   ├── axios-error-interceptor.js   # Interceptor erros
│   │   └── axios-auth-interceptor.js    # Interceptor auth
│   │
│   ├── constants/
│   │   ├── app-constants.js             # Constantes gerais
│   │   ├── menu-items.js                # Config menu
│   │   ├── available-widgets.js         # Widgets disponíveis
│   │   ├── chart-types.js               # Tipos gráfico
│   │   ├── chart-palette.js             # Paleta cores
│   │   ├── error-messages.js            # Mensagens erro PT-BR
│   │   ├── success-messages.js          # Mensagens sucesso
│   │   └── validation-messages.js       # Mensagens validação
│   │
│   ├── utils/
│   │   ├── formatters.js                # Formatação valores
│   │   ├── chart-helpers.js             # Utilitários gráficos
│   │   ├── color-utils.js               # Utilitários cores
│   │   ├── color-utils.test.js
│   │   └── sanitize.js                  # Wrapper DOMPurify
│   │
│   └── styles/
│       ├── main.css                     # Estilos principais
│       ├── variables.css                # Variáveis CSS
│       ├── layout.css                   # Estilos layout
│       ├── themes/
│       │   ├── variables.css            # Variáveis cores
│       │   ├── light.css               # Override claro
│       │   └── dark.css                 # Override escuro
│       ├── breakpoints.css              # Variáveis breakpoints
│       ├── grid.css                     # Sistema grid
│       ├── typography.css               # Tipografia
│       └── touch.css                    # Touch targets
│
├── vite.config.js                       # Config Vite + PWA
├── tailwind.config.js                   # Config Tailwind
├── tsconfig.json                        # Config TypeScript
├── package.json
└── README.md
```

---

## 3. Componentes por Épico

### EP15 - PWA (Progressive Web App)

#### 3.1.1 Service Worker e Cache Strategy

**Objetivo**: Implementar PWA com funcionamento offline básico.

**Componentes Principais**:
| Componente | Descrição | Arquivo |
|------------|-----------|---------|
| `useOnlineStatus` | Hook para detectar estado de conexão | `composables/useOnlineStatus.js` |
| `OfflineFallback` | Página exibida quando offline em rota não cacheada | `pages/OfflineFallback.vue` |
| `OfflineBanner` | Indicador visual "Modo Offline" | `components/feedback/OfflineBanner.vue` |

**Estratégias de Cache**:
```javascript
// vite.config.js - Configuração PWA
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        runtimeCaching: [
          {
            // Cache-first para assets estáticos
            urlPattern: /\.(js|css|png|jpg|svg|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          },
          {
            // Network-first para APIs
            urlPattern: /\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 }
            }
          },
          {
            // Stale-while-revalidate para dados não críticos
            urlPattern: /\/api\/(benchmarks|market-data).*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'market-data-cache'
            }
          }
        ]
      }
    })
  ]
})
```

**Dependências**: Nenhuma (épico base)

---

#### 3.1.2 Manifest.json e Instalação PWA

**Objetivo**: Tornar a aplicação instalável como app nativo.

**Configuração**:
```javascript
// vite.config.js
VitePWA({
  manifest: {
    name: 'MoneyTrackr - Gestor de Investimentos',
    short_name: 'MoneyTrackr',
    description: 'Sistema de gestão de portfólio de investimentos',
    display: 'standalone',
    orientation: 'portrait-primary',
    start_url: '/',
    theme_color: '#3b82f6',
    background_color: '#ffffff',
    icons: [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }
})
```

**Meta Tags iOS**:
```html
<!-- index.html -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
```

---

#### 3.1.3 Background Sync e Offline Queue

**Objetivo**: Sincronizar ações offline automaticamente.

**Estrutura IndexedDB**:
```javascript
// services/offline-queue/indexeddb.js
import { openDB } from 'idb'

const DB_NAME = 'moneytrackr-offline'
const STORE_NAME = 'pendingActions'

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
  })
}

export const addPendingAction = async (action) => {
  const db = await initDB()
  return db.put(STORE_NAME, {
    id: crypto.randomUUID(),
    type: action.type, // 'CREATE_TRANSACTION' | 'UPDATE_TRANSACTION' | 'DELETE_TRANSACTION'
    payload: action.payload,
    timestamp: Date.now(),
    walletId: action.walletId
  })
}
```

**Componentes**:
| Componente | Descrição |
|------------|-----------|
| `useOfflineQueue` | Hook para gerenciar fila offline |
| `PendingActionsIndicator` | Badge no header com contador de pendências |
| `PendingActionsList` | Modal/lista de ações pendentes |

---

### EP16 - Layout Base

#### 3.2.1 Estrutura de Layout Principal

**Objetivo**: Criar layout consistente sidebar + conteúdo.

**Estrutura CSS Grid**:
```css
/* styles/layout.css */
.app-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  grid-template-rows: 64px 1fr;
  grid-template-areas:
    "sidebar header"
    "sidebar content";
  height: 100vh;
}

.app-layout--collapsed {
  grid-template-columns: 64px 1fr;
}

.app-layout--mobile {
  grid-template-columns: 1fr;
  grid-template-areas:
    "header"
    "content";
}

/* Breakpoints */
@media (max-width: 768px) {
  .app-layout {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 768px) and (max-width: 1024px) {
  .app-layout {
    grid-template-columns: 64px 1fr;
  }
}
```

**Componentes**:
| Componente | Responsabilidade |
|------------|-----------------|
| `AppLayout` | Container principal com grid |
| `AppSidebar` | Sidebar fixa à esquerda |
| `AppHeader` | Header superior com ações |
| `AppContent` | Área de conteúdo com scroll independente |

---

#### 3.2.2 Sistema de Temas (Light/Dark Mode)

**Objetivo**: Alternar entre tema claro e escuro.

**Variáveis CSS**:
```css
/* styles/themes/variables.css */
:root {
  /* Cores primárias */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-bg-tertiary: #e5e5e5;
  
  /* Texto */
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #666666;
  --color-text-muted: #999999;
  
  /* Acentuação */
  --color-accent: #3b82f6;
  --color-accent-hover: #2563eb;
  
  /* Status */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  
  /* Bordas */
  --color-border: #e5e5e5;
  --color-border-focus: #3b82f6;
  
  /* Gráficos */
  --chart-bg: #ffffff;
  --chart-grid: #e5e5e5;
  --chart-text: #666666;
}

[data-theme="dark"] {
  --color-bg-primary: #1a1a1a;
  --color-bg-secondary: #2d2d2d;
  --color-bg-tertiary: #3d3d3d;
  
  --color-text-primary: #ffffff;
  --color-text-secondary: #a0a0a0;
  --color-text-muted: #666666;
  
  --color-border: #3d3d3d;
  
  --chart-bg: #1a1a1a;
  --chart-grid: #3d3d3d;
  --chart-text: #a0a0a0;
}
```

**Hook useTheme**:
```javascript
// composables/useTheme.js
export function useTheme() {
  const theme = ref('light')
  
  const initTheme = () => {
    const saved = localStorage.getItem('moneytrackr-theme')
    if (saved) {
      theme.value = saved
    } else {
      // Detectar preferência do SO
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      theme.value = prefersDark ? 'dark' : 'light'
    }
    applyTheme()
  }
  
  const applyTheme = () => {
    document.documentElement.setAttribute('data-theme', theme.value)
  }
  
  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    localStorage.setItem('moneytrackr-theme', theme.value)
    applyTheme()
  }
  
  return { theme, initTheme, toggleTheme }
}
```

---

#### 3.2.3 Header Global

**Objetivo**: Header com navegação e ações rápidas.

**Componentes**:
| Componente | Descrição |
|------------|-----------|
| `HeaderLogo` | Logo com link para Dashboard |
| `ThemeToggle` | Botão alternar tema (sol/lua) |
| `NotificationBell` | Ícone de notificações com badge |
| `UserMenu` | Dropdown com perfil, configurações, logout |

**Estrutura**:
```vue
<!-- components/layout/AppHeader.vue -->
<template>
  <header class="app-header">
    <div class="header-left">
      <HamburgerButton v-if="isMobile" @click="toggleSidebar" />
      <HeaderLogo />
      <ThemeToggle />
    </div>
    
    <div class="header-right">
      <PendingActionsIndicator v-if="hasPendingActions" />
      <NotificationBell :count="notificationCount" />
      <UserMenu :user="currentUser" @logout="handleLogout" />
    </div>
  </header>
</template>
```

---

### EP17 - Navegação

#### 3.3.1 Roteamento SPA com Lazy Loading

**Objetivo**: Navegação client-side com carregamento sob demanda.

**Configuração Vue Router**:
```javascript
// router/routes.js
export const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/pages/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/transactions',
    name: 'Transactions',
    component: () => import('@/pages/Transactions.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/wallets',
    name: 'Wallets',
    component: () => import('@/pages/Wallets.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/imports',
    name: 'Imports',
    component: () => import('@/pages/Imports.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/registrations',
    name: 'Registrations',
    component: () => import('@/pages/Registrations.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/pages/Settings.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/Login.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/pages/NotFound.vue')
  }
]
```

**Suspense Fallback**:
```vue
<!-- App.vue -->
<template>
  <RouterView v-slot="{ Component }">
    <Suspense>
      <component :is="Component" />
      <template #fallback>
        <PageLoader />
      </template>
    </Suspense>
  </RouterView>
</template>
```

---

#### 3.3.2 Route Guards (Autenticação)

**Objetivo**: Proteger rotas e redirecionar não autenticados.

**Implementação**:
```javascript
// router/guards.js
import { useAuthStore } from '@/store/auth.store'

export function setupGuards(router) {
  router.beforeEach((to, from, next) => {
    const authStore = useAuthStore()
    
    // Rotas que requerem autenticação
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      })
      return
    }
    
    // Rotas apenas para guests (login, register)
    if (to.meta.guestOnly && authStore.isAuthenticated) {
      next({ path: '/' })
      return
    }
    
    // Token expirado
    if (authStore.isTokenExpired) {
      authStore.logout()
      next({
        path: '/login',
        query: { redirect: to.fullPath, expired: 'true' }
      })
      return
    }
    
    next()
  })
}
```

---

#### 3.3.3 Página 404 e Tratamento de Rotas

**Objetivo**: Página amigável para rotas inexistentes.

**Componente**:
```vue
<!-- pages/NotFound.vue -->
<template>
  <div class="not-found">
    <img src="@/assets/illustrations/404-illustration.svg" alt="Página não encontrada" />
    <h1>Página não encontrada</h1>
    <p>A página que você está procurando não existe ou foi movida.</p>
    <RouterLink to="/" class="btn btn-primary">
      Voltar ao Dashboard
    </RouterLink>
  </div>
</template>
```

---

### EP18 - Sidebar

#### 3.4.1 Menu de Navegação Principal

**Objetivo**: Menu lateral com acesso às seções principais.

**Configuração de Itens**:
```javascript
// constants/menu-items.js
import { LayoutDashboard, Receipt, Upload, Database, Wallet } from 'lucide-vue-next'

export const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    route: '/',
    matchExact: true
  },
  {
    id: 'transactions',
    label: 'Transações',
    icon: Receipt,
    route: '/transactions'
  },
  {
    id: 'imports',
    label: 'Importação',
    icon: Upload,
    route: '/imports'
  },
  {
    id: 'registrations',
    label: 'Cadastros',
    icon: Database,
    route: '/registrations'
  },
  {
    id: 'wallets',
    label: 'Carteiras',
    icon: Wallet,
    route: '/wallets'
  }
]
```

**Componente SidebarItem**:
```vue
<!-- components/layout/SidebarItem.vue -->
<template>
  <RouterLink
    :to="item.route"
    class="sidebar-item"
    :class="{ 'sidebar-item--active': isActive }"
  >
    <component :is="item.icon" class="sidebar-item__icon" />
    <span v-if="!collapsed" class="sidebar-item__label">{{ item.label }}</span>
    <Tooltip v-if="collapsed" :content="item.label" position="right">
      <span />
    </Tooltip>
  </RouterLink>
</template>

<script setup>
import { useRoute } from 'vue-router'

const props = defineProps({
  item: { type: Object, required: true },
  collapsed: { type: Boolean, default: false }
})

const route = useRoute()
const isActive = computed(() => {
  return props.item.matchExact
    ? route.path === props.item.route
    : route.path.startsWith(props.item.route)
})
</script>
```

---

#### 3.4.2 Sidebar Colapsável (Modo Ícones)

**Objetivo**: Permitir colapsar sidebar para mais espaço.

**Hook useSidebar**:
```javascript
// composables/useSidebar.js
export function useSidebar() {
  const collapsed = ref(false)
  const mobileOpen = ref(false)
  
  // Carregar estado salvo
  onMounted(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved !== null) {
      collapsed.value = saved === 'true'
    }
  })
  
  const toggle = () => {
    collapsed.value = !collapsed.value
    localStorage.setItem('sidebar-collapsed', collapsed.value)
  }
  
  const toggleMobile = () => {
    mobileOpen.value = !mobileOpen.value
  }
  
  const closeMobile = () => {
    mobileOpen.value = false
  }
  
  return {
    collapsed: readonly(collapsed),
    mobileOpen: readonly(mobileOpen),
    toggle,
    toggleMobile,
    closeMobile
  }
}
```

---

#### 3.4.3 Sidebar Mobile (Overlay)

**Objetivo**: Sidebar como overlay em dispositivos móveis.

**Componente MobileSidebar**:
```vue
<!-- components/layout/MobileSidebar.vue -->
<template>
  <Teleport to="body">
    <Transition name="fade">
      <MobileBackdrop v-if="isOpen" @click="close" />
    </Transition>
    
    <Transition name="slide">
      <aside v-if="isOpen" class="mobile-sidebar">
        <SidebarMenu :collapsed="false" @navigate="close" />
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mobile-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 260px;
  height: 100vh;
  z-index: 50;
  background: var(--color-bg-primary);
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 300ms ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
</style>
```

---

### EP19 - Dashboard

#### 3.5.1 Grid de Widgets com Drag & Drop

**Objetivo**: Dashboard personalizável com widgets arrastáveis.

**Configuração vue-grid-layout**:
```vue
<!-- components/dashboard/DashboardGrid.vue -->
<template>
  <GridLayout
    v-model:layout="layout"
    :col-num="12"
    :row-height="80"
    :margin="[16, 16]"
    :is-draggable="!isMobile"
    :is-resizable="!isMobile"
    :responsive="true"
    @layout-updated="onLayoutUpdate"
  >
    <GridItem
      v-for="item in layout"
      :key="item.i"
      :x="item.x"
      :y="item.y"
      :w="item.w"
      :h="item.h"
      :i="item.i"
    >
      <WidgetContainer :id="item.i" @remove="removeWidget" />
    </GridItem>
  </GridLayout>
</template>

<script setup>
import { GridLayout, GridItem } from 'vue-grid-layout'

const layout = ref([
  { i: 'patrimonio', x: 0, y: 0, w: 4, h: 2 },
  { i: 'performance', x: 4, y: 0, w: 8, h: 4 },
  { i: 'distribuicao', x: 0, y: 2, w: 4, h: 3 },
  { i: 'ultimas-transacoes', x: 0, y: 5, w: 6, h: 3 },
  { i: 'proventos', x: 6, y: 5, w: 6, h: 3 }
])

const onLayoutUpdate = debounce((newLayout) => {
  saveLayout(newLayout)
}, 500)
</script>
```

---

#### 3.5.2 Adicionar e Remover Widgets

**Objetivo**: Permitir personalização de widgets.

**Modal de Adição**:
```vue
<!-- components/dashboard/AddWidgetModal.vue -->
<template>
  <Modal v-model="isOpen" title="Adicionar Widget">
    <div class="widget-list">
      <div
        v-for="widget in availableWidgets"
        :key="widget.id"
        class="widget-option"
        @click="addWidget(widget)"
      >
        <component :is="widget.icon" />
        <span>{{ widget.name }}</span>
      </div>
    </div>
  </Modal>
</template>
```

---

#### 3.5.3 Persistência de Layout por Carteira

**Objetivo**: Salvar layout específico por carteira.

**Estrutura de Dados**:
```javascript
// Estrutura do layout salvo
{
  walletId: 'uuid',
  layout: [
    { i: 'widget-id', x: 0, y: 0, w: 4, h: 2 }
  ],
  activeWidgets: ['patrimonio', 'performance', 'distribuicao'],
  updatedAt: '2026-03-27T10:00:00Z'
}
```

**API**:
- `GET /api/wallets/:id/dashboard-layout`
- `PUT /api/wallets/:id/dashboard-layout`

---

### EP20 - Gráficos

#### 3.6.1 Gráfico de Performance do Portfolio

**Objetivo**: Visualizar evolução do patrimônio.

**Configuração Chart.js**:
```javascript
// components/charts/PerformanceChart.vue
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
)

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index'
  },
  plugins: {
    tooltip: {
      callbacks: {
        label: (context) => {
          return formatCurrency(context.parsed.y)
        }
      }
    }
  },
  scales: {
    x: {
      grid: { color: 'var(--chart-grid)' }
    },
    y: {
      grid: { color: 'var(--chart-grid)' },
      ticks: {
        callback: (value) => formatCurrency(value)
      }
    }
  }
}
```

---

#### 3.6.2 Benchmarks (CDI, IBOV)

**Objetivo**: Comparar performance com indicadores.

**Cores por Benchmark**:
| Benchmark | Cor | Estilo |
|-----------|-----|--------|
| Portfolio | #3b82f6 (azul) | Linha sólida |
| CDI | #10b981 (verde) | Linha tracejada |
| IBOV | #f59e0b (laranja) | Linha tracejada |
| IPCA | #8b5cf6 (roxo) | Linha tracejada |

---

#### 3.6.3 Grupos de Ativos

**Objetivo**: Visualizar performance por classe.

**Cores por Classe**:
| Classe | Cor |
|--------|-----|
| Ações | #3b82f6 (azul) |
| FIIs | #10b981 (verde) |
| Renda Fixa | #f59e0b (amarelo) |
| Cripto | #8b5cf6 (roxo) |
| ETFs | #ec4899 (rosa) |
| Outros | #6b7280 (cinza) |

---

#### 3.6.4 Seletor de Período

**Objetivo**: Selecionar intervalo de análise.

**Períodos Rápidos**:
| Botão | Período |
|-------|---------|
| 1M | Último mês |
| 3M | Últimos 3 meses |
| 6M | Últimos 6 meses |
| 1A | Último ano |
| Tudo | Todo histórico |

---

### EP21 - Transações UI

#### 3.7.1 Tabela de Transações com Paginação

**Objetivo**: Listar transações com paginação server-side.

**Colunas**:
| Coluna | Formato | Ordenável |
|--------|---------|-----------|
| Data | DD/MM/YYYY | Sim |
| Tipo | Badge colorido | Sim |
| Ticker | Texto + link | Sim |
| Quantidade | Número decimal | Sim |
| Preço Unit. | R$ #.###,## | Sim |
| Total | R$ #.###,## | Sim |
| Carteira | Badge | Sim |
| Ações | Botões | Não |

**Paginação**:
- Default: 25 itens por página
- Máximo: 200 itens por página
- Controles: Primeira, Anterior, Páginas, Próxima, Última

---

#### 3.7.2 Filtros de Transações

**Objetivo**: Filtrar por múltiplos critérios.

**Filtros Disponíveis**:
| Filtro | Tipo | Comportamento |
|--------|------|---------------|
| Período | Date range picker | Intervalo de datas |
| Tipo | Dropdown múltiplo | Compra, Venda, Dividendo, etc. |
| Ticker | Autocomplete | Busca com API |
| Carteira | Dropdown | Lista de carteiras do usuário |

**Persistência em URL**:
```
/transactions?startDate=2026-01-01&endDate=2026-01-31&type=BUY&ticker=PETR4
```

---

#### 3.7.3 Ordenação de Colunas

**Objetivo**: Ordenar por qualquer coluna.

**Estados**:
- Neutro: Sem ícone
- Ascendente: ↑ (seta para cima)
- Descendente: ↓ (seta para baixo)

---

#### 3.7.4 Responsividade Mobile

**Objetivo**: Interface otimizada para mobile.

**Transformações**:
| Desktop | Mobile |
|---------|--------|
| Tabela | Cards empilhados |
| Filtros inline | Drawer colapsável |
| Paginação | Infinite scroll |
| Botões na tabela | Swipe actions |

---

### EP22 - Formulários

#### 3.8.1 Formulário de Transação

**Objetivo**: Cadastrar transações com validação.

**Campos**:
| Campo | Tipo | Obrigatório | Validação |
|-------|------|-------------|-----------|
| Tipo | Dropdown | Sim | - |
| Ticker | Autocomplete | Sim | Deve existir |
| Data | Date picker | Sim | Não futura |
| Quantidade | Number | Sim* | > 0 |
| Preço Unit. | Currency | Sim* | > 0 |
| Taxas | Currency | Não | >= 0 |
| Carteira | Dropdown | Sim | - |
| Notas | Textarea | Não | Max 500 chars |

*Obrigatório apenas para tipos Compra/Venda

---

#### 3.8.2 Validação de Formulário

**Objetivo**: Validação em tempo real.

**Regras de Validação**:
```javascript
// composables/useTransactionForm.js
const validationRules = {
  type: { required: true },
  ticker: { 
    required: true,
    async validate(value) {
      const exists = await checkTickerExists(value)
      return exists || 'Ticker não encontrado'
    }
  },
  date: { 
    required: true,
    notFuture: true 
  },
  quantity: { 
    required: (form) => ['BUY', 'SELL'].includes(form.type),
    min: 0.0001 
  },
  price: { 
    required: (form) => ['BUY', 'SELL'].includes(form.type),
    min: 0.01 
  },
  fees: { min: 0 },
  walletId: { required: true }
}
```

---

#### 3.8.3 Edição de Transação

**Objetivo**: Editar transações existentes.

**Fluxo**:
1. Clique em "Editar" na tabela
2. Formulário abre pré-populado
3. Alterações detectadas (isDirty)
4. Salvar → PUT /api/transactions/:id
5. Toast de sucesso
6. Fechar formulário

---

#### 3.8.4 Exclusão de Transação

**Objetivo**: Excluir com confirmação.

**Fluxo**:
1. Clique em "Excluir"
2. Modal de confirmação
3. Confirmar → DELETE /api/transactions/:id
4. Otimistic delete na UI
5. Toast de sucesso

---

## 4. State Management

### 4.1 Estrutura de Stores (Pinia)

```javascript
// store/index.js
import { createPinia } from 'pinia'

export const pinia = createPinia()
```

### 4.2 Auth Store

```javascript
// store/auth.store.js
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null,
    refreshToken: null,
    loading: false,
    error: null
  }),
  
  getters: {
    isAuthenticated: (state) => !!state.token && !!state.user,
    isTokenExpired: (state) => {
      if (!state.token) return true
      const decoded = jwtDecode(state.token)
      return decoded.exp * 1000 < Date.now()
    }
  },
  
  actions: {
    async login(credentials) { /* ... */ },
    async logout() { /* ... */ },
    async refreshSession() { /* ... */ },
    setUser(userData) { /* ... */ }
  },
  
  persist: {
    key: 'moneytrackr-auth',
    paths: ['token', 'refreshToken']
  }
})
```

### 4.3 Wallet Store

```javascript
// store/wallet.store.js
export const useWalletStore = defineStore('wallet', {
  state: () => ({
    wallets: [],
    activeWalletId: null,
    loading: false,
    dashboardLayout: null
  }),
  
  getters: {
    activeWallet: (state) => 
      state.wallets.find(w => w.id === state.activeWalletId),
    walletOptions: (state) => 
      state.wallets.map(w => ({ value: w.id, label: w.name }))
  },
  
  actions: {
    async fetchWallets() { /* ... */ },
    setActiveWallet(id) { /* ... */ },
    async saveDashboardLayout(layout) { /* ... */ }
  }
})
```

### 4.4 Chart Store

```javascript
// store/chart.store.js
export const useChartStore = defineStore('chart', {
  state: () => ({
    chartConfigs: {},
    activeFilters: {
      period: '1Y',
      benchmarks: [],
      assetClasses: []
    }
  }),
  
  actions: {
    setPeriod(period) { /* ... */ },
    toggleBenchmark(benchmark) { /* ... */ },
    toggleAssetClass(assetClass) { /* ... */ },
    async saveChartConfig(chartId, config) { /* ... */ }
  }
})
```

### 4.5 Theme Store

```javascript
// store/theme.store.js
export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: 'light',
    systemPreference: 'light'
  }),
  
  actions: {
    init() {
      this.systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark' : 'light'
      
      const saved = localStorage.getItem('moneytrackr-theme')
      this.theme = saved || this.systemPreference
      this.applyTheme()
    },
    
    toggle() {
      this.theme = this.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('moneytrackr-theme', this.theme)
      this.applyTheme()
    },
    
    applyTheme() {
      document.documentElement.setAttribute('data-theme', this.theme)
    }
  }
})
```

---

## 5. Routing

### 5.1 Definição de Rotas

```javascript
// router/routes.js
export const routes = [
  // Rotas públicas
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/Login.vue'),
    meta: { guestOnly: true, layout: 'blank' }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/pages/Register.vue'),
    meta: { guestOnly: true, layout: 'blank' }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('@/pages/ForgotPassword.vue'),
    meta: { guestOnly: true, layout: 'blank' }
  },
  
  // Rotas protegidas
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/pages/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/transactions',
    name: 'Transactions',
    component: () => import('@/pages/Transactions.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/transactions/new',
    name: 'NewTransaction',
    component: () => import('@/pages/EditTransaction.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/transactions/:id/edit',
    name: 'EditTransaction',
    component: () => import('@/pages/EditTransaction.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/wallets',
    name: 'Wallets',
    component: () => import('@/pages/Wallets.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/imports',
    name: 'Imports',
    component: () => import('@/pages/Imports.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/registrations',
    name: 'Registrations',
    component: () => import('@/pages/Registrations.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/pages/Settings.vue'),
    meta: { requiresAuth: true }
  },
  
  // 404
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/pages/NotFound.vue')
  }
]
```

### 5.2 Navigation Guards

```javascript
// router/guards.js
export function setupGuards(router) {
  router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()
    
    // Inicializar auth se ainda não feito
    if (!authStore.initialized) {
      await authStore.init()
    }
    
    // Verificar autenticação
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      })
      return
    }
    
    // Verificar guest-only
    if (to.meta.guestOnly && authStore.isAuthenticated) {
      next({ path: '/' })
      return
    }
    
    // Verificar token expirado
    if (authStore.isAuthenticated && authStore.isTokenExpired) {
      try {
        await authStore.refreshSession()
        next()
      } catch {
        authStore.logout()
        next({
          path: '/login',
          query: { redirect: to.fullPath, expired: 'true' }
        })
      }
      return
    }
    
    next()
  })
}
```

---

## 6. API Integration

### 6.1 Axios Instance

```javascript
// services/api/index.js
import axios from 'axios'
import { useAuthStore } from '@/store/auth.store'
import { useToast } from '@/composables/useToast'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Para cookies httpOnly
})

// Interceptor de request
api.interceptors.request.use(
  (config) => {
    // CSRF token
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf-token='))
      ?.split('=')[1]
    
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken
    }
    
    return config
  },
  (error) => Promise.reject(error)
)

// Interceptor de response
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error
    
    // 401 - Não autorizado
    if (response?.status === 401) {
      const authStore = useAuthStore()
      authStore.logout()
      window.location.href = '/login'
      return Promise.reject(error)
    }
    
    // 403 - CSRF error
    if (response?.status === 403 && response?.data?.code === 'CSRF_ERROR') {
      // Retry com novo CSRF token
      return api.request(config)
    }
    
    // Outros erros
    const toast = useToast()
    const message = response?.data?.message || 'Erro inesperado. Tente novamente.'
    toast.showError(message)
    
    return Promise.reject(error)
  }
)

export default api
```

### 6.2 Services

```javascript
// services/api/transaction.service.js
import api from './index'

export const transactionService = {
  getAll(params) {
    return api.get('/transactions', { params })
  },
  
  getById(id) {
    return api.get(`/transactions/${id}`)
  },
  
  create(data) {
    return api.post('/transactions', data)
  },
  
  update(id, data) {
    return api.put(`/transactions/${id}`, data)
  },
  
  delete(id) {
    return api.delete(`/transactions/${id}`)
  }
}

// services/api/wallet.service.js
export const walletService = {
  getAll() {
    return api.get('/wallets')
  },
  
  getById(id) {
    return api.get(`/wallets/${id}`)
  },
  
  create(data) {
    return api.post('/wallets', data)
  },
  
  update(id, data) {
    return api.put(`/wallets/${id}`, data)
  },
  
  delete(id) {
    return api.delete(`/wallets/${id}`)
  },
  
  getDashboardLayout(id) {
    return api.get(`/wallets/${id}/dashboard-layout`)
  },
  
  saveDashboardLayout(id, layout) {
    return api.put(`/wallets/${id}/dashboard-layout`, layout)
  }
}

// services/api/benchmark.service.js
export const benchmarkService = {
  getBenchmarkData(params) {
    return api.get('/benchmarks', { params })
  },
  
  getComparisonData(params) {
    return api.get('/charts/comparison-data', { params })
  }
}
```

---

## 7. PWA Configuration

### 7.1 Service Worker

```javascript
// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'MoneyTrackr - Gestor de Investimentos',
        short_name: 'MoneyTrackr',
        description: 'Sistema de gestão de portfólio de investimentos',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\.(js|css|png|jpg|svg|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          },
          {
            urlPattern: /\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 }
            }
          }
        ]
      }
    })
  ]
})
```

### 7.2 Estratégia de Cache

| Tipo de Recurso | Estratégia | TTL |
|-----------------|------------|-----|
| JS/CSS/Imagens | CacheFirst | 30 dias |
| API (dados) | NetworkFirst | 5 minutos |
| Cotações | StaleWhileRevalidate | 1-5 minutos |
| Benchmarks | StaleWhileRevalidate | 24 horas |

---

## 8. Styling Architecture

### 8.1 Sistema de Breakpoints

```css
/* styles/breakpoints.css */
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}

/* Mobile first */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

### 8.2 Tailwind Configuration

```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)'
        },
        background: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary: 'var(--color-bg-tertiary)'
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
```

---

## 9. Bibliotecas e Dependências

### 9.1 Dependências Principais

```json
{
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.2.0",
    "pinia": "^2.1.0",
    "pinia-plugin-persistedstate": "^3.2.0",
    "axios": "^1.6.0",
    "chart.js": "^4.4.0",
    "vue-chartjs": "^5.3.0",
    "vue-grid-layout": "^3.0.0",
    "lucide-vue-next": "^0.300.0",
    "@tanstack/vue-table": "^8.11.0",
    "vue-datepicker": "^1.0.0",
    "vee-validate": "^4.12.0",
    "zod": "^3.22.0",
    "idb": "^8.0.0",
    "dompurify": "^3.0.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.0.0",
    "vite-plugin-pwa": "^0.17.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "@vue/test-utils": "^2.4.0",
    "eslint": "^8.56.0",
    "eslint-plugin-vue": "^9.19.0",
    "prettier": "^3.2.0"
  }
}
```

### 9.2 Mapeamento por Funcionalidade

| Funcionalidade | Biblioteca | Versão |
|----------------|------------|--------|
| Framework | Vue.js | 3.4.x |
| Roteamento | Vue Router | 4.2.x |
| Estado | Pinia | 2.1.x |
| HTTP Client | Axios | 1.6.x |
| Gráficos | Chart.js + vue-chartjs | 4.4.x / 5.3.x |
| Grid Layout | vue-grid-layout | 3.0.x |
| Ícones | Lucide Vue Next | 0.300.x |
| Tabela | @tanstack/vue-table | 8.11.x |
| Date Picker | vue-datepicker | 1.0.x |
| Validação | Vee-Validate + Zod | 4.12.x / 3.22.x |
| IndexedDB | idb | 8.0.x |
| Sanitização | DOMPurify | 3.0.x |
| Datas | date-fns | 3.0.x |

---

## 10. Ordem de Implementação

### 10.1 Sprint 1: Fundação (EP-15 + EP-16)

```
Semana 1:
├── STORY-1501: Service Worker e Cache Strategy
├── STORY-1502: Manifest.json e Instalação PWA
└── STORY-1601: Estrutura de Layout Principal

Semana 2:
├── STORY-1602: Sistema de Temas (Light/Dark Mode)
├── STORY-1603: Header Global
└── STORY-1503: Background Sync e Offline Queue
```

### 10.2 Sprint 2: Navegação (EP-17 + EP-18)

```
Semana 3:
├── STORY-1701: Roteamento SPA com Lazy Loading
├── STORY-1702: Route Guards (Autenticação)
└── STORY-1703: Página 404 e Tratamento de Rotas

Semana 4:
├── STORY-1801: Menu de Navegação Principal
├── STORY-1802: Sidebar Colapsável (Modo Ícones)
└── STORY-1803: Sidebar Mobile (Overlay)
```

### 10.3 Sprint 3: Dashboard e Gráficos (EP-19 + EP-20)

```
Semana 5:
├── STORY-1901: Grid de Widgets com Drag & Drop
├── STORY-1902: Adicionar e Remover Widgets
└── STORY-1903: Persistência de Layout por Carteira

Semana 6:
├── STORY-2001: Gráfico de Performance do Portfolio
├── STORY-2002: Benchmarks (CDI, IBOV)
├── STORY-2003: Grupos de Ativos (FIIs, Ações, etc.)
└── STORY-2004: Seletor de Período (Date Range)
```

### 10.4 Sprint 4: Transações e Formulários (EP-21 + EP-22)

```
Semana 7:
├── STORY-2101: Tabela de Transações com Paginação
├── STORY-2102: Filtros de Transações
├── STORY-2103: Ordenação de Colunas
└── STORY-2104: Responsividade Mobile

Semana 8:
├── STORY-2201: Formulário de Transação
├── STORY-2202: Validação de Formulário
├── STORY-2203: Edição de Transação
└── STORY-2204: Exclusão de Transação
```

---

## 11. Riscos Técnicos

### 11.1 Matriz de Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Performance de gráficos com muitos dados | Média | Alto | Implementar agregação de dados, lazy loading de séries |
| PWA não instalável em alguns navegadores | Baixa | Médio | Testar em múltiplos navegadores, fallback para web app |
| Offline sync conflitos | Média | Alto | Implementar resolução de conflitos, UI de merge manual |
| Bundle size excessivo | Média | Médio | Code splitting agressivo, tree shaking, análise contínua |
| Incompatibilidade de grid layout em mobile | Baixa | Médio | Fallback para layout estático em mobile |
| Memory leak em virtual scrolling | Baixa | Alto | Testes de stress, cleanup adequado de observers |
| Tema escuro com contraste insuficiente | Média | Médio | Testes de acessibilidade, ajuste de cores |

### 11.2 Plano de Contingência

**Cenário 1: Performance de gráficos degradada**
- Ação: Implementar downsampling de dados
- Threshold: > 1000 pontos no gráfico
- Fallback: Agregação por período (semana/mês)

**Cenário 2: PWA não funciona em Safari iOS**
- Ação: Meta tags específicas para iOS
- Fallback: Funciona como web app normal

**Cenário 3: Conflito de sincronização offline**
- Ação: UI de resolução de conflitos
- Fallback: Manter ambas as versões, usuário escolhe

---

## 12. Checklist de Implementação

### EP15 - PWA
- [ ] Service Worker registrado automaticamente
- [ ] Assets cacheados no primeiro acesso
- [ ] Estratégia cache-first para estáticos
- [ ] Estratégia network-first para APIs
- [ ] Indicador "Modo Offline" funcional
- [ ] Página de fallback offline
- [ ] Toast "Conexão restaurada"
- [ ] Notificação de nova versão
- [ ] Manifest.json completo
- [ ] Ícones em todos os tamanhos
- [ ] Meta tags iOS configuradas
- [ ] PWA instalável (Lighthouse score >= 90)
- [ ] IndexedDB para fila offline
- [ ] Background sync implementado
- [ ] Indicador de pendências no header

### EP16 - Layout Base
- [ ] Grid layout responsivo
- [ ] Sidebar fixa em desktop
- [ ] Sidebar oculta em mobile
- [ ] Sidebar colapsada em tablet
- [ ] Header fixo no topo
- [ ] Conteúdo com scroll independente
- [ ] Tema claro/escuro funcional
- [ ] Detecção de preferência do SO
- [ ] Persistência de tema
- [ ] Transição suave ao alternar tema
- [ ] Gráficos adaptados ao tema
- [ ] Logo com link para Dashboard
- [ ] Toggle de tema no header
- [ ] Menu de perfil dropdown
- [ ] Logout funcional

### EP17 - Navegação
- [ ] Lazy loading de rotas
- [ ] Suspense fallback
- [ ] Navegação sem reload
- [ ] Botões voltar/avançar funcionais
- [ ] Deep links funcionais
- [ ] Route guards implementados
- [ ] Redirecionamento para login
- [ ] Redirect param salvo
- [ ] Token expirado detectado
- [ ] Página 404 amigável
- [ ] Botão "Voltar ao Dashboard"

### EP18 - Sidebar
- [ ] Menu com todos os itens
- [ ] Ícones Lucide configurados
- [ ] Item ativo destacado
- [ ] Hover effect
- [ ] Sidebar colapsável
- [ ] Tooltips quando colapsada
- [ ] Estado persistido
- [ ] Sidebar mobile overlay
- [ ] Animação de slide
- [ ] Backdrop escuro
- [ ] Fecha ao navegar
- [ ] Fecha com ESC
- [ ] Swipe para fechar

### EP19 - Dashboard
- [ ] Grid de widgets
- [ ] Drag & drop funcional
- [ ] Resize de widgets
- [ ] Layout salvo automaticamente
- [ ] Layout por carteira
- [ ] Adicionar widgets
- [ ] Remover widgets
- [ ] Modal de widgets disponíveis
- [ ] Empty state do dashboard
- [ ] Widgets padrão carregados

### EP20 - Gráficos
- [ ] Gráfico de linha
- [ ] Tooltip interativo
- [ ] Zoom por seleção
- [ ] Reset zoom
- [ ] Tema escuro adaptado
- [ ] Responsivo
- [ ] Benchmarks (CDI, IBOV)
- [ ] Linhas tracejadas
- [ ] Toggle de benchmarks
- [ ] Grupos de ativos
- [ ] Gráfico empilhado
- [ ] Filtro por classe
- [ ] Seletor de período
- [ ] Períodos rápidos
- [ ] Date picker customizado

### EP21 - Transações UI
- [ ] Tabela com colunas corretas
- [ ] Paginação server-side
- [ ] Controles de paginação
- [ ] Contador de transações
- [ ] Cards em mobile
- [ ] Filtros funcionais
- [ ] Date range picker
- [ ] Dropdown de tipo
- [ ] Autocomplete de ticker
- [ ] Dropdown de carteira
- [ ] Filtros combinados
- [ ] Limpar filtros
- [ ] Persistência em URL
- [ ] Ordenação por coluna
- [ ] Toggle asc/desc
- [ ] Drawer de filtros mobile
- [ ] FAB para adicionar
- [ ] Infinite scroll mobile

### EP22 - Formulários
- [ ] Formulário de transação
- [ ] Todos os campos
- [ ] Autocomplete de ticker
- [ ] Validação em tempo real
- [ ] Mensagens de erro claras
- [ ] Campos condicionais por tipo
- [ ] Confirmação ao cancelar
- [ ] Submissão com loading
- [ ] Toast de sucesso
- [ ] Edição pré-populada
- [ ] Detecção de alterações
- [ ] Modal de exclusão
- [ ] Otimistic delete

---

**Documento criado por**: @architect
**Data**: 2026-03-27
**Status**: Pronto para @tech-lead
