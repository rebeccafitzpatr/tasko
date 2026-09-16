<template>
  <div ref="selectRoot" class="custom-select">
    <button
      type="button"
      class="custom-select__trigger"
      :class="{ 'is-open': isOpen, 'has-value': selectedOption }"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :disabled="disabled"
      @click="toggle"
      @keydown="handleTriggerKeydown"
    >
      <span>{{ selectedOption?.label ?? placeholder }}</span>
      <span class="custom-select__arrow" aria-hidden="true">▾</span>
    </button>

    <ul
      v-if="isOpen"
      class="custom-select__menu"
      role="listbox"
      :aria-label="placeholder"
    >
      <li
        v-for="option in options"
        :key="option.value"
        class="custom-select__option"
        :class="{ 'is-selected': option.value === modelValue }"
        role="option"
        :aria-selected="option.value === modelValue"
        @click="selectOption(option)"
      >
        {{ option.label }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

interface SelectOption {
  value: number
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: number | null
    options: SelectOption[]
    placeholder: string
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const selectRoot = ref<HTMLElement | null>(null)
const isOpen = ref(false)

const selectedOption = computed(() =>
  props.options.find(option => option.value === props.modelValue),
)

function toggle() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value
  }
}

function selectOption(option: SelectOption) {
  emit('update:modelValue', option.value)
  isOpen.value = false
}

function handleTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    toggle()
  }

  if (event.key === 'Escape') {
    isOpen.value = false
  }
}

function handleOutsideClick(event: MouseEvent) {
  if (
    selectRoot.value &&
    !selectRoot.value.contains(event.target as Node)
  ) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})
</script>

<style scoped>
.custom-select {
  position: relative;
  min-width: 180px;
  text-align: left;
}

.custom-select__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  color: var(--text-strong);
  font: inherit;
  text-align: left;
  background: var(--control-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
}

.custom-select__trigger:hover,
.custom-select__trigger.is-open {
  border-color: var(--theme-color);
}

.custom-select__trigger:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.custom-select__trigger:not(.has-value) {
  color: var(--text);
}

.custom-select__arrow {
  margin-left: 12px;
  color: var(--theme-color);
}

.custom-select__menu {
  position: absolute;
  z-index: 10;
  top: calc(100% + 4px);
  right: 0;
  left: 0;
  max-height: 220px;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  list-style: none;
  background: var(--control-bg);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  box-shadow: var(--shadow);
}

.custom-select__option {
  padding: 8px 10px;
  color: var(--text-strong);
  border-radius: 4px;
  cursor: pointer;
}

.custom-select__option:hover,
.custom-select__option.is-selected {
  color: var(--theme-text);
  background: var(--surface-muted);
}

.custom-select__option.is-selected {
  font-weight: 600;
}
</style>