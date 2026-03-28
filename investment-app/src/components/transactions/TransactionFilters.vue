<template>
  <div class="transaction-filters">
    <div class="filter-row">
      <!-- Date Range -->
      <div class="filter-group">
        <label>Periodo</label>
        <div class="date-range">
          <input
            type="date"
            v-model="filters.startDate"
            :max="filters.endDate || todayDate"
            placeholder="Data Inicial"
          />
          <span class="separator">ate</span>
          <input
            type="date"
            v-model="filters.endDate"
            :min="filters.startDate"
            :max="todayDate"
            placeholder="Data Final"
          />
        </div>
      </div>
      
      <!-- Type Filter -->
      <div class="filter-group">
        <label>Tipo</label>
        <select v-model="filters.type">
          <option value="">Todos</option>
          <option value="BUY">Compra</option>
          <option value="SELL">Venda</option>
        </select>
      </div>
      
      <!-- Ticker Filter -->
      <div class="filter-group">
        <label>Ticker</label>
        <input
          type="text"
          v-model="filters.ticker"
          placeholder="Ex: PETR4"
          maxlength="20"
          @blur="normalizeTicker"
        />
      </div>
    </div>
    
    <div class="filter-actions">
      <Button variant="primary" @click="applyFilters">
        Aplicar Filtros
      </Button>
      <Button variant="secondary" @click="clearFilters">
        Limpar
      </Button>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue'
import Button from '@/components/ui/Button.vue'

const emit = defineEmits(['apply', 'clear'])

const filters = reactive({
  startDate: '',
  endDate: '',
  type: '',
  ticker: '',
})

const todayDate = computed(() => new Date().toISOString().split('T')[0])

const normalizeTicker = () => {
  filters.ticker = filters.ticker.toUpperCase().trim()
}

const applyFilters = () => {
  normalizeTicker()
  const activeFilters = {}
  
  if (filters.startDate) activeFilters.startDate = filters.startDate
  if (filters.endDate) activeFilters.endDate = filters.endDate
  if (filters.type) activeFilters.type = filters.type
  if (filters.ticker) activeFilters.ticker = filters.ticker
  
  emit('apply', activeFilters)
}

const clearFilters = () => {
  filters.startDate = ''
  filters.endDate = ''
  filters.type = ''
  filters.ticker = ''
  emit('clear')
}

defineExpose({
  filters,
  applyFilters,
  clearFilters,
})
</script>

<style scoped>
.transaction-filters {
  background-color: white;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.filter-group {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-group label {
  font-weight: 500;
  font-size: 0.875rem;
  color: #333;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-range input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.875rem;
}

.separator {
  color: #666;
  font-size: 0.875rem;
}

.filter-group select,
.filter-group input[type="text"] {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.875rem;
}

.filter-group select:focus,
.filter-group input:focus {
  outline: none;
  border-color: #1a1a2e;
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

/* Responsive */
@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
  }
  
  .filter-group {
    min-width: 100%;
  }
  
  .date-range {
    flex-direction: column;
    align-items: stretch;
  }
  
  .separator {
    text-align: center;
  }
  
  .filter-actions {
    flex-direction: column;
  }
  
  .filter-actions button {
    width: 100%;
  }
}
</style>
