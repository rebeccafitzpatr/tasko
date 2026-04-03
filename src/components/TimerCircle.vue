<template>
  <svg :width="size" :height="size" class="timer-circle">
    <circle
      class="timer-bg"
      :r="radius"
      :cx="size/2"
      :cy="size/2"
      fill="none"
      :stroke-width="stroke"
    />
    <circle
      class="timer-fg"
      :r="radius"
      :cx="size/2"
      :cy="size/2"
      fill="none"
      :stroke-width="stroke"
      :stroke-dasharray="circumference"
      :stroke-dashoffset="dashOffset"
      stroke-linecap="round"
      :transform="`rotate(-90 ${size/2} ${size/2})`"
    />
    <foreignObject
      :x="size * 0.15"
      :y="size * 0.32"
      :width="size * 0.7"
      :height="size * 0.36"
    >
    <div class="timer-center-content" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
        <slot>
        <span class="timer-text">{{ displayTime }}</span>
        </slot>
    </div>
    </foreignObject>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  timeLeft: number,      // seconds left
  duration: number,      // total seconds
  size?: number,         // px
  stroke?: number        // px
}>()

const size = props.size ?? 120
const stroke = props.stroke ?? 8
const radius = computed(() => (size - stroke) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const progress = computed(() =>
  Math.max(0, Math.min(1, props.timeLeft / props.duration))
)
const dashOffset = computed(() =>
  circumference.value * (1 - progress.value)
)

const displayTime = computed(() => {
  const min = Math.floor(props.timeLeft / 60)
  const sec = props.timeLeft % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
})
</script>

<style scoped>
.timer-circle {
  display: block;
}
.timer-bg {
  stroke: #eee;
}
.timer-fg {
  stroke: #42b983;
  transition: stroke-dashoffset 0.5s linear;
}
.timer-text {
  font-size: 1.4em;
  fill: #333;
  font-family: monospace;
  dominant-baseline: middle;
}
</style>