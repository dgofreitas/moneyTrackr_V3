<template>
  <ProtectedRoute>
    <div class="positions-page">
      <header class="page-header">
        <div class="header-content">
          <h1>Posicoes</h1>
          <p class="subtitle">Visualize suas posicoes ativas e encerradas</p>
        </div>
      </header>
      
      <!-- Wallet Selector -->
      <div v-if="walletStore.wallets.length > 1" class="wallet-selector">
        <label>Carteira:</label>
        <select v-model="selectedWalletId" @change="onWalletChange">
          <option v-for="wallet in walletStore.wallets" :key="wallet._id" :value="wallet._id">
            {{ wallet.name }}
          </option>
        </select>
      </div>
      
      <!-- Filter Tabs -->
      <div class="filter-tabs">
        <button
          :class="['tab', { active: activeTab === 'active' }]"
          @click="activeTab = 'active'"
        >
          Ativas ({{ activePositions.length }})
        </button>
        <button
          :class="['tab', { active: activeTab === 'closed' }]"
          @click="activeTab = 'closed'"
        >
          Encerradas ({{ closedPositions.length }})
        </button>
      </div>
      
      <!-- Loading State -->
      <div v-if="transactionStore.isLoading" class="loading-container">
        <Loading message="Carregando posicoes..." />
      </div>
      
      <!-- Active Positions -->
      <div v-else-if="activeTab === 'active'" class="positions-grid">
        <div v-if="activePositions.length === 0" class="empty-state">
          <p>Nenhuma posicao ativa encontrada</p>
          <router-link to="/transactions/new" class="btn btn-primary">
            Registrar Primeira Transacao
          </router-link>
        </div>
        
        <div
          v-else
          v-for="position in activePositions"
          :key="position._id"
          class="position-card active"
        >
          <div class="position-header">
            <h3 class="ticker">{{ position.ticker }}</h3>
            <span class="status-badge active">Ativa</span>
          </div>
          
          <div class="position-details">
            <div class="detail-row">
              <span class="label">Quantidade:</span>
              <span class="value">{{ formatNumber(position.quantity) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Preco Medio:</span>
              <span class="value">{{ formatCurrency(position.averagePrice) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Total Investido:</span>
              <span class="value highlight">{{ formatCurrency(position.totalInvested) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Taxas Totais:</span>
              <span class="value">{{ formatCurrency(position.totalFees || 0) }}</span>
            </div>
          </div>
          
          <div class="position-footer">
            <span class="last-update">
              Ultima atualizacao: {{ formatDate(position.lastTransactionDate || position.updatedAt) }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Closed Positions -->
      <div v-else class="positions-grid">
        <div v-if="closedPositions.length === 0" class="empty-state">
          <p>Nenhuma posicao encerrada</p>
        </div>
        
        <div
          v-else
          v-for="position in closedPositions"
          :key="position._id"
          class="position-card closed"
        >
          <div class="position-header">
            <h3 class="ticker">{{ position.ticker }}</h3>
            <span class="status-badge closed">Encerrada</span>
          </div>
          
          <div class="position-details">
            <div class="detail-row">
              <span class="label">Quantidade:</span>
              <span class="value">{{ formatNumber(position.quantity) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Total Investido:</span>
              <span class="value">{{ formatCurrency(position.totalInvested) }}</span>
            </div>
          </div>
          
          <div class="position-footer">
            <span class="last-update">
              Encerrada em: {{ formatDate(position.lastTransactionDate || position.updatedAt) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </ProtectedRoute>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ProtectedRoute from '@/components/common/ProtectedRoute.vue'
import Loading from '@/components/ui/Loading.vue'
import { useTransactionStore } from '@/stores/transaction-store'
import { useWalletStore } from '@/stores/wallet-store'

const transactionStore = useTransactionStore()
const walletStore = useWalletStore()

const activeTab = ref('active')

const selectedWalletId = computed({
  get: () => walletStore.activeWalletId,
  set: (value) => walletStore.setActiveWalletById(value),
})

const activePositions = computed(() => transactionStore.activePositions)
const closedPositions = computed(() => transactionStore.closedPositions)

const loadPositions = async () => {
  if (!selectedWalletId.value) return
  
  try {
    await transactionStore.fetchPositions(selectedWalletId.value)
  } catch (error) {
    console.error('Erro ao carregar posicoes:', error)
  }
}

const onWalletChange = () => {
  loadPositions()
}

const formatNumber = (value) => {
  if (value === null || value === undefined) return '0'
  return new Intl.NumberFormat('pt-BR').format(value)
}

const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('pt-BR')
}

onMounted(async () => {
  // Load wallets first
  if (walletStore.wallets.length === 0) {
    await walletStore.fetchWallets()
  }
  
  // Then load positions
  loadPositions()
})
</script>

<style scoped>
.positions-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 1rem;
}

.page-header {
  margin-bottom: 1.5rem;
}

.header-content h1 {
  color: #1a1a2e;
  font-size: 1.75rem;
  margin: 0;
}

.subtitle {
  color: #666;
  margin: 0.25rem 0 0 0;
}

.wallet-selector {
  background-color: white;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.wallet-selector label {
  font-weight: 500;
}

.wallet-selector select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  min-width: 200px;
}

.filter-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tab {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tab:hover {
  background-color: #f8f9fa;
}

.tab.active {
  background-color: #1a1a2e;
  color: white;
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.positions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.empty-state p {
  color: #666;
  margin-bottom: 1rem;
}

.btn {
  display: inline-block;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  text-decoration: none;
}

.btn-primary {
  background-color: #1a1a2e;
  color: white;
}

.position-card {
  background-color: white;
  border-radius: 8px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.position-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.position-card.active {
  border-left: 4px solid #28a745;
}

.position-card.closed {
  border-left: 4px solid #6c757d;
  opacity: 0.8;
}

.position-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #eee;
}

.ticker {
  font-size: 1.25rem;
  color: #1a1a2e;
  margin: 0;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.active {
  background-color: #d4edda;
  color: #155724;
}

.status-badge.closed {
  background-color: #e2e3e5;
  color: #383d41;
}

.position-details {
  margin-bottom: 1rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.detail-row .label {
  color: #666;
}

.detail-row .value {
  font-weight: 500;
  color: #333;
}

.detail-row .value.highlight {
  color: #1a1a2e;
  font-size: 1.1rem;
}

.position-footer {
  padding-top: 0.75rem;
  border-top: 1px solid #eee;
}

.last-update {
  font-size: 0.75rem;
  color: #999;
}

/* Responsive */
@media (max-width: 768px) {
  .wallet-selector {
    flex-direction: column;
    align-items: stretch;
  }
  
  .wallet-selector select {
    width: 100%;
  }
  
  .filter-tabs {
    flex-direction: column;
  }
  
  .tab {
    width: 100%;
  }
  
  .positions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
