
<template>
  <div>
    <h1>Tasks</h1>
    <div class="task-form">
      <form @submit.prevent="addTask" class="details">
        <input v-model="newTask.name" placeholder="Task name" required />
        <CustomSelect
          v-model="newTask.skillId"
          placeholder="Select skill"
          :options="
            skills.map(skill => ({
              value: skill.id,
              label: skill.name,
            }))
          "
          @update:modelValue="clearSkillError"
        />
        <button type="submit">Add Task</button>
      </form>
      <p v-if="skillError" class="form-error" role="alert">{{ skillError }}</p>
    </div>

    <div class="tasks-list">
      <ul>
        <li v-for="task in tasks" :key="task.id">
          <div class="task-item">
            {{ task.name }} ({{ getSkillName(task.skillId) }})
            <button class="delete-button" @click="deleteTask(task.id)">Delete</button>
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
import CustomSelect from '../components/CustomSelect.vue'

const taskStore = useTaskStore()
const skillStore = useSkillStore()

const tasks = taskStore.tasks
const skills = skillStore.skills
const skillError = ref('')

const newTask = ref({
  id: 0,
  name: '',
  skillId: null as number | null,
  start: '',
  end: '',
  date: '',
})

function addTask() {
  if (!newTask.value.name || !newTask.value.skillId) {
    if (!newTask.value.skillId) {
      skillError.value = 'Choose a skill before adding this task.'
    }
    return
  }

  skillError.value = ''
  const now = new Date()
  taskStore.addTask({
    ...newTask.value,
    id: Math.floor(Math.random() * 1000000),
    start: now.toISOString(),
    end: now.toISOString(),
    date: now.toISOString().split('T')[0],
  })
  newTask.value.name = ''
  newTask.value.skillId = null
}

function clearSkillError() {
  skillError.value = ''
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
