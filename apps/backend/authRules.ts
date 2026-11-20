// Validation for account registration and login. Pure functions so they are unit-testable.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 255

export interface Credentials {
  email: string
  password: string
}

export interface Registration extends Credentials {
  displayName: string | null
}

type Validated<T> = { value: T } | { error: string }

function asRecord(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null ? body as Record<string, unknown> : {}
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (email.length < 3 || email.length > 255 || !EMAIL_PATTERN.test(email)) return null
  return email
}

export function validPassword(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= PASSWORD_MIN_LENGTH
    && value.length <= PASSWORD_MAX_LENGTH
}

export function validateLoginInput(body: unknown): Validated<Credentials> {
  const { email, password } = asRecord(body)
  const normalized = normalizeEmail(email)
  if (!normalized) return { error: 'Enter a valid email address.' }
  if (typeof password !== 'string' || password.length === 0) return { error: 'Enter your password.' }
  return { value: { email: normalized, password } }
}

export function validateRegistrationInput(body: unknown): Validated<Registration> {
  const { email, password, displayName } = asRecord(body)
  const normalized = normalizeEmail(email)
  if (!normalized) return { error: 'Enter a valid email address.' }
  if (!validPassword(password)) {
    return { error: `Password must be ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters.` }
  }
  if (displayName !== undefined && displayName !== null && typeof displayName !== 'string') {
    return { error: 'Display name must be text.' }
  }
  const trimmedName = typeof displayName === 'string' ? displayName.trim() : ''
  if (trimmedName.length > 255) return { error: 'Display name must be 255 characters or fewer.' }
  return { value: { email: normalized, password, displayName: trimmedName.length ? trimmedName : null } }
}
