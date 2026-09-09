<template>
  <div>
    <h1>Skills</h1>
    <form @submit.prevent="addSkill" class="details">
      <input v-model="newSkill.name" placeholder="Skill name" required />
      <button type="submit">Add Skill</button>
    </form>
    <div class="tasks-list">
      <ul>
        <li v-for="skill in skills" :key="skill.id">
          <div class="task-item">
            {{ skill.name }}
            <button @click="deleteSkill(skill.id)">Delete</button>
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

const newSkill = ref({
  id: 0,
  name: '',
})

function addSkill() {
  if (!newSkill.value.name) return
  skillStore.addSkill({
    id: Math.floor(Math.random() * 1000000),
    name: newSkill.value.name,
  })
  newSkill.value.name = ''
}

function deleteSkill(id: number) {
  skillStore.deleteSkill(id)
}
</script>
