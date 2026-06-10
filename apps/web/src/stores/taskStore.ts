import { defineStore } from 'pinia'
import { useSkillStore } from './skillStore'

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

export interface PomodoroLogEntry {
  taskId: string
  skillId: string
  duration: number // in minutes
  completedAt: string // ISO date string
}


export const useTaskStore = defineStore('task', {
  state: () => ({
    tasks: [] as Task[],
    pomodoroLog: [] as PomodoroLogEntry[],
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
      const skillStore = useSkillStore()
      
      if (task) {
        const skill = skillStore.skills.find(s => s.id === task.skillId)
        task.completedPomodoros = (task.completedPomodoros ?? 0) + 1
        task.minutesSpent = (task.minutesSpent ?? 0) + minutes
        if (skill) {
          skill.minutesSpent = (skill.minutesSpent ?? 0) + minutes
          console.log(`Updated skill ${skill.name}: spent ${skill.minutesSpent} minutes`)
        }

        // Add a log entry for this Pomodoro
        this.pomodoroLog.push({
          taskId: task.id,
          skillId: task.skillId,
          duration: minutes,
          completedAt: new Date().toISOString(),
        })
      }
    },
  },
  persist: true,
})
