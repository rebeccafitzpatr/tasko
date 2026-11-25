<template>
  <div class="analytics-root">
    <h1>Analytics</h1>
    <p v-if="loadError" role="alert">{{ loadError }}</p>
    <button v-if="loadError" :disabled="isRefreshing" @click="loadData(true)">Retry loading</button>
    <p v-if="saveMessage" role="status">{{ saveMessage }}</p>
    <p v-if="isRefreshing" role="status">Loading analytics...</p>
    <div v-if="analyticsMatchesRange" class="card skill-section">
      <div class="skill-section-header">
        <h2>Time spent per skill</h2>
        <div class="skill-period-toggle" role="group" aria-label="Minutes period">
          <button type="button" :class="{ active: skillPeriod === 'today' }" @click="skillPeriod = 'today'">today</button>
          <span aria-hidden="true">/</span>
          <button type="button" :class="{ active: skillPeriod === 'week' }" @click="skillPeriod = 'week'">this week</button>
          <span aria-hidden="true">/</span>
          <button type="button" :class="{ active: skillPeriod === 'year' }" @click="skillPeriod = 'year'">this year</button>
        </div>
      </div>
      <ul class="skill-list">
        <li v-for="skill in skills" :key="skill.id" class="skill-row">
          <span class="skill-name">{{ skillLabel(skill, skills) }}</span>
          <span class="skill-stats">
            <span>{{ periodTasksForSkill(skill.id) }} {{ periodTasksForSkill(skill.id) === 1 ? 'task' : 'tasks' }}</span>
            <span>{{ periodPomodorosForSkill(skill.id) }} sessions</span>
            <span>{{ periodMinutesForSkill(skill.id) }} mins</span>
          </span>
        </li>
      </ul>
    </div>
    <div class="card">
      <h2 class="history-heading">Session History</h2>
      <div v-if="analyticsMatchesRange" class="analytics-summary">
        <div class="summary-item">
          <span class="summary-label">Total tasks</span>
          <span v-if="analyticsStore.isLoading && !analyticsStore.hasLoaded" class="summary-value">...</span>
          <span v-else class="summary-value">{{ analyticsStore.summary.totalTasks }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total sessions</span>
          <span v-if="analyticsStore.isLoading && !analyticsStore.hasLoaded" class="summary-value">...</span>
          <span v-else class="summary-value">{{ analyticsStore.summary.totalPomodoros }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total time spent</span>
          <span v-if="analyticsStore.isLoading && !analyticsStore.hasLoaded" class="summary-value">...</span>
          <span v-else class="summary-value">{{ analyticsStore.summary.totalMinutes }} min</span>
        </div>
      </div>
      <p v-if="analyticsMatchesRange && !isRefreshing && analyticsStore.summary.totalPomodoros === 0">No sessions in the selected range. Totals are zero.</p>
      <div class="history-actions">
        <div class="history-action-group">
          <button :disabled="rangeBusy" @click="openEditor(null)">Add manual session</button>
          <button :disabled="rangeBusy" @click="exportSessions">{{ isExporting ? 'Exporting...' : 'Export CSV' }}</button>
          <button :disabled="rangeBusy || activityLoading" @click="openActivityGraph">
            {{ activityLoading ? 'Loading graph...' : 'Activity graph' }}
          </button>
        </div>
        <button class="filter-toggle" type="button" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">
          {{ filtersOpen ? 'Hide filter' : hasActiveFilter ? 'Filter ●' : 'Filter' }}
        </button>
      </div>
      <div v-if="activityOpen" class="modal-backdrop" role="presentation" @click.self="activityOpen = false">
        <section class="activity-modal" role="dialog" aria-modal="true" aria-labelledby="activity-title">
          <div class="modal-header">
            <div>
              <h2 id="activity-title">Activity graph</h2>
              <p>Daily study minutes for the last year.</p>
            </div>
            <button type="button" aria-label="Close activity graph" @click="activityOpen = false">×</button>
          </div>
          <p v-if="activityError" role="alert">{{ activityError }}</p>
          <p v-else-if="activityLoading" role="status">Loading activity...</p>
          <ActivityGraph :logs="activityLogs" :tasks="taskStore.tasks" />
        </section>
      </div>
      <form v-show="filtersOpen" class="history-filters" @submit.prevent="applyRange">
        <label>Period (NZ)
          <select v-model="selectedPeriod" name="period" :disabled="rangeBusy" @change="choosePeriod">
            <option v-for="period in reportPeriods" :key="period.value" :value="period.value">{{ period.label }}</option>
          </select>
        </label>
        <label>Start date (NZ)<input v-model="startDate" name="start" type="date" :disabled="rangeBusy" @input="selectedPeriod = 'custom'" @change="applyCustomDates" /></label>
        <label>End date (NZ)<input v-model="endDate" name="end" type="date" :disabled="rangeBusy" @input="selectedPeriod = 'custom'" @change="applyCustomDates" /></label>
      </form>
      <p v-if="rangeError" role="alert">{{ rangeError }}</p>
      <p v-if="isExporting" role="status">Exporting all matching sessions...</p>
      <p v-if="exportMessage" role="status">{{ exportMessage }}</p>
      <p v-if="exportError" role="alert">{{ exportError }} Retry with Export CSV.</p>
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
import ActivityGraph from '../components/ActivityGraph.vue'
import { exportHistory, fetchActivityPomodoros, type PomodoroLog, type DateRange } from '../services/service'
import { skillLabel } from '../services/skillLabels'
import { reportPeriods, periodRange, validateReportRange, type ReportPeriod } from '../services/reportPeriods'
import { downloadHistory } from '../services/historyDownload'
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
const filtersOpen = ref(false)
const startDate = ref('')
const endDate = ref('')
const appliedRange = ref<DateRange>({})
const selectedPeriod = ref<ReportPeriod>('all')
const isExporting = ref(false)
const exportError = ref('')
const exportMessage = ref('')
const activityOpen = ref(false)
const activityLoading = ref(false)
const activityError = ref('')
const activityLogs = ref<PomodoroLog[]>([])
const rangeBusy = computed(() => isRefreshing.value || historyLoading.value || editorOpen.value || isExporting.value)
const hasActiveFilter = computed(() => Boolean(appliedRange.value.start || appliedRange.value.end))
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
  if (rangeBusy.value) return
  rangeError.value = ''
  const range = { start: startDate.value || undefined, end: endDate.value || undefined }
  try { validateReportRange(range) }
  catch (cause) {
    rangeError.value = cause instanceof Error ? cause.message : 'Enter a valid date range.'
    return
  }
  appliedRange.value = range
  exportError.value = ''
  exportMessage.value = ''
  pomodoroStore.pomodoroLog = []
  pomodoroStore.historyHasMore = false
  currentCursor.value = null
  previousCursors.value = []
  await loadData(true)
}

function applyCustomDates() {
  selectedPeriod.value = 'custom'
  return applyRange()
}

function choosePeriod() {
  if (selectedPeriod.value === 'custom') return
  const range = periodRange(selectedPeriod.value)
  startDate.value = range.start ?? ''
  endDate.value = range.end ?? ''
  return applyRange()
}

async function openActivityGraph() {
  if (rangeBusy.value || activityLoading.value) return
  activityOpen.value = true
  activityLoading.value = true
  activityError.value = ''
  try {
    activityLogs.value = await fetchActivityPomodoros()
  } catch (cause) {
    activityError.value = cause instanceof Error ? cause.message : 'Could not load activity graph.'
  } finally {
    activityLoading.value = false
  }
}

async function exportSessions() {
  if (rangeBusy.value) return
  isExporting.value = true
  exportError.value = ''
  exportMessage.value = ''
  const range = { ...appliedRange.value }
  try {
    const csv = await exportHistory(range)
    if (csv === null) {
      exportMessage.value = 'No sessions match the selected range. No CSV file was created.'
      return
    }
    downloadHistory(csv, range)
    exportMessage.value = `CSV download started for all matching sessions: ${range.start ?? 'all history'} to ${range.end ?? 'latest'}.`
  } catch (cause) {
    exportError.value = cause instanceof Error ? cause.message : 'Could not export history.'
  } finally {
    isExporting.value = false
  }
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

const skillPeriod = ref<'today' | 'week' | 'year'>('today')

function periodTasksForSkill(skillId: number) {
  const summary = skillSummary(skillId)
  if (skillPeriod.value === 'today') return summary?.todayTasks ?? 0
  if (skillPeriod.value === 'week') return summary?.weekTasks ?? 0
  return summary?.yearTasks ?? 0
}

function periodPomodorosForSkill(skillId: number) {
  const summary = skillSummary(skillId)
  if (skillPeriod.value === 'today') return summary?.todayPomodoros ?? 0
  if (skillPeriod.value === 'week') return summary?.weekPomodoros ?? 0
  return summary?.yearPomodoros ?? 0
}

function periodMinutesForSkill(skillId: number) {
  const summary = skillSummary(skillId)
  if (skillPeriod.value === 'today') return summary?.todayMinutes ?? 0
  if (skillPeriod.value === 'week') return summary?.weekMinutes ?? 0
  return summary?.yearMinutes ?? 0
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
</script>

<style scoped>
.history-filters, .history-navigation, .history-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
  margin-bottom: 1rem;
}
.history-filters label { display: flex; flex-direction: column; gap: 0.4rem; text-align: left; }
.history-filters label { flex: 1 1 160px; min-width: 0; }
.history-filters input, .history-filters select { width: 100%; min-width: 0; box-sizing: border-box; }
.history-actions { justify-content: space-between; }
.history-action-group { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.history-actions .filter-toggle { margin-left: auto; }
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
  margin-bottom: 1rem;
  padding: 1rem;
  border-top: 4px solid var(--theme-color);
  border-radius: 8px;
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

.history-heading {
  margin-bottom: 1rem;
  text-align: center;
}

.skill-section {
  padding: 1.25rem 1rem;
  background: color-mix(in srgb, var(--theme-color), var(--surface) 94%);
}

.skill-section-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 0.35rem 0.75rem;
  margin-bottom: 1rem;
  text-align: left;
}

.skill-section-header h2 {
  margin: 0;
}

.skill-period-toggle {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  color: var(--text);
  font-size: 0.95rem;
}

.skill-period-toggle button {
  min-height: 0;
  padding: 0;
  color: var(--text);
  font-size: inherit;
  background: none;
  border: none;
  cursor: pointer;
}

.skill-period-toggle button:hover:not(:disabled) {
  color: var(--theme-text);
  background: none;
  border: none;
}

.skill-period-toggle button.active {
  color: var(--text-strong);
  font-weight: 700;
}

.skill-list {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  gap: 0.9rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.skill-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  align-items: baseline;
  gap: 1.25rem;
  overflow-wrap: anywhere;
}

.skill-name {
  color: var(--text-strong);
  font-size: 1.05rem;
  font-weight: 600;
  text-align: right;
}

.skill-stats {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.3rem 1.1rem;
  color: var(--text-strong);
  font-size: 0.9rem;
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

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.45);
}

.activity-modal {
  width: min(980px, 96vw);
  max-height: 88vh;
  overflow: auto;
  padding: 1.25rem;
  background: var(--surface);
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
}

.modal-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.modal-header h2,
.modal-header p {
  margin: 0;
}

.modal-header p {
  color: var(--text);
  font-size: 0.9rem;
}

.modal-header button {
  min-width: 2.25rem;
  padding: 0.25rem 0.65rem;
  font-size: 1.4rem;
  line-height: 1;
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
  .skill-periods { grid-template-columns: 1fr; }
  .skill-periods span { border-right: 0; border-bottom: 1px solid var(--border); }
  .skill-periods span:last-child { border-bottom: 0; }
}
</style>
