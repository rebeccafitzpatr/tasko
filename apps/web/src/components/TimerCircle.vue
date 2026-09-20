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
      x="0"
      y="0"
      :width="size"
      :height="size"
    >
    <div class="timer-center-content">
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
  overflow: visible;
}
.timer-bg {
  stroke: color-mix(in srgb, var(--theme-color), transparent 82%);
}
.timer-fg {
  stroke: var(--theme-color);
  filter: drop-shadow(0 3px 5px color-mix(in srgb, var(--theme-color), transparent 72%));
  transition: stroke-dashoffset 0.5s linear, stroke 0.2s ease;
}
.timer-text {
  font-size: 1.4em;
  fill: var(--text-strong);
  font-family: var(--mono);
  dominant-baseline: middle;
}
.timer-center-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  
}
</style>