export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
