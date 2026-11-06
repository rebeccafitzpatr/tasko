import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import express from 'express'
import { SQL } from 'bun'
import type { PomodoroLog, Skill } from './types.js'

interface StoredSession extends PomodoroLog {
  completionId: string | null
  completionRequest: string | null
}

const sessions = new Map<string, StoredSession>()
let insertCount = 0
let taskUpdates = 0
let skillUpdates = 0
let taskExists = true
let failInsert = false
let latestId = 0
let rollbacks = 0
let lookupBarrier: Promise<void> | null = null
let releaseLookups: (() => void) | null = null
let lookupCount = 0
let failUpdate = false
let failHistory = false
let hierarchySkills = [
  { id: 4, name: 'English', parentId: null as number | null, minutesSpent: 0 },
]
let storedTaskSkillId: number | null = 4

function skillDetails(id: number) {
  const skill = hierarchySkills.find(item => item.id === id)
  if (!skill) return null
  const parent = hierarchySkills.find(item => item.id === skill.parentId)
  return { ...skill, parentName: parent?.name ?? null, parentSkillId: parent?.id ?? null, parentSkillName: parent?.name ?? null }
}

function inRange(session: StoredSession, start: unknown, end: unknown) {
  const time = session.completedAt.replace('T', ' ').replace(/Z$/, '')
  return (start == null || time >= String(start)) && (end == null || time < String(end))
}

// Exercise the real HTTP handler with a database double that enforces the unique key.
async function query(strings: TemplateStringsArray, ...values: unknown[]) {
  const sql = strings.join('?')
  if (sql.includes('SELECT COUNT(*) AS c, COALESCE(SUM(duration_minutes), 0) AS m FROM pomodoro_logs')) {
    const filtered = [...sessions.values()].filter(session => inRange(session, values[0], values[2]))
    return [{ c: filtered.length, m: filtered.reduce((sum, session) => sum + session.duration, 0) }]
  }
  if (sql.includes('SELECT COUNT(*) AS c FROM tasks')) return [{ c: taskExists ? 1 : 0 }]
  if (sql.includes('GROUP BY s.id, s.name')) {
    expect(sql).not.toContain('LIMIT')
    expect(sql).toContain('AS directMinutes')
    return hierarchySkills.map(skill => {
    const associated = [...sessions.values()].filter(session =>
      (session.skillId === skill.id || session.parentSkillId === skill.id) && inRange(session, values[6], values[8]))
    const direct = associated.filter(session => session.skillId === skill.id)
    const parent = hierarchySkills.find(item => item.id === skill.parentId)
    expect(sql).toContain('OR pl.parent_skill_id_snapshot = s.id')
    const periodTotal = (start: unknown, end: unknown) => associated
      .filter(session => {
        const time = session.completedAt.replace('T', ' ').replace(/Z$/, '')
        return time >= String(start) && time <= String(end)
      }).reduce((sum, session) => sum + session.duration, 0)
    return {
      skillId: skill.id, skillName: skill.name, pomodoros: associated.length,
      parentId: skill.parentId, parentName: parent?.name ?? null,
      skillPath: parent ? `${parent.name} / ${skill.name}` : skill.name,
      directPomodoros: direct.length, directMinutes: direct.reduce((sum, session) => sum + session.duration, 0),
      minutes: associated.reduce((sum, session) => sum + session.duration, 0),
      todayMinutes: periodTotal(values[0], values[1]),
      weekMinutes: periodTotal(values[2], values[3]),
      yearMinutes: periodTotal(values[4], values[5]),
    }
    })
  }
  if (sql.includes('AS cursorTime')) {
    if (failHistory) throw new Error('History unavailable')
    expect(sql).toContain('ORDER BY pl.completed_at DESC, pl.id DESC')
    const beforeTime = values[4]
    const beforeId = values[7]
    const filtered = [...sessions.values()]
      .filter(session => {
        const time = session.completedAt.replace('T', ' ').replace(/Z$/, '')
        return inRange(session, values[0], values[2]) &&
          (beforeTime == null || time < String(beforeTime) ||
            (time === String(beforeTime) && session.id < Number(beforeId)))
      })
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt) || b.id - a.id)
      .slice(0, Number(values[8]))
    return filtered.map(session => ({
      ...session, cursorTime: session.completedAt.replace('T', ' ').replace(/Z$/, ''),
    }))
  }
  if (sql.includes('WHERE completion_id')) {
    const session = sessions.get(String(values[0]))
    if (lookupBarrier !== null) {
      const barrier = lookupBarrier
      lookupCount++
      if (lookupCount === 2) {
        lookupBarrier = null
        releaseLookups?.()
      }
      await barrier
    }
    return session ? [session] : []
  }
  if (sql.includes('FROM tasks t')) {
    const skill = skillDetails(storedTaskSkillId ?? 0)
    return taskExists ? [{
      id: Number(values[0]), taskName: 'Study', skillId: storedTaskSkillId, skillName: skill?.name ?? null,
      parentSkillId: skill?.parentSkillId ?? null, parentSkillName: skill?.parentSkillName ?? null,
    }] : []
  }
  if (sql.includes('SELECT id, name, parent_id AS parentId FROM skills')) {
    return hierarchySkills.map(skill => ({ ...skill }))
  }
  if (sql.includes('FROM skills s LEFT JOIN skills p')) {
    const skills = values.length ? [skillDetails(Number(values[0]))] : hierarchySkills.map(skill => skillDetails(skill.id))
    return skills.filter(skill => skill !== null)
  }
  if (sql.includes('INSERT INTO skills')) {
    if (hierarchySkills.some(skill => skill.name === values[0])) {
      throw new SQL.MySQLError('Duplicate skill', { code: 'ER_DUP_ENTRY', errno: 1062, sqlState: '23000' })
    }
    latestId = Math.max(0, ...hierarchySkills.map(skill => skill.id)) + 1
    hierarchySkills.push({ id: latestId, name: String(values[0]), parentId: values[1] == null ? null : Number(values[1]), minutesSpent: 0 })
    return []
  }
  if (sql.includes('UPDATE skills SET name')) {
    const skill = hierarchySkills.find(skill => skill.id === Number(values[2]))
    if (!skill) throw new Error('Test skill missing')
    Object.assign(skill, { name: String(values[0]), parentId: values[1] == null ? null : Number(values[1]) })
    return []
  }
  if (sql.includes('DELETE FROM skills')) {
    const id = Number(values[0])
    hierarchySkills = hierarchySkills.filter(skill => skill.id !== id)
    if (storedTaskSkillId === id) storedTaskSkillId = null
    for (const session of sessions.values()) if (session.skillId === id) session.skillId = null
    return []
  }
  if (sql.includes('INSERT INTO tasks')) {
    latestId = 12
    storedTaskSkillId = values[1] == null ? null : Number(values[1])
    return []
  }
  if (sql.includes('SELECT id FROM tasks')) {
    return taskExists ? [{ id: 12 }] : []
  }
  if (sql.includes('FROM pomodoro_logs WHERE id')) {
    const session = [...sessions.values()].find(value => value.id === Number(values[0]))
    return session ? [session] : []
  }
  if (sql.includes('UPDATE pomodoro_logs')) {
    if (failUpdate) throw new Error('Database unavailable')
    const session = [...sessions.values()].find(value => value.id === Number(values[9]))
    if (!session) throw new Error('Test session missing')
    Object.assign(session, {
      taskId: values[0] == null ? null : Number(values[0]),
      skillId: values[1] == null ? null : Number(values[1]),
      taskName: values[2], skillName: values[3], duration: Number(values[4]),
      completedAt: String(values[5]).replace(' ', 'T') + 'Z',
      parentSkillId: values[6] == null ? null : Number(values[6]),
      parentSkillName: values[7] == null ? null : String(values[7]),
      skillPath: values[8] == null ? null : String(values[8]),
    })
    return []
  }
  if (sql.includes('INSERT INTO pomodoro_logs')) {
    if (failInsert) throw new Error('Database unavailable')
    const completionId = values[7] == null ? null : String(values[7])
    if (completionId !== null && sessions.has(completionId)) {
      throw new SQL.MySQLError('Duplicate completion', {
        code: 'ER_DUP_ENTRY', errno: 1062, sqlState: '23000',
      })
    }
    latestId++
    insertCount++
    sessions.set(completionId ?? `manual-${latestId}`, {
      id: latestId,
      taskId: values[0] == null ? null : Number(values[0]),
      skillId: values[1] == null ? null : Number(values[1]),
      taskName: values[2] == null ? null : String(values[2]),
      skillName: values[3] == null ? null : String(values[3]),
      duration: Number(values[4]),
      completedAt: String(values[5]).replace(' ', 'T') + 'Z',
      type: values[6] === 'manual' ? 'manual' : 'timer',
      completionId,
      completionRequest: values[8] == null ? null : String(values[8]),
      parentSkillId: values[9] == null ? null : Number(values[9]),
      parentSkillName: values[10] == null ? null : String(values[10]),
      skillPath: values[11] == null ? null : String(values[11]),
    })
    return []
  }
  if (sql.includes('UPDATE tasks')) {
    if (sql.includes('SET name')) storedTaskSkillId = values[1] == null ? null : Number(values[1])
    taskUpdates++
    return []
  }
  if (sql.includes('UPDATE skills')) {
    skillUpdates++
    return []
  }
  if (sql.includes('LAST_INSERT_ID')) return [{ id: latestId }]
  throw new Error(`Unexpected query in test: ${sql}`)
}

const testDb = Object.assign(query, {
  begin: async (callback: (transaction: typeof query) => Promise<unknown>) => {
    try {
      return await callback(query)
    } catch (error) {
      rollbacks++
      throw error
    }
  },
})

mock.module('./db.js', () => ({ db: testDb }))
const { default: api } = await import('./api.js')
const app = express()
app.use(express.json())
app.use('/api', api)
const server = app.listen(0, '127.0.0.1')
await new Promise<void>(resolve => server.once('listening', resolve))
const address = server.address()
if (address === null || typeof address === 'string') throw new Error('Test server did not start')
const url = `http://127.0.0.1:${address.port}/api/pomodoros`

const request = {
  taskId: 12, duration: 25, type: 'timer',
  completionId: '00000000-0000-4000-8000-000000000001',
}

function post(body: unknown = request) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  sessions.clear()
  insertCount = taskUpdates = skillUpdates = latestId = rollbacks = 0
  taskExists = true
  failInsert = false
  failUpdate = false
  failHistory = false
  lookupBarrier = null
  releaseLookups = null
  lookupCount = 0
  hierarchySkills = [{ id: 4, name: 'English', parentId: null, minutesSpent: 0 }]
  storedTaskSkillId = 4
})

function put(id: number | string, body: unknown) {
  return fetch(`${url}/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function skillRequest(path = '', method = 'GET', body?: unknown) {
  return fetch(`${url.replace('/pomodoros', '/skills')}${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('skill hierarchy HTTP behavior and historical assignments', () => {
  test('range summaries include all sessions and distinguish direct totals from parent rollups', async () => {
    hierarchySkills.push({ id: 5, name: 'Grammar', parentId: 4, minutesSpent: 0 })
    for (let id = 1; id <= 140; id++) {
      sessions.set(`range-${id}`, {
        id, taskId: null, skillId: 5, parentSkillId: 4, parentSkillName: 'English',
        taskName: null, skillName: 'Grammar', skillPath: 'English / Grammar', duration: 2,
        completedAt: '2026-01-31T23:59:59Z', type: 'manual', completionId: null, completionRequest: null,
      })
    }
    sessions.set('direct', { ...sessions.get('range-1')!, id: 141, skillId: 4, parentSkillId: null, duration: 10 })
    sessions.set('unassigned', { ...sessions.get('range-1')!, id: 142, skillId: null, parentSkillId: null, duration: 7 })
    sessions.set('outside', { ...sessions.get('range-1')!, id: 143, completedAt: '2026-02-01T00:00:00Z' })
    const summaryUrl = url.replace('/pomodoros', '/analytics/summary')
    const result = await fetch(`${summaryUrl}?start=2026-01-01&end=2026-01-31`)
    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({
      totalPomodoros: 142, totalMinutes: 297,
      range: { start: '2026-01-01', end: '2026-01-31', timezone: 'UTC', endInclusive: true },
      breakdown: [
        { skillId: 4, parentId: null, minutes: 290, pomodoros: 141, directMinutes: 10, directPomodoros: 1 },
        { skillId: 5, parentId: 4, skillPath: 'English / Grammar', minutes: 280, pomodoros: 140, directMinutes: 280 },
      ],
    })
    const empty = await fetch(`${summaryUrl}?start=2025-01-01&end=2025-01-01`)
    expect(await empty.json()).toMatchObject({
      totalPomodoros: 0, totalMinutes: 0, breakdown: [{ minutes: 0 }, { minutes: 0 }],
    })
    expect((await fetch(`${summaryUrl}?start=2026-02-01&end=2026-01-01`)).status).toBe(400)
  })

  test('creates standalone and child skills and reads the relationship', async () => {
    const parent = await skillRequest('', 'POST', { name: 'Programming' })
    expect(parent.status).toBe(201)
    const { id } = await parent.json() as Skill
    const child = await skillRequest('', 'POST', { name: 'TypeScript', parentId: id })
    expect(child.status).toBe(201)
    expect(await child.json()).toMatchObject({ parentId: id, parentName: 'Programming' })
    expect(await (await skillRequest()).json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'English', parentId: null }),
      expect.objectContaining({ name: 'TypeScript', parentId: id }),
    ]))
  })

  test('rejects invalid parents, nesting, self-parenting and moving a parent with children', async () => {
    const child = await (await skillRequest('', 'POST', { name: 'Grammar', parentId: 4 })).json() as Skill
    for (const parentId of [0, '4', 999]) {
      expect((await skillRequest('', 'POST', { name: 'Invalid', parentId })).status).toBe(400)
    }
    expect((await skillRequest('', 'POST', { name: 'Nested', parentId: child.id })).status).toBe(400)
    expect((await skillRequest('/4', 'PUT', { parentId: 4 })).status).toBe(400)
    await skillRequest('', 'POST', { name: 'Other' })
    expect((await skillRequest('/4', 'PUT', { parentId: child.id + 1 })).status).toBe(400)
    expect((await skillRequest('', 'POST', { name: 'English' })).status).toBe(409)
    expect((await skillRequest('/999', 'PUT', { name: 'Missing' })).status).toBe(404)
  })

  test('blocks parent deletion until children are moved or promoted', async () => {
    const child = await (await skillRequest('', 'POST', { name: 'Grammar', parentId: 4 })).json() as Skill
    const blocked = await skillRequest('/4', 'DELETE')
    expect(blocked.status).toBe(409)
    expect((await blocked.json() as { error: string }).error).toContain('sub-skills')
    expect((await skillRequest(`/${child.id}`, 'PUT', { parentId: null })).status).toBe(200)
    expect((await skillRequest('/4', 'DELETE')).status).toBe(204)
    expect(skillDetails(child.id)?.parentId).toBeNull()
  })

  test('snapshots parent paths for timer and manual sessions, preserves edits and retries after deletion', async () => {
    const child = await (await skillRequest('', 'POST', { name: 'Grammar', parentId: 4 })).json() as Skill
    storedTaskSkillId = child.id
    const timer = await post()
    expect(timer.status).toBe(201)
    expect(await timer.json()).toMatchObject({ skillPath: 'English / Grammar', parentSkillId: 4 })
    const manual = await post({ type: 'manual', taskId: null, skillId: child.id, duration: 10, completedAt: '2026-01-01T12:00:00Z' })
    expect(await manual.json()).toMatchObject({ skillPath: 'English / Grammar', parentSkillName: 'English' })
    await skillRequest(`/${child.id}`, 'PUT', { parentId: null })
    await skillRequest('/4', 'PUT', { name: 'Renamed' })
    const edited = await put(child.id + 1, { taskId: 12, skillId: child.id, duration: 40, completedAt: '2026-01-01T12:00:00Z' })
    expect(edited.status).toBe(200)
    expect(await edited.json()).toMatchObject({ skillPath: 'English / Grammar', parentSkillId: 4 })
    const stats = await (await fetch(url.replace('/pomodoros', '/analytics/summary'))).json() as { breakdown: { minutes: number }[] }
    expect(stats.breakdown[0]?.minutes).toBe(50)
    await skillRequest(`/${child.id}`, 'DELETE')
    await skillRequest('/4', 'DELETE')
    const retry = await post()
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ skillId: null, skillPath: 'English / Grammar' })
    const history = await (await fetch(url)).json() as { items: PomodoroLog[] }
    expect(history.items.every((session: PomodoroLog) => session.skillPath === 'English / Grammar')).toBe(true)
    expect(sessions.size).toBe(2)
  })

  test('tasks accept standalone and child assignments and reject nonexistent skills', async () => {
    const child = await (await skillRequest('', 'POST', { name: 'Grammar', parentId: 4 })).json() as Skill
    const tasksUrl = url.replace('/pomodoros', '/tasks')
    const create = (skillId: number) => fetch(tasksUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Study', skillId }),
    })
    expect((await create(4)).status).toBe(201)
    expect(await (await create(child.id)).json()).toMatchObject({ skillId: child.id, skillPath: 'English / Grammar' })
    expect((await create(999)).status).toBe(404)
    const updated = await fetch(`${tasksUrl}/12`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Study', skillId: 4 }),
    })
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({ skillId: 4, skillPath: 'English' })
  })

  test('moving a child keeps old paths and records new sessions under its new parent', async () => {
    const child = await (await skillRequest('', 'POST', { name: 'Grammar', parentId: 4 })).json() as Skill
    const parent = await (await skillRequest('', 'POST', { name: 'Languages' })).json() as Skill
    const details = { type: 'manual', taskId: null, skillId: child.id, duration: 15, completedAt: '2026-01-01T12:00:00Z' }
    const oldSession = await (await post(details)).json() as PomodoroLog
    const moved = await skillRequest(`/${child.id}`, 'PUT', { parentId: parent.id })
    expect(moved.status).toBe(200)
    expect(await moved.json()).toMatchObject({ parentId: parent.id, parentName: 'Languages' })
    const newSession = await (await post(details)).json() as PomodoroLog
    expect(oldSession.skillPath).toBe('English / Grammar')
    expect(newSession.skillPath).toBe('Languages / Grammar')
    expect(newSession.parentSkillId).toBe(parent.id)
    const history = await (await fetch(url)).json() as { items: PomodoroLog[] }
    expect(history.items.map(session => session.skillPath)).toEqual(['Languages / Grammar', 'English / Grammar'])
    if (oldSession.id === undefined) throw new Error('Created session has no ID')
    const reassigned = await put(oldSession.id, {
      taskId: null, skillId: 4, duration: details.duration, completedAt: details.completedAt,
    })
    expect(reassigned.status).toBe(200)
    expect(await reassigned.json()).toMatchObject({ skillId: 4, skillPath: 'English', parentSkillId: null })
  })
})

describe('manual session creation and corrections', () => {
  const details = { taskId: null, skillId: null, duration: 30, completedAt: '2026-01-01T12:00:00Z' }

  test('creates multiple unassigned manual sessions with null completion identities', async () => {
    const first = await post({ ...details, type: 'manual' })
    const second = await post({ ...details, type: 'manual' })
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(await first.json()).toMatchObject({ ...details, type: 'manual', completionId: null })
    expect(sessions.size).toBe(2)
    expect(taskUpdates).toBe(0)
  })

  test('supports skill-only manual sessions and task-derived skills', async () => {
    const skillOnly = await post({ ...details, skillId: 4, type: 'manual' })
    expect(skillOnly.status).toBe(201)
    expect(await skillOnly.json()).toMatchObject({ taskId: null, skillId: 4, skillName: 'English' })
    const taskSession = await post({ ...details, taskId: 12, type: 'manual' })
    expect(taskSession.status).toBe(201)
    expect(await taskSession.json()).toMatchObject({ taskId: 12, skillId: 4, type: 'manual' })
  })

  test('rejects missing tasks and mismatched skills without inserting a session', async () => {
    const mismatch = await post({ ...details, taskId: 12, skillId: 9, type: 'manual' })
    expect(mismatch.status).toBe(400)
    taskExists = false
    expect((await post({ ...details, taskId: 12, type: 'manual' })).status).toBe(404)
    expect(insertCount).toBe(0)
  })

  test('edits a timer without converting its type or changing its retry fingerprint', async () => {
    await post()
    const edited = await put(1, { ...details, taskId: 12, skillId: 4, duration: 40 })
    expect(edited.status).toBe(200)
    expect(await edited.json()).toMatchObject({ duration: 40, type: 'timer', completionId: request.completionId })
    const retry = await post()
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ id: 1, duration: 40, type: 'timer' })
    expect(insertCount).toBe(1)
  })

  test('reassigns a session and reconciles old and new counters', async () => {
    hierarchySkills.push({ id: 9, name: 'Coding', parentId: null, minutesSpent: 0 })
    await post()
    const edited = await put(1, { ...details, taskId: null, skillId: 9 })
    expect(edited.status).toBe(200)
    expect(await edited.json()).toMatchObject({ taskId: null, skillId: 9, duration: 30 })
    expect(taskUpdates).toBe(2)
    expect(skillUpdates).toBe(3)
  })

  test('manual corrections update aggregate totals without inserting another record', async () => {
    await post({ ...details, type: 'manual', skillId: 4 })
    const edited = await put(1, { ...details, duration: 45, skillId: 4 })
    expect(edited.status).toBe(200)
    expect(await edited.json()).toMatchObject({ type: 'manual', duration: 45, completionId: null })
    const summary = await fetch(url.replace('/pomodoros', '/analytics/summary'))
    expect(summary.status).toBe(200)
    expect(await summary.json()).toMatchObject({
      totalPomodoros: 1, totalMinutes: 45,
      breakdown: [{ skillId: 4, minutes: 45, pomodoros: 1 }],
    })
    expect(insertCount).toBe(1)
  })

  test('keeps deleted record snapshots during a duration/date correction', async () => {
    await post()
    const stored = sessions.get(request.completionId)!
    stored.taskId = null
    stored.skillId = null
    const edited = await put(1, details)
    expect(edited.status).toBe(200)
    expect(await edited.json()).toMatchObject({ taskId: null, skillId: null, taskName: 'Study', skillName: 'English' })
  })

  test('reports invalid input, unknown sessions and persistence errors', async () => {
    expect((await put('invalid', details)).status).toBe(400)
    expect((await put(999, details)).status).toBe(404)
    await post()
    expect((await put(1, { ...details, duration: 0 })).status).toBe(400)
    failUpdate = true
    const failed = await put(1, details)
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'Database unavailable' })
    expect(sessions.get(request.completionId)?.duration).toBe(25)
  })
})
afterAll(() => new Promise<void>((resolve, reject) => {
  server.close(error => error ? reject(error) : resolve())
  server.closeAllConnections()
}))

describe('timer completion idempotency', () => {
  test('retries return the original session and do not increment counters again', async () => {
    const first = await post()
    const saved = await first.json()
    const retry = await post()
    expect(first.status).toBe(201)
    expect(retry.status).toBe(200)
    expect(await retry.json()).toEqual(saved)
    expect(insertCount).toBe(1)
    expect(taskUpdates).toBe(1)
    expect(skillUpdates).toBe(1)
  })

  describe('paginated session history and complete aggregates', () => {
    function seed(count: number, time = '2026-01-01T12:00:00Z') {
      for (let id = 1; id <= count; id++) {
        sessions.set(`seed-${id}`, {
          id, taskId: null, skillId: 4, taskName: 'Deleted task', skillName: 'English',
          duration: 1, completedAt: time, type: 'manual', completionId: null, completionRequest: null,
        })
      }
    }
    async function page(params = '') {
      const response = await fetch(`${url}?${params}`)
      expect(response.status).toBe(200)
      const body = await response.json() as {
        items: StoredSession[]; hasMore: boolean; nextCursor: string | null; limit: number
      }
      return body
    }

    test('browses more than 100 tied-timestamp records without omissions or duplicates', async () => {
      seed(235)
      let cursor: string | null = null
      const ids: number[] = []
      do {
        const result = await page(`limit=100${cursor ? `&cursor=${cursor}` : ''}`)
        expect(result.items.length).toBeLessThanOrEqual(100)
        expect(result.hasMore).toBe(result.nextCursor !== null)
        ids.push(...result.items.map(session => session.id))
        cursor = result.nextCursor
      } while (cursor !== null)
      expect(ids).toEqual(Array.from({ length: 235 }, (_, index) => 235 - index))
      expect(new Set(ids).size).toBe(235)
    })

    test('newer inserts between pages do not shift the older-record cursor', async () => {
      seed(60)
      const first = await page()
      sessions.set('newer', {
        ...sessions.get('seed-1')!, id: 61, completedAt: '2026-02-01T12:00:00Z',
      })
      const second = await page(`cursor=${first.nextCursor}`)
      expect(first.items.map(session => session.id)).toEqual(Array.from({ length: 25 }, (_, i) => 60 - i))
      expect(second.items.map(session => session.id)).toEqual(Array.from({ length: 25 }, (_, i) => 35 - i))
    })

    test('includes the complete end date and supports either date boundary alone', async () => {
      seed(1, '2026-01-01T00:00:00Z')
      sessions.set('end', { ...sessions.get('seed-1')!, id: 2, completedAt: '2026-01-02T23:59:59Z' })
      sessions.set('after', { ...sessions.get('seed-1')!, id: 3, completedAt: '2026-01-03T00:00:00Z' })
      expect((await page('start=2026-01-01&end=2026-01-02')).items.map(session => session.id)).toEqual([2, 1])
      expect((await page('start=2026-01-03')).items.map(session => session.id)).toEqual([3])
      expect((await page('end=2026-01-01')).items.map(session => session.id)).toEqual([1])
      expect((await page('start=2026-02-01')).hasMore).toBe(false)
    })

    test('aggregates all matching records, including period totals beyond the first page', async () => {
      const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
      seed(235, now)
      const history = await page()
      expect(history.items).toHaveLength(25)
      const response = await fetch(url.replace('/pomodoros', '/analytics/summary'))
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        totalPomodoros: 235, totalMinutes: 235,
        breakdown: [{
          skillId: 4, minutes: 235, pomodoros: 235,
          todayMinutes: 235, weekMinutes: 235, yearMinutes: 235,
        }],
      })
    })

    test('filtered aggregates include all filtered records, not just the requested page', async () => {
      seed(140)
      sessions.set('outside', { ...sessions.get('seed-1')!, id: 141, completedAt: '2026-02-01T00:00:00Z' })
      const response = await fetch(url.replace('/pomodoros', '/analytics/summary') + '?start=2026-01-01&end=2026-01-01')
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        totalPomodoros: 140, totalMinutes: 140, breakdown: [{ minutes: 140, pomodoros: 140 }],
      })
    })

    test('invalid queries and database failures return explicit errors', async () => {
      expect((await fetch(`${url}?limit=101`)).status).toBe(400)
      expect((await fetch(`${url}?cursor=invalid`)).status).toBe(400)
      expect((await fetch(url.replace('/pomodoros', '/analytics/summary') + '?start=invalid')).status).toBe(400)
      failHistory = true
      const failed = await fetch(url)
      expect(failed.status).toBe(500)
      expect(await failed.json()).toEqual({ error: 'History unavailable' })
    })
  })

  test('concurrent submissions are deduplicated at the unique-key boundary', async () => {
    lookupBarrier = new Promise(resolve => { releaseLookups = resolve })
    const responses = await Promise.all([post(), post()])
    expect(responses.map(response => response.status).sort()).toEqual([200, 201])
    const results = await Promise.all(responses.map(response => response.json()))
    expect(results[0]).toEqual(results[1])
    expect(results[0]).toMatchObject({ id: 1 })
    expect(insertCount).toBe(1)
    expect(taskUpdates).toBe(1)
    expect(skillUpdates).toBe(1)
    expect(rollbacks).toBe(1)
  })

  test('a retry remains valid after the task was deleted', async () => {
    await post()
    taskExists = false
    const retry = await post()
    expect(retry.status).toBe(200)
    expect(insertCount).toBe(1)
  })

  test('rejects reuse of a completion ID for a different duration', async () => {
    await post()
    const conflict = await post({ ...request, duration: 30 })
    expect(conflict.status).toBe(409)
    expect(insertCount).toBe(1)
  })

  test('returns database failures explicitly and allows a later retry', async () => {
    failInsert = true
    const failed = await post()
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'Database unavailable' })
    expect(taskUpdates).toBe(0)
    expect(rollbacks).toBe(1)
    failInsert = false
    expect((await post()).status).toBe(201)
  })

  test('requires the completion ID before attempting persistence', async () => {
    const invalid = await post({ type: 'timer', duration: 25, taskId: 12 })
    expect(invalid.status).toBe(400)
    expect(insertCount).toBe(0)
  })
})
