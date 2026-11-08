<template>
  <form class="session-editor" novalidate @submit.prevent="save">
    <h3>{{ session ? 'Edit session' : 'Add manual session' }}</h3>
    <p v-if="session">Original type: {{ session.type }}. Editing does not change the session type.</p>
    <p v-if="session?.skillPath">Recorded skill: {{ session.skillPath }}. Unchanged assignments preserve this historical path.</p>
    <fieldset :disabled="isSaving">
      <label>
        Completed at
        <input v-model="completedAt" name="completedAt" type="datetime-local" step="1" required />
      </label>
      <label>
        Duration (minutes)
        <input v-model.number="duration" name="duration" type="number" min="1" max="2147483647" step="1" required />
      </label>
      <label>
        Task
        <select v-model="taskId" name="taskId" @change="selectTask">
          <option :value="null">No task</option>
          <option v-for="task in tasks" :key="task.id" :value="task.id">{{ task.name }} ({{ task.skillPath ?? taskSkillLabel(task.skillId) }})</option>
        </select>
      </label>
      <label>
        Skill
        <select v-model="skillId" name="skillId" :disabled="taskId !== null">
          <option :value="null">No skill</option>
          <option v-for="skill in skills" :key="skill.id" :value="skill.id">{{ skillLabel(skill, skills) }}</option>
        </select>
      </label>
      <p v-if="taskId !== null">The skill is determined by the selected task.</p>
      <p v-if="session && (session.taskId === null && session.taskName || session.skillId === null && session.skillName)">
        Deleted task/skill names and paths remain in history unless you reassign the session.
      </p>
      <div class="session-actions">
        <button type="submit">{{ isSaving ? 'Saving...' : 'Save session' }}</button>
        <button type="button" @click="emit('cancel')">Cancel</button>
      </div>
    </fieldset>
    <p v-if="error" class="session-error" role="alert">{{ error }}</p>
  </form>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { createManualSession, editSession, type PomodoroLog, type Skill, type Task } from '../services/service'
import { skillLabel } from '../services/skillLabels'

const props = defineProps<{ session: PomodoroLog | null; tasks: Task[]; skills: Skill[] }>()
const emit = defineEmits<{ saved: [session: PomodoroLog]; cancel: [] }>()
const completedAt = ref('')
const duration = ref<number | string>(25)
const taskId = ref<number | null>(null)
const skillId = ref<number | null>(null)
const isSaving = ref(false)
const error = ref('')
function taskSkillLabel(id: number | null | undefined) {
  const skill = props.skills.find(item => item.id === id)
  return skill ? skillLabel(skill, props.skills) : 'Unassigned'
}

function localDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

watch(() => props.session, session => {
  const date = session ? new Date(session.completedAt) : new Date()
  completedAt.value = Number.isNaN(date.getTime()) ? '' : localDateTime(date)
  duration.value = session?.duration ?? 25
  taskId.value = session?.taskId ?? null
  skillId.value = session?.skillId ?? null
  error.value = ''
}, { immediate: true })

function selectTask() {
  skillId.value = props.tasks.find(task => task.id === taskId.value)?.skillId ?? null
}

async function save() {
  if (isSaving.value) return
  error.value = ''
  if (typeof duration.value !== 'number' || !Number.isInteger(duration.value) ||
      duration.value < 1 || duration.value > 2_147_483_647) {
    error.value = 'Enter a positive whole number of minutes (1 to 2147483647).'
    return
  }
  const date = new Date(completedAt.value)
  const normalizedInput = completedAt.value.length === 16 ? `${completedAt.value}:00` : completedAt.value
  if (!completedAt.value || Number.isNaN(date.getTime()) || date.getFullYear() < 1000 ||
      localDateTime(date) !== normalizedInput) {
    error.value = 'Enter a valid completion date and time.'
    return
  }
  if (date.getTime() > Date.now()) {
    error.value = 'The completion date and time cannot be in the future.'
    return
  }
  isSaving.value = true
  try {
    const details = {
      taskId: taskId.value, skillId: skillId.value,
      duration: duration.value, completedAt: date.toISOString(),
    }
    const saved = props.session?.id != null
      ? await editSession(props.session.id, details)
      : await createManualSession(details)
    emit('saved', saved)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to save this session. Try again.'
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.session-editor { margin: 1rem 0; }
fieldset {
  border: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}
label { display: flex; flex-direction: column; gap: 0.5rem; text-align: left; }
input, select { width: 100%; min-width: 0; box-sizing: border-box; }
.session-actions { display: flex; gap: 0.5rem; align-items: flex-end; }
.session-error { color: var(--theme-text); border-left: 3px solid var(--theme-color); padding: 0.75rem; }
</style>
