import { describe, expect, test } from 'bun:test'
import { parseHistoryQuery, historyCursor } from './historyQuery.js'

describe('history query validation', () => {
  test('defaults to a bounded page with no date restriction', () => {
    expect(parseHistoryQuery({})).toEqual({
      value: { limit: 25, start: null, end: null, beforeTime: null, beforeId: null },
    })
  })
  test('uses inclusive calendar dates, including leap days', () => {
    expect(parseHistoryQuery({ start: '2024-02-29', end: '2024-02-29', limit: '100' })).toMatchObject({
      value: { limit: 100, start: '2024-02-29 00:00:00', end: '2024-03-01 00:00:00' },
    })
  })
  test.each([
    { limit: '0' }, { limit: '101' }, { limit: '-1' }, { limit: '1.5' },
    { limit: ['10', '20'] }, { start: '2025-02-29' }, { start: 'invalid' },
    { end: '2026-13-01' }, { end: ['2026-01-01'] },
    { start: '2026-02-01', end: '2026-01-01' }, { cursor: 'invalid' },
  ])('rejects invalid query %j', query => {
    expect(parseHistoryQuery(query)).toHaveProperty('error')
  })
  test('roundtrips cursor and rejects reuse with different dates', () => {
    const parsed = parseHistoryQuery({ start: '2026-01-01' })
    if ('error' in parsed) throw new Error(parsed.error)
    const cursor = historyCursor('2026-01-02 12:00:00', 100, parsed.value)
    expect(parseHistoryQuery({ start: '2026-01-01', cursor })).toMatchObject({
      value: { beforeTime: '2026-01-02 12:00:00', beforeId: 100 },
    })
    expect(parseHistoryQuery({ start: '2026-02-01', cursor })).toHaveProperty('error')
  })
})
