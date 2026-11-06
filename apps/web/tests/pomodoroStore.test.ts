import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { TIMER_STORAGE_KEY, usePomodoroStore } from '../src/stores/pomodoroStore'
import { addPomodoro, fetchAnalytics, fetchSkills, fetchTasks } from '../src/services/service'

vi.mock('../src/services/service', () => ({
  addPomodoro: vi.fn(),
  fetchPomodoros: vi.fn().mockResolvedValue([]),
  fetchAnalytics: vi.fn(),
  fetchSkills: vi.fn(),
  fetchTasks: vi.fn(),
}))

describe('durable timer', () => {
  let values: Map<string, string>
  let stores: ReturnType<typeof usePomodoroStore>[]

  function newStore() {
    setActivePinia(createPinia())
    const store = usePomodoroStore()
    stores.push(store)
    return store
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-06T00:00:00Z'))
    vi.resetAllMocks()
    vi.mocked(fetchTasks).mockResolvedValue([])
    vi.mocked(fetchSkills).mockResolvedValue([])
    vi.mocked(fetchAnalytics).mockResolvedValue({ totalPomodoros: 1, totalMinutes: 1, totalTasks: 1 })
    vi.mocked(addPomodoro).mockImplementation(async (taskId, duration, completionId) => ({
      id: 1, taskId, duration, completionId,
      skillId: null, taskName: 'Study', skillName: null,
      completedAt: new Date().toISOString(), type: 'timer',
    }))
    values = new Map()
    stores = []
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
    })
  })

  afterEach(() => {
    stores.forEach(store => store.cleanup())
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function startTimer() {
    const store = newStore()
    store.selectTask(12)
    store.setDuration(1)
    store.start()
    return store
  }

  it('restores the deadline, task, and identity after a reload', async () => {
    const original = startTimer()
    const completionId = original.completionId
    await vi.advanceTimersByTimeAsync(15_000)
    original.cleanup()
    const restored = newStore()
    restored.restore()
    expect(restored.currentTaskId).toBe(12)
    expect(restored.completionId).toBe(completionId)
    expect(restored.timeLeft).toBe(45)
    expect(restored.isRunning).toBe(true)
    expect(addPomodoro).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(45_000)
    expect(addPomodoro).toHaveBeenCalledExactlyOnceWith(12, 1, completionId)
    expect(restored.pendingCompletion).toBe(false)
  })

  it('uses wall-clock elapsed time rather than interval ticks', async () => {
    const store = startTimer()
    vi.setSystemTime(new Date('2026-11-06T00:00:40Z'))
    await store.tick()
    expect(store.timeLeft).toBe(20)
    expect(addPomodoro).not.toHaveBeenCalled()
  })

  it('pauses across reloads without consuming paused time or recording a session', async () => {
    const original = startTimer()
    await vi.advanceTimersByTimeAsync(20_000)
    original.pause()
    await vi.advanceTimersByTimeAsync(120_000)
    const restored = newStore()
    restored.restore()
    expect(restored.isRunning).toBe(false)
    expect(restored.timeLeft).toBe(40)
    expect(addPomodoro).not.toHaveBeenCalled()
    restored.start()
    await vi.advanceTimersByTimeAsync(40_000)
    expect(addPomodoro).toHaveBeenCalledTimes(1)
  })

  it('reset cancels the timer without creating a session, including after restart', async () => {
    const original = startTimer()
    await vi.advanceTimersByTimeAsync(10_000)
    original.reset()
    const restored = newStore()
    restored.restore()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(restored.currentTaskId).toBeNull()
    expect(restored.isRunning).toBe(false)
    expect(addPomodoro).not.toHaveBeenCalled()
  })

  it('does not submit an elapsed timer just because the app restarted', async () => {
    const original = startTimer()
    original.cleanup()
    await vi.advanceTimersByTimeAsync(90_000)
    const restored = newStore()
    restored.restore()
    expect(restored.timeLeft).toBe(0)
    expect(restored.pendingCompletion).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(addPomodoro).not.toHaveBeenCalled()
    await restored.saveCompletion()
    await restored.saveCompletion()
    expect(addPomodoro).toHaveBeenCalledTimes(1)
  })

  it('reset discards an unsaved completion instead of submitting it after restart', async () => {
    const original = startTimer()
    original.cleanup()
    await vi.advanceTimersByTimeAsync(90_000)
    const restored = newStore()
    restored.restore()
    restored.reset()
    const restarted = newStore()
    restarted.restore()
    await restarted.saveCompletion()
    expect(restarted.pendingCompletion).toBe(false)
    expect(addPomodoro).not.toHaveBeenCalled()
  })

  it('assigns different completion IDs to consecutive timers', async () => {
    const store = startTimer()
    const firstId = store.completionId
    await vi.advanceTimersByTimeAsync(60_000)
    store.selectTask(12)
    store.start()
    expect(store.completionId).not.toBe(firstId)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(addPomodoro).toHaveBeenCalledTimes(2)
  })

  it('retains an ambiguous failed save across reloads and retries with the same ID', async () => {
    vi.mocked(addPomodoro).mockRejectedValueOnce(new Error('Response lost'))
    const original = startTimer()
    const completionId = original.completionId
    await vi.advanceTimersByTimeAsync(60_000)
    expect(original.completionError).toContain('Response lost')
    expect(original.pendingCompletion).toBe(true)
    const restored = newStore()
    restored.restore()
    expect(restored.pendingCompletion).toBe(true)
    expect(addPomodoro).toHaveBeenCalledTimes(1)
    await restored.saveCompletion()
    expect(addPomodoro).toHaveBeenNthCalledWith(2, 12, 1, completionId)
    expect(restored.pendingCompletion).toBe(false)
  })

  it('prevents parallel completion requests and reset while saving', async () => {
    let resolveSave!: (value: Awaited<ReturnType<typeof addPomodoro>>) => void
    vi.mocked(addPomodoro).mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve }))
    const store = startTimer()
    vi.setSystemTime(new Date('2026-11-06T00:01:00Z'))
    const completion = store.tick()
    await store.saveCompletion()
    store.reset()
    expect(store.isSaving).toBe(true)
    expect(store.pendingCompletion).toBe(true)
    expect(addPomodoro).toHaveBeenCalledTimes(1)
    resolveSave({
      id: 1, taskId: 12, skillId: null, taskName: 'Study', skillName: null,
      duration: 1, completedAt: new Date().toISOString(), type: 'timer',
    })
    await completion
    expect(store.isSaving).toBe(false)
    expect(store.pendingCompletion).toBe(false)
  })

  it('shows storage failures and refuses to start an unpersisted timer', () => {
    const store = newStore()
    store.selectTask(12)
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('Quota exceeded') })
    store.start()
    expect(store.isRunning).toBe(false)
    expect(store.persistenceError).toContain('Quota exceeded')
    expect(addPomodoro).not.toHaveBeenCalled()
  })

  it('does not send a completion if its retry identity cannot be persisted', async () => {
    const store = startTimer()
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('Storage blocked') })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(store.pendingCompletion).toBe(true)
    expect(store.persistenceError).toContain('Storage blocked')
    expect(addPomodoro).not.toHaveBeenCalled()
  })

  it('reports invalid saved data instead of inventing a running timer', () => {
    values.set(TIMER_STORAGE_KEY, '{"version":1}')
    const store = newStore()
    store.restore()
    expect(store.persistenceError).toContain('invalid')
    expect(store.isRunning).toBe(false)
    expect(addPomodoro).not.toHaveBeenCalled()
  })

  it('shows storage read failures during restoration', () => {
    vi.mocked(localStorage.getItem).mockImplementation(() => { throw new Error('Storage access denied') })
    const store = newStore()
    store.restore()
    expect(store.persistenceError).toContain('Storage access denied')
    expect(store.isRunning).toBe(false)
    expect(addPomodoro).not.toHaveBeenCalled()
  })

  it('pausing at the deadline does not submit a completion', async () => {
    const store = startTimer()
    vi.setSystemTime(new Date('2026-11-06T00:01:00Z'))
    store.pause()
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.pendingCompletion).toBe(true)
    expect(addPomodoro).not.toHaveBeenCalled()
  })

  it('does not resubmit a saved session when a report refresh fails', async () => {
    vi.mocked(fetchAnalytics).mockRejectedValue(new Error('Reports unavailable'))
    const store = startTimer()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(store.refreshError).toContain('Session saved')
    expect(store.pendingCompletion).toBe(false)
    await store.saveCompletion()
    expect(addPomodoro).toHaveBeenCalledTimes(1)
  })
})
