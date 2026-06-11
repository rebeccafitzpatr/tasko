import { defineStore } from 'pinia'
import { useTaskStore } from './taskStore'
import { fetchPomodoros } from '../services/service'

let interval: ReturnType<typeof setInterval> | null = null

export const usePomodoroStore = defineStore('pomodoro', {
  state: () => ({
    isRunning: false,
    timeLeft: 25 * 60,
    sessionType: 'work' as 'work' | 'break',
    currentTaskId: null as number | null,
    duration: 25,
    pomodoroLog: [] as { id: number; taskId: number; duration: number; completed: boolean }[], // keep a local cache of logs
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
    async start() {
      if (this.isRunning) return
      this.isRunning = true
      if (interval) clearInterval(interval)
      interval = setInterval(() => {
        if (this.timeLeft > 0) {
          this.timeLeft--
        } else {
          this.pause()
          // on completion of timer
          if (this.currentTaskId != null) {
            const taskStore = useTaskStore()
            taskStore.incrementPomodoro(this.currentTaskId, this.duration)
          }
          this.reset()
        }
      }, 1000)
    },
    pause() {
      this.isRunning = false
      if (interval) clearInterval(interval)
      interval = null
    },
    reset() {
      this.timeLeft = this.duration * 60
      this.sessionType = 'work'
      this.isRunning = false
      this.currentTaskId = null
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