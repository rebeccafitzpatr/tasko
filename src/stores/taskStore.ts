import { defineStore } from 'pinia'

export interface Task {
  id: string
  name: string
  skillId: string
  start: string // ISO date
  end: string // ISO date
  date: string // ISO date
  completedPomodoros?: number // Number of completed pomodoros
  minutesSpent?: number // Total minutes spent on this task
}

export const useTaskStore = defineStore('task', {
  state: () => ({
    tasks: [] as Task[],
  }),
  actions: {
    addTask(task: Task) {
      this.tasks.push({ ...task, completedPomodoros: task.completedPomodoros ?? 0, minutesSpent: task.minutesSpent ?? 0 })
    },
    updateTask(updated: Task) {
      const idx = this.tasks.findIndex(t => t.id === updated.id)
      if (idx !== -1) this.tasks[idx] = { ...updated }
    },
    deleteTask(id: string) {
      this.tasks = this.tasks.filter(t => t.id !== id)
    },
    incrementPomodoro(taskId: string, minutes: number) {
      const task = this.tasks.find(t => t.id === taskId)
      if (task) {
        task.completedPomodoros = (task.completedPomodoros ?? 0) + 1
        task.minutesSpent = (task.minutesSpent ?? 0) + minutes
      }
    },
  },
  persist: true,
})
