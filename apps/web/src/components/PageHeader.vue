<template>
  <div class="view-header" aria-label="page-title">
    <h1 class="view-title">{{ title }}</h1>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<style scoped>
.view-header {
  height: 64px; /* must match App.vue heading height if you center inside main */
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}
.view-title {
  margin: 0;
  font-size: 1.25rem;
}
</style>