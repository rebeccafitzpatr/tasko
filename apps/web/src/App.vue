<template>
  <div class="centered-container">
    <nav>
      <router-link to="/tasks">Tasks</router-link>  
      <router-link to="/skills">Skills</router-link> 
      <router-link to="/pomodoro">Pomodoro</router-link> 
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
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 38px;
  padding: 0px;
  box-sizing: border-box;
  background-color: #bbb;
  border-radius: 8px;
  box-shadow: 3px 4px 0 rgba(0,0,0,0.18);
}

nav a {
  display: block;
  padding: 8px 12px;
  background-color: #eee;
  border: 2px solid #aaa;
  border-radius: 8px;
  text-decoration: none;
  color: #000;
}

.router-link-active {
  background-color: rgba(170, 170, 170, 0.88);
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
