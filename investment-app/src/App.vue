<template>
  <MainLayout>
    <router-view />
  </MainLayout>
</template>

<script>
import MainLayout from './components/layout/MainLayout.vue'

export default {
  name: 'App',
  components: {
    MainLayout,
  },
}
</script>
