
<template>
  <div>
    <h1>Tasks</h1>
    <div class="task-form">
      <form @submit.prevent="addTask" class="details">
        <input v-model="newTask.name" placeholder="Task name" required :disabled="busy" />
        <CustomSelect
          v-model="newTask.skillId"
          placeholder="Select skill"
          :disabled="busy"
          :options="
            skills.map(skill => ({
              value: skill.id,
              label: skillLabel(skill, skills),
            }))
          "
          @update:modelValue="clearSkillError"
        />
        <button type="submit" :disabled="busy">Add Task</button>
      </form>
      <p v-if="skillError" class="form-error" role="alert">{{ skillError }}</p>
      <p v-if="busy" role="status">Loading or saving tasks...</p>
      <button v-if="loadFailed" :disabled="busy" @click="load">Retry loading</button>
    </div>

    <div class="tasks-list">
      <ul>
        <li v-for="task in tasks" :key="task.id">
          <div class="task-item">
            <form v-if="editingId === task.id" class="task-edit" @submit.prevent="saveEdit">
              <label>Task name
                <input v-model="editName" name="editTaskName" :disabled="busy" v-focus />
              </label>
              <div class="task-edit-skill">
                <span>Skill</span>
                <CustomSelect v-model="editSkillId" placeholder="Select skill" :disabled="busy"
                  :options="skills.map(skill => ({ value: skill.id, label: skillLabel(skill, skills) }))"
                  @update:modelValue="editError = ''" />
              </div>
              <div class="item-actions">
                <button type="submit" :disabled="busy">Save task</button>
                <button type="button" :disabled="busy" @click="cancelEdit">Cancel</button>
              </div>
              <p v-if="editError" class="form-error" role="alert">{{ editError }}</p>
            </form>
            <template v-else>
              <span class="item-label">{{ task.name }} ({{ getSkillName(task.skillId) }})</span>
              <div class="item-actions">
                <button :disabled="busy || editingId !== null" @click="editTask(task)">Edit</button>
                <button class="delete-button" :disabled="busy" @click="deleteTask(task.id)">Delete</button>
              </div>
            </template>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type ObjectDirective } from 'vue'
import { useTaskStore, type Task } from '../stores/taskStore'
import { useSkillStore } from '../stores/skillStore'
import CustomSelect from '../components/CustomSelect.vue'
import { skillLabel } from '../services/skillLabels'

const taskStore = useTaskStore()
const skillStore = useSkillStore()

const tasks = computed(() => taskStore.tasks)
const skills = computed(() => skillStore.skills)
const skillError = ref('')
const busy = ref(false)
const loadFailed = ref(false)
const editingId = ref<number | null>(null)
const editName = ref('')
const editSkillId = ref<number | null>(null)
const editError = ref('')
const vFocus: ObjectDirective<HTMLInputElement> = { mounted: element => element.focus() }

const newTask = ref({
  id: 0,
  name: '',
  skillId: null as number | null,
  start: '',
  end: '',
  date: '',
})

async function addTask() {
  if (busy.value) return
  if (!newTask.value.name.trim() || !newTask.value.skillId) {
    if (!newTask.value.skillId) {
      skillError.value = 'Choose a skill before adding this task.'
    }
    return
  }

  skillError.value = ''
  busy.value = true
  try {
    await taskStore.addTask({ ...newTask.value, name: newTask.value.name.trim() })
    newTask.value.name = ''
    newTask.value.skillId = null
  } catch (cause) {
    skillError.value = cause instanceof Error ? cause.message : 'Unable to save task.'
  } finally { busy.value = false }
}

function clearSkillError() {
  skillError.value = ''
}

async function deleteTask(id: number) {
  if (busy.value) return
  busy.value = true
  skillError.value = ''
  try {
    await taskStore.deleteTask(id)
    if (editingId.value === id) cancelEdit()
  }
  catch (cause) { skillError.value = cause instanceof Error ? cause.message : 'Unable to delete task.' }
  finally { busy.value = false }
}

function editTask(task: Task) {
  editingId.value = task.id
  editName.value = task.name
  editSkillId.value = task.skillId ?? null
  editError.value = ''
}
function cancelEdit() {
  editingId.value = null
  editName.value = ''
  editSkillId.value = null
  editError.value = ''
}
async function saveEdit() {
  if (busy.value || editingId.value === null) return
  if (!editName.value.trim()) {
    editError.value = 'Enter a task name.'
    return
  }
  if (!editSkillId.value) {
    editError.value = 'Choose a skill before saving this task.'
    return
  }
  busy.value = true
  editError.value = ''
  try {
    await taskStore.updateTask({
      id: editingId.value, name: editName.value.trim(), skillId: editSkillId.value,
    })
    cancelEdit()
  } catch (cause) {
    editError.value = cause instanceof Error ? cause.message : 'Unable to save task. Your input has been kept.'
  } finally { busy.value = false }
}
async function load() {
  busy.value = true
  skillError.value = ''
  try {
    await Promise.all([taskStore.loadTasks(), skillStore.loadSkills()])
    loadFailed.value = false
  } catch (cause) {
    loadFailed.value = true
    skillError.value = cause instanceof Error ? cause.message : 'Unable to load tasks and skills.'
  } finally { busy.value = false }
}
onMounted(load)

function getSkillName(skillId: number | null | undefined) {
  const skill = skills.value.find(s => s.id === skillId)
  return skill ? skillLabel(skill, skills.value) : 'Unassigned / unavailable'
}
</script>

<style>

.task-form {
  width: 100%;
}

.form-error {
  width: 100%;
  margin: 0.75rem 0 0;
  padding: 0.65rem 0.8rem;
  color: var(--theme-text);
  font-size: 0.85rem;
  text-align: left;
  background: color-mix(in srgb, var(--theme-color), transparent 88%);
  border-left: 3px solid var(--theme-color);
  border-radius: 4px;
}

.tasks-list {
  background-color: var(--theme-light);
  padding: 1.5rem 2rem;
  margin: 1rem;
  border-radius: 12px;
}

.tasks-list ul{
  list-style:none;
}

.task-item {
  padding: 1rem;
  margin: 1rem;
  border: 1px solid var(--theme-medium);
  background-color: var(--bg);
  border-radius: 8px;

}

</style>

<style scoped>
.task-edit { display: flex; flex: 1 1 100%; flex-wrap: wrap; align-items: flex-end; gap: 0.75rem; min-width: 0; }
.task-edit label, .task-edit-skill { display: flex; flex: 1 1 12rem; flex-direction: column; gap: 0.5rem; min-width: 0; text-align: left; }
.task-edit .custom-select { min-width: 0; }
.task-edit .form-error { box-sizing: border-box; margin: 0; }
</style>
