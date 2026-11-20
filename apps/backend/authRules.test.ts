import { describe, expect, test } from 'bun:test'
import { validateLoginInput, validateRegistrationInput } from './authRules.js'

describe('validateRegistrationInput', () => {
  test('accepts a valid registration and normalizes fields', () => {
    const result = validateRegistrationInput({
      email: '  Learner@Example.COM ', password: 'correct horse', displayName: '  Remy  ',
    })
    expect(result).toEqual({ value: { email: 'learner@example.com', password: 'correct horse', displayName: 'Remy' } })
  })

  test('defaults display name to null', () => {
    const result = validateRegistrationInput({ email: 'a@b.co', password: 'longenough' })
    expect(result).toEqual({ value: { email: 'a@b.co', password: 'longenough', displayName: null } })
    expect(validateRegistrationInput({ email: 'a@b.co', password: 'longenough', displayName: '   ' }))
      .toEqual({ value: { email: 'a@b.co', password: 'longenough', displayName: null } })
  })

  test('rejects invalid emails', () => {
    for (const email of [undefined, null, 42, '', 'plain', 'a@b', 'a b@c.d', '@d.com', `x@${'y'.repeat(260)}.com`]) {
      expect(validateRegistrationInput({ email, password: 'longenough' })).toEqual({ error: 'Enter a valid email address.' })
    }
  })

  test('rejects weak or invalid passwords', () => {
    for (const password of [undefined, null, 1234567890, 'short', 'x'.repeat(256)]) {
      expect('error' in validateRegistrationInput({ email: 'a@b.co', password })).toBe(true)
    }
    expect('value' in validateRegistrationInput({ email: 'a@b.co', password: 'x'.repeat(255) })).toBe(true)
  })

  test('rejects invalid display names', () => {
    expect(validateRegistrationInput({ email: 'a@b.co', password: 'longenough', displayName: 9 }))
      .toEqual({ error: 'Display name must be text.' })
    expect('error' in validateRegistrationInput({ email: 'a@b.co', password: 'longenough', displayName: 'n'.repeat(256) })).toBe(true)
  })
})

describe('validateLoginInput', () => {
  test('accepts valid credentials without altering the password', () => {
    expect(validateLoginInput({ email: 'A@B.co', password: ' pw with spaces ' }))
      .toEqual({ value: { email: 'a@b.co', password: ' pw with spaces ' } })
  })

  test('rejects missing fields and non-objects', () => {
    expect(validateLoginInput(undefined)).toEqual({ error: 'Enter a valid email address.' })
    expect(validateLoginInput({ email: 'a@b.co' })).toEqual({ error: 'Enter your password.' })
    expect(validateLoginInput({ email: 'a@b.co', password: '' })).toEqual({ error: 'Enter your password.' })
  })
})
