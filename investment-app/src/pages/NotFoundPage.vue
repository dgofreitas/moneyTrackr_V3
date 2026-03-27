<template>
  <div class="not-found-page">
    <Card>
      <h2>Pagina nao encontrada</h2>
      <p>A pagina que voce esta procurando nao existe.</p>
      <router-link to="/">Voltar para o inicio</router-link>
    </Card>
  </div>
</template>

<script>
import Card from '../components/ui/Card.vue'

export default {
  name: 'NotFoundPage',
  components: {
    Card,
  },
}
</script>

<style scoped>
.not-found-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

h2 {
  margin-bottom: 1rem;
}

p {
  margin-bottom: 1rem;
}
</style>
