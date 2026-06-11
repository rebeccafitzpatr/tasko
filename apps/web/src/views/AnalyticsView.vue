
<template>
  <div class="analytics-root">
    <h1>Analytics</h1>
    <div class="analytics-summary card">
      <div class="summary-item">
        <span class="summary-label">Total tasks</span>
        <span class="summary-value">{{ analyticsSummary.totalTasks }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Total Pomodoros</span>
        <span class="summary-value">{{ analyticsSummary.totalPomodoros }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Total time spent</span>
        <span class="summary-value">{{ analyticsSummary.totalMinutes }} min</span>
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
              <td>{{ getTaskName(log.taskId) }}</td>
              <td>{{ getSkillName(log.skillId) }}</td>
              <td>{{ log.duration }}</td>
              <td>{{ formatDateTime(log.completedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useTaskStore } from '../stores/taskStore'
import { useSkillStore } from '../stores/skillStore'
import { usePomodoroStore } from '../stores/pomodoroStore'
import { fetchAnalytics, type AnalyticsSummary } from '../services/service'

const taskStore = useTaskStore()
const skillStore = useSkillStore()
const pomodoroStore = usePomodoroStore()
const analyticsSummary = ref<AnalyticsSummary>({ totalPomodoros: 0, totalMinutes: 0 })
onMounted(async () => {
  analyticsSummary.value = await fetchAnalytics()
  taskStore.loadTasks()
  skillStore.loadSkills()
  pomodoroStore.loadPomodoros()
  fetchAnalytics().then(data => {
    analyticsSummary.value = data
  })
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

const recentPomodoros = pomodoroLog.slice(-10).reverse()
// ...existing script code...
</script>

<style scoped>
.analytics-root {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.07);
  padding: 1.5rem 2rem;
  margin: 1.5rem 0;
  width: 100%;
  max-width: 700px;
}

.analytics-summary {
  display: flex;
  justify-content: space-around;
  gap: 2rem;
  margin-bottom: 1.5rem;
}
.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.summary-label {
  color: #888;
  font-size: 1em;
}
.summary-value {
  font-size: 2em;
  font-weight: bold;
  color: #42b983;
}

.skill-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}
.skill-card {
  background: #f8fafc;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  padding: 1rem 1.5rem;
  min-width: 180px;
  flex: 1 1 220px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.skill-title {
  font-weight: bold;
  font-size: 1.1em;
  margin-bottom: 0.5em;
}
.skill-metrics {
  display: flex;
  gap: 1.2em;
  margin-bottom: 0.5em;
  color: #333;
}
.skill-periods {
  display: flex;
  gap: 1.2em;
  font-size: 0.95em;
  color: #666;
}

.table-responsive {
  overflow-x: auto;
}
.analytics-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1em;
}
.analytics-table th, .analytics-table td {
  padding: 0.6em 1em;
  border-bottom: 1px solid #eee;
  text-align: left;
}
.analytics-table th {
  background: #f3f3f3;
  color: #333;
  font-weight: 600;
}
.analytics-table tr:last-child td {
  border-bottom: none;
}
</style>
