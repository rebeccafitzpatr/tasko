import { Router, type NextFunction, type Request, type Response } from 'express'
import { SQL } from 'bun'
import { createHash, randomBytes } from 'node:crypto'
import { db } from './db.js'
import { validateLoginInput, validateRegistrationInput } from './authRules.js'

declare global {
  namespace Express {
    interface Request {
      userId?: number
    }
  }
}

const TOKEN_TTL_DAYS = 30

export interface AuthUser {
  id: number
  email: string
  displayName: string | null
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function issueToken(userId: number): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await db`
    INSERT INTO auth_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, ${hashToken(token)}, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${TOKEN_TTL_DAYS} DAY))
  `
  return token
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  return /^[0-9a-f]{64}$/.test(token) ? token : null
}

/** Rejects requests without a valid, unexpired token; attaches req.userId. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req)
  if (!token) return res.status(401).json({ error: 'Log in to continue.' })
  try {
    const rows = await db`
      SELECT user_id AS userId FROM auth_tokens
      WHERE token_hash = ${hashToken(token)} AND expires_at > UTC_TIMESTAMP()
    `
    if (!rows[0]) return res.status(401).json({ error: 'Your session has expired. Log in again.' })
    req.userId = Number(rows[0].userId)
    next()
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
}

async function findUser(userId: number): Promise<AuthUser | null> {
  const rows = await db`
    SELECT id, email, display_name AS displayName FROM users WHERE id = ${userId}
  `
  if (!rows[0]) return null
  return { id: Number(rows[0].id), email: String(rows[0].email), displayName: rows[0].displayName ?? null }
}

const router = Router()

router.post('/register', async (req, res) => {
  const validation = validateRegistrationInput(req.body)
  if ('error' in validation) return res.status(400).json({ error: validation.error })
  const { email, password, displayName } = validation.value
  try {
    const passwordHash = await Bun.password.hash(password)
    const user = await db.begin(async transaction => {
      await transaction`
        INSERT INTO users (email, display_name, password_hash)
        VALUES (${email}, ${displayName}, ${passwordHash})
      `
      const inserted = await transaction`SELECT LAST_INSERT_ID() AS id`
      const id = Number(inserted[0].id)
      // The first account claims pre-existing single-user data.
      const count = await transaction`SELECT COUNT(*) AS c FROM users`
      if (Number(count[0]?.c ?? 0) === 1) {
        await transaction`UPDATE skills SET user_id = ${id} WHERE user_id IS NULL`
        await transaction`UPDATE tasks SET user_id = ${id} WHERE user_id IS NULL`
        await transaction`UPDATE pomodoro_logs SET user_id = ${id} WHERE user_id IS NULL`
      }
      return { id, email, displayName }
    })
    const token = await issueToken(user.id)
    res.status(201).json({ token, user })
  } catch (e) {
    if (e instanceof SQL.MySQLError && e.errno === 1062) {
      return res.status(409).json({ error: 'An account with this email already exists.' })
    }
    res.status(500).json({ error: (e as Error).message })
  }
})

router.post('/login', async (req, res) => {
  const validation = validateLoginInput(req.body)
  if ('error' in validation) return res.status(400).json({ error: validation.error })
  const { email, password } = validation.value
  try {
    const rows = await db`
      SELECT id, email, display_name AS displayName, password_hash AS passwordHash
      FROM users WHERE email = ${email}
    `
    const account = rows[0]
    const valid = account ? await Bun.password.verify(password, String(account.passwordHash)) : false
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' })
    const token = await issueToken(Number(account.id))
    res.json({
      token,
      user: { id: Number(account.id), email: String(account.email), displayName: account.displayName ?? null },
    })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.post('/logout', requireAuth, async (req, res) => {
  const token = bearerToken(req)
  try {
    if (token) await db`DELETE FROM auth_tokens WHERE token_hash = ${hashToken(token)}`
    res.status(204).send()
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await findUser(req.userId!)
    if (!user) return res.status(401).json({ error: 'Your session has expired. Log in again.' })
    res.json({ user })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

export default router
