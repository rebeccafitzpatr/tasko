import { describe, expect, it } from 'vitest'
import { formatNzDateTime, fromNzInput, nzToday, toNzInput } from '../src/services/timeZone'

describe('New Zealand time helpers', () => {
  it('converts NZ wall-clock input to UTC across daylight saving', () => {
    expect(fromNzInput('2026-01-01T12:00:00')?.toISOString()).toBe('2025-12-31T23:00:00.000Z')
    expect(fromNzInput('2026-07-01T12:00')?.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it('rejects malformed values and times skipped when daylight saving starts', () => {
    expect(fromNzInput('2026-09-27T02:30:00')).toBeNull()
    expect(fromNzInput('2026-02-30T10:00:00')).toBeNull()
    expect(fromNzInput('not a date')).toBeNull()
  })

  it('round-trips instants into NZ input values and calendar dates', () => {
    const instant = new Date('2026-11-08T11:30:00Z')
    expect(toNzInput(instant)).toBe('2026-11-09T00:30:00')
    expect(nzToday(instant)).toBe('2026-11-09')
  })

  it('formats display times in NZ regardless of the browser zone', () => {
    expect(formatNzDateTime('2026-11-08T11:30:00Z')).toContain('9 Nov 2026')
    expect(formatNzDateTime('invalid')).toBe('')
  })
})
