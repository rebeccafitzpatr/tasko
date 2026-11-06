import { defineStore } from 'pinia'
import { fetchAnalytics, type AnalyticsSummary, type DateRange } from '../services/service'

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
    range: {} as DateRange,
    cacheKey: '',
    requestId: 0,
  }),
  actions: {
    async load(force = false, requestedRange?: DateRange) {
      const range = requestedRange ?? this.range
      const cacheKey = JSON.stringify([range.start ?? null, range.end ?? null])
      const isFresh = Date.now() - this.fetchedAt < CACHE_DURATION_MS
      if (!force && this.hasLoaded && isFresh && cacheKey === this.cacheKey) return this.summary
      const requestId = ++this.requestId
      this.range = { ...range }

      this.isLoading = true
      try {
        const summary = await fetchAnalytics(range)
        if (requestId !== this.requestId) return this.summary
        this.summary = summary
        this.hasLoaded = true
        this.fetchedAt = Date.now()
        this.cacheKey = cacheKey
        return this.summary
      } finally {
        if (requestId === this.requestId) this.isLoading = false
      }
    },
    invalidate() {
      this.fetchedAt = 0
    },
  },
})
