<template>
  <nav>
    <router-link to="/tasks">Tasks</router-link> |
    <router-link to="/skills">Skills</router-link> |
    <router-link to="/pomodoro">Pomodoro</router-link> |
    <router-link to="/analytics">Analytics</router-link>
  </nav>
  <router-view />
</template>

<script setup lang="ts">
// App logic here (if needed)
</script>

<style>
nav {
  margin-bottom: 1rem;
}
nav a {
  margin-right: 1rem;
}
</style>
