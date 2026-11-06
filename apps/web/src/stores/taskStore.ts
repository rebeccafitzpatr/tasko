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
    },
    async updateTask(updated: Task) {
      //const idx = this.tasks.findIndex(t => t.id === updated.id)
      //if (idx !== -1) this.tasks[idx] = { ...updated }
      try {
        const t = await updateTask(updated.id, updated);
        const idx = this.tasks.findIndex(x => x.id === updated.id);
        if (idx !== -1) this.tasks[idx] = t;
      } catch (e) {
        console.error(e);
        // Optional: reconcile with backend to ensure consistency
        await this.loadTasks();
      }
    },
    async deleteTask(id: number) {
      const taskIndex = this.tasks.findIndex(task => task.id === id)
      const deletedTask = taskIndex === -1 ? undefined : this.tasks[taskIndex]
      if (taskIndex !== -1) this.tasks.splice(taskIndex, 1)

      try {
        await deleteTask(id);
      } catch (e) {
        if (deletedTask) this.tasks.splice(taskIndex, 0, deletedTask)
        console.error(e);
      }
      useAnalyticsStore().invalidate()
    },
  },
  persist: true,
})
