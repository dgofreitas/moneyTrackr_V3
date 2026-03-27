<template>
  <div class="home-page">
    <Card>
      <h2>Bem-vindo ao MoneyTrackr</h2>
      <p>Sistema de gestao de carteiras de investimentos.</p>
      <p>Gerencie seus investimentos de forma simples e eficiente.</p>
    </Card>
  </div>
</template>

<script>
import Card from '../components/ui/Card.vue'

export default {
  name: 'HomePage',
  components: {
    Card,
  },
}
</script>

<style scoped>
.home-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

h2 {
  margin-bottom: 1rem;
}

p {
  margin-bottom: 0.5rem;
}
</style>
