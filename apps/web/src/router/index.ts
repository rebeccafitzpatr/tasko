import { createRouter, createWebHistory} from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import TasksView from '../views/TasksView.vue'
import SkillsView from '../views/SkillsView.vue'
import AnalyticsView from '../views/AnalyticsView.vue'
import PomodoroView from '../views/PomodoroView.vue'
import TodoView from '../views/TodoView.vue'

const routes: Array<RouteRecordRaw> = [
  { path: '/', redirect: '/tasks' },
  { path: '/tasks', component: TasksView },
  { path: '/skills', component: SkillsView },
  { path: '/analytics', component: AnalyticsView },
  { path: '/pomodoro', component: PomodoroView },
  { path: '/todos', component: TodoView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
