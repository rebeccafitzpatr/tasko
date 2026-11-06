export type SessionType = 'timer' | 'manual'

export interface CreateSessionInput {
  taskId: number | null
  skillId: number | null
  duration: number
  type: SessionType
  completedAt: string | null
  completionId: string | null
}

export type SessionInputResult =
  | { value: CreateSessionInput }
  | { error: string }

function isPositiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return false
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return false

  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  const calendarDate = new Date(Date.UTC(year, month - 1, day))
  return calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day
}

export function validateCreateSessionInput(body: unknown): SessionInputResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Request body must be an object.' }
  }

  const input = body as Record<string, unknown>

  if (input.type !== 'timer' && input.type !== 'manual') {
    return { error: 'type must be "timer" or "manual".' }
  }
  if (typeof input.duration !== 'number' ||
      !Number.isSafeInteger(input.duration) ||
      Number(input.duration) < 1 ||
      Number(input.duration) > 2_147_483_647) {
    return { error: 'duration must be a positive whole number of minutes.' }
  }

  const taskId = input.taskId == null ? null : input.taskId
  const skillId = input.skillId == null ? null : input.skillId

  if (taskId !== null && !isPositiveId(taskId)) {
    return { error: 'taskId must be a positive integer or null.' }
  }
  if (skillId !== null && !isPositiveId(skillId)) {
    return { error: 'skillId must be a positive integer or null.' }
  }
  if (input.type === 'timer' && taskId === null) {
    return { error: 'taskId is required for timer sessions.' }
  }
  if (input.type === 'timer' &&
      (typeof input.completionId !== 'string' ||
       !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.completionId))) {
    return { error: 'Timer sessions require a UUID v4 completionId.' }
  }

  if (input.type === 'manual') {
    if (!isIsoTimestamp(input.completedAt)) {
      return { error: 'Manual sessions require completedAt as an ISO timestamp with a timezone.' }
    }
    if (new Date(input.completedAt).getTime() > Date.now()) {
      return { error: 'completedAt cannot be in the future.' }
    }
  }

  return {
    value: {
      taskId,
      skillId,
      duration: Number(input.duration),
      type: input.type,
      completedAt: input.type === 'manual' ? input.completedAt as string : null,
      completionId: input.type === 'timer' ? String(input.completionId).toLowerCase() : null,
    },
  }
}
