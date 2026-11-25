<template>
  <section class="activity-graph" aria-label="Activity graph">
    <div class="activity-summary">
      <strong>{{ totalMinutes }}</strong> minutes across <strong>{{ activeDays }}</strong> active days
    </div>

    <div class="graph-scroll" role="img" :aria-label="`${totalMinutes} minutes tracked in the last ${days} days`">
      <div class="month-row" :style="gridStyle">
        <span v-for="label in monthLabels" :key="label.key" class="month-label" :style="{ gridColumn: `${label.column} / span ${label.span}` }">
          {{ label.name }}
        </span>
      </div>
      <div class="graph-grid" :style="gridStyle">
        <span v-for="day in paddedDays" :key="day.key" class="graph-cell-wrapper">
          <span
            v-if="day.date"
            class="graph-cell"
            :class="`level-${day.level}`"
            :title="`${day.label}: ${day.minutes} min`"
            :aria-label="`${day.label}: ${day.minutes} minutes`"
          />
        </span>
      </div>
    </div>

    <div class="activity-legend" aria-hidden="true">
      <span>Less</span>
      <span class="legend-cell level-0"></span>
      <span class="legend-cell level-1"></span>
      <span class="legend-cell level-2"></span>
      <span class="legend-cell level-3"></span>
      <span class="legend-cell level-4"></span>
      <span>More</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PomodoroLog } from '../services/service'
import { APP_TIME_ZONE } from '../services/timeZone'

const props = withDefaults(defineProps<{
  logs: PomodoroLog[]
  days?: number
}>(), {
  days: 365,
})

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const labelFormatter = new Intl.DateTimeFormat('en-NZ', {
  timeZone: APP_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

const monthFormatter = new Intl.DateTimeFormat('en-NZ', {
  timeZone: APP_TIME_ZONE,
  month: 'short',
})

function dateKey(date: Date) {
  return dayFormatter.format(date)
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + amount)
  return next
}

const minutesByDay = computed(() => {
  const map = new Map<string, number>()
  for (const log of props.logs) {
    const key = dateKey(new Date(log.completedAt))
    map.set(key, (map.get(key) ?? 0) + (log.duration ?? 0))
  }
  return map
})

const daysList = computed(() => {
  const today = new Date()
  const start = addDays(today, -(props.days - 1))
  return Array.from({ length: props.days }, (_, index) => {
    const date = addDays(start, index)
    const key = dateKey(date)
    const minutes = minutesByDay.value.get(key) ?? 0
    return {
      key,
      date,
      minutes,
      label: labelFormatter.format(date),
      month: monthFormatter.format(date),
      level: minutes === 0 ? 0 : minutes < 25 ? 1 : minutes < 60 ? 2 : minutes < 120 ? 3 : 4,
    }
  })
})

const leadingBlanks = computed(() => {
  const first = daysList.value[0]?.date
  return first ? first.getDay() : 0
})

const columns = computed(() => Math.ceil((leadingBlanks.value + daysList.value.length) / 7))
const gridStyle = computed(() => ({ '--columns': columns.value }))

const paddedDays = computed(() => [
  ...Array.from({ length: leadingBlanks.value }, (_, index) => ({ key: `blank-${index}`, date: null })),
  ...daysList.value,
])

const monthLabels = computed(() => {
  const labels: { key: string; name: string; column: number; span: number }[] = []
  let current: { key: string; name: string; column: number; span: number } | null = null
  daysList.value.forEach((day, index) => {
    const column = Math.floor((leadingBlanks.value + index) / 7) + 1
    const monthKey = day.key.slice(0, 7)
    if (!current || current.key !== monthKey) {
      current = { key: monthKey, name: day.month, column, span: 1 }
      labels.push(current)
    } else {
      current.span = Math.max(current.span, column - current.column + 1)
    }
  })
  return labels
})

const totalMinutes = computed(() => daysList.value.reduce((sum, day) => sum + day.minutes, 0))
const activeDays = computed(() => daysList.value.filter(day => day.minutes > 0).length)
</script>

<style scoped>
.activity-graph {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.activity-summary {
  color: var(--text-strong);
  text-align: left;
}

.graph-scroll {
  max-width: 100%;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.month-row,
.graph-grid {
  display: grid;
  grid-auto-flow: column;
  grid-template-columns: repeat(var(--columns), 13px);
  gap: 3px;
  min-width: max-content;
}

.month-row {
  margin-left: 0;
  margin-bottom: 0.35rem;
  min-height: 1rem;
}

.month-label {
  overflow: hidden;
  color: var(--text);
  font-size: 0.72rem;
  text-align: left;
  white-space: nowrap;
}

.graph-grid {
  grid-template-rows: repeat(7, 13px);
}

.graph-cell-wrapper {
  width: 13px;
  height: 13px;
}

.graph-cell,
.legend-cell {
  display: block;
  width: 13px;
  height: 13px;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}

.level-0 { background: color-mix(in srgb, var(--theme-color), var(--surface) 94%); }
.level-1 { background: color-mix(in srgb, var(--theme-color), var(--surface) 74%); }
.level-2 { background: color-mix(in srgb, var(--theme-color), var(--surface) 52%); }
.level-3 { background: color-mix(in srgb, var(--theme-color), var(--surface) 30%); }
.level-4 { background: var(--theme-color); }

.activity-legend {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  color: var(--text);
  font-size: 0.75rem;
}
</style>
