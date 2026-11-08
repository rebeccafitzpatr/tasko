import { describe, expect, test } from 'bun:test'
import { historyCsv, type ExportSession } from './historyCsv.js'

const session: ExportSession = {
  id: 1, taskId: null, skillId: null, taskName: 'Read, "practice"\nand review',
  skillName: 'Writing, essays', parentSkillName: 'Languages\r\nand literature',
  skillPath: 'Languages / Writing, essays', duration: 25, type: 'manual',
  completedAt: '2026-01-01T12:00:00Z', completedAtIsUtc: true,
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++ }
      else quoted = !quoted
    } else if (!quoted && char === ',') { row.push(cell); cell = '' }
    else if (!quoted && char === '\r' && csv[i + 1] === '\n') {
      row.push(cell); rows.push(row); row = []; cell = ''; i++
    } else cell += char
  }
  return rows
}

describe('CSV session serialization', () => {
  test('round trips commas, quotes and embedded newlines without extra records', () => {
    const csv = historyCsv([session])
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    expect(parseCsv(csv.slice(1))).toEqual([
      ['completed_at', 'duration_minutes', 'session_type', 'task', 'skill', 'parent_skill', 'skill_path', 'timestamp_policy'],
      [session.completedAt, '25', 'manual', session.taskName!, session.skillName!,
        session.parentSkillName!, session.skillPath!, 'UTC'],
    ])
  })
  test('keeps unassigned fields empty and marks legacy time explicitly', () => {
    const rows = parseCsv(historyCsv([{ ...session, taskName: null, skillName: null, skillPath: null,
      parentSkillName: null, completedAt: '2026-01-01 12:00:00', completedAtIsUtc: 0 }]).slice(1))
    expect(rows[1]).toEqual(['2026-01-01 12:00:00', '25', 'manual', '', '', '', '', 'legacy_unknown'])
  })
  test('neutralizes spreadsheet formulas without changing stored names', () => {
    for (const name of ['=1+1', '+SUM(A1)', '-10', '@command', '  =1+1', '\tname', '\nname']) {
      const record = { ...session, taskName: name }
      const rows = parseCsv(historyCsv([record]).slice(1))
      expect(rows[1]?.[3]).toBe(`'${name}`)
      expect(record.taskName).toBe(name)
    }
  })
})
