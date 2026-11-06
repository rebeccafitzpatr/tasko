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

// Exercise the real HTTP handler with a database double that enforces the unique key.
async function query(strings: TemplateStringsArray, ...values: unknown[]) {
  const sql = strings.join('?')
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
    return taskExists ? [{ id: 12, taskName: 'Study', skillId: 4, skillName: 'English' }] : []
  }
  if (sql.includes('INSERT INTO pomodoro_logs')) {
    if (failInsert) throw new Error('Database unavailable')
    const completionId = String(values[7])
    if (sessions.has(completionId)) {
      throw new SQL.MySQLError('Duplicate completion', {
        code: 'ER_DUP_ENTRY', errno: 1062, sqlState: '23000',
      })
    }
    latestId++
    insertCount++
    sessions.set(completionId, {
      id: latestId,
      taskId: Number(values[0]),
      skillId: Number(values[1]),
      taskName: String(values[2]),
      skillName: String(values[3]),
      duration: Number(values[4]),
      completedAt: String(values[5]).replace(' ', 'T') + 'Z',
      type: 'timer',
      completionId,
      completionRequest: String(values[8]),
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
  lookupBarrier = null
  releaseLookups = null
  lookupCount = 0
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
