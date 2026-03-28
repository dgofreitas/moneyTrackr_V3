<template>
  <Modal :isOpen="isOpen" @close="close" title="Confirmar Venda">
    <div class="confirm-content">
      <!-- Transaction Summary -->
      <div class="summary-section">
        <h3>Resumo da Operacao</h3>
        <div class="summary-row">
          <span>Ativo:</span>
          <strong>{{ transaction?.ticker }}</strong>
        </div>
        <div class="summary-row">
          <span>Quantidade:</span>
          <strong>{{ formatNumber(transaction?.quantity) }}</strong>
        </div>
        <div class="summary-row">
          <span>Preco de Venda:</span>
          <strong>{{ formatCurrency(transaction?.price) }}</strong>
        </div>
        <div class="summary-row">
          <span>Taxas:</span>
          <strong>{{ formatCurrency(transaction?.fees || 0) }}</strong>
        </div>
        <div class="summary-row total">
          <span>Total Liquido:</span>
          <strong>{{ formatCurrency(netTotal) }}</strong>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <!-- P/L Section -->
      <div class="pnl-section">
        <h3>Lucro/Prejuizo</h3>
        <div class="summary-row">
          <span>Preco Medio:</span>
          <strong>{{ formatCurrency(position?.averagePrice || 0) }}</strong>
        </div>
        <div class="summary-row pnl">
          <span>P/L Estimado:</span>
          <strong :class="['pnl-value', estimatedPnL >= 0 ? 'profit' : 'loss']">
            {{ formatCurrency(estimatedPnL) }}
          </strong>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <!-- Position Impact -->
      <div class="position-section">
        <h3>Impacto na Posicao</h3>
        <div class="summary-row">
          <span>Posicao Atual:</span>
          <strong>{{ formatNumber(position?.quantity || 0) }} unidades</strong>
        </div>
        <div class="summary-row">
          <span>Posicao Apos Venda:</span>
          <strong>{{ formatNumber(positionAfterSale) }} unidades</strong>
        </div>
        <div v-if="positionAfterSale === 0" class="position-closed">
          ⚠️ Esta operacao encerrara sua posicao neste ativo.
        </div>
      </div>
    </div>
    
    <template #footer>
      <Button variant="secondary" @click="close">
        Cancelar
      </Button>
      <Button variant="danger" :loading="isLoading" @click="confirm">
        Confirmar Venda
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { computed } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Button from '@/components/ui/Button.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  transaction: {
    type: Object,
    default: null,
  },
  position: {
    type: Object,
    default: null,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'confirm'])

const netTotal = computed(() => {
  if (!props.transaction) return 0
  const gross = props.transaction.quantity * props.transaction.price
  return gross - (props.transaction.fees || 0)
})

const estimatedPnL = computed(() => {
  if (!props.transaction || !props.position) return 0
  const { quantity, price, fees = 0 } = props.transaction
  const { averagePrice = 0 } = props.position
  return (price * quantity) - (averagePrice * quantity) - fees
})

const positionAfterSale = computed(() => {
  if (!props.position || !props.transaction) return 0
  return Math.max(0, props.position.quantity - props.transaction.quantity)
})

const close = () => {
  emit('close')
}

const confirm = () => {
  emit('confirm')
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
</script>

<style scoped>
.confirm-content {
  padding: 0;
}

.summary-section,
.pnl-section,
.position-section {
  margin-bottom: 1rem;
}

.summary-section h3,
.pnl-section h3,
.position-section h3 {
  font-size: 1rem;
  color: #1a1a2e;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
}

.summary-row span {
  color: #666;
}

.summary-row strong {
  color: #333;
}

.summary-row.total {
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid #eee;
  font-size: 1.1rem;
}

.summary-row.total strong {
  color: #1a1a2e;
}

.divider {
  height: 1px;
  background-color: #eee;
  margin: 1rem 0;
}

.pnl-value.profit {
  color: #155724;
  background-color: #d4edda;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.pnl-value.loss {
  color: #721c24;
  background-color: #f8d7da;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.position-closed {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  color: #856404;
  font-size: 0.875rem;
  text-align: center;
}
</style>
