<template>
  <div>
    <h1>Skills</h1>
    <div class="skill-form">
      <form @submit.prevent="addSkill" class="details">
        <input
          v-model="newSkill.name"
          placeholder="Skill name"
          @input="clearSkillError"
        />
        <button type="submit">Add Skill</button>
      </form>
      <p v-if="skillError" class="form-error" role="alert">{{ skillError }}</p>
    </div>
    <div class="tasks-list">
      <ul>
        <li v-for="skill in skills" :key="skill.id">
          <div class="task-item">
            {{ skill.name }}
            <button class="delete-button" @click="deleteSkill(skill.id)">Delete</button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSkillStore } from '../stores/skillStore'

const skillStore = useSkillStore()
const skills = skillStore.skills
const skillError = ref('')

const newSkill = ref({
  id: 0,
  name: '',
})

function addSkill() {
  if (!newSkill.value.name.trim()) {
    skillError.value = 'Enter a skill name before adding it.'
    return
  }

  skillError.value = ''
  skillStore.addSkill({
    id: Math.floor(Math.random() * 1000000),
    name: newSkill.value.name,
  })
  newSkill.value.name = ''
}

function clearSkillError() {
  skillError.value = ''
}

function deleteSkill(id: number) {
  skillStore.deleteSkill(id)
}
</script>

<style scoped>
.skill-form {
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
</style>
