
<template>
  <div>
    <h1>Pomodoro Timer</h1>
    <div>
      <label>
        Task:
        <select v-model="selectedTaskId" :disabled="isRunning">
          <option value="" disabled>Select task</option>
          <option v-for="task in tasks" :key="task.id" :value="task.id">
            {{ task.name }}
          </option>
        </select>
      </label>
    </div>
    <div>
      <label>
        Duration (minutes):
        <input type="number" v-model.number="duration" min="1" max="60" :disabled="isRunning" @change="updateDuration" />
      </label>
    </div>
    <div>
      <span>{{ minutes }}:{{ seconds }}</span>
      <span>({{ sessionTypeLabel }})</span>
    </div>
    <button @click="start" :disabled="isRunning || !selectedTaskId">Start</button>
    <button @click="pause" :disabled="!isRunning">Pause</button>
    <button @click="reset">Reset</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { usePomodoroStore } from '../stores/pomodoroStore'
import { useTaskStore } from '../stores/taskStore'
import { useSkillStore } from '../stores/skillStore'

const pomodoroStore = usePomodoroStore()
const taskStore = useTaskStore()
const skillStore = useSkillStore()

const tasks = taskStore.tasks
const isRunning = computed(() => pomodoroStore.isRunning)
const sessionTypeLabel = computed(() => pomodoroStore.sessionType === 'work' ? 'Work' : 'Break')

const selectedTaskId = ref('')
const duration = ref(pomodoroStore.duration)

let interval: number | undefined

const minutes = computed(() => String(Math.floor(pomodoroStore.timeLeft / 60)).padStart(2, '0'))
const seconds = computed(() => String(pomodoroStore.timeLeft % 60).padStart(2, '0'))

function updateDuration() {
  if (!isRunning.value && duration.value >= 1 && duration.value <= 60) {
    pomodoroStore.setDuration(duration.value)
  }
}

function start() {
  if (!pomodoroStore.isRunning && selectedTaskId.value) {
    pomodoroStore.selectTask(selectedTaskId.value)
    pomodoroStore.start()
    clearInterval(interval)
    interval = setInterval(() => {
      if (pomodoroStore.timeLeft > 0) {
        pomodoroStore.timeLeft--
      } else {
        pomodoroStore.pause()
        clearInterval(interval)
        // Log completed Pomodoro to the task and skill
        if (pomodoroStore.currentTaskId) {
          const minutes = pomodoroStore.duration
          taskStore.incrementPomodoro(pomodoroStore.currentTaskId, minutes)
          const task = taskStore.tasks.find(t => t.id === pomodoroStore.currentTaskId)
          if (task) {
            skillStore.incrementSkillTime(task.skillId, minutes)
          }
        }
        // Optionally, reset timer for next Pomodoro (auto-repeat)
        // pomodoroStore.reset()
      }
    }, 1000)
  }
}

function pause() {
  pomodoroStore.pause()
  clearInterval(interval)
}

function reset() {
  pomodoroStore.reset()
  clearInterval(interval)
  selectedTaskId.value = ''
  duration.value = pomodoroStore.duration
}

onUnmounted(() => {
  clearInterval(interval)
})
</script>
