
<template>
  <div class="analytics-root">
    <h1>Analytics</h1>
    <div class="analytics-summary card">
      <div class="summary-item">
        <span class="summary-label">Total tasks</span>
        <span v-if="analyticsStore.isLoading && !analyticsStore.hasLoaded" class="summary-value">...</span>
        <span v-else class="summary-value">{{ analyticsStore.summary.totalTasks }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Total Pomodoros</span>
        <span v-if="analyticsStore.isLoading && !analyticsStore.hasLoaded" class="summary-value">...</span>
        <span v-else class="summary-value">{{ analyticsStore.summary.totalPomodoros }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Total time spent</span>
        <span v-if="analyticsStore.isLoading && !analyticsStore.hasLoaded" class="summary-value">...</span>
        <span v-else class="summary-value">{{ analyticsStore.summary.totalMinutes }} min</span>
      </div>
    </div>
    <div class="card">
      <h2>Time spent per skill</h2>
      <ul class="skill-list">
        <li v-for="skill in skills" :key="skill.id" class="skill-card">
          <div class="skill-title">{{ skill.name }}</div>
          <div class="skill-metrics">
            <span>{{ countTasksForSkill(skill.id) }} tasks</span>
            <span>{{ totalPomodorosForSkill(skill.id) }} Pomodoros</span>
            <span>{{ totalMinutesForSkill(skill.id) }} min</span>
          </div>
          <div class="skill-periods">
            <span>Today: <b>{{ totalMinutesForSkillPerDay(skill.id) }}</b> min</span>
            <span>This week: <b>{{ totalMinutesForSkillPerWeek(skill.id) }}</b> min</span>
            <span>This year: <b>{{ totalMinutesForSkillPerYear(skill.id) }}</b> min</span>
          </div>
        </li>
      </ul>
    </div>
    <div class="card">
      <h2>Recent Pomodoro Sessions</h2>
      <div class="table-responsive">
        <table class="analytics-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Skill</th>
              <th>Duration (min)</th>
              <th>Completed At</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in recentPomodoros" :key="log.completedAt + log.taskId">
              <td data-label="Task">{{ getTaskName(log.taskId) }}</td>
              <td data-label="Skill">{{ getSkillName(log.skillId) }}</td>
              <td data-label="Duration">{{ log.duration }} min</td>
              <td data-label="Completed">{{ formatDateTime(log.completedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useTaskStore } from '../stores/taskStore'
import { useSkillStore } from '../stores/skillStore'
import { usePomodoroStore } from '../stores/pomodoroStore'
import { useAnalyticsStore } from '../stores/analyticsStore'

const taskStore = useTaskStore()
const skillStore = useSkillStore()
const pomodoroStore = usePomodoroStore()
const analyticsStore = useAnalyticsStore()
onMounted(async () => {
  await Promise.all([
    analyticsStore.load(),
    taskStore.loadTasks(),
    skillStore.loadSkills(),
    pomodoroStore.loadPomodoros(),
  ])
})

const tasks = taskStore.tasks
const skills = skillStore.skills
const pomodoroLog = pomodoroStore.pomodoroLog

function countTasksForSkill(skillId: number) {
  return tasks.filter(t => t.skillId === skillId).length
}

function totalPomodorosForSkill(skillId: number) {
  return pomodoroLog.filter(log => log.skillId === skillId).length
}

function totalMinutesForSkill(skillId: number) {
  return pomodoroLog
    .filter(log => log.skillId === skillId)
    .reduce((sum, log) => sum + log.duration, 0)
}

function totalMinutesForSkillPerDay(skillId: number) {
  const today = new Date().toISOString().slice(0, 10)
  return pomodoroLog
    .filter(log => log.skillId === skillId && log.completedAt.slice(0, 10) === today)
    .reduce((sum, log) => sum + log.duration, 0)
}

function totalMinutesForSkillPerWeek(skillId: number) {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0,0,0,0)
  return pomodoroLog
    .filter(log => {
      const d = new Date(log.completedAt)
      return log.skillId === skillId && d >= startOfWeek && d <= now
    })
    .reduce((sum, log) => sum + log.duration, 0)
}

function totalMinutesForSkillPerYear(skillId: number) {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  return pomodoroLog
    .filter(log => {
      const d = new Date(log.completedAt)
      return log.skillId === skillId && d >= startOfYear && d <= now
    })
    .reduce((sum, log) => sum + log.duration, 0)
}

function getTaskName(taskId: number | null | undefined) {
  const task = tasks.find(t => t.id === taskId)
  return task ? task.name : 'Unknown'
}
function getSkillName(skillId: number | null | undefined) {
  const skill = skills.find(s => s.id === skillId)
  return skill ? skill.name : 'Unknown'
}
function formatDateTime(dt: string) {
  const d = new Date(dt)
  return d.toLocaleString()
}

const recentPomodoros = computed(() =>
  pomodoroStore.pomodoroLog
    .filter(log => {
      const taskExists = log.taskId != null && taskStore.tasks.some(task => task.id === log.taskId)
      const skillExists = log.skillId == null || skillStore.skills.some(skill => skill.id === log.skillId)
      return taskExists && skillExists
    })
    .slice(-10)
    .reverse(),
)
// ...existing script code...
</script>

<style scoped>
.analytics-root {
  width: 100%;
  min-width: 0;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.card {
  width: 100%;
  min-width: 0;
  max-width: none;
  margin: 0 0 1rem;
  padding: 1rem;
  background: var(--surface);
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.07);
}

.analytics-summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  border-top: 4px solid var(--theme-color);
  background: color-mix(in srgb, var(--theme-color), var(--surface) 92%);
}

.summary-item {
  min-width: 0;
  flex: 1 1 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.summary-label {
  color: var(--text);
  font-size: 0.9rem;
}

.summary-value {
  color: var(--theme-text);
  font-size: 1.75rem;
  font-weight: bold;
}

.skill-list {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  min-width: 0;
  gap: 0.75rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.skill-card {
  min-width: 0;
  flex: 1 1 180px;
  padding: 1rem;
  background: var(--surface-muted);
  border-radius: 8px;
  overflow-wrap: anywhere;
}

.skill-title {
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.skill-metrics,
.skill-periods {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.skill-metrics {
  margin-bottom: 0.5rem;
  padding: 0px 6px;
  color: var(--text-strong);
  font-size: 0.7rem;
  justify-content:space-between;
}

.skill-periods {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  width: 100%;
  color: var(--text);
  font-size: 0.55rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.skill-periods span {
  min-width: 0;
  padding: 0.6rem 0.45rem;
  text-align: center;
  border-right: 1px solid var(--border);
}

.skill-periods span:last-child {
  border-right: 0;
}

.analytics-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.analytics-table th,
.analytics-table td {
  overflow-wrap: anywhere;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
}

.analytics-table th {
  color: var(--text-on-accent);
  background: var(--theme-color);
}

.analytics-table tbody tr:nth-child(even) {
  background: color-mix(in srgb, var(--theme-color), var(--surface) 94%);
  }

.analytics-table tbody tr:hover {
  background: color-mix(in srgb, var(--theme-color), var(--surface) 88%);
}

@media (max-width: 600px) {
  .table-responsive {
    overflow: visible;
  }

  .analytics-table,
  .analytics-table tbody,
  .analytics-table tr,
  .analytics-table td {
    display: block;
    width: 100%;
  }

  .analytics-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .analytics-table tr {
    margin-bottom: 0.75rem;
    padding: 0.5rem 0;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .analytics-table td {
    display: grid;
    grid-template-columns: 6.5rem minmax(0, 1fr);
    gap: 0.75rem;
    padding: 0.45rem 0.6rem;
    border-bottom: 0;
    white-space: normal;
    text-align: left;
  }

  .analytics-table td::before {
    color: var(--text-strong);
    font-weight: 600;
    content: attr(data-label);
  }

  .skill-periods span {
    font-size: 0.8rem;
  }
}
</style>
