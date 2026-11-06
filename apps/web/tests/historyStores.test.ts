import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePomodoroStore } from '../src/stores/pomodoroStore'
import { useAnalyticsStore } from '../src/stores/analyticsStore'
import { fetchPomodoros, fetchAnalytics, type SessionPage, type AnalyticsSummary } from '../src/services/service'

vi.mock('../src/services/service', () => ({ fetchPomodoros: vi.fn(), fetchAnalytics: vi.fn() }))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

const page: SessionPage = { items: [], hasMore: true, nextCursor: 'next', limit: 25 }

describe('history page requests', () => {
  it('retains the last successful page on errors and permits retry', async () => {
    const store = usePomodoroStore()
    vi.mocked(fetchPomodoros).mockResolvedValueOnce(page)
    await store.loadPomodoros({ limit: 25 })
    vi.mocked(fetchPomodoros).mockRejectedValueOnce(new Error('Unavailable'))
    await expect(store.loadPomodoros({ cursor: 'next', limit: 25 })).rejects.toThrow('Unavailable')
    expect(store.historyOptions).toEqual({ limit: 25 })
    expect(store.historyNextCursor).toBe('next')
    expect(store.historyIsLoading).toBe(false)
    vi.mocked(fetchPomodoros).mockResolvedValueOnce({ ...page, hasMore: false, nextCursor: null })
    await store.loadPomodoros({ cursor: 'next', limit: 25 })
    expect(store.historyHasMore).toBe(false)
  })

  it('does not apply a stale response after a new date filter request', async () => {
    const store = usePomodoroStore()
    let finish!: (page: SessionPage) => void
    vi.mocked(fetchPomodoros).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const stale = store.loadPomodoros({ cursor: 'old' })
    vi.mocked(fetchPomodoros).mockResolvedValueOnce({ ...page, nextCursor: 'new' })
    await store.loadPomodoros({ start: '2026-01-01' })
    finish(page)
    await stale
    expect(store.historyNextCursor).toBe('new')
    expect(store.historyOptions).toEqual({ start: '2026-01-01' })
  })

  it('a background timer refresh cannot overtake a requested history page', async () => {
    const store = usePomodoroStore()
    let finish!: (page: SessionPage) => void
    vi.mocked(fetchPomodoros).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const loading = store.loadPomodoros({ cursor: 'next' })
    await store.loadPomodoros()
    expect(fetchPomodoros).toHaveBeenCalledTimes(1)
    finish(page)
    await loading
    expect(store.historyOptions).toEqual({ cursor: 'next' })
  })
})

describe('complete aggregate cache', () => {
  const summary: AnalyticsSummary = { totalPomodoros: 140, totalMinutes: 140, totalTasks: 1 }

  it('caches by date range, not by the history page', async () => {
    const store = useAnalyticsStore()
    vi.mocked(fetchAnalytics).mockResolvedValue(summary)
    await store.load(false, { start: '2026-01-01' })
    await store.load(false, { start: '2026-01-01' })
    expect(fetchAnalytics).toHaveBeenCalledTimes(1)
    await store.load(false, { start: '2026-02-01' })
    expect(fetchAnalytics).toHaveBeenCalledTimes(2)
    await store.load(true)
    expect(fetchAnalytics).toHaveBeenLastCalledWith({ start: '2026-02-01' })
    expect(store.summary.totalMinutes).toBe(140)
  })

  it('does not overwrite newly filtered aggregates with an older response', async () => {
    const store = useAnalyticsStore()
    let finish!: (summary: AnalyticsSummary) => void
    vi.mocked(fetchAnalytics).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const old = store.load(false, {})
    vi.mocked(fetchAnalytics).mockResolvedValueOnce({ ...summary, totalMinutes: 50 })
    await store.load(false, { end: '2026-01-01' })
    finish(summary)
    await old
    expect(store.summary.totalMinutes).toBe(50)
    expect(store.range).toEqual({ end: '2026-01-01' })
    expect(store.isLoading).toBe(false)
  })
})
