import { defineStore } from 'pinia'
import { useAnalyticsStore } from './analyticsStore'
import { fetchTasks, createTask, updateTask, deleteTask } from '../services/service'

export interface Task {
  id: number
  name: string
  skillId?: number | null
  start?: string // ISO date
  end?: string // ISO date
  date?: string // ISO date
  completedPomodoros?: number // Number of completed pomodoros
  minutesSpent?: number // Total minutes spent on this task
  createdAt?: string // ISO date
  updatedAt?: string // ISO date
  skillName?: string // Optional skill name for display purposes
  skillPath?: string | null
  
}

export interface PomodoroLogEntry {
  id?: number
  taskId: number | null
  skillId?: number | null
  taskName?: string | null
  skillName?: string | null
  duration: number // in minutes
  completedAt: string // ISO date string
  type?: 'timer' | 'manual'
}


export const useTaskStore = defineStore('task', {
  state: () => ({
    tasks: [] as Task[],
    pomodoroLog: [] as PomodoroLogEntry[],
  }),
  actions: {
    async loadTasks() {
      this.tasks = await fetchTasks();
    },
    async addTask(task: Task) {
      const newTask = await createTask(task.name, task.skillId ?? null);
      this.tasks.push(newTask);
      useAnalyticsStore().invalidate()
    },
    async updateTask(updated: Task) {
      const task = await updateTask(updated.id, updated);
      const idx = this.tasks.findIndex(x => x.id === updated.id);
      if (idx !== -1) this.tasks[idx] = { ...this.tasks[idx], ...task };
      useAnalyticsStore().invalidate()
    },
    async deleteTask(id: number) {
      await deleteTask(id);
      this.tasks = this.tasks.filter(task => task.id !== id)
      useAnalyticsStore().invalidate()
    },
  },
  persist: true,
})
