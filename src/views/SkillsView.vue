<template>
  <div>
    <h1>Skills</h1>
    <form @submit.prevent="addSkill">
      <input v-model="newSkill.name" placeholder="Skill name" required />
      <button type="submit">Add Skill</button>
    </form>
    <ul>
      <li v-for="skill in skills" :key="skill.id">
        {{ skill.name }}
        <button @click="deleteSkill(skill.id)">Delete</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSkillStore } from '../stores/skillStore'

const skillStore = useSkillStore()
const skills = skillStore.skills

const newSkill = ref({
  id: '',
  name: '',
})

function addSkill() {
  if (!newSkill.value.name) return
  skillStore.addSkill({
    id: Math.random().toString(36).slice(2),
    name: newSkill.value.name,
  })
  newSkill.value.name = ''
}

function deleteSkill(id: string) {
  skillStore.deleteSkill(id)
}
</script>
