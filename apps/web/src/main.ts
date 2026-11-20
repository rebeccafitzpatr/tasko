import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import './style.css'

import App from './App.vue'
import router from './router'
import { usePomodoroStore } from './stores/pomodoroStore'
import { useAuthStore } from './stores/authStore'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
usePomodoroStore(pinia).restore()
useAuthStore(pinia).restoreSession()
app.use(router)
app.mount('#app')

// Fired by the API layer when a request is rejected with 401.
window.addEventListener('tasko:unauthorized', () => {
  useAuthStore(pinia).clearSession()
  if (router.currentRoute.value.path !== '/login') router.push('/login')
})
