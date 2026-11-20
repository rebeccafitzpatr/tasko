import { createRouter, createWebHistory} from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import TasksView from '../views/TasksView.vue'
import SkillsView from '../views/SkillsView.vue'
import AnalyticsView from '../views/AnalyticsView.vue'
import PomodoroView from '../views/PomodoroView.vue'
import SettingsView from '../views/SettingsView.vue'
import LoginView from '../views/LoginView.vue'
import { hasAuthToken } from '../services/service'

const routes: Array<RouteRecordRaw> = [
  { path: '/', redirect: '/tasks' },
  { path: '/login', component: LoginView, meta: { public: true } },
  { path: '/tasks', component: TasksView },
  { path: '/skills', component: SkillsView },
  { path: '/analytics', component: AnalyticsView },
  { path: '/pomodoro', component: PomodoroView },
  { path: '/settings', component: SettingsView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(to => {
  if (to.meta.public) return hasAuthToken() ? '/tasks' : true
  if (!hasAuthToken()) {
    return { path: '/login', query: to.fullPath === '/tasks' ? {} : { redirect: to.fullPath } }
  }
  return true
})

export default router
