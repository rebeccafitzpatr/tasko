
<template>
  <div class="analytics-root">
    <h1>Analytics</h1>
    <p v-if="loadError" role="alert">{{ loadError }}</p>
    <button v-if="loadError" :disabled="isRefreshing" @click="loadData(true)">Retry loading</button>
    <p v-if="saveMessage" role="status">{{ saveMessage }}</p>
    <form class="history-filters" @submit.prevent="applyRange">
      <label>Start date (NZ)<input v-model="startDate" name="start" type="date" /></label>
      <label>End date (NZ)<input v-model="endDate" name="end" type="date" /></label>
      <button :disabled="isRefreshing || historyLoading || editorOpen">Apply dates</button>
      <button type="button" :disabled="isRefreshing || historyLoading || editorOpen" @click="clearRange">All dates</button>
    </form>
    <p v-if="rangeError" role="alert">{{ rangeError }}</p>
    <p v-if="isRefreshing" role="status">Loading analytics...</p>
    <div v-if="analyticsMatchesRange" class="analytics-summary card">
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
    <div v-if="analyticsMatchesRange" class="card">
      <h2>Time spent per skill</h2>
      <ul class="skill-list">
        <li v-for="skill in skills" :key="skill.id" class="skill-card">
          <div class="skill-title">{{ skillLabel(skill, skills) }}</div>
          <div class="skill-metrics">
            <span>{{ countTasksForSkill(skill.id) }} tasks</span>
            <span>{{ totalPomodorosForSkill(skill.id) }} Pomodoros</span>
            <span>{{ totalMinutesForSkill(skill.id) }} min</span>
          </div>
          <div class="skill-periods">
            <span>Today: <b>{{ skillSummary(skill.id)?.todayMinutes ?? 0 }}</b> min</span>
            <span>This week: <b>{{ skillSummary(skill.id)?.weekMinutes ?? 0 }}</b> min</span>
            <span>This year: <b>{{ skillSummary(skill.id)?.yearMinutes ?? 0 }}</b> min</span>
          </div>
        </li>
      </ul>
    </div>
    <div class="card">
      <h2>Session history</h2>
      <button class="add-session" :disabled="isRefreshing || historyLoading || editorOpen" @click="openEditor(null)">Add manual session</button>
      <SessionEditor v-if="editorOpen" :session="editingSession" :tasks="tasks" :skills="skills"
        @saved="sessionSaved" @cancel="editorOpen = false" />
      <p v-if="historyLoading" role="status">Loading sessions...</p>
      <p v-if="historyError" role="alert">{{ historyError }}</p>
      <button v-if="historyError" :disabled="historyLoading || isRefreshing" @click="retryHistory">Retry history</button>
      <p v-if="!historyLoading && !historyError && recentPomodoros.length === 0">No sessions match these dates.</p>
      <div class="history-navigation" v-if="previousCursors.length > 0 || pomodoroStore.historyHasMore">
        <button :disabled="isRefreshing || historyLoading || editorOpen || previousCursors.length === 0"
          @click="loadHistory(previousCursors[previousCursors.length - 1] ?? null, 'previous')">Newer sessions</button>
        <button :disabled="isRefreshing || historyLoading || editorOpen || !pomodoroStore.historyHasMore"
          @click="loadHistory(pomodoroStore.historyNextCursor, 'next')">Older sessions</button>
      </div>
      <div class="table-responsive">
        <table class="analytics-table">
          <colgroup>
            <col class="col-task" />
            <col class="col-skill" />
            <col class="col-duration" />
            <col class="col-completed" />
            <col class="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Skill</th>
              <th scope="col">Duration</th>
              <th scope="col">Completed</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in recentPomodoros" :key="log.id ?? log.completedAt + log.taskId">
              <td data-label="Task">{{ log.taskName ?? getTaskName(log.taskId) }}</td>
              <td data-label="Skill">{{ log.skillPath ?? log.skillName ?? getSkillName(log.skillId) }}</td>
              <td data-label="Duration">{{ log.duration }} min</td>
              <td data-label="Completed">{{ formatDateTime(log.completedAt) }}</td>
              <td data-label="Actions">
                <button :disabled="isRefreshing || historyLoading || editorOpen || log.id == null" @click="openEditor(log)">Edit</button>
              </td>
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
import SessionEditor from '../components/SessionEditor.vue'
import type { PomodoroLog, DateRange } from '../services/service'
import { skillLabel } from '../services/skillLabels'
import { formatNzDateTime } from '../services/timeZone'

const taskStore = useTaskStore()
const skillStore = useSkillStore()
const pomodoroStore = usePomodoroStore()
const analyticsStore = useAnalyticsStore()
const loadError = ref('')
const saveMessage = ref('')
const editorOpen = ref(false)
const editingSession = ref<PomodoroLog | null>(null)
const isRefreshing = ref(false)
const historyLoading = ref(false)
const historyError = ref('')
const rangeError = ref('')
const startDate = ref('')
const endDate = ref('')
const appliedRange = ref<DateRange>({})
const analyticsMatchesRange = computed(() => analyticsStore.hasLoaded &&
  analyticsStore.cacheKey === JSON.stringify([appliedRange.value.start ?? null, appliedRange.value.end ?? null]))
const currentCursor = ref<string | null>(null)
const previousCursors = ref<(string | null)[]>([])
type PageAction = 'first' | 'next' | 'previous'
let retryPage: { cursor: string | null; action: PageAction } = { cursor: null, action: 'first' }

async function loadHistory(cursor: string | null, action: PageAction) {
  if (historyLoading.value) return
  historyLoading.value = true
  historyError.value = ''
  retryPage = { cursor, action }
  try {
    await pomodoroStore.loadPomodoros({ ...appliedRange.value, limit: 25, cursor: cursor ?? undefined })
    if (action === 'next') previousCursors.value.push(currentCursor.value)
    else if (action === 'previous') previousCursors.value.pop()
    else previousCursors.value = []
    currentCursor.value = cursor
  } catch (error) {
    historyError.value = error instanceof Error ? error.message : 'Could not load sessions. Retry history.'
  } finally {
    historyLoading.value = false
  }
}

function retryHistory() {
  return loadHistory(retryPage.cursor, retryPage.action)
}

async function applyRange() {
  rangeError.value = ''
  if (startDate.value && endDate.value && startDate.value > endDate.value) {
    rangeError.value = 'Start date must be on or before end date.'
    return
  }
  appliedRange.value = { start: startDate.value || undefined, end: endDate.value || undefined }
  pomodoroStore.pomodoroLog = []
  pomodoroStore.historyHasMore = false
  currentCursor.value = null
  previousCursors.value = []
  await loadData(true)
}

function clearRange() {
  startDate.value = ''
  endDate.value = ''
  return applyRange()
}

async function loadData(force = false) {
  if (isRefreshing.value || historyLoading.value) return
  isRefreshing.value = true
  loadError.value = ''
  try {
    const results = await Promise.allSettled([
      analyticsStore.load(force, appliedRange.value),
      taskStore.loadTasks(),
      skillStore.loadSkills(),
      loadHistory(null, 'first'),
    ])
    const failed = results.find(result => result.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Could not load session history and analytics.'
  } finally {
    isRefreshing.value = false
  }
}

onMounted(() => loadData())

function openEditor(session: PomodoroLog | null) {
  editingSession.value = session
  editorOpen.value = true
  saveMessage.value = ''
}

async function sessionSaved() {
  editorOpen.value = false
  // An edited timestamp can move the row to another page or outside the active date range.
  pomodoroStore.pomodoroLog = []
  pomodoroStore.historyHasMore = false
  currentCursor.value = null
  previousCursors.value = []
  saveMessage.value = 'Session saved.'
  analyticsStore.invalidate()
  await loadData(true)
  if (loadError.value || historyError.value) {
    saveMessage.value = 'Session saved, but history or analytics could not refresh. Retry loading.'
  }
}

const tasks = computed(() => taskStore.tasks)
const skills = computed(() => skillStore.skills)

function countTasksForSkill(skillId: number) {
  return tasks.value.filter(t => t.skillId === skillId).length
}

function totalPomodorosForSkill(skillId: number) {
  return skillSummary(skillId)?.pomodoros ?? 0
}

function totalMinutesForSkill(skillId: number) {
  return skillSummary(skillId)?.minutes ?? 0
}

function skillSummary(skillId: number) {
  return analyticsStore.summary.breakdown?.find(skill => skill.skillId === skillId)
}

function getTaskName(taskId: number | null | undefined) {
  const task = tasks.value.find(t => t.id === taskId)
  return task ? task.name : 'Unassigned / unavailable'
}
function getSkillName(skillId: number | null | undefined) {
  const skill = skills.value.find(s => s.id === skillId)
  return skill ? skillLabel(skill, skills.value) : 'Unassigned / unavailable'
}
function formatDateTime(dt: string) {
  return formatNzDateTime(dt)
}

const recentPomodoros = computed(() => pomodoroStore.pomodoroLog ?? [])
// ...existing script code...
</script>

<style scoped>
.history-filters, .history-navigation {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
  margin-bottom: 1rem;
}
.history-filters label { display: flex; flex-direction: column; gap: 0.4rem; text-align: left; }
.add-session { margin-bottom: 1rem; }
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
  vertical-align: middle;
}

.col-duration { width: 6.5rem; }
.col-actions { width: 6rem; }

.analytics-table td button { white-space: nowrap; }

.analytics-table th {
  overflow-wrap: normal;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
