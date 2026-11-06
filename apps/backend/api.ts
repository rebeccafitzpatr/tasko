import { Router } from 'express'
import { SQL, type TransactionSQL } from 'bun'
import { db } from './db.js' // uses the db.ts export
import { validateCreateSessionInput, validateEditSessionInput } from './sessionRules.js'
import { parseHistoryQuery, historyCursor } from './historyQuery.js'
import type { PomodoroLog } from './types.js'
import { validateSkillParent, validSkillName, type SkillNode } from './skillRules.js'
import { historyCsv, type ExportSession } from './historyCsv.js'

const router = Router();

class SessionRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function resolveSessionAssignment(query: SQL, taskId: number | null, requestedSkillId: number | null) {
  if (taskId !== null) {
    const tasks = await query`
      SELECT t.id, t.name AS taskName, t.skill_id AS skillId, s.name AS skillName,
             p.id AS parentSkillId, p.name AS parentSkillName
      FROM tasks t LEFT JOIN skills s ON s.id = t.skill_id
      LEFT JOIN skills p ON p.id = s.parent_id WHERE t.id = ${taskId}
    `
    const task = tasks[0]
    if (!task) throw new SessionRequestError(404, 'Task not found. Choose another task or leave it unassigned.')
    const skillId = task.skillId == null ? null : Number(task.skillId)
    if (requestedSkillId !== null && requestedSkillId !== skillId) {
      throw new SessionRequestError(400, 'skillId must match the selected task.')
    }
    return {
      taskName: String(task.taskName), skillName: task.skillName ?? null, skillId,
      parentSkillId: task.parentSkillId == null ? null : Number(task.parentSkillId),
      parentSkillName: task.parentSkillName ?? null,
      skillPath: task.parentSkillName ? `${task.parentSkillName} / ${task.skillName}` : task.skillName ?? null,
    }
  }
  if (requestedSkillId !== null) {
    const skills = await query`
      SELECT s.id, s.name, p.id AS parentSkillId, p.name AS parentSkillName
      FROM skills s LEFT JOIN skills p ON p.id = s.parent_id WHERE s.id = ${requestedSkillId}
    `
    if (!skills[0]) throw new SessionRequestError(404, 'Skill not found. Choose another skill or leave it unassigned.')
    const skill = skills[0]
    return {
      taskName: null, skillName: String(skill.name), skillId: requestedSkillId,
      parentSkillId: skill.parentSkillId == null ? null : Number(skill.parentSkillId),
      parentSkillName: skill.parentSkillName ?? null,
      skillPath: skill.parentSkillName ? `${skill.parentSkillName} / ${skill.name}` : String(skill.name),
    }
  }
  return { taskName: null, skillName: null, skillId: null, parentSkillId: null, parentSkillName: null, skillPath: null }
}

async function reconcileSessionCounters(transaction: TransactionSQL, taskIds: (number | null)[], skillIds: (number | null)[]) {
  for (const taskId of new Set(taskIds)) {
    if (taskId === null) continue
    await transaction`
      UPDATE tasks SET
        completed_pomodoros = (SELECT COUNT(*) FROM pomodoro_logs WHERE task_id = ${taskId}),
        minutes_spent = (SELECT COALESCE(SUM(duration_minutes), 0) FROM pomodoro_logs WHERE task_id = ${taskId})
      WHERE id = ${taskId}
    `
  }
  for (const skillId of new Set(skillIds)) {
    if (skillId === null) continue
    await transaction`
      UPDATE skills SET
        minutes_spent = (SELECT COALESCE(SUM(duration_minutes), 0) FROM pomodoro_logs WHERE skill_id = ${skillId})
      WHERE id = ${skillId}
    `
  }
}

async function findCompletion(completionId: string) {
  const rows = await db`
    SELECT id, task_id AS taskId, skill_id AS skillId,
           task_name_snapshot AS taskName, skill_name_snapshot AS skillName,
           duration_minutes AS duration,
           DATE_FORMAT(completed_at, '%Y-%m-%dT%H:%i:%sZ') AS completedAt,
           type, completion_id AS completionId, completion_request AS completionRequest,
           parent_skill_id_snapshot AS parentSkillId, parent_skill_name_snapshot AS parentSkillName,
           skill_path_snapshot AS skillPath
    FROM pomodoro_logs WHERE completion_id = ${completionId}
  `
  return rows[0]
}

// Skills

router.get('/skills', async (_req, res) => {
  try {
    const rows = await db`
      SELECT s.id, s.name, s.parent_id AS parentId, p.name AS parentName, s.minutes_spent AS minutesSpent
      FROM skills s LEFT JOIN skills p ON p.id = s.parent_id ORDER BY s.id
    `
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.post('/skills', async (req, res) => {
  const { name, parentId = null } = req.body ?? {}
  if (!validSkillName(name)) return res.status(400).json({ error: 'Enter a skill name from 1 to 255 characters.' })
  if (parentId !== null && (typeof parentId !== 'number' || !Number.isSafeInteger(parentId) || parentId < 1)) {
    return res.status(400).json({ error: 'parentId must be a positive integer or null.' })
  }
  try {
    const skill = await db.begin(async transaction => {
      const rows: SkillNode[] = await transaction`SELECT id, name, parent_id AS parentId FROM skills ORDER BY id FOR UPDATE`
      const nodes = rows.map(row => ({ ...row, id: Number(row.id), parentId: row.parentId == null ? null : Number(row.parentId) }))
      const error = validateSkillParent(nodes, null, parentId)
      if (error) throw new SessionRequestError(400, error)
      await transaction`INSERT INTO skills (name, parent_id, minutes_spent) VALUES (${name.trim()}, ${parentId}, 0)`
      const inserted = await transaction`SELECT LAST_INSERT_ID() AS id`
      return { id: Number(inserted[0].id), name: name.trim(), parentId, parentName: nodes.find(node => node.id === parentId)?.name ?? null, minutesSpent: 0 }
    })
    res.status(201).json(skill)
  } catch (e) {
    if (e instanceof SessionRequestError) return res.status(e.status).json({ error: e.message })
    if (e instanceof SQL.MySQLError && e.errno === 1062) return res.status(409).json({ error: 'A skill with this name already exists.' })
    res.status(500).json({ error: (e as Error).message })
  }
})

router.put('/skills/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { name, minutesSpent, parentId } = req.body ?? {}
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid skill ID.' })
  if (name !== undefined && !validSkillName(name)) return res.status(400).json({ error: 'Enter a skill name from 1 to 255 characters.' })
  if (parentId !== undefined && parentId !== null && (typeof parentId !== 'number' || !Number.isSafeInteger(parentId) || parentId < 1)) {
    return res.status(400).json({ error: 'parentId must be a positive integer or null.' })
  }
  if (minutesSpent !== undefined && (typeof minutesSpent !== 'number' || !Number.isSafeInteger(minutesSpent) || minutesSpent < 0)) {
    return res.status(400).json({ error: 'minutesSpent must be a non-negative integer.' })
  }
  try {
    const skill = await db.begin(async transaction => {
      const rows: SkillNode[] = await transaction`SELECT id, name, parent_id AS parentId FROM skills ORDER BY id FOR UPDATE`
      const nodes = rows.map(row => ({ ...row, id: Number(row.id), parentId: row.parentId == null ? null : Number(row.parentId) }))
      const current = nodes.find(node => node.id === id)
      if (!current) throw new SessionRequestError(404, 'Skill not found.')
      const nextParent = parentId === undefined ? current.parentId : parentId
      const error = validateSkillParent(nodes, id, nextParent)
      if (error) throw new SessionRequestError(400, error)
      await transaction`UPDATE skills SET name = ${name === undefined ? current.name : name.trim()}, parent_id = ${nextParent} WHERE id = ${id}`
      if (minutesSpent !== undefined) await transaction`UPDATE skills SET minutes_spent = ${minutesSpent} WHERE id = ${id}`
      const updated = await transaction`
        SELECT s.id, s.name, s.parent_id AS parentId, p.name AS parentName, s.minutes_spent AS minutesSpent
        FROM skills s LEFT JOIN skills p ON p.id = s.parent_id WHERE s.id = ${id}
      `
      return updated[0]
    })
    res.json(skill)
  } catch (e) {
    if (e instanceof SessionRequestError) return res.status(e.status).json({ error: e.message })
    if (e instanceof SQL.MySQLError && e.errno === 1062) return res.status(409).json({ error: 'A skill with this name already exists.' })
    res.status(500).json({ error: (e as Error).message })
  }
})

router.delete('/skills/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid skill ID.' })
  try {
    await db.begin(async transaction => {
      const rows: SkillNode[] = await transaction`SELECT id, name, parent_id AS parentId FROM skills ORDER BY id FOR UPDATE`
      if (!rows.some(row => Number(row.id) === id)) throw new SessionRequestError(404, 'Skill not found.')
      if (rows.some(row => row.parentId !== null && Number(row.parentId) === id)) {
        throw new SessionRequestError(409, 'Move, promote, or delete sub-skills before deleting their parent.')
      }
      await transaction`DELETE FROM skills WHERE id = ${id}`
    })
    res.status(204).send()
  } catch (e) {
    if (e instanceof SessionRequestError) return res.status(e.status).json({ error: e.message })
    res.status(500).json({ error: (e as Error).message })
  }
});

// Tasks

router.get('/tasks', async (_req, res) => {
  try {
    const rows = await db`
      SELECT
        t.id,
        t.name AS name,
        t.skill_id AS skillId,
        t.status AS status,
        t.completed_pomodoros AS completedPomodoros,
        t.minutes_spent AS minutesSpent,
        t.created_at AS createdAt,
        t.updated_at AS updatedAt,
        s.name AS skillName,
        p.id AS parentSkillId, p.name AS parentSkillName,
        CASE WHEN p.id IS NULL THEN s.name ELSE CONCAT(p.name, ' / ', s.name) END AS skillPath
      FROM tasks t
      LEFT JOIN skills s ON t.skill_id = s.id
      LEFT JOIN skills p ON p.id = s.parent_id
      ORDER BY t.id DESC
    `
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.post('/tasks', async (req, res) => {
  const { name, skillId = null } = req.body ?? {}
  if (!validSkillName(name)) return res.status(400).json({ error: 'Enter a task name from 1 to 255 characters.' })
  if (skillId !== null && (typeof skillId !== 'number' || !Number.isSafeInteger(skillId) || skillId < 1)) {
    return res.status(400).json({ error: 'skillId must be a positive integer or null.' })
  }
  try {
    const assignment = await resolveSessionAssignment(db, null, skillId)
    const task = await db.begin(async transaction => {
      await transaction`INSERT INTO tasks (name, skill_id) VALUES (${name.trim()}, ${skillId})`
      const rows = await transaction`SELECT LAST_INSERT_ID() AS id`
      return { id: Number(rows[0].id), name: name.trim(), skillId, skillName: assignment.skillName, skillPath: assignment.skillPath }
    })
    res.status(201).json(task)
  } catch (e) {
    if (e instanceof SessionRequestError) return res.status(e.status).json({ error: e.message })
    res.status(500).json({ error: (e as Error).message })
  }
})

router.put('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { name, skillId = null } = req.body ?? {}
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid task ID.' })
  if (!validSkillName(name)) return res.status(400).json({ error: 'Enter a task name from 1 to 255 characters.' })
  if (skillId !== null && (typeof skillId !== 'number' || !Number.isSafeInteger(skillId) || skillId < 1)) {
    return res.status(400).json({ error: 'skillId must be a positive integer or null.' })
  }
  try {
    const assignment = await resolveSessionAssignment(db, null, skillId)
    const task = await db.begin(async transaction => {
      const previous = await transaction`SELECT id FROM tasks WHERE id = ${id} FOR UPDATE`
      if (!previous[0]) throw new SessionRequestError(404, 'Task not found.')
      await transaction`UPDATE tasks SET name = ${name.trim()}, skill_id = ${skillId} WHERE id = ${id}`
      return { id, name: name.trim(), skillId, skillName: assignment.skillName, skillPath: assignment.skillPath }
    })
    res.json(task)
  } catch (e) {
    if (e instanceof SessionRequestError) return res.status(e.status).json({ error: e.message })
    res.status(500).json({ error: (e as Error).message })
  }
})

router.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params
  try {
    await db`DELETE FROM tasks WHERE id = ${id}`
    res.status(204).send()
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
});

// Pomodoro Logs

router.post('/pomodoros', async (req, res) => {
  const validation = validateCreateSessionInput(req.body)
  if ('error' in validation) {
    return res.status(400).json({ error: validation.error })
  }

  const { taskId, skillId: requestedSkillId, duration, type, completionId } = validation.value
  const completionRequest = completionId ? JSON.stringify({ taskId, duration, type }) : null
  try {
    if (completionId) {
      const existing = await findCompletion(completionId)
      if (existing) {
        const { completionRequest: savedRequest, ...savedSession } = existing
        if (savedRequest !== completionRequest) {
          return res.status(409).json({ error: 'completionId was already used for another session.' })
        }
        return res.status(200).json(savedSession)
      }
    }
    const { taskName, skillName, skillId: canonicalSkillId, parentSkillId, parentSkillName, skillPath } =
      await resolveSessionAssignment(db, taskId, requestedSkillId)

    const completedAt = type === 'timer'
      ? new Date()
      : new Date(validation.value.completedAt as string)
    completedAt.setMilliseconds(0)
    const completedAtUtc = completedAt.toISOString().slice(0, 19).replace('T', ' ')
    const session = await db.begin(async (transaction) => {
      await transaction`
        INSERT INTO pomodoro_logs
          (task_id, skill_id, task_name_snapshot, skill_name_snapshot,
           duration_minutes, completed_at, completed_at_is_utc, type,
           completion_id, completion_request,
           parent_skill_id_snapshot, parent_skill_name_snapshot, skill_path_snapshot)
        VALUES
          (${taskId}, ${canonicalSkillId}, ${taskName}, ${skillName},
           ${duration}, ${completedAtUtc}, TRUE, ${type},
           ${completionId}, ${completionRequest}, ${parentSkillId}, ${parentSkillName}, ${skillPath})
      `
      if (taskId !== null) {
        await transaction`
          UPDATE tasks
          SET completed_pomodoros = COALESCE(completed_pomodoros, 0) + 1,
              minutes_spent = COALESCE(minutes_spent, 0) + ${duration}
          WHERE id = ${taskId}
        `
      }
      if (canonicalSkillId !== null) {
        await transaction`
          UPDATE skills SET minutes_spent = COALESCE(minutes_spent, 0) + ${duration}
          WHERE id = ${canonicalSkillId}
        `
      }
      const rows = await transaction`SELECT LAST_INSERT_ID() AS id`
      return rows[0]
    })
    res.status(201).json({
      id: session.id,
      taskId,
      skillId: canonicalSkillId,
      taskName,
      skillName,
      duration,
      completedAt: completedAt.toISOString().replace('.000Z', 'Z'),
      type,
      completionId,
      parentSkillId, parentSkillName, skillPath,
    })
  } catch (e) {
    if (e instanceof SessionRequestError) {
      return res.status(e.status).json({ error: e.message })
    }
    if (completionId && e instanceof SQL.MySQLError && e.errno === 1062) {
      try {
        const existing = await findCompletion(completionId)
        if (existing && existing.completionRequest === completionRequest) {
          const { completionRequest: _savedRequest, ...savedSession } = existing
          return res.status(200).json(savedSession)
        }
        return res.status(409).json({ error: 'completionId conflicts with an existing session.' })
      } catch (lookupError) {
        return res.status(500).json({ error: (lookupError as Error).message })
      }
    }
    res.status(500).json({ error: (e as Error).message })
  }
})

router.put('/pomodoros/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Session ID must be a positive integer.' })
  }
  const validation = validateEditSessionInput(req.body)
  if ('error' in validation) return res.status(400).json({ error: validation.error })
  const { taskId, skillId, duration } = validation.value
  const completedAt = new Date(validation.value.completedAt)
  completedAt.setMilliseconds(0)
  const completedAtUtc = completedAt.toISOString().slice(0, 19).replace('T', ' ')

  try {
    const session = await db.begin(async transaction => {
      const rows = await transaction`
        SELECT id, task_id AS taskId, skill_id AS skillId,
               task_name_snapshot AS taskName, skill_name_snapshot AS skillName,
               type, completion_id AS completionId,
               parent_skill_id_snapshot AS parentSkillId, parent_skill_name_snapshot AS parentSkillName,
               skill_path_snapshot AS skillPath
        FROM pomodoro_logs WHERE id = ${id} FOR UPDATE
      `
      const previous = rows[0]
      if (!previous) throw new SessionRequestError(404, 'Session not found. Refresh history and try again.')
      const oldTaskId = previous.taskId == null ? null : Number(previous.taskId)
      const oldSkillId = previous.skillId == null ? null : Number(previous.skillId)
      // Preserve historical labels/associations for duration-only edits, even after deletion or reassignment.
      const assignment = taskId === oldTaskId && skillId === oldSkillId
        ? {
          taskName: previous.taskName, skillName: previous.skillName, skillId: oldSkillId,
          parentSkillId: previous.parentSkillId ?? null, parentSkillName: previous.parentSkillName ?? null,
          skillPath: previous.skillPath ?? previous.skillName ?? null,
        }
        : await resolveSessionAssignment(transaction, taskId, skillId)
      await transaction`
        UPDATE pomodoro_logs SET task_id = ${taskId}, skill_id = ${assignment.skillId},
          task_name_snapshot = ${assignment.taskName}, skill_name_snapshot = ${assignment.skillName},
          duration_minutes = ${duration}, completed_at = ${completedAtUtc}, completed_at_is_utc = TRUE,
          parent_skill_id_snapshot = ${assignment.parentSkillId}, parent_skill_name_snapshot = ${assignment.parentSkillName},
          skill_path_snapshot = ${assignment.skillPath}
        WHERE id = ${id}
      `
      await reconcileSessionCounters(transaction, [oldTaskId, taskId], [oldSkillId, assignment.skillId])
      return {
        id, taskId, skillId: assignment.skillId,
        taskName: assignment.taskName, skillName: assignment.skillName,
        duration, completedAt: completedAt.toISOString().replace('.000Z', 'Z'),
        type: previous.type, completionId: previous.completionId,
        parentSkillId: assignment.parentSkillId, parentSkillName: assignment.parentSkillName, skillPath: assignment.skillPath,
      }
    })
    res.json(session)
  } catch (error) {
    res.status(error instanceof SessionRequestError ? error.status : 500)
      .json({ error: (error as Error).message })
  }
})

router.get('/pomodoros/export', async (req, res) => {
  const parsed = parseHistoryQuery({ start: req.query.start, end: req.query.end })
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })
  const { start, end } = parsed.value
  try {
    const logs: ExportSession[] = await db`
      SELECT pl.id, pl.task_id AS taskId, pl.skill_id AS skillId,
        COALESCE(pl.task_name_snapshot, t.name) AS taskName,
        COALESCE(pl.skill_name_snapshot, s.name) AS skillName,
        pl.parent_skill_id_snapshot AS parentSkillId, pl.parent_skill_name_snapshot AS parentSkillName,
        COALESCE(pl.skill_path_snapshot, pl.skill_name_snapshot, s.name) AS skillPath,
        pl.duration_minutes AS duration, pl.type,
        pl.completed_at_is_utc AS completedAtIsUtc,
        CASE WHEN pl.completed_at_is_utc THEN DATE_FORMAT(pl.completed_at, '%Y-%m-%dT%H:%i:%sZ')
          ELSE DATE_FORMAT(pl.completed_at, '%Y-%m-%d %H:%i:%s') END AS completedAt
      FROM pomodoro_logs pl
      LEFT JOIN tasks t ON t.id = pl.task_id
      LEFT JOIN skills s ON s.id = pl.skill_id
      WHERE (${start} IS NULL OR pl.completed_at >= ${start})
        AND (${end} IS NULL OR pl.completed_at < ${end})
      ORDER BY pl.completed_at DESC, pl.id DESC
    `
    if (logs.length === 0) return res.status(204).send()
    const filename = `tasko-sessions_${req.query.start ?? 'all'}_${req.query.end ?? 'latest'}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(historyCsv(logs))
  } catch (cause) {
    res.status(500).json({ error: (cause as Error).message })
  }
})

router.get('/pomodoros', async (req, res) => {
  const parsed = parseHistoryQuery(req.query)
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })
  const { limit, start, end, beforeTime, beforeId } = parsed.value
  try {
    const logs: (PomodoroLog & { cursorTime: string })[] = await db`
      SELECT
        pl.id,
        pl.task_id AS taskId,
        pl.skill_id AS skillId,
        COALESCE(pl.task_name_snapshot, t.name) AS taskName,
        COALESCE(pl.skill_name_snapshot, s.name) AS skillName,
        pl.parent_skill_id_snapshot AS parentSkillId, pl.parent_skill_name_snapshot AS parentSkillName,
        COALESCE(pl.skill_path_snapshot, pl.skill_name_snapshot, s.name) AS skillPath,
        pl.duration_minutes AS duration,
        CASE
          WHEN pl.completed_at_is_utc THEN DATE_FORMAT(pl.completed_at, '%Y-%m-%dT%H:%i:%sZ')
          ELSE DATE_FORMAT(pl.completed_at, '%Y-%m-%d %H:%i:%s')
        END AS completedAt,
        pl.type,
        DATE_FORMAT(pl.completed_at, '%Y-%m-%d %H:%i:%s') AS cursorTime
      FROM pomodoro_logs pl
      LEFT JOIN tasks t ON t.id = pl.task_id
      LEFT JOIN skills s ON s.id = pl.skill_id
      WHERE (${start} IS NULL OR pl.completed_at >= ${start})
        AND (${end} IS NULL OR pl.completed_at < ${end})
        AND (${beforeTime} IS NULL OR pl.completed_at < ${beforeTime}
          OR (pl.completed_at = ${beforeTime} AND pl.id < ${beforeId}))
      ORDER BY pl.completed_at DESC, pl.id DESC
      LIMIT ${limit + 1}
    `
    const hasMore = logs.length > limit
    const page = logs.slice(0, limit)
    const last = page[page.length - 1]
    res.json({
      items: page.map(({ cursorTime: _time, ...log }) => log),
      hasMore,
      nextCursor: hasMore && last ? historyCursor(last.cursorTime, Number(last.id), parsed.value) : null,
      limit,
    })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.get('/analytics/summary', async (req, res) => {
  const parsed = parseHistoryQuery({ start: req.query.start, end: req.query.end })
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })
  const { start, end } = parsed.value
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const week = new Date(today)
  week.setUTCDate(week.getUTCDate() - week.getUTCDay())
  const year = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  const sqlTime = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ')
  const todayStart = sqlTime(today)
  const weekStart = sqlTime(week)
  const yearStart = sqlTime(year)
  const nowTime = sqlTime(now)
  try {
    const totals = (await db`
      SELECT COUNT(*) AS c, COALESCE(SUM(duration_minutes), 0) AS m FROM pomodoro_logs
      WHERE (${start} IS NULL OR completed_at >= ${start})
        AND (${end} IS NULL OR completed_at < ${end})
    `)[0];
    const totalTasks = (await db`SELECT COUNT(*) AS c FROM tasks`)[0]?.c ?? 0;

    const breakdown: {
      skillId: number; skillName: string; pomodoros: number; minutes: number;
      parentId: number | null; parentName: string | null; skillPath: string;
      directPomodoros: number; directMinutes: number;
      todayMinutes: number; weekMinutes: number; yearMinutes: number
    }[] = await db`
      SELECT s.id AS skillId, s.name AS skillName,
             s.parent_id AS parentId, p.name AS parentName,
             CASE WHEN p.id IS NULL THEN s.name ELSE CONCAT(p.name, ' / ', s.name) END AS skillPath,
             COUNT(pl.id) AS pomodoros,
             COALESCE(SUM(pl.duration_minutes), 0) AS minutes,
             COALESCE(SUM(CASE WHEN pl.skill_id = s.id THEN 1 ELSE 0 END), 0) AS directPomodoros,
             COALESCE(SUM(CASE WHEN pl.skill_id = s.id THEN pl.duration_minutes ELSE 0 END), 0) AS directMinutes,
             COALESCE(SUM(CASE WHEN pl.completed_at >= ${todayStart} AND pl.completed_at <= ${nowTime}
               THEN pl.duration_minutes ELSE 0 END), 0) AS todayMinutes,
             COALESCE(SUM(CASE WHEN pl.completed_at >= ${weekStart} AND pl.completed_at <= ${nowTime}
               THEN pl.duration_minutes ELSE 0 END), 0) AS weekMinutes,
             COALESCE(SUM(CASE WHEN pl.completed_at >= ${yearStart} AND pl.completed_at <= ${nowTime}
               THEN pl.duration_minutes ELSE 0 END), 0) AS yearMinutes
      FROM skills s
      LEFT JOIN skills p ON p.id = s.parent_id
      LEFT JOIN pomodoro_logs pl ON (pl.skill_id = s.id OR pl.parent_skill_id_snapshot = s.id)
        AND (${start} IS NULL OR pl.completed_at >= ${start})
        AND (${end} IS NULL OR pl.completed_at < ${end})
      GROUP BY s.id, s.name, s.parent_id, p.id, p.name
      ORDER BY s.id
    `;

    res.json({ totalPomodoros: Number(totals?.c ?? 0),
      totalMinutes: Number(totals?.m ?? 0),
      totalTasks: Number(totalTasks),
      range: { start: req.query.start ?? null, end: req.query.end ?? null, timezone: 'UTC', endInclusive: true },
      breakdown: breakdown.map(row => ({
        skillId: Number(row.skillId), skillName: row.skillName,
        parentId: row.parentId == null ? null : Number(row.parentId), parentName: row.parentName,
        skillPath: row.skillPath,
        pomodoros: Number(row.pomodoros), minutes: Number(row.minutes),
        directPomodoros: Number(row.directPomodoros), directMinutes: Number(row.directMinutes),
        todayMinutes: Number(row.todayMinutes), weekMinutes: Number(row.weekMinutes),
        yearMinutes: Number(row.yearMinutes),
      }))
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

export default router