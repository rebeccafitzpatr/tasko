import { defineStore } from 'pinia'

export const usePomodoroStore = defineStore('pomodoro', {
  state: () => ({
    isRunning: false,
    timeLeft: 25 * 60, // 25 minutes
    sessionType: 'work' as 'work' | 'break',
    currentTaskId: '' as string,
    duration: 25, // in minutes
  }),
  actions: {
    selectTask(taskId: string) {
      this.currentTaskId = taskId
    },
    setDuration(minutes: number) {
      this.duration = minutes
      this.timeLeft = minutes * 60
    },
    start() {
      this.isRunning = true
    },
    pause() {
      this.isRunning = false
    },
    reset() {
      this.timeLeft = this.duration * 60
      this.sessionType = 'work'
      this.isRunning = false
      this.currentTaskId = ''
    },
  },
  persist: true,
})
