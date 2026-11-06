import { defineStore } from 'pinia'
import { addPomodoro, fetchPomodoros, type PomodoroLog } from '../services/service'
import { useTaskStore } from './taskStore'
import { useSkillStore } from './skillStore'
import { useAnalyticsStore } from './analyticsStore'

export const TIMER_STORAGE_KEY = 'tasko-timer-v1'

interface SavedTimer {
  version: 1
  duration: number
  timeLeft: number
  currentTaskId: number | null
  completionId: string | null
  endsAt: number | null
  pendingCompletion: boolean
}

function isSavedTimer(value: unknown): value is SavedTimer {
  if (typeof value !== 'object' || value === null) return false
  const timer = value as Record<string, unknown>
  return timer.version === 1 &&
    typeof timer.duration === 'number' && Number.isInteger(timer.duration) &&
    timer.duration >= 1 && timer.duration <= 60 &&
    typeof timer.timeLeft === 'number' && Number.isInteger(timer.timeLeft) &&
    timer.timeLeft >= 0 && timer.timeLeft <= timer.duration * 60 &&
    (timer.currentTaskId === null ||
      (typeof timer.currentTaskId === 'number' && Number.isSafeInteger(timer.currentTaskId) && timer.currentTaskId > 0)) &&
    (timer.completionId === null ||
      (typeof timer.completionId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(timer.completionId))) &&
    (timer.endsAt === null ||
      (typeof timer.endsAt === 'number' && Number.isSafeInteger(timer.endsAt) && timer.endsAt > 0)) &&
    typeof timer.pendingCompletion === 'boolean' &&
    ((timer.endsAt === null && !timer.pendingCompletion) ||
      (timer.currentTaskId !== null && timer.completionId !== null)) &&
    (!timer.pendingCompletion || (timer.endsAt === null && timer.timeLeft === 0))
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export const usePomodoroStore = defineStore('pomodoro', {
  state: () => ({
    isRunning: false,
    timeLeft: 25 * 60,
    sessionType: 'work' as 'work' | 'break',
    currentTaskId: null as number | null,
    duration: 25,
    completionId: null as string | null,
    endsAt: null as number | null,
    pendingCompletion: false,
    isSaving: false,
    completionError: '',
    persistenceError: '',
    refreshError: '',
    pomodoroLog: [] as PomodoroLog[],
    interval: null as ReturnType<typeof setInterval> | null,
  }),
  actions: {
    persistTimer() {
      const saved: SavedTimer = {
        version: 1,
        duration: this.duration,
        timeLeft: this.timeLeft,
        currentTaskId: this.currentTaskId,
        completionId: this.completionId,
        endsAt: this.endsAt,
        pendingCompletion: this.pendingCompletion,
      }
      try {
        localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(saved))
        this.persistenceError = ''
        return true
      } catch (error) {
        this.persistenceError = `Cannot persist timer progress: ${errorMessage(error)}. Keep this page open.`
        return false
      }
    },
    restore() {
      this.cleanup()
      try {
        const raw = localStorage.getItem(TIMER_STORAGE_KEY)
        if (raw === null) {
          // Older timers have no deadline or completion identity and cannot be resumed safely.
          const legacy = localStorage.getItem('pomodoro')
          if (legacy !== null) {
            this.persistenceError = 'An older timer cannot be safely resumed. Select a task and start a new timer.'
          }
          return
        }
        const saved: unknown = JSON.parse(raw)
        if (!isSavedTimer(saved)) throw new Error('Saved timer data is invalid')
        this.duration = saved.duration
        this.timeLeft = saved.timeLeft
        this.currentTaskId = saved.currentTaskId
        this.completionId = saved.completionId
        this.endsAt = saved.endsAt
        this.pendingCompletion = saved.pendingCompletion
        this.isRunning = this.endsAt !== null
        if (this.endsAt !== null) {
          this.timeLeft = Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000))
          if (this.timeLeft === 0) {
            this.isRunning = false
            this.endsAt = null
            this.pendingCompletion = true
            this.persistTimer()
          } else {
            this.scheduleTick()
          }
        }
      } catch (error) {
        this.isRunning = false
        this.persistenceError = `Cannot restore timer progress: ${errorMessage(error)}.`
      }
    },
    selectTask(taskId: number | null) {
      if (this.isRunning || this.isSaving || this.pendingCompletion) return
      if (this.currentTaskId !== taskId) {
        this.completionId = null
        this.timeLeft = this.duration * 60
      }
      this.currentTaskId = taskId
      this.persistTimer()
    },
    setDuration(minutes: number) {
      if (this.isRunning || this.isSaving || this.pendingCompletion) return
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
        this.completionError = 'Duration must be a whole number from 1 to 60 minutes.'
        return
      }
      this.duration = minutes
      this.timeLeft = minutes * 60
      this.completionId = null
      this.persistTimer()
    },
    async loadPomodoros() {
      this.pomodoroLog = await fetchPomodoros()
    },
    start() {
      if (this.isRunning || this.isSaving || this.pendingCompletion) return
      if (this.currentTaskId === null) {
        this.completionError = 'Select a task before starting the timer.'
        return
      }
      try {
        this.completionId ??= crypto.randomUUID()
      } catch (error) {
        this.persistenceError = `Cannot identify this timer: ${errorMessage(error)}.`
        return
      }
      this.completionError = ''
      this.endsAt = Date.now() + this.timeLeft * 1000
      this.isRunning = true
      if (!this.persistTimer()) {
        this.isRunning = false
        this.endsAt = null
        return
      }
      this.scheduleTick()
    },
    scheduleTick() {
      this.cleanup()
      this.interval = setInterval(() => { void this.tick() }, 250)
    },
    async tick() {
      if (!this.isRunning || this.endsAt === null) return
      this.timeLeft = Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000))
      if (this.timeLeft > 0) return
      this.isRunning = false
      this.endsAt = null
      this.pendingCompletion = true
      this.cleanup()
      await this.saveCompletion()
    },
    async saveCompletion() {
      if (!this.pendingCompletion || this.isSaving ||
          this.currentTaskId === null || this.completionId === null) return
      if (!this.persistTimer()) return
      this.isSaving = true
      this.completionError = ''
      try {
        const session = await addPomodoro(this.currentTaskId, this.duration, this.completionId)
        if (!this.pomodoroLog.some(log => log.id === session.id)) {
          this.pomodoroLog.unshift(session)
        }
        this.reset(true)
      } catch (error) {
        this.completionError = `Could not save session: ${errorMessage(error)}. Retry to save this same session.`
        return
      } finally {
        this.isSaving = false
      }

      // A reporting refresh failure must not turn an acknowledged save into a failed completion.
      try {
        await Promise.all([
          useTaskStore().loadTasks(),
          useSkillStore().loadSkills(),
          useAnalyticsStore().load(true),
        ])
        this.refreshError = ''
      } catch (error) {
        this.refreshError = `Session saved, but reports could not refresh: ${errorMessage(error)}.`
      }
    },
    pause() {
      if (!this.isRunning || this.endsAt === null) return
      this.timeLeft = Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000))
      this.endsAt = null
      this.isRunning = false
      this.cleanup()
      this.pendingCompletion = this.timeLeft === 0
      this.persistTimer()
    },
    reset(afterSave = false) {
      if (this.isSaving && !afterSave) return
      this.cleanup()
      this.timeLeft = this.duration * 60
      this.sessionType = 'work'
      this.isRunning = false
      this.endsAt = null
      this.currentTaskId = null
      this.completionId = null
      this.pendingCompletion = false
      this.completionError = ''
      this.refreshError = ''
      this.persistTimer()
    },
    cleanup() {
      if (this.interval !== null) clearInterval(this.interval)
      this.interval = null
    },
  },
})
