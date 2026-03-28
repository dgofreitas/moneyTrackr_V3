<template>
  <ProtectedRoute>
    <div class="transaction-form-page">
      <header class="page-header">
        <div class="header-content">
          <button class="back-btn" @click="goBack">← Voltar</button>
          <h1>{{ isEditing ? 'Editar Transacao' : 'Nova Transacao' }}</h1>
        </div>
      </header>
      
      <div class="form-container">
        <form @submit.prevent="handleSubmit" class="transaction-form">
          <!-- Type Selector -->
          <div class="form-group">
            <label>Tipo de Operacao</label>
            <div class="type-selector">
              <button
                type="button"
                :class="['type-btn', 'buy', { active: form.type === 'BUY' }]"
                @click="form.type = 'BUY'"
                :disabled="isLoading"
              >
                📈 Compra
              </button>
              <button
                type="button"
                :class="['type-btn', 'sell', { active: form.type === 'SELL' }]"
                @click="form.type = 'SELL'"
                :disabled="isLoading"
              >
                📉 Venda
              </button>
            </div>
          </div>
          
          <!-- Ticker -->
          <div class="form-group">
            <label for="ticker">Ativo (Ticker) *</label>
            <input
              id="ticker"
              v-model="form.ticker"
              type="text"
              placeholder="Ex: PETR4"
              maxlength="20"
              :disabled="isLoading"
              @blur="normalizeTicker"
              required
            />
            <span v-if="errors.ticker" class="error">{{ errors.ticker }}</span>
            
            <!-- Available quantity for SELL -->
            <div v-if="form.type === 'SELL' && availablePosition" class="available-info">
              <span class="info-badge">
                Disponivel: {{ formatNumber(availablePosition.quantity) }} unidades
                (Preco Medio: {{ formatCurrency(availablePosition.averagePrice) }})
              </span>
            </div>
          </div>
          
          <!-- Quantity -->
          <div class="form-group">
            <label for="quantity">Quantidade *</label>
            <input
              id="quantity"
              v-model.number="form.quantity"
              type="number"
              step="0.00000001"
              min="0"
              placeholder="0"
              :disabled="isLoading"
              required
            />
            <span v-if="errors.quantity" class="error">{{ errors.quantity }}</span>
          </div>
          
          <!-- Price -->
          <div class="form-group">
            <label for="price">Preco Unitario ({{ form.currency }}) *</label>
            <input
              id="price"
              v-model.number="form.price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              :disabled="isLoading"
              required
            />
            <span v-if="errors.price" class="error">{{ errors.price }}</span>
          </div>
          
          <!-- Fees -->
          <div class="form-group">
            <label for="fees">Taxas ({{ form.currency }})</label>
            <input
              id="fees"
              v-model.number="form.fees"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              :disabled="isLoading"
            />
          </div>
          
          <!-- Date -->
          <div class="form-group">
            <label for="date">Data da Operacao *</label>
            <input
              id="date"
              v-model="form.date"
              type="date"
              :max="todayDate"
              :disabled="isLoading"
              required
            />
            <span v-if="errors.date" class="error">{{ errors.date }}</span>
          </div>
          
          <!-- Currency -->
          <div class="form-group">
            <label for="currency">Moeda</label>
            <select id="currency" v-model="form.currency" :disabled="isLoading">
              <option value="BRL">BRL - Real Brasileiro</option>
              <option value="USD">USD - Dolar Americano</option>
              <option value="EUR">EUR - Euro</option>
            </select>
          </div>
          
          <!-- Notes -->
          <div class="form-group">
            <label for="notes">Observacoes</label>
            <textarea
              id="notes"
              v-model="form.notes"
              maxlength="500"
              placeholder="Notas sobre a operacao..."
              :disabled="isLoading"
              rows="3"
            ></textarea>
            <span class="char-count">{{ form.notes?.length || 0 }}/500</span>
          </div>
          
          <!-- Total Calculated -->
          <div class="total-section">
            <div class="total-row">
              <span>Total:</span>
              <span class="total-value">{{ formattedTotal }}</span>
            </div>
            <div v-if="form.type === 'SELL' && estimatedPnL !== null" class="pnl-row">
              <span>P/L Estimado:</span>
              <span :class="['pnl-value', estimatedPnL >= 0 ? 'profit' : 'loss']">
                {{ formatCurrency(estimatedPnL) }}
              </span>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="form-actions">
            <Button type="button" variant="secondary" @click="goBack" :disabled="isLoading">
              Cancelar
            </Button>
            <Button type="submit" variant="primary" :loading="isLoading">
              {{ isEditing ? 'Salvar' : 'Registrar' }}
            </Button>
          </div>
        </form>
      </div>
      
      <!-- Sell Confirmation Dialog -->
      <TransactionConfirmDialog
        :isOpen="showConfirmDialog"
        :transaction="form"
        :position="availablePosition"
        :isLoading="isLoading"
        @close="closeConfirmDialog"
        @confirm="confirmSell"
      />
    </div>
  </ProtectedRoute>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import ProtectedRoute from '@/components/common/ProtectedRoute.vue'
import Button from '@/components/ui/Button.vue'
import TransactionConfirmDialog from '@/components/transactions/TransactionConfirmDialog.vue'
import { useTransactionStore } from '@/stores/transaction-store'
import { useWalletStore } from '@/stores/wallet-store'

const router = useRouter()
const route = useRoute()
const transactionStore = useTransactionStore()
const walletStore = useWalletStore()

const isEditing = computed(() => !!route.params.id)
const transactionId = computed(() => route.params.id)

const isLoading = ref(false)
const showConfirmDialog = ref(false)
const availablePosition = ref(null)

const form = reactive({
  type: 'BUY',
  ticker: '',
  quantity: null,
  price: null,
  fees: 0,
  date: new Date().toISOString().split('T')[0],
  currency: 'BRL',
  notes: '',
})

const errors = reactive({
  ticker: '',
  quantity: '',
  price: '',
  date: '',
})

const todayDate = computed(() => new Date().toISOString().split('T')[0])

const total = computed(() => {
  if (!form.quantity || !form.price) return 0
  const subtotal = form.quantity * form.price
  return form.type === 'BUY'
    ? subtotal + (form.fees || 0)
    : subtotal - (form.fees || 0)
})

const formattedTotal = computed(() => {
  return formatCurrency(total.value)
})

const estimatedPnL = computed(() => {
  if (form.type !== 'SELL' || !availablePosition.value || !form.quantity || !form.price) {
    return null
  }
  const { averagePrice = 0 } = availablePosition.value
  return (form.price * form.quantity) - (averagePrice * form.quantity) - (form.fees || 0)
})

const normalizeTicker = () => {
  form.ticker = form.ticker.toUpperCase().trim()
}

const fetchAvailablePosition = async () => {
  if (form.type === 'SELL' && form.ticker && walletStore.activeWalletId) {
    try {
      availablePosition.value = await transactionStore.getPosition(
        form.ticker,
        walletStore.activeWalletId
      )
    } catch {
      availablePosition.value = { quantity: 0, averagePrice: 0 }
    }
  } else {
    availablePosition.value = null
  }
}

watch(() => form.type, () => {
  if (form.type === 'SELL') {
    fetchAvailablePosition()
  } else {
    availablePosition.value = null
  }
})

watch(() => form.ticker, () => {
  if (form.type === 'SELL' && form.ticker) {
    fetchAvailablePosition()
  }
})

const validate = () => {
  let isValid = true
  
  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key] = ''
  })
  
  // Ticker validation
  if (!form.ticker || form.ticker.trim().length === 0) {
    errors.ticker = 'Ticker e obrigatorio'
    isValid = false
  } else if (form.ticker.length < 3 || form.ticker.length > 20) {
    errors.ticker = 'Ticker deve ter entre 3 e 20 caracteres'
    isValid = false
  }
  
  // Quantity validation
  if (!form.quantity || form.quantity <= 0) {
    errors.quantity = 'Quantidade deve ser maior que zero'
    isValid = false
  } else if (form.type === 'SELL' && availablePosition.value) {
    if (form.quantity > availablePosition.value.quantity) {
      errors.quantity = `Quantidade maxima disponivel: ${availablePosition.value.quantity}`
      isValid = false
    }
  }
  
  // Price validation
  if (!form.price || form.price <= 0) {
    errors.price = 'Preco deve ser maior que zero'
    isValid = false
  }
  
  // Date validation
  if (!form.date) {
    errors.date = 'Data e obrigatoria'
    isValid = false
  } else if (new Date(form.date) > new Date()) {
    errors.date = 'Data nao pode ser futura'
    isValid = false
  }
  
  return isValid
}

const handleSubmit = async () => {
  normalizeTicker()
  
  if (!validate()) return
  
  // For SELL, show confirmation dialog first
  if (form.type === 'SELL' && !isEditing.value) {
    showConfirmDialog.value = true
    return
  }
  
  await saveTransaction()
}

const confirmSell = async () => {
  showConfirmDialog.value = false
  await saveTransaction()
}

const closeConfirmDialog = () => {
  showConfirmDialog.value = false
}

const saveTransaction = async () => {
  if (!walletStore.activeWalletId) {
    alert('Selecione uma carteira primeiro')
    return
  }
  
  isLoading.value = true
  
  try {
    const data = {
      walletId: walletStore.activeWalletId,
      ticker: form.ticker,
      type: form.type,
      quantity: form.quantity,
      price: form.price,
      fees: form.fees || 0,
      date: form.date,
      currency: form.currency,
      notes: form.notes || '',
    }
    
    if (isEditing.value) {
      await transactionStore.updateTransaction(transactionId.value, data)
    } else {
      await transactionStore.createTransaction(data)
    }
    
    router.push('/transactions')
  } catch (error) {
    console.error('Erro ao salvar transacao:', error)
    alert(error.message || 'Erro ao salvar transacao')
  } finally {
    isLoading.value = false
  }
}

const goBack = () => {
  router.push('/transactions')
}

const formatNumber = (value) => {
  if (value === null || value === undefined) return '0'
  return new Intl.NumberFormat('pt-BR').format(value)
}

const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: form.currency,
  }).format(value)
}

const loadTransaction = async () => {
  if (!isEditing.value) return
  
  isLoading.value = true
  try {
    const transaction = await transactionStore.getTransaction(transactionId.value)
    if (transaction) {
      Object.assign(form, {
        type: transaction.type,
        ticker: transaction.ticker,
        quantity: transaction.quantity,
        price: transaction.price,
        fees: transaction.fees || 0,
        date: new Date(transaction.date).toISOString().split('T')[0],
        currency: transaction.currency || 'BRL',
        notes: transaction.notes || '',
      })
      
      // Fetch position for SELL type
      if (transaction.type === 'SELL') {
        await fetchAvailablePosition()
      }
    }
  } catch (error) {
    console.error('Erro ao carregar transacao:', error)
    router.push('/transactions')
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  // Load wallets first
  if (walletStore.wallets.length === 0) {
    await walletStore.fetchWallets()
  }
  
  // Load transaction if editing
  await loadTransaction()
})
</script>

<style scoped>
.transaction-form-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 1rem;
}

.page-header {
  margin-bottom: 1.5rem;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-btn {
  background: none;
  border: none;
  color: #1a1a2e;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.5rem;
  display: flex;
  align-items: center;
}

.back-btn:hover {
  text-decoration: underline;
}

.header-content h1 {
  color: #1a1a2e;
  font-size: 1.5rem;
  margin: 0;
}

.form-container {
  max-width: 600px;
  margin: 0 auto;
}

.transaction-form {
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: #333;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #1a1a2e;
}

.form-group input:disabled,
.form-group select:disabled,
.form-group textarea:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.error {
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: block;
}

.char-count {
  font-size: 0.75rem;
  color: #666;
  text-align: right;
  display: block;
  margin-top: 0.25rem;
}

.type-selector {
  display: flex;
  gap: 0.5rem;
}

.type-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid #ccc;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.type-btn.buy.active {
  border-color: #155724;
  background-color: #d4edda;
  color: #155724;
}

.type-btn.sell.active {
  border-color: #721c24;
  background-color: #f8d7da;
  color: #721c24;
}

.type-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.available-info {
  margin-top: 0.5rem;
}

.info-badge {
  display: inline-block;
  background-color: #e7f3ff;
  color: #004085;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.total-section {
  background-color: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
}

.total-row,
.pnl-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
}

.total-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a2e;
}

.pnl-value {
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.pnl-value.profit {
  background-color: #d4edda;
  color: #155724;
}

.pnl-value.loss {
  background-color: #f8d7da;
  color: #721c24;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .type-selector {
    flex-direction: column;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions button {
    width: 100%;
  }
}
</style>
