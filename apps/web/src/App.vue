<template>
  <div class="centered-container">
    
    <nav>
      
      <h2 class="logo"> TASKO </h2>

      <div v-if="auth.isAuthenticated" class="nav-user">
        <span class="user-label" :title="auth.user?.email ?? ''">{{ auth.displayLabel }}</span>
        <button class="logout-button" type="button" @click="logout">Log out</button>
      </div>

      <div v-if="auth.isAuthenticated" class="nav-links">
        <router-link to="/tasks">Tasks</router-link>  
        <router-link to="/skills">Skills</router-link> 
        <router-link to="/pomodoro">Pomodoro</router-link> 
        <router-link to="/analytics">Analytics</router-link>
        <router-link to="/settings">Settings</router-link>
      </div>
    </nav>
  
    <main class="page-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { useAuthStore } from './stores/authStore'

  const auth = useAuthStore()
  const router = useRouter()

  async function logout() {
    try {
      await auth.logout()
    } finally {
      router.push('/login')
    }
  }

  const themes: Record<string, string> = {
    grey: '#737373',
    blue: '#2563a6',
    green: '#27734a',
    orange: '#b85c1b',
  }

  const savedTheme = localStorage.getItem('theme-key') || 'grey'
  document.documentElement.style.setProperty('--theme-color', themes[savedTheme] || themes.grey)
</script>

<style>
/* Base nav, link, and logo styling lives in style.css; this block arranges the
   two-row layout: logo + account on top, evenly spread links below. */

.centered-container nav {
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 12px;
}

.centered-container nav .logo {
  margin: 0 2px;
}

.page-content {
  padding-top: clamp(1.5rem, 3vw, 2.5rem);
}

.nav-user {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.centered-container nav .nav-links {
  flex-basis: 100%;
  margin-left: 0;
}

.centered-container nav .nav-links a {
  flex: 1 1 0;
  text-align: center;
}

.user-label {
  max-width: 180px;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.logout-button {
  min-height: 36px;
  padding: 6px 12px;
  color: var(--text-strong);
  font: inherit;
  font-size: 0.9rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.logout-button:hover:not(:disabled) {
  color: var(--text-on-accent);
  background: var(--theme-color);
  border-color: var(--theme-color);
}

@media (max-width: 700px) {
  .nav-user {
    width: 100%;
    justify-content: space-between;
    margin-left: 0;
  }

  .user-label {
    max-width: 70%;
  }
}

</style>
