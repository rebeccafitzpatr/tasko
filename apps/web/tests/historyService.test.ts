import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPomodoros } from '../src/services/service'

afterEach(() => vi.unstubAllGlobals())

function respondWith(body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })))
}

describe('fetchPomodoros', () => {
  it('rejects a legacy array response with an actionable error', async () => {
    respondWith([{ id: 1, duration: 25 }])
    await expect(fetchPomodoros()).rejects.toThrow('outdated format')
  })

  it('returns a valid paginated response', async () => {
    const page = { items: [], hasMore: false, nextCursor: null, limit: 25 }
    respondWith(page)
    await expect(fetchPomodoros()).resolves.toEqual(page)
  })
})
