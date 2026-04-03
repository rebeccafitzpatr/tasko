<template>
  <div class="centered-container">
    <nav>
      <router-link to="/tasks">Tasks</router-link> |
      <router-link to="/skills">Skills</router-link> |
      <router-link to="/pomodoro">Pomodoro</router-link> |
      <router-link to="/analytics">Analytics</router-link>
    </nav>
  
    <router-view />
  </div>
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

/* Center all page content */
.centered-container {
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  justify-content: center; /* vertical centering */
  align-items: center;     /* horizontal centering */
  text-align: center;
  padding: 2rem;
  max-width: 700px;
  margin: 0 auto;
  background: #fafafa;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
}
</style>
