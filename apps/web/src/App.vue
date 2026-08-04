<template>
  <div class="layout">
    <header class="app-header">
      <nav class="app-nav">
        <router-link to="/tasks">Tasks</router-link> |
        <router-link to="/todos">Todos</router-link> |
        <router-link to="/skills">Skills</router-link> |
        <router-link to="/pomodoro">Pomodoro</router-link> |
        <router-link to="/analytics">Analytics</router-link>
      </nav>
    </header>

    <main class="app-content">
      <section class="centered-container">
        <router-view />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
// App logic here (if needed)
</script>

<style scoped>
:root {
  --header-h: 64px;          /* adjust to match your actual header height */
  --max-content-width: 900px;
}

.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  height: var(--header-h);
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-bottom: 1px solid #eee;
  z-index: 1000;
}

.app-content {
  padding-top: var(--header-h); /* offset for fixed header */
  flex: 1;
  display: grid;
  place-items: center;          /* centers content both horizontally and vertically */
}

.centered-container {
  width: min(var(--max-content-width), 92%);
  padding: 1rem;
  background: #fafafa;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,.07);
}

.app-nav {
  display: flex;
  gap: 1rem;
  justify-content: center;
  padding: 0.75rem 1rem;
}
.app-nav a {
  color: rgb(51, 102, 244);
  text-decoration: none;
}
</style>
