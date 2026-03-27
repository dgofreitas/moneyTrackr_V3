<template>
  <header class="header">
    <div class="header-content">
      <h1 class="logo">MoneyTrackr</h1>
      <nav class="nav">
        <router-link to="/" class="nav-link">Inicio</router-link>
      </nav>
    </div>
  </header>
</template>

<script>
export default {
  name: 'Header',
}
</script>

<style scoped>
.header {
  background-color: #1a1a2e;
  color: white;
  padding: 1rem;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
}

.nav {
  display: flex;
  gap: 1rem;
}

.nav-link {
  color: white;
  text-decoration: none;
}

.nav-link:hover {
  text-decoration: underline;
}
</style>
