import { describe, expect, it } from 'vitest'
import { comparisonChange, periodRange, previousRange, validateReportRange } from '../src/services/reportPeriods'

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
  it('compares inclusive equal day counts across leap days, years and DST', () => {
    expect(previousRange({ start: '2024-03-01', end: '2024-03-07' })).toEqual({ start: '2024-02-23', end: '2024-02-29' })
    expect(previousRange({ start: '2026-01-01', end: '2026-01-01' })).toEqual({ start: '2025-12-31', end: '2025-12-31' })
    expect(previousRange({ start: '2026-03-08', end: '2026-03-09' })).toEqual({ start: '2026-03-06', end: '2026-03-07' })
  })
  it('rejects invalid dates, reversed ranges and unsupported previous dates', () => {
    for (const range of [
      { start: '2026-02-29' }, { end: '9999-01-01' }, { start: '2026-01-02', end: '2026-01-01' },
    ]) expect(() => validateReportRange(range)).toThrow()
    expect(() => previousRange({ start: '1000-01-01', end: '1000-01-02' })).toThrow()
    expect(() => validateReportRange({})).not.toThrow()
  })
  it('handles zero baselines and signed changes without division by zero', () => {
    expect(comparisonChange(30, 20, 'min')).toBe('+10 min (+50%)')
    expect(comparisonChange(10, 20, 'min')).toBe('-10 min (-50%)')
    expect(comparisonChange(0, 20, 'min')).toBe('-20 min (-100%)')
    expect(comparisonChange(30, 0, 'min')).toContain('no prior activity')
    expect(comparisonChange(0, 0, 'sessions')).toBe('No activity in either period.')
  })
})
