import { describe, expect, test } from 'bun:test'
import { validateCreateSessionInput } from './sessionRules.js'

describe('validateCreateSessionInput', () => {
  test('accepts a timer session with a task and positive whole-minute duration', () => {
    expect(validateCreateSessionInput({
      type: 'timer',
      taskId: 12,
      skillId: 4,
      duration: 25,
    })).toEqual({
      value: {
        type: 'timer',
        taskId: 12,
        skillId: 4,
        duration: 25,
        completedAt: null,
      },
    })
  })

  test('accepts a manual session with a zoned ISO timestamp and optional associations', () => {
    expect(validateCreateSessionInput({
      type: 'manual',
      taskId: null,
      skillId: null,
      duration: 45,
      completedAt: '2026-11-05T08:30:00+13:00',
    })).toMatchObject({
      value: {
        type: 'manual',
        duration: 45,
        completedAt: '2026-11-05T08:30:00+13:00',
      },
    })
  })

  test.each([
    [{ type: 'timer', taskId: 1, duration: 0 }, 'duration'],
    [{ type: 'timer', taskId: 1, duration: 1.5 }, 'duration'],
    [{ type: 'timer', taskId: null, duration: 25 }, 'taskId'],
    [{ type: 'unknown', taskId: 1, duration: 25 }, 'type'],
    [{ type: 'manual', duration: 25 }, 'completedAt'],
    [{ type: 'manual', duration: 25, completedAt: '2026-02-30T12:00:00Z' }, 'completedAt'],
    [{ type: 'manual', duration: 25, completedAt: '2099-01-01T00:00:00Z' }, 'future'],
    [{ type: 'manual', duration: 25, taskId: '1', completedAt: '2026-11-05T08:30:00Z' }, 'taskId'],
  ] as const)('rejects invalid input %j', (input, message) => {
    expect(validateCreateSessionInput(input)).toMatchObject({ error: expect.stringContaining(message) })
  })
})
