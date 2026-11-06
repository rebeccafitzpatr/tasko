import { Router } from 'express'
import { SQL, type TransactionSQL } from 'bun'
import { db } from './db.js' // uses the db.ts export
import { validateCreateSessionInput, validateEditSessionInput } from './sessionRules.js'

const router = Router();

class SessionRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function resolveSessionAssignment(query: SQL, taskId: number | null, requestedSkillId: number | null) {
  if (taskId !== null) {
    const tasks = await query`
      SELECT t.id, t.name AS taskName, t.skill_id AS skillId, s.name AS skillName
      FROM tasks t LEFT JOIN skills s ON s.id = t.skill_id WHERE t.id = ${taskId}
    `
    const task = tasks[0]
    if (!task) throw new SessionRequestError(404, 'Task not found. Choose another task or leave it unassigned.')
    const skillId = task.skillId == null ? null : Number(task.skillId)
    if (requestedSkillId !== null && requestedSkillId !== skillId) {
      throw new SessionRequestError(400, 'skillId must match the selected task.')
    }
    return { taskName: String(task.taskName), skillName: task.skillName ?? null, skillId }
  }
  if (requestedSkillId !== null) {
    const skills = await query`SELECT id, name FROM skills WHERE id = ${requestedSkillId}`
    if (!skills[0]) throw new SessionRequestError(404, 'Skill not found. Choose another skill or leave it unassigned.')
    return { taskName: null, skillName: String(skills[0].name), skillId: requestedSkillId }
  }
  return { taskName: null, skillName: null, skillId: null }
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
           type, completion_id AS completionId, completion_request AS completionRequest
    FROM pomodoro_logs WHERE completion_id = ${completionId}
  `
  return rows[0]
}

// Skills

router.get('/skills', async (_req, res) => {
  try {
    const rows = await db`SELECT id, name, minutes_spent AS minutesSpent FROM skills`
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.post('/skills', async (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  try {
    await db`INSERT INTO skills (name, minutes_spent) VALUES (${name}, 0)`
    const rows = await db`SELECT LAST_INSERT_ID() AS id`
    res.status(201).json({ id: rows[0].id, name, minutesSpent: 0 })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.put('/skills/:id', async (req, res) => {
  const { id } = req.params
  const { name, minutesSpent } = req.body
  try {
    if (name != null) {
      await db`UPDATE skills SET name = ${name} WHERE id = ${id}`
    }
    if (typeof minutesSpent === 'number') {
      await db`UPDATE skills SET minutes_spent = ${minutesSpent} WHERE id = ${id}`
    }
    const rows = await db`SELECT id, name, minutes_spent AS minutesSpent FROM skills WHERE id = ${id}`
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.delete('/skills/:id', async (req, res) => {
  const { id } = req.params
  try {
    await db`DELETE FROM skills WHERE id = ${id}`
    res.status(204).send()
  } catch (e) {
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
        s.name AS skillName
      FROM tasks t
      LEFT JOIN skills s ON t.skill_id = s.id
      ORDER BY t.id DESC
    `
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.post('/tasks', async (req, res) => {
  const { name, skillId } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  try {
    await db`INSERT INTO tasks (name, skill_id) VALUES (${name}, ${skillId ?? null})`
    const rows = await db`SELECT LAST_INSERT_ID() AS id`
    res.status(201).json({ id: rows[0].id, name, skillId: skillId ?? null })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.put('/tasks/:id', async (req, res) => {
  const { id } = req.params
  const { name, skillId } = req.body
  try {
    await db`UPDATE tasks SET name = ${name}, skill_id = ${skillId ?? null} WHERE id = ${id}`
    res.json({ id, name, skillId: skillId ?? null })
  } catch (e) {
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
    const { taskName, skillName, skillId: canonicalSkillId } =
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
           completion_id, completion_request)
        VALUES
          (${taskId}, ${canonicalSkillId}, ${taskName}, ${skillName},
           ${duration}, ${completedAtUtc}, TRUE, ${type},
           ${completionId}, ${completionRequest})
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
               type, completion_id AS completionId
        FROM pomodoro_logs WHERE id = ${id} FOR UPDATE
      `
      const previous = rows[0]
      if (!previous) throw new SessionRequestError(404, 'Session not found. Refresh history and try again.')
      const oldTaskId = previous.taskId == null ? null : Number(previous.taskId)
      const oldSkillId = previous.skillId == null ? null : Number(previous.skillId)
      // Preserve historical labels/associations for duration-only edits, even after deletion or reassignment.
      const assignment = taskId === oldTaskId && skillId === oldSkillId
        ? { taskName: previous.taskName, skillName: previous.skillName, skillId: oldSkillId }
        : await resolveSessionAssignment(transaction, taskId, skillId)
      await transaction`
        UPDATE pomodoro_logs SET task_id = ${taskId}, skill_id = ${assignment.skillId},
          task_name_snapshot = ${assignment.taskName}, skill_name_snapshot = ${assignment.skillName},
          duration_minutes = ${duration}, completed_at = ${completedAtUtc}, completed_at_is_utc = TRUE
        WHERE id = ${id}
      `
      await reconcileSessionCounters(transaction, [oldTaskId, taskId], [oldSkillId, assignment.skillId])
      return {
        id, taskId, skillId: assignment.skillId,
        taskName: assignment.taskName, skillName: assignment.skillName,
        duration, completedAt: completedAt.toISOString().replace('.000Z', 'Z'),
        type: previous.type, completionId: previous.completionId,
      }
    })
    res.json(session)
  } catch (error) {
    res.status(error instanceof SessionRequestError ? error.status : 500)
      .json({ error: (error as Error).message })
  }
})

router.get('/pomodoros', async (_req, res) => {
  try {
    const logs = await db`
      SELECT
        pl.id,
        pl.task_id AS taskId,
        pl.skill_id AS skillId,
        COALESCE(pl.task_name_snapshot, t.name) AS taskName,
        COALESCE(pl.skill_name_snapshot, s.name) AS skillName,
        pl.duration_minutes AS duration,
        CASE
          WHEN pl.completed_at_is_utc THEN DATE_FORMAT(pl.completed_at, '%Y-%m-%dT%H:%i:%sZ')
          ELSE DATE_FORMAT(pl.completed_at, '%Y-%m-%d %H:%i:%s')
        END AS completedAt,
        pl.type
      FROM pomodoro_logs pl
      LEFT JOIN tasks t ON t.id = pl.task_id
      LEFT JOIN skills s ON s.id = pl.skill_id
      ORDER BY pl.completed_at DESC, pl.id DESC
      LIMIT 100
    `
    res.json(logs)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.get('/analytics/summary', async (_req, res) => {
  try {
    const totalPomodoros = (await db`
      SELECT COUNT(*) AS c FROM pomodoro_logs
    `)[0]?.c ?? 0;
    const totalMinutes = (await db`
      SELECT COALESCE(SUM(duration_minutes), 0) AS m FROM pomodoro_logs
    `)[0]?.m ?? 0;
    const totalTasks = (await db`SELECT COUNT(*) AS c FROM tasks`)[0]?.c ?? 0;

    // Optional: per-skill breakdown (if you want to surface this too)
    const breakdown: { skillId: number; skillName: string; pomodoros: number; minutes: number }[] = await db`
      SELECT s.id AS skillId, s.name AS skillName,
             COUNT(pl.id) AS pomodoros,
             COALESCE(SUM(pl.duration_minutes), 0) AS minutes
      FROM skills s
      LEFT JOIN pomodoro_logs pl ON pl.skill_id = s.id
      GROUP BY s.id, s.name
    `;

    res.json({ totalPomodoros: Number(totalPomodoros),
      totalMinutes: Number(totalMinutes),
      totalTasks: Number(totalTasks),
      breakdown: breakdown.map(row => ({
        skillId: Number(row.skillId), skillName: row.skillName,
        pomodoros: Number(row.pomodoros), minutes: Number(row.minutes),
      }))
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

export default router