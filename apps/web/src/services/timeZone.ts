export const APP_TIME_ZONE = 'Pacific/Auckland'

const displayFormat = new Intl.DateTimeFormat('en-NZ', {
  timeZone: APP_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short',
})

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
})

const pad = (value: number) => String(value).padStart(2, '0')

function parts(instant: Date) {
  const p = Object.fromEntries(partsFormat.formatToParts(instant).map(part => [part.type, part.value]))
  return [p.year, p.month, p.day, p.hour, p.minute, p.second].map(Number) as
    [number, number, number, number, number, number]
}

export function formatNzDateTime(value: string | Date): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : displayFormat.format(date)
}

/** `YYYY-MM-DDTHH:mm:ss` wall-clock value in New Zealand for a datetime-local input. */
export function toNzInput(instant: Date): string {
  const [y, mo, d, h, mi, s] = parts(instant)
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}`
}

/** Today's calendar date in New Zealand as `YYYY-MM-DD`. */
export function nzToday(now = new Date()): string {
  return toNzInput(now).slice(0, 10)
}

/**
 * Converts a New Zealand wall-clock input value to an instant.
 * Returns null for malformed values or times skipped by a daylight-saving change.
 */
export function fromNzInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return null
  const [y, mo, d, h, mi, s] = match.slice(1).map(part => Number(part ?? 0)) as
    [number, number, number, number, number, number]
  const wallClock = Date.UTC(y, mo - 1, d, h, mi, s)
  const offset = (instant: number) => {
    const [py, pmo, pd, ph, pmi, ps] = parts(new Date(instant))
    return Date.UTC(py, pmo - 1, pd, ph, pmi, ps) - instant
  }
  let instant = wallClock - offset(wallClock)
  instant = wallClock - offset(instant)
  const result = new Date(instant)
  const normalized = value.length === 16 ? `${value}:00` : value
  return toNzInput(result) === normalized ? result : null
}
