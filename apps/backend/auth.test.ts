import { beforeEach, describe, expect, mock, test } from 'bun:test'
import express from 'express'
import { SQL } from 'bun'

interface StoredUser {
  id: number
  email: string
  displayName: string | null
  passwordHash: string
}

const users = new Map<string, StoredUser>()
const tokens = new Map<string, number>()
let nextUserId = 0
let claimedBy: number[] = []

async function query(strings: TemplateStringsArray, ...values: unknown[]) {
  const sql = strings.join('?')
  if (sql.includes('INSERT INTO users')) {
    const email = String(values[0])
    if (users.has(email)) {
      throw new SQL.MySQLError('Duplicate email', { code: 'ER_DUP_ENTRY', errno: 1062, sqlState: '23000' })
    }
    nextUserId++
    users.set(email, {
      id: nextUserId, email,
      displayName: values[1] == null ? null : String(values[1]),
      passwordHash: String(values[2]),
    })
    return []
  }
  if (sql.includes('LAST_INSERT_ID')) return [{ id: nextUserId }]
  if (sql.includes('SELECT COUNT(*) AS c FROM users')) return [{ c: users.size }]
  if (sql.includes('SET user_id')) {
    claimedBy.push(Number(values[0]))
    return []
  }
  if (sql.includes('INSERT INTO auth_tokens')) {
    tokens.set(String(values[1]), Number(values[0]))
    return []
  }
  if (sql.includes('DELETE FROM auth_tokens')) {
    tokens.delete(String(values[0]))
    return []
  }
  if (sql.includes('FROM auth_tokens')) {
    const userId = tokens.get(String(values[0]))
    return userId === undefined ? [] : [{ userId }]
  }
  if (sql.includes('FROM users WHERE email')) {
    const user = users.get(String(values[0]))
    return user ? [user] : []
  }
  if (sql.includes('FROM users WHERE id')) {
    const user = [...users.values()].find(candidate => candidate.id === Number(values[0]))
    return user ? [user] : []
  }
  throw new Error(`Unexpected query in test: ${sql}`)
}

const testDb = Object.assign(query, {
  begin: async (callback: (transaction: typeof query) => Promise<unknown>) => callback(query),
})

mock.module('./db.js', () => ({ db: testDb }))
const { default: authRouter, requireAuth } = await import('./auth.js')
const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.get('/api/probe', requireAuth, (req, res) => res.json({ userId: req.userId }))
const server = app.listen(0, '127.0.0.1')
await new Promise<void>(resolve => server.once('listening', resolve))
const address = server.address()
if (address === null || typeof address === 'string') throw new Error('Test server did not start')
const base = `http://127.0.0.1:${address.port}/api`

function post(path: string, body: unknown, token?: string) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

function get(path: string, token?: string) {
  return fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

const registration = { email: 'learner@example.com', password: 'correct horse', displayName: 'Remy' }

beforeEach(() => {
  users.clear()
  tokens.clear()
  nextUserId = 0
  claimedBy = []
})

describe('registration', () => {
  test('creates the account, claims legacy data for the first user only, and returns a working token', async () => {
    const response = await post('/auth/register', registration)
    expect(response.status).toBe(201)
    const body = await response.json() as { token: string; user: unknown }
    expect(body.user).toEqual({ id: 1, email: 'learner@example.com', displayName: 'Remy' })
    expect(body.token).toMatch(/^[0-9a-f]{64}$/)
    // Three claim updates (skills, tasks, pomodoro_logs), all for user 1.
    expect(claimedBy).toEqual([1, 1, 1])

    const probe = await get('/probe', body.token)
    expect(probe.status).toBe(200)
    expect(await probe.json()).toEqual({ userId: 1 })

    const second = await post('/auth/register', { ...registration, email: 'second@example.com' })
    expect(second.status).toBe(201)
    expect(claimedBy).toEqual([1, 1, 1])
  })

  test('rejects duplicate emails and invalid input', async () => {
    expect((await post('/auth/register', registration)).status).toBe(201)
    const duplicate = await post('/auth/register', { ...registration, displayName: 'Other' })
    expect(duplicate.status).toBe(409)
    expect((await post('/auth/register', { email: 'bad', password: 'correct horse' })).status).toBe(400)
    expect((await post('/auth/register', { email: 'a@b.co', password: 'short' })).status).toBe(400)
  })
})

describe('login and logout', () => {
  test('issues tokens for valid credentials only', async () => {
    await post('/auth/register', registration)
    const ok = await post('/auth/login', { email: 'Learner@example.com', password: 'correct horse' })
    expect(ok.status).toBe(200)
    const { token, user } = await ok.json() as { token: string; user: unknown }
    expect(user).toEqual({ id: 1, email: 'learner@example.com', displayName: 'Remy' })
    expect((await get('/auth/me', token)).status).toBe(200)

    expect((await post('/auth/login', { email: registration.email, password: 'wrong password' })).status).toBe(401)
    expect((await post('/auth/login', { email: 'nobody@example.com', password: 'correct horse' })).status).toBe(401)
  })

  test('logout revokes the token', async () => {
    const { token } = await (await post('/auth/register', registration)).json() as { token: string }
    expect((await post('/auth/logout', {}, token)).status).toBe(204)
    expect((await get('/auth/me', token)).status).toBe(401)
    expect((await get('/probe', token)).status).toBe(401)
  })
})

describe('requireAuth', () => {
  test('rejects missing, malformed, and unknown tokens', async () => {
    expect((await get('/probe')).status).toBe(401)
    expect((await get('/probe', 'not-a-token')).status).toBe(401)
    expect((await get('/probe', 'f'.repeat(64))).status).toBe(401)
  })
})
