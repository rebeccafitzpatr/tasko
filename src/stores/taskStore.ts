import { defineStore } from 'pinia'

export interface Task {
  id: string
  name: string
  skillId: string
  start: string // ISO date
  end: string // ISO date
  date: string // ISO date
}

export const useTaskStore = defineStore('task', {
  state: () => ({
    tasks: [] as Task[],
  }),
  actions: {
    addTask(task: Task) {
      this.tasks.push(task)
    },
    updateTask(updated: Task) {
      const idx = this.tasks.findIndex(t => t.id === updated.id)
      if (idx !== -1) this.tasks[idx] = updated
    },
    deleteTask(id: string) {
      this.tasks = this.tasks.filter(t => t.id !== id)
    },
  },
})
