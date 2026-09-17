<template>
  <div class="centered-container">
    
    <nav>
      
      <h2 class="logo"> TASKO </h2>

      <div class="nav-links">
        <router-link to="/tasks">Tasks</router-link>  
        <router-link to="/skills">Skills</router-link> 
        <router-link to="/pomodoro">Pomodoro</router-link> 
        <router-link to="/analytics">Analytics</router-link>
        <router-link to="/settings">Settings</router-link>
      </div>
    </nav>
  
    <router-view />
  </div>
</template>

<script setup lang="ts">
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
nav {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 38px;
  padding: 0px 12px;
  box-sizing: border-box;
  background-color: var(--theme-medium);
  border-radius: 8px;
  box-shadow: 3px 4px 0 rgba(0,0,0,0.18);
}

.logo {
  margin: 0 14px;
  font-size: 1.3rem;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

nav a {
  display: block;
  padding: 8px 12px;
  background-color: var(--surface);
  border: 2px solid var(--theme-color);
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-strong);
}

.router-link-active {
  background-color: var(--theme-color);
  color: var(--text-on-accent);
}

/* Center all page content */
.centered-container {
  width: min(100% - 2rem, 700px);
  min-height: 80vh;
  margin: 0 auto;
  padding: 2rem;
  box-sizing: border-box;

  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;

  text-align: center;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
}

.centered-container nav,
.centered-container > .router-view {
  width: 100%;
}
</style>
