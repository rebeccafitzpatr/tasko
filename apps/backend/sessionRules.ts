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
  if (year < 1000 || Number(value.slice(11, 13)) > 23 ||
      Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return false
  const calendarDate = new Date(Date.UTC(year, month - 1, day))
  return calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day
}

export interface EditSessionInput {
  taskId: number | null
  skillId: number | null
  duration: number
  completedAt: string
}

function validateSessionFields(input: Record<string, unknown>): string | null {
  if (typeof input.duration !== 'number' || !Number.isSafeInteger(input.duration) ||
      input.duration < 1 || input.duration > 2_147_483_647) {
    return 'duration must be a positive whole number of minutes.'
  }
  if (input.taskId != null && !isPositiveId(input.taskId)) {
    return 'taskId must be a positive integer or null.'
  }
  if (input.skillId != null && !isPositiveId(input.skillId)) {
    return 'skillId must be a positive integer or null.'
  }
  return null
}

function timestampError(value: unknown): string | null {
  if (!isIsoTimestamp(value)) {
    return 'completedAt must be a valid ISO timestamp with a timezone.'
  }
  if (new Date(value).getTime() > Date.now()) {
    return 'completedAt cannot be in the future.'
  }
  return null
}

export function validateEditSessionInput(body: unknown):
  { value: EditSessionInput } | { error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Request body must be an object.' }
  }
  const input = body as Record<string, unknown>
  if ('type' in input || 'completionId' in input) {
    return { error: 'Session type and completionId cannot be changed.' }
  }
  const error = validateSessionFields(input) ?? timestampError(input.completedAt)
  if (error) return { error }
  return {
    value: {
      taskId: input.taskId == null ? null : Number(input.taskId),
      skillId: input.skillId == null ? null : Number(input.skillId),
      duration: Number(input.duration),
      completedAt: String(input.completedAt),
    },
  }
}

export function validateCreateSessionInput(body: unknown): SessionInputResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Request body must be an object.' }
  }

  const input = body as Record<string, unknown>

  if (input.type !== 'timer' && input.type !== 'manual') {
    return { error: 'type must be "timer" or "manual".' }
  }
  const fieldsError = validateSessionFields(input)
  if (fieldsError) return { error: fieldsError }

  const taskId = input.taskId == null ? null : input.taskId
  const skillId = input.skillId == null ? null : input.skillId

  if (input.type === 'timer' && taskId === null) {
    return { error: 'taskId is required for timer sessions.' }
  }
  if (input.type === 'timer' &&
      (typeof input.completionId !== 'string' ||
       !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.completionId))) {
    return { error: 'Timer sessions require a UUID v4 completionId.' }
  }

  if (input.type === 'manual') {
    const error = timestampError(input.completedAt)
    if (error) return { error }
  }

  return {
    value: {
      taskId: taskId === null ? null : Number(taskId),
      skillId: skillId === null ? null : Number(skillId),
      duration: Number(input.duration),
      type: input.type,
      completedAt: input.type === 'manual' ? input.completedAt as string : null,
      completionId: input.type === 'timer' ? String(input.completionId).toLowerCase() : null,
    },
  }
}
