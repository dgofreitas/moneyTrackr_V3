<template>
  <ProtectedRoute>
    <div class="transactions-page">
      <header class="page-header">
        <div class="header-content">
          <h1>Transacoes</h1>
          <p class="subtitle">Gerencie suas operacoes de compra e venda</p>
        </div>
        <div class="header-actions">
          <router-link to="/transactions/new" class="btn btn-primary">
            + Nova Transacao
          </router-link>
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
      
      <!-- Filters -->
      <TransactionFilters
        ref="filtersRef"
        @apply="applyFilters"
        @clear="clearFilters"
      />
      
      <!-- Transaction Table -->
      <TransactionTable
        :transactions="transactionStore.transactions"
        :loading="transactionStore.isLoading"
        :pagination="transactionStore.pagination"
        @sort="handleSort"
        @edit="handleEdit"
        @delete="handleDelete"
        @page-change="handlePageChange"
      />
      
      <!-- Delete Confirmation Modal -->
      <Modal :isOpen="showDeleteModal" @close="closeDeleteModal" title="Confirmar Exclusao">
        <div class="delete-confirm">
          <p>Tem certeza que deseja excluir esta transacao?</p>
          <div v-if="transactionToDelete" class="transaction-info">
            <p><strong>Ticker:</strong> {{ transactionToDelete.ticker }}</p>
            <p><strong>Tipo:</strong> {{ transactionToDelete.type === 'BUY' ? 'Compra' : 'Venda' }}</p>
            <p><strong>Quantidade:</strong> {{ transactionToDelete.quantity }}</p>
            <p><strong>Data:</strong> {{ formatDate(transactionToDelete.date) }}</p>
          </div>
          <p class="warning">⚠️ Esta acao nao pode ser desfeita.</p>
        </div>
        <template #footer>
          <Button variant="secondary" @click="closeDeleteModal">
            Cancelar
          </Button>
          <Button variant="danger" :loading="isDeleting" @click="confirmDelete">
            Excluir
          </Button>
        </template>
      </Modal>
    </div>
  </ProtectedRoute>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import ProtectedRoute from '@/components/common/ProtectedRoute.vue'
import TransactionTable from '@/components/transactions/TransactionTable.vue'
import TransactionFilters from '@/components/transactions/TransactionFilters.vue'
import Modal from '@/components/ui/Modal.vue'
import Button from '@/components/ui/Button.vue'
import { useTransactionStore } from '@/stores/transaction-store'
import { useWalletStore } from '@/stores/wallet-store'

const router = useRouter()
const transactionStore = useTransactionStore()
const walletStore = useWalletStore()

const filtersRef = ref(null)
const showDeleteModal = ref(false)
const transactionToDelete = ref(null)
const isDeleting = ref(false)

const selectedWalletId = computed({
  get: () => walletStore.activeWalletId,
  set: (value) => walletStore.setActiveWalletById(value),
})

const currentFilters = ref({})
const currentSort = ref({ key: 'date', order: 'desc' })
const currentPage = ref(1)

const loadTransactions = async () => {
  if (!selectedWalletId.value) return
  
  try {
    await transactionStore.fetchTransactions({
      walletId: selectedWalletId.value,
      ...currentFilters.value,
      sortBy: currentSort.value.key,
      sortOrder: currentSort.value.order,
      page: currentPage.value,
      limit: 50,
    })
  } catch (error) {
    console.error('Erro ao carregar transacoes:', error)
  }
}

const onWalletChange = () => {
  currentPage.value = 1
  loadTransactions()
}

const applyFilters = (filters) => {
  currentFilters.value = filters
  currentPage.value = 1
  loadTransactions()
}

const clearFilters = () => {
  currentFilters.value = {}
  currentPage.value = 1
  loadTransactions()
}

const handleSort = ({ key, order }) => {
  currentSort.value = { key, order }
  loadTransactions()
}

const handlePageChange = (page) => {
  currentPage.value = page
  loadTransactions()
}

const handleEdit = (transaction) => {
  router.push(`/transactions/${transaction._id}/edit`)
}

const handleDelete = (transaction) => {
  transactionToDelete.value = transaction
  showDeleteModal.value = true
}

const closeDeleteModal = () => {
  showDeleteModal.value = false
  transactionToDelete.value = null
}

const confirmDelete = async () => {
  if (!transactionToDelete.value) return
  
  isDeleting.value = true
  try {
    await transactionStore.deleteTransaction(transactionToDelete.value._id)
    closeDeleteModal()
    // Reload to ensure consistency
    loadTransactions()
  } catch (error) {
    console.error('Erro ao excluir transacao:', error)
    alert(error.message || 'Erro ao excluir transacao')
  } finally {
    isDeleting.value = false
  }
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
  
  // Then load transactions
  loadTransactions()
})
</script>

<style scoped>
.transactions-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 1rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
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

.header-actions {
  display: flex;
  gap: 0.5rem;
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

.btn-primary:hover {
  background-color: #2d2d4a;
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

.delete-confirm {
  padding: 1rem 0;
}

.delete-confirm p {
  margin-bottom: 1rem;
}

.transaction-info {
  background-color: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  margin: 1rem 0;
}

.transaction-info p {
  margin: 0.25rem 0;
}

.warning {
  color: #856404;
  background-color: #fff3cd;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 1rem;
}

/* Responsive */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: stretch;
  }
  
  .header-actions .btn {
    text-align: center;
  }
  
  .wallet-selector {
    flex-direction: column;
    align-items: stretch;
  }
  
  .wallet-selector select {
    width: 100%;
  }
}
</style>
