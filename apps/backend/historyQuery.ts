import { toSqlUtc, zonedMidnight } from './timeZone.js'

export interface HistoryQuery {
  limit: number
  start: string | null
  end: string | null
  beforeTime: string | null
  beforeId: number | null
}

function dateBoundary(value: unknown, exclusiveEnd: boolean): string | null {
  if (value === undefined) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number(value.slice(0, 4)) < 1000 || Number(value.slice(0, 4)) > 9998) {
    throw new Error('Dates must use YYYY-MM-DD (years 1000 to 9998).')
  }
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Enter a valid calendar date.')
  }
  // Dates are calendar days in the app time zone; boundaries are stored as UTC.
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  return toSqlUtc(zonedMidnight(year, month, exclusiveEnd ? day + 1 : day))
}

export function parseHistoryQuery(query: Record<string, unknown>):
  { value: HistoryQuery } | { error: string } {
  try {
    const start = dateBoundary(query.start, false)
    const end = dateBoundary(query.end, true)
    if (start !== null && end !== null && start >= end) {
      throw new Error('Start date must be on or before end date.')
    }
    const limit = query.limit === undefined ? 25 : Number(query.limit)
    if (query.limit !== undefined &&
        (typeof query.limit !== 'string' || !/^\d+$/.test(query.limit))) {
      throw new Error('limit must be a whole number from 1 to 100.')
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('limit must be a whole number from 1 to 100.')
    }
    let beforeTime: string | null = null
    let beforeId: number | null = null
    if (query.cursor !== undefined) {
      if (typeof query.cursor !== 'string' || query.cursor.length > 512) {
        throw new Error('Invalid history cursor. Restart from the first page.')
      }
      const cursor: unknown = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'))
      if (typeof cursor !== 'object' || cursor === null ||
          !('time' in cursor) || !('id' in cursor) || !('start' in cursor) || !('end' in cursor) ||
          typeof cursor.time !== 'string' ||
          !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(cursor.time) ||
          Number.isNaN(new Date(cursor.time.replace(' ', 'T') + 'Z').getTime()) ||
          new Date(cursor.time.replace(' ', 'T') + 'Z').toISOString().slice(0, 19).replace('T', ' ') !== cursor.time ||
          typeof cursor.id !== 'number' || !Number.isSafeInteger(cursor.id) || cursor.id < 1 ||
          cursor.start !== start || cursor.end !== end) {
        throw new Error('Invalid history cursor. Restart from the first page.')
      }
      beforeTime = cursor.time
      beforeId = cursor.id
    }
    return { value: { limit, start, end, beforeTime, beforeId } }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid history query.' }
  }
}

export function historyCursor(time: string, id: number, query: HistoryQuery): string {
  return Buffer.from(JSON.stringify({ time, id, start: query.start, end: query.end })).toString('base64url')
}
