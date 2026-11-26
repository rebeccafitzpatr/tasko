import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAnalytics, fetchPomodoros } from '../src/services/service'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchPomodoros', () => {
  it('rejects a legacy array response with an actionable error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([{ id: 1, duration: 25 }])))
    await expect(fetchPomodoros()).rejects.toThrow('outdated format')
  })

  it('returns a valid paginated response', async () => {
    const page = { items: [], hasMore: false, nextCursor: null, limit: 25 }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(page)))
    await expect(fetchPomodoros()).resolves.toEqual(page)
  })
})

describe('fetchAnalytics', () => {
  const breakdown = {
    skillId: 1, todayTasks: 1, weekTasks: 1, yearTasks: 1,
    todayPomodoros: 1, weekPomodoros: 1, yearPomodoros: 1,
    todayMinutes: 3, weekMinutes: 3, yearMinutes: 3,
  }

  it('accepts a complete report without fetching history', async () => {
    const summary = { totalPomodoros: 1, breakdown: [breakdown] }
    const fetch = vi.fn().mockResolvedValue(response(summary))
    vi.stubGlobal('fetch', fetch)
    await expect(fetchAnalytics()).resolves.toEqual(summary)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('derives legacy period figures from every history page with historical parent rollups', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-26T05:00:00Z'))
    const session = {
      taskId: 12, skillId: 2, parentSkillId: 1, taskName: 'Task', skillName: 'Child',
      duration: 3, completedAt: '2026-11-26T04:00:00Z', type: 'timer',
    }
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ totalPomodoros: 4, breakdown: [{ skillId: 1 }, { skillId: 2 }] }))
      .mockResolvedValueOnce(response({
        items: [session, { ...session, duration: 4 }], hasMore: true, nextCursor: 'next', limit: 100,
      }))
      .mockResolvedValueOnce(response({
        items: [
          { ...session, taskId: null, duration: 5, completedAt: '2026-11-24 04:00:00' },
          { ...session, taskId: 13, duration: 8, completedAt: '2026-11-10T04:00:00Z' },
          { ...session, duration: 99, completedAt: '2026-11-26T06:00:00Z' },
        ], hasMore: false, nextCursor: null, limit: 100,
      }))
    vi.stubGlobal('fetch', fetch)
    const result = await fetchAnalytics({ start: '2026-01-01' })
    for (const skill of result.breakdown!) {
      expect(skill).toMatchObject({
        todayTasks: 1, todayPomodoros: 2, todayMinutes: 7,
        weekTasks: 1, weekPomodoros: 3, weekMinutes: 12,
        yearTasks: 2, yearPomodoros: 4, yearMinutes: 20,
      })
    }
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[1]![0]).toContain('start=2026-01-01&end=2026-11-26&limit=100')
    expect(fetch.mock.calls[2]![0]).toContain('cursor=next')
  })

  it('surfaces incomplete pagination instead of showing partial counts', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ totalPomodoros: 1, breakdown: [{ skillId: 1 }] }))
      .mockResolvedValueOnce(response({ items: [], hasMore: true, nextCursor: null, limit: 100 }))
    vi.stubGlobal('fetch', fetch)
    await expect(fetchAnalytics()).rejects.toThrow('pagination is incomplete')
  })

  it('respects the applied history range and skips history outside the current year', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-26T05:00:00Z'))
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ totalPomodoros: 0, breakdown: [{ skillId: 1 }] }))
      .mockResolvedValueOnce(response({ items: [], hasMore: false, nextCursor: null, limit: 100 }))
    vi.stubGlobal('fetch', fetch)
    const result = await fetchAnalytics({ start: '2026-11-01', end: '2026-11-10' })
    expect(fetch.mock.calls[1]![0]).toContain('start=2026-11-01&end=2026-11-10')
    expect(result.breakdown![0]).toMatchObject({ todayTasks: 0, weekPomodoros: 0, yearMinutes: 0 })

    fetch.mockResolvedValueOnce(response({ totalPomodoros: 1, breakdown: [{ skillId: 1 }] }))
    const old = await fetchAnalytics({ end: '2025-12-31' })
    expect(old.breakdown![0]).toMatchObject({ todayTasks: 0, weekPomodoros: 0, yearMinutes: 0 })
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
