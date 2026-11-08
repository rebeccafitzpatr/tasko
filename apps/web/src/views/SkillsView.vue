<template>
  <div>
    <h1>Skills</h1>
    <form class="details" @submit.prevent="save">
      <label>Skill name <input v-model="name" name="skillName" placeholder="Skill name" :disabled="busy" /></label>
      <label>Parent skill
        <select v-model="parentId" name="parentId" :disabled="busy || editingHasChildren">
          <option :value="null">Standalone / top-level skill</option>
          <option v-for="parent in availableParents" :key="parent.id" :value="parent.id">{{ parent.name }}</option>
        </select>
      </label>
      <button :disabled="busy">{{ editingId === null ? 'Add Skill' : 'Save skill' }}</button>
      <button v-if="editingId !== null" type="button" :disabled="busy" @click="clearForm">Cancel</button>
    </form>
    <p v-if="editingHasChildren">Move or promote the sub-skills before moving this parent.</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="busy" role="status">Saving or loading skills...</p>
    <button v-if="loadFailed" :disabled="busy" @click="load">Retry loading</button>
    <div class="tasks-list">
      <ul>
        <li v-for="parent in topLevelSkills" :key="parent.id">
          <div class="task-item">
            <span class="item-label">
              <strong>{{ parent.name }}</strong>
              <span class="skill-kind">{{ children(parent.id).length ? 'Parent skill' : 'Standalone skill' }}</span>
            </span>
            <div class="item-actions">
              <button :disabled="busy" @click="edit(parent)">Edit</button>
              <button :disabled="busy" @click="addChild(parent.id)">Add sub-skill</button>
              <button class="delete-button" :disabled="busy || children(parent.id).length > 0" @click="remove(parent.id)">Delete</button>
            </div>
          </div>
          <ul aria-label="Sub-skills">
            <li v-for="child in children(parent.id)" :key="child.id">
              <div class="task-item">
                <span class="item-label">
                  <span>{{ parent.name }} / {{ child.name }}</span>
                  <span class="skill-kind">Sub-skill</span>
                </span>
                <div class="item-actions">
                  <button :disabled="busy" @click="edit(child)">Edit / move</button>
                  <button class="delete-button" :disabled="busy" @click="remove(child.id)">Delete</button>
                </div>
              </div>
            </li>
          </ul>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSkillStore, type Skill } from '../stores/skillStore'

const store = useSkillStore()
const name = ref('')
const parentId = ref<number | null>(null)
const editingId = ref<number | null>(null)
const busy = ref(false)
const error = ref('')
const loadFailed = ref(false)
const topLevelSkills = computed(() => store.skills.filter(skill => skill.parentId == null))
const availableParents = computed(() => topLevelSkills.value.filter(skill => skill.id !== editingId.value))
const children = (id: number) => store.skills.filter(skill => skill.parentId === id)
const editingHasChildren = computed(() => editingId.value !== null && children(editingId.value).length > 0)

function clearForm() {
  name.value = ''
  parentId.value = null
  editingId.value = null
}
function edit(skill: Skill) {
  editingId.value = skill.id
  name.value = skill.name
  parentId.value = skill.parentId ?? null
  error.value = ''
}
function addChild(id: number) {
  clearForm()
  parentId.value = id
  error.value = ''
}
async function load() {
  busy.value = true
  error.value = ''
  try {
    await store.loadSkills()
    loadFailed.value = false
  } catch (cause) {
    loadFailed.value = true
    error.value = cause instanceof Error ? cause.message : 'Unable to load skills.'
  } finally { busy.value = false }
}
async function save() {
  if (busy.value) return
  if (!name.value.trim() || name.value.trim().length > 255) {
    error.value = 'Enter a skill name from 1 to 255 characters.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const skill = { id: editingId.value ?? 0, name: name.value.trim(), parentId: parentId.value }
    if (editingId.value === null) await store.addSkill(skill)
    else await store.updateSkill(skill)
    clearForm()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to save skill. Your input has been kept.'
  } finally { busy.value = false }
}
async function remove(id: number) {
  busy.value = true
  error.value = ''
  try {
    await store.deleteSkill(id)
    if (editingId.value === id) clearForm()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to delete skill.'
  } finally { busy.value = false }
}
onMounted(load)
</script>

<style scoped>
label { display: flex; flex-direction: column; gap: 0.5rem; text-align: left; }
.task-item { flex-wrap: wrap; gap: 0.5rem 0.75rem; }
.skill-kind { color: var(--text); font-size: 0.85rem; }
.form-error { padding: 0.75rem; border-left: 3px solid var(--theme-color); color: var(--theme-text); }
</style>
