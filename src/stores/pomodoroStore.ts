import { defineStore } from 'pinia'

export const usePomodoroStore = defineStore('pomodoro', {
  state: () => ({
    isRunning: false,
    timeLeft: 25 * 60, // 25 minutes
    sessionType: 'work' as 'work' | 'break',
  }),
  actions: {
    start() {
      this.isRunning = true
    },
    pause() {
      this.isRunning = false
    },
    reset() {
      this.timeLeft = 25 * 60
      this.sessionType = 'work'
      this.isRunning = false
    },
    // More timer logic here
  },
})
