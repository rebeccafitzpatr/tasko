import { defineStore } from 'pinia'
import { useTaskStore } from './taskStore'
import { fetchPomodoros, type PomodoroLog } from '../services/service'
import { useSkillStore } from './skillStore'
import { useAnalyticsStore } from './analyticsStore'

let interval: ReturnType<typeof setInterval> | null = null

export const usePomodoroStore = defineStore('pomodoro', {
  state: () => ({
    isRunning: false,
    timeLeft: 25 * 60,
    sessionType: 'work' as 'work' | 'break',
    currentTaskId: null as number | null,
    duration: 25,
    completionError: '',
    pomodoroLog: [] as PomodoroLog[], // keep a local cache of logs
  }),
  actions: {
    selectTask(taskId: number) {
      this.currentTaskId = taskId
    },
    setDuration(minutes: number) {
      this.duration = minutes
      this.timeLeft = minutes * 60
    },
    async loadPomodoros() {
      this.pomodoroLog = await fetchPomodoros()
    },
    start() {
      if (this.isRunning) return
      this.completionError = ''
      this.isRunning = true
      if (interval) clearInterval(interval)
      interval = setInterval(async () => {
        if (this.timeLeft > 0) {
          this.timeLeft--
        } else {
          this.pause()
          try {
            if (this.currentTaskId != null) {
              const taskStore = useTaskStore()
              await taskStore.incrementPomodoro(this.currentTaskId, this.duration)
              const skillStore = useSkillStore()
              const task = taskStore.tasks.find(t => t.id === this.currentTaskId)
              if (task?.skillId != null) {
                await skillStore.incrementSkillTime(task.skillId, this.duration)
              }
              const analyticsStore = useAnalyticsStore()
              await analyticsStore.load(true)
            }
          } catch (error) {
            this.completionError = error instanceof Error
              ? error.message
              : 'Unable to save the completed session.'
          } finally {
            this.reset(false)
          }
        }
      }, 1000)
    },
    pause() {
      this.isRunning = false
      if (interval) clearInterval(interval)
      interval = null
    },
    reset(clearCompletionError = true) {
      this.timeLeft = this.duration * 60
      this.sessionType = 'work'
      this.isRunning = false
      this.currentTaskId = null
      if (clearCompletionError) this.completionError = ''
      if (interval) clearInterval(interval)
      interval = null
    },
    // Optional: call this on app unmount or before reload to clean up
    cleanup() {
      if (interval) clearInterval(interval)
      interval = null
    }
  },
  persist: true,
})