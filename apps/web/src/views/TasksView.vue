
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

    <div class="tasks-list">
      <ul>
        <li v-for="task in tasks" :key="task.id">
          <div class="task-item">
            {{ task.name }} ({{ getSkillName(task.skillId) }})
            <button @click="deleteTask(task.id)">Delete</button>
          </div>
        </li>
      </ul>
    </div>
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
  id: 0,
  name: '',
  skillId: 0,
  start: '',
  end: '',
  date: '',
})

function addTask() {
  if (!newTask.value.name || !newTask.value.skillId) return
  const now = new Date()
  taskStore.addTask({
    ...newTask.value,
    id: Math.floor(Math.random() * 1000000),
    start: now.toISOString(),
    end: now.toISOString(),
    date: now.toISOString().split('T')[0],
  })
  newTask.value.name = ''
  newTask.value.skillId = 0
}

function deleteTask(id: number) {
  taskStore.deleteTask(id)
}

function getSkillName(skillId: number | null | undefined) {
  const skill = skills.find(s => s.id === skillId)
  return skill ? skill.name : 'Unknown'
}
</script>

<style>

.tasks-list {
  background-color: #e8e8e8;
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
  border: 1px solid #e2e2e2;
  background-color:#eee;
  border-radius: 8px;

}

</style>
