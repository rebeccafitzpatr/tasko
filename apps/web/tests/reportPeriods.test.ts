import { describe, expect, it } from 'vitest'
import { periodRange, validateReportRange } from '../src/services/reportPeriods'

describe('NZ reporting periods', () => {
  const now = new Date('2026-11-06T00:30:00+13:00')
  it('uses the NZ calendar day for every preset even when the UTC date differs', () => {
    expect(periodRange('today', now)).toEqual({ start: '2026-11-06', end: '2026-11-06' })
    expect(periodRange('last7', now)).toEqual({ start: '2026-10-31', end: '2026-11-06' })
    expect(periodRange('last30', now)).toEqual({ start: '2026-10-08', end: '2026-11-06' })
    expect(periodRange('week', now)).toEqual({ start: '2026-11-01', end: '2026-11-06' })
    expect(periodRange('month', now)).toEqual({ start: '2026-11-01', end: '2026-11-06' })
    expect(periodRange('year', now)).toEqual({ start: '2026-01-01', end: '2026-11-06' })
    expect(periodRange('year', new Date('2027-01-01T00:30:00+13:00'))).toEqual({ start: '2027-01-01', end: '2027-01-01' })
    expect(periodRange('all', now)).toEqual({})
  })
  it('rejects invalid dates and reversed ranges', () => {
    for (const range of [
      { start: '2026-02-29' }, { end: '9999-01-01' }, { start: '2026-01-02', end: '2026-01-01' },
    ]) expect(() => validateReportRange(range)).toThrow()
    expect(() => validateReportRange({})).not.toThrow()
  })
})
