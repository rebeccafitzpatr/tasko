<!-- filepath: /home/pop/Documents/repos/tasko/apps/web/src/views/TodoView.vue -->
<template>
  <div class="view-wrap">
    <PageHeader title="Todos" />
    <div class="content centered-container">
      <div class="todo-controls">
        <select v-model="selectedTaskId">
          <option :value="null" disabled>Select Task to link</option>
          <option v-for="t in tasks" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <input v-model="newTodo.title" placeholder="New todo title" />
        <button type="button" @click="addTodo">Add Todo</button>
      </div>
      <ul>
        <li v-for="todo in todos" :key="todo.id">
          {{ todo.title }} • Task: {{ getTaskName(todo.taskId) }} • {{ todo.completed ? 'Done' : 'Pending' }}
          <button @click="toggleTodo(todo.id)">{{ todo.completed ? 'Undo' : 'Complete' }}</button>
          <button @click="removeTodo(todo.id)">Delete</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '../components/PageHeader.vue'
import { ref, computed, onMounted } from 'vue'
import { useTodoStore } from '../stores/todoStore'
import { useTaskStore } from '../stores/taskStore'

const todoStore = useTodoStore()
const taskStore = useTaskStore()

const newTodo = ref({ title: '' })
const selectedTaskId = ref<number | null>(null)

const todos = computed(() => todoStore.todos)
const tasks = computed(() => taskStore.tasks)

function getTaskName(id: number | null | undefined) {
  const t = tasks.value.find(x => x.id === id)
  return t?.name ?? 'Unlinked'
}

async function addTodo() {
  if (!newTodo.value.title) return
  await todoStore.addTodo({ title: newTodo.value.title, taskId: selectedTaskId.value })
  newTodo.value.title = ''
  selectedTaskId.value = null
  await todoStore.loadTodos()
}

async function toggleTodo(id: number) {
  await todoStore.toggleTodo(id)
}

async function removeTodo(id: number) {
  await todoStore.removeTodo(id)
}
onMounted(async () => {
  await todoStore.loadTodos()
})
</script>

<style scoped>
.view-wrap { width: min(900px, 92%); margin: 0 auto; }
.content { padding: 1rem; }
.todo-controls {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.todo-controls input, .todo-controls select {
  padding: 0.5rem;
}
.todo-controls button { padding: 0.5rem 1rem; }
</style>