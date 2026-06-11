import { Router } from 'express'
import { db } from './db' // uses the db.ts export
// import type { Skill, Task, PomodoroLog } from '../types' // optional

const router = Router();

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
  const { taskId, skillId, duration } = req.body
  const minutes = Number(duration) || 25
  try {
    // Update task's counters
    await db`UPDATE tasks
      SET completed_pomodoros = COALESCE(completed_pomodoros, 0) + 1,
          minutes_spent = COALESCE(minutes_spent, 0) + ${minutes}
      WHERE id = ${taskId}`
    // Insert log
    await db`INSERT INTO pomodoro_logs (task_id, skill_id, duration_minutes, completed_at) 
      VALUES (${taskId}, ${skillId ?? null}, ${minutes}, NOW())`
    res.status(201).json({ taskId, duration: minutes })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.get('/pomodoros', async (_req, res) => {
  try {
    const logs = await db`
      SELECT id, task_id AS taskId, skill_id AS skillId, duration_minutes AS duration, completed_at AS completedAt, type
      FROM pomodoro_logs
      ORDER BY completedAt DESC
      LIMIT 100
    `
    res.json(logs)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.get('/analytics/summary', async (_req, res) => {
  try {
    // DB-backed aggregates
    const totalPomodoros = (await db`SELECT COUNT(*) AS c FROM pomodoro_logs`)[0]?.c ?? 0;
    const totalMinutes = (await db`SELECT COALESCE(SUM(duration_minutes), 0) AS m FROM pomodoro_logs`)[0]?.m ?? 0;
    const totalTasks = (await db`SELECT COUNT(*) AS c FROM tasks`)[0]?.c ?? 0;

    // Optional: per-skill breakdown (if you want to surface this too)
    const breakdown = await db`
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
      breakdown: []
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

export default router