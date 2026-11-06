import type { PomodoroLog } from './types.js'

export interface ExportSession extends PomodoroLog {
  completedAtIsUtc: boolean | number
}

function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value)
  // CSV quoting alone does not prevent spreadsheet formulas in user labels.
  if (typeof value === 'string' && /^(?:\s*[=+\-@]|[\t\r\n])/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function historyCsv(sessions: ExportSession[]): string {
  const header = ['completed_at', 'duration_minutes', 'session_type', 'task', 'skill', 'parent_skill', 'skill_path', 'timestamp_policy']
  const rows = sessions.map(session => [
    session.completedAt, session.duration, session.type, session.taskName,
    session.skillName, session.parentSkillName, session.skillPath ?? session.skillName,
    session.completedAtIsUtc ? 'UTC' : 'legacy_unknown',
  ].map(csvCell).join(','))
  return '\uFEFF' + [header.join(','), ...rows].join('\r\n') + '\r\n'
}
