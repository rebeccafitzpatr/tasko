import { defineStore } from 'pinia'
import { fetchAnalytics, type AnalyticsSummary } from '../services/service'

const CACHE_DURATION_MS = 30_000

export const useAnalyticsStore = defineStore('analytics', {
  state: () => ({
    summary: {
      totalTasks: 0,
      totalPomodoros: 0,
      totalMinutes: 0,
    } as AnalyticsSummary,
    isLoading: false,
    hasLoaded: false,
    fetchedAt: 0,
  }),
  actions: {
    async load(force = false) {
      const isFresh = Date.now() - this.fetchedAt < CACHE_DURATION_MS
      if (!force && this.hasLoaded && isFresh) return this.summary
      if (this.isLoading) return this.summary

      this.isLoading = true
      try {
        this.summary = await fetchAnalytics()
        this.hasLoaded = true
        this.fetchedAt = Date.now()
        return this.summary
      } finally {
        this.isLoading = false
      }
    },
    invalidate() {
      this.fetchedAt = 0
    },
  },
})
