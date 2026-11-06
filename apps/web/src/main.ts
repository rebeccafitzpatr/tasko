import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import './style.css'

import App from './App.vue'
import router from './router'
import { usePomodoroStore } from './stores/pomodoroStore'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
usePomodoroStore(pinia).restore()
app.use(router)
app.mount('#app')
