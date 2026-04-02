<template>
  <div>
    <h1>Pomodoro Timer</h1>
    <div>
      <span>{{ minutes }}:{{ seconds }}</span>
      <span>({{ sessionTypeLabel }})</span>
    </div>
    <button @click="start" :disabled="isRunning">Start</button>
    <button @click="pause" :disabled="!isRunning">Pause</button>
    <button @click="reset">Reset</button>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted } from 'vue'
import { usePomodoroStore } from '../stores/pomodoroStore'

const store = usePomodoroStore()
const isRunning = computed(() => store.isRunning)
const sessionTypeLabel = computed(() => store.sessionType === 'work' ? 'Work' : 'Break')

let interval: number | undefined

const minutes = computed(() => String(Math.floor(store.timeLeft / 60)).padStart(2, '0'))
const seconds = computed(() => String(store.timeLeft % 60).padStart(2, '0'))

function start() {
  if (!store.isRunning) {
    store.start()
    interval = setInterval(() => {
      if (store.timeLeft > 0) {
        store.timeLeft--
      } else {
        store.pause()
        clearInterval(interval)
      }
    }, 1000)
  }
}

function pause() {
  store.pause()
  clearInterval(interval)
}

function reset() {
  store.reset()
  clearInterval(interval)
}

onUnmounted(() => {
  clearInterval(interval)
})
</script>
