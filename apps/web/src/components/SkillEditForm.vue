<template>
  <form class="skill-edit" @submit.prevent="$emit('save')">
    <label>Skill name
      <input ref="nameInput" :value="name" name="editSkillName" :disabled="busy"
        @input="$emit('update:name', ($event.target as HTMLInputElement).value)" />
    </label>
    <label>Parent skill
      <select :value="parentId ?? ''" name="editParentId" :disabled="busy || hasChildren"
        @change="$emit('update:parentId', ($event.target as HTMLSelectElement).value === '' ? null : Number(($event.target as HTMLSelectElement).value))">
        <option value="">Standalone / top-level skill</option>
        <option v-for="parent in parents" :key="parent.id" :value="parent.id">{{ parent.name }}</option>
      </select>
    </label>
    <p v-if="hasChildren" class="edit-note">Move or promote the sub-skills before moving this parent.</p>
    <p v-if="error" class="edit-error" role="alert">{{ error }}</p>
    <div class="edit-actions">
      <button type="submit" :disabled="busy">Save skill</button>
      <button type="button" :disabled="busy" @click="$emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Skill } from '../services/service'

defineProps<{
  name: string
  parentId: number | null
  parents: Skill[]
  hasChildren: boolean
  busy: boolean
  error: string
}>()
defineEmits<{
  'update:name': [value: string]
  'update:parentId': [value: number | null]
  save: []
  cancel: []
}>()

const nameInput = ref<HTMLInputElement | null>(null)
onMounted(() => nameInput.value?.focus())
</script>

<style scoped>
.skill-edit { display: flex; flex: 1 1 100%; flex-wrap: wrap; align-items: flex-end; gap: 0.75rem; min-width: 0; }
.skill-edit label { display: flex; flex: 1 1 12rem; flex-direction: column; gap: 0.5rem; min-width: 0; text-align: left; }
.edit-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-left: auto; }
.edit-note, .edit-error { flex-basis: 100%; margin: 0; }
.edit-error { padding: 0.75rem; border-left: 3px solid var(--theme-color); color: var(--theme-text); }
</style>
