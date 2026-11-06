import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import express from 'express'
import { SQL } from 'bun'
import type { PomodoroLog } from './types.js'

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

// Exercise the real HTTP handler with a database double that enforces the unique key.
async function query(strings: TemplateStringsArray, ...values: unknown[]) {
  const sql = strings.join('?')
  if (sql.includes('SELECT COUNT(*) AS c FROM pomodoro_logs')) return [{ c: sessions.size }]
  if (sql.includes('SELECT COALESCE(SUM(duration_minutes), 0) AS m FROM pomodoro_logs')) {
    return [{ m: [...sessions.values()].reduce((sum, session) => sum + session.duration, 0) }]
  }
  if (sql.includes('SELECT COUNT(*) AS c FROM tasks')) return [{ c: taskExists ? 1 : 0 }]
  if (sql.includes('GROUP BY s.id, s.name')) {
    const associated = [...sessions.values()].filter(session => session.skillId === 4)
    return [{
      skillId: 4, skillName: 'English', pomodoros: associated.length,
      minutes: associated.reduce((sum, session) => sum + session.duration, 0),
    }]
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
    return taskExists ? [{ id: Number(values[0]), taskName: 'Study', skillId: 4, skillName: 'English' }] : []
  }
  if (sql.includes('SELECT id, name FROM skills')) {
    return [{ id: Number(values[0]), name: 'English' }]
  }
  if (sql.includes('FROM pomodoro_logs WHERE id')) {
    const session = [...sessions.values()].find(value => value.id === Number(values[0]))
    return session ? [session] : []
  }
  if (sql.includes('UPDATE pomodoro_logs')) {
    if (failUpdate) throw new Error('Database unavailable')
    const session = [...sessions.values()].find(value => value.id === Number(values[6]))
    if (!session) throw new Error('Test session missing')
    Object.assign(session, {
      taskId: values[0] == null ? null : Number(values[0]),
      skillId: values[1] == null ? null : Number(values[1]),
      taskName: values[2], skillName: values[3], duration: Number(values[4]),
      completedAt: String(values[5]).replace(' ', 'T') + 'Z',
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
    })
    return []
  }
  if (sql.includes('UPDATE tasks')) {
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
  lookupBarrier = null
  releaseLookups = null
  lookupCount = 0
})

function put(id: number | string, body: unknown) {
  return fetch(`${url}/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

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
