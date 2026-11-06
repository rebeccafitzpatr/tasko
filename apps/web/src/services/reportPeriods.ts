import type { DateRange } from './service'

export const reportPeriods = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'week', label: 'This week to date' },
  { value: 'month', label: 'This month to date' },
  { value: 'year', label: 'This year to date' },
  { value: 'custom', label: 'Custom range' },
] as const
export type ReportPeriod = typeof reportPeriods[number]['value']

function calendarDate(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value || date.getUTCFullYear() < 1000 || date.getUTCFullYear() > 9998) {
    throw new Error('Enter valid UTC calendar dates (years 1000 to 9998).')
  }
  return date
}

export function validateReportRange(range: DateRange): void {
  if (range.start) calendarDate(range.start)
  if (range.end) calendarDate(range.end)
  if (range.start && range.end && range.start > range.end) {
    throw new Error('Start date must be on or before end date.')
  }
}

export function periodRange(period: Exclude<ReportPeriod, 'custom'>, now = new Date()): DateRange {
  if (period === 'all') return {}
  const end = now.toISOString().slice(0, 10)
  const start = calendarDate(end)
  if (period === 'last7') start.setUTCDate(start.getUTCDate() - 6)
  if (period === 'last30') start.setUTCDate(start.getUTCDate() - 29)
  if (period === 'week') start.setUTCDate(start.getUTCDate() - start.getUTCDay())
  if (period === 'month') start.setUTCDate(1)
  if (period === 'year') start.setUTCMonth(0, 1)
  return { start: start.toISOString().slice(0, 10), end }
}

export function previousRange(range: Required<DateRange>): Required<DateRange> {
  validateReportRange(range)
  const start = calendarDate(range.start)
  const end = calendarDate(range.end)
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  end.setTime(start.getTime())
  end.setUTCDate(end.getUTCDate() - 1)
  start.setUTCDate(start.getUTCDate() - days)
  const previous = { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  validateReportRange(previous)
  return previous
}

export function comparisonChange(current: number, previous: number, unit: string): string {
  const delta = current - previous
  const change = `${delta > 0 ? '+' : ''}${delta} ${unit}`
  if (previous === 0) return current === 0
    ? 'No activity in either period.'
    : `${change}; no prior activity (percentage unavailable).`
  const percent = Math.round(delta / previous * 100)
  return `${change} (${percent > 0 ? '+' : ''}${percent}%)`
}
