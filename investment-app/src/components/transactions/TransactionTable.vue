<template>
  <div class="transaction-table-container">
    <div class="table-wrapper">
      <table class="transaction-table">
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              :class="{ sortable: column.sortable }"
              @click="column.sortable && handleSort(column.key)"
            >
              {{ column.label }}
              <span v-if="column.sortable && sortKey === column.key" class="sort-icon">
                {{ sortOrder === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
            <th>Acoes</th>
          </tr>
        </thead>
        
        <tbody>
          <tr v-if="loading">
            <td :colspan="columns.length + 1" class="loading-cell">
              <Loading message="Carregando transacoes..." />
            </td>
          </tr>
          
          <tr v-else-if="transactions.length === 0">
            <td :colspan="columns.length + 1" class="empty-cell">
              <p>Nenhuma transacao encontrada</p>
            </td>
          </tr>
          
          <tr v-else v-for="transaction in transactions" :key="transaction._id">
            <td>{{ formatDate(transaction.date) }}</td>
            <td class="ticker">{{ transaction.ticker }}</td>
            <td>
              <span :class="['badge', 'type-badge', transaction.type.toLowerCase()]">
                {{ transaction.type === 'BUY' ? 'Compra' : 'Venda' }}
              </span>
            </td>
            <td class="number">{{ formatNumber(transaction.quantity) }}</td>
            <td class="number">{{ formatCurrency(transaction.price) }}</td>
            <td class="number">{{ formatCurrency(transaction.fees) }}</td>
            <td class="number">{{ formatCurrency(calculateTotal(transaction)) }}</td>
            <td class="number">
              <span
                v-if="transaction.type === 'SELL' && transaction.realizedPnL !== null"
                :class="['badge', 'pnl-badge', transaction.realizedPnL >= 0 ? 'profit' : 'loss']"
              >
                {{ formatCurrency(transaction.realizedPnL) }}
              </span>
              <span v-else class="muted">-</span>
            </td>
            <td class="actions">
              <button class="action-btn edit" @click="$emit('edit', transaction)" title="Editar">
                ✏️
              </button>
              <button class="action-btn delete" @click="$emit('delete', transaction)" title="Excluir">
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Pagination -->
    <div v-if="pagination && pagination.totalPages > 1" class="pagination">
      <button
        class="page-btn"
        :disabled="pagination.page === 1"
        @click="$emit('page-change', pagination.page - 1)"
      >
        Anterior
      </button>
      <span class="page-info">
        Pagina {{ pagination.page }} de {{ pagination.totalPages }}
      </span>
      <button
        class="page-btn"
        :disabled="pagination.page === pagination.totalPages"
        @click="$emit('page-change', pagination.page + 1)"
      >
        Proxima
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Loading from '@/components/ui/Loading.vue'

const props = defineProps({
  transactions: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  pagination: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['sort', 'edit', 'delete', 'page-change'])

const sortKey = ref('date')
const sortOrder = ref('desc')

const columns = [
  { key: 'date', label: 'Data', sortable: true },
  { key: 'ticker', label: 'Ticker', sortable: true },
  { key: 'type', label: 'Tipo', sortable: true },
  { key: 'quantity', label: 'Quantidade', sortable: true },
  { key: 'price', label: 'Preco', sortable: true },
  { key: 'fees', label: 'Taxas', sortable: true },
  { key: 'total', label: 'Total', sortable: false },
  { key: 'realizedPnL', label: 'P/L', sortable: true },
]

const handleSort = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'desc'
  }
  emit('sort', { key: sortKey.value, order: sortOrder.value })
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('pt-BR')
}

const formatNumber = (value) => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('pt-BR').format(value)
}

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const calculateTotal = (transaction) => {
  if (!transaction) return 0
  const subtotal = transaction.quantity * transaction.price
  return transaction.type === 'BUY'
    ? subtotal + (transaction.fees || 0)
    : subtotal - (transaction.fees || 0)
}
</script>

<style scoped>
.transaction-table-container {
  width: 100%;
}

.table-wrapper {
  overflow-x: auto;
}

.transaction-table {
  width: 100%;
  border-collapse: collapse;
  background-color: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.transaction-table th,
.transaction-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.transaction-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.transaction-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.transaction-table th.sortable:hover {
  background-color: #e9ecef;
}

.sort-icon {
  margin-left: 0.25rem;
  font-size: 0.75rem;
}

.transaction-table tbody tr:hover {
  background-color: #f8f9fa;
}

.loading-cell,
.empty-cell {
  text-align: center;
  padding: 2rem !important;
  color: #666;
}

.number {
  text-align: right;
  font-family: monospace;
}

.ticker {
  font-weight: 600;
  color: #1a1a2e;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.type-badge.buy {
  background-color: #d4edda;
  color: #155724;
}

.type-badge.sell {
  background-color: #f8d7da;
  color: #721c24;
}

.pnl-badge.profit {
  background-color: #d4edda;
  color: #155724;
}

.pnl-badge.loss {
  background-color: #f8d7da;
  color: #721c24;
}

.muted {
  color: #999;
}

.actions {
  white-space: nowrap;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 1rem;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.action-btn:hover {
  opacity: 1;
}

.action-btn.edit:hover {
  transform: scale(1.1);
}

.action-btn.delete:hover {
  transform: scale(1.1);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  padding: 1rem;
}

.page-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background-color: #f8f9fa;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #666;
  font-size: 0.875rem;
}

/* Responsive */
@media (max-width: 768px) {
  .transaction-table th,
  .transaction-table td {
    padding: 0.5rem;
    font-size: 0.875rem;
  }
  
  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>
