
<template>
  <div>
    <h1>Pomodoro Timer</h1>
    <div class="pomodoro-content">
      
      <!-- <div>
        <label>
          Duration (minutes):
          <input type="number" v-model.number="duration" min="1" max="60" :disabled="isRunning" @change="updateDuration" />
        </label>
      </div> -->
      <div class="timer-center">
        <TimerCircle
          :timeLeft="pomodoroStore.timeLeft"
          :duration="pomodoroStore.duration * 60"
          :size="160"
          :stroke="10"
        >
        <template #default>
          <div v-if="!isRunning && pomodoroStore.timeLeft === pomodoroStore.duration * 60" style="display:flex;flex-direction:column;align-items:center;">
            <input
              type="number"
              v-model.number="duration"
              min="1"
              max="60"
              style="width:3.5em;text-align:center;font-size:1.5em;"
              @change="updateDuration"
            />
            <span style="font-size:0.9em;">min</span>
          </div>
          <span v-else class="timer-text">{{ minutes }}:{{ seconds }}</span>
        </template>
        </TimerCircle>  
        <span>({{ sessionTypeLabel }})</span>
      </div>

      <div class="pomodoro-controls">
        <label>
          Task:
          <select v-model="selectedTaskId" :disabled="isRunning">
            <option value="" disabled>Select task</option>
            <option v-for="task in tasks" :key="task.id" :value="task.id">
              {{ task.name }}
            </option>
          </select>
        </label>

        <div class="timer-controls">
          <button @click="start" :disabled="isRunning || !selectedTaskId">Start</button>
          <button @click="pause" :disabled="!isRunning">Pause</button>
          <button @click="reset">Reset</button>
        </div>
      </div>
      
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { usePomodoroStore } from '../stores/pomodoroStore'
import { useTaskStore } from '../stores/taskStore'
import TimerCircle from '../components/TimerCircle.vue'
//import { useSkillStore } from '../stores/skillStore'

const pomodoroStore = usePomodoroStore()
const taskStore = useTaskStore()
//const skillStore = useSkillStore()

const tasks = taskStore.tasks
const isRunning = computed(() => pomodoroStore.isRunning)
const sessionTypeLabel = computed(() => pomodoroStore.sessionType === 'work' ? 'Work' : 'Break')

const selectedTaskId = ref('')
const duration = ref(pomodoroStore.duration)

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
  }
}

function pause() {
  pomodoroStore.pause()
}

function reset() {
  pomodoroStore.reset()
  selectedTaskId.value = ''
  duration.value = pomodoroStore.duration
}

onUnmounted(() => {
  //pomodoroStore.cleanup()   //do not cleanup every time we navigate away.
})
</script>

<style scoped>
  .timer-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 20px 0;
  }

  .pomodoro-content {
    display: flex;
    height:50vh;
    flex-direction: row;
    gap: 40px;
    align-items: center;
  }

  .pomodoro-controls {
    display: flex;
    flex-direction: column;
    height: 30%;
    justify-content: space-between;
  }
</style>
