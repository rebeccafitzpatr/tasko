
<template>
  <div>
    <h1>Tasks</h1>
    <form @submit.prevent="addTask">
      <input v-model="newTask.name" placeholder="Task name" required />
      <select v-model="newTask.skillId" required>
        <option value="" disabled>Select skill</option>
        <option v-for="skill in skills" :key="skill.id" :value="skill.id">{{ skill.name }}</option>
      </select>
      <button type="submit">Add Task</button>
    </form>
    <ul>
      <li v-for="task in tasks" :key="task.id">
        {{ task.name }} ({{ getSkillName(task.skillId) }})
        <button @click="deleteTask(task.id)">Delete</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTaskStore } from '../stores/taskStore'
import { useSkillStore } from '../stores/skillStore'

const taskStore = useTaskStore()
const skillStore = useSkillStore()

const tasks = taskStore.tasks
const skills = skillStore.skills

const newTask = ref({
  id: '',
  name: '',
  skillId: '',
  start: '',
  end: '',
  date: '',
})

function addTask() {
  if (!newTask.value.name || !newTask.value.skillId) return
  const now = new Date()
  taskStore.addTask({
    ...newTask.value,
    id: Math.random().toString(36).slice(2),
    start: now.toISOString(),
    end: now.toISOString(),
    date: now.toISOString().split('T')[0],
  })
  newTask.value.name = ''
  newTask.value.skillId = ''
}

function deleteTask(id: string) {
  taskStore.deleteTask(id)
}

function getSkillName(skillId: string) {
  const skill = skills.find(s => s.id === skillId)
  return skill ? skill.name : 'Unknown'
}
</script>
