import { defineStore } from 'pinia'
import {
  fetchCurrentUser,
  hasAuthToken,
  loginAccount,
  logoutAccount,
  registerAccount,
  setAuthToken,
  type AuthUser,
} from '../services/service'
import { useTaskStore } from './taskStore'
import { useSkillStore } from './skillStore'
import { useAnalyticsStore } from './analyticsStore'
import { usePomodoroStore } from './pomodoroStore'

/** Drops cached data so one account's tasks, skills, and history never show for another. */
function clearUserData() {
  const pomodoro = usePomodoroStore()
  pomodoro.reset()
  pomodoro.pomodoroLog = []
  pomodoro.historyOptions = {}
  pomodoro.historyHasMore = false
  pomodoro.historyNextCursor = null
  useTaskStore().$reset()
  useSkillStore().$reset()
  useAnalyticsStore().$reset()
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUser | null,
  }),
  getters: {
    isAuthenticated: state => state.user !== null,
    displayLabel: state => state.user?.displayName || state.user?.email || '',
  },
  actions: {
    async login(email: string, password: string) {
      this.user = await loginAccount(email, password)
      clearUserData()
    },
    async register(email: string, password: string, displayName: string | null) {
      this.user = await registerAccount(email, password, displayName)
      clearUserData()
    },
    /** Validates the saved token on app start and refreshes the profile. */
    async restoreSession() {
      if (!hasAuthToken()) {
        this.user = null
        return
      }
      try {
        this.user = await fetchCurrentUser()
      } catch {
        // A 401 already cleared the token and notified the app; other errors keep the cached user.
      }
    },
    clearSession() {
      setAuthToken(null)
      this.user = null
      clearUserData()
    },
    async logout() {
      await logoutAccount()
      this.user = null
      clearUserData()
    },
  },
  persist: true,
})
