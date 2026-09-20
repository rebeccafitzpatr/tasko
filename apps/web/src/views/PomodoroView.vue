
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
      <section class="timer-panel" aria-label="Pomodoro timer">
        <div class="timer-kicker">{{ isRunning ? 'Session in progress' : 'Ready when you are' }}</div>
        <TimerCircle
          :timeLeft="pomodoroStore.timeLeft"
          :duration="pomodoroStore.duration * 60"
          :size="160"
          :stroke="10"
        >
        <template #default>
          <div
            v-if="!isRunning && pomodoroStore.timeLeft === pomodoroStore.duration * 60"
            class="duration-editor"
          >
            <input
              class="duration-input"
              type="number"
              v-model.number="duration"
              min="1"
              max="60"
              @change="updateDuration"
            />
            <span class="duration-unit">min</span>
          </div>
          <span v-else class="timer-text">{{ minutes }}:{{ seconds }}</span>
        </template>
        </TimerCircle>  
        <span class="session-label">{{ sessionTypeLabel }} session</span>
      </section>

      <section class="pomodoro-controls" aria-label="Timer controls">
        <label>
          <span class="field-label">Focus task</span>
          <CustomSelect
            v-model="selectedTaskId"
            placeholder="Select task"
            :disabled="isRunning"
            :options="
              tasks.map(task => ({
                value: task.id,
                label: task.name,
              }))
            "
            @update:modelValue="clearStartError"
          />
        </label>

        <p v-if="startError" class="start-error" role="alert">{{ startError }}</p>
        <div class="timer-controls">
          <button @click="start" :disabled="isRunning">Start</button>
          <button @click="pause" :disabled="!isRunning">Pause</button>
          <button @click="reset">Reset</button>
        </div>
      </section>
      
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { usePomodoroStore } from '../stores/pomodoroStore'
import { useTaskStore } from '../stores/taskStore'
import TimerCircle from '../components/TimerCircle.vue'
import CustomSelect from '../components/CustomSelect.vue'
//import { useSkillStore } from '../stores/skillStore'

const pomodoroStore = usePomodoroStore()
const taskStore = useTaskStore()
//const skillStore = useSkillStore()

const tasks = taskStore.tasks
const isRunning = computed(() => pomodoroStore.isRunning)
const sessionTypeLabel = computed(() => pomodoroStore.sessionType === 'work' ? 'Work' : 'Break')

const selectedTaskId = ref<number | null>(null)
const duration = ref(pomodoroStore.duration)
const startError = ref('')

const minutes = computed(() => String(Math.floor(pomodoroStore.timeLeft / 60)).padStart(2, '0'))
const seconds = computed(() => String(pomodoroStore.timeLeft % 60).padStart(2, '0'))

function updateDuration() {
  if (!isRunning.value && duration.value >= 1 && duration.value <= 60) {
    pomodoroStore.setDuration(duration.value)
  }
}

function start() {
  if (pomodoroStore.isRunning) return

  if (selectedTaskId.value === null) {
    startError.value = 'Select a task before starting the session.'
    return
  }

  startError.value = ''
  pomodoroStore.selectTask(selectedTaskId.value)
  pomodoroStore.start()
}

function clearStartError() {
  startError.value = ''
}

function reset() {
  pomodoroStore.reset()
  selectedTaskId.value = null
  duration.value = pomodoroStore.duration
  startError.value = ''
}

function pause() {
  pomodoroStore.pause()
}

onUnmounted(() => {
  //pomodoroStore.cleanup()   //do not cleanup every time we navigate away.
})
</script>

<style scoped>
  .pomodoro-content {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) minmax(220px, 0.85fr);
    gap: 2.5rem;
    align-items: center;
    min-height: 340px;
    padding: 2rem;
    background: var(--surface-muted);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow);
  }

  .timer-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.85rem;
    min-height: 280px;
    padding: 1.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  .timer-kicker,
  .field-label {
    color: var(--theme-text);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .session-label {
    color: var(--text-strong);
    font-size: 1rem;
    font-weight: 600;
  }

  .timer-text {
    color: var(--text-strong);
    font: 600 1.4em/1 var(--mono);
  }

  .duration-editor {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .pomodoro-controls {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    justify-content: center;
    min-width: 0;
    padding: 1rem;
  }

  .start-error {
    width: 100%;
    margin: -1.2rem 0;
    padding: 0.65rem 0.8rem;
    color: var(--theme-text);
    font-size: 0.85rem;
    text-align: left;
    background: color-mix(in srgb, var(--theme-color), transparent 88%);
    border-left: 3px solid var(--theme-color);
    border-radius: 4px;
  }

  .pomodoro-controls label {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    text-align: left;
  }

  .timer-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }

  .timer-controls button {
    min-height: 44px;
    margin: 0;
  }

  .timer-controls button:first-child {
    grid-column: 1 / -1;
    background: var(--theme-color);
  }

  @media (max-width: 600px) {
    .pomodoro-content {
      grid-template-columns: 1fr;
      gap: 1rem;
      padding: 1rem;
    }

    .timer-panel {
      min-height: 250px;
    }

    .pomodoro-controls {
      gap: 1.25rem;
      padding: 0.5rem;
    }
  }

  .duration-input {
    width: 3.5em;
    padding: 0.05em 0.1em;
    color: var(--text-strong);
    font: 600 1.5em/1.2 var(--mono);
    text-align: center;
    background: transparent;
    border: 0;
    border-bottom: 2px solid var(--theme-color);
    border-radius: 6px;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .duration-input::-webkit-inner-spin-button,
  .duration-input::-webkit-outer-spin-button {
    display: none;
  }

  .duration-unit {
    margin-top: 0.15rem;
    color: var(--theme-text);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
</style>
