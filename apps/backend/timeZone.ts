// Reporting calendar days, weeks and years follow this IANA zone (DST-aware).
export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Pacific/Auckland'

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
})

export interface ZonedDate { year: number; month: number; day: number; weekday: number }

function zonedParts(instant: Date) {
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]))
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second),
  }
}

function offsetMs(instant: Date): number {
  const p = zonedParts(instant)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant.getTime() / 1000) * 1000
}

/** Calendar date in the app time zone for an instant. Weekday: 0 = Sunday. */
export function zonedDate(instant: Date): ZonedDate {
  const p = zonedParts(instant)
  return { year: p.year, month: p.month, day: p.day, weekday: new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() }
}

/** UTC instant of 00:00 on the given calendar day in the app time zone. Day overflow is normalised. */
export function zonedMidnight(year: number, month: number, day: number): Date {
  const wallClock = Date.UTC(year, month - 1, day)
  let instant = wallClock - offsetMs(new Date(wallClock))
  const corrected = wallClock - offsetMs(new Date(instant))
  if (corrected !== instant) instant = corrected
  return new Date(instant)
}

export function toSqlUtc(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}
