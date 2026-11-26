<template>
  <dialog ref="dialog" class="modal-dialog" :aria-label="title" @cancel.prevent="close"
    @click="backdropClick">
    <div class="dialog-header">
      <h2>{{ title }}</h2>
      <button type="button" :aria-label="`Close ${title}`" :disabled="busy" @click="close">×</button>
    </div>
    <slot />
  </dialog>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

const props = defineProps<{ title: string; busy?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const previousFocus = document.activeElement

function close() {
  if (!props.busy) emit('close')
}
function backdropClick(event: MouseEvent) {
  const element = dialog.value
  if (!element || event.target !== element) return
  const bounds = element.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) close()
}
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => {
  dialog.value?.close()
  if (previousFocus instanceof HTMLElement) previousFocus.focus()
})
</script>

<style scoped>
.modal-dialog {
  box-sizing: border-box;
  width: min(640px, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  overflow: auto;
  padding: 1.25rem;
  color: var(--text-strong);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
}
.modal-dialog::backdrop { background: rgba(0, 0, 0, 0.45); }
.dialog-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.dialog-header h2 { margin: 0; }
.dialog-header button { padding: 0.25rem 0.65rem; font-size: 1.4rem; }
</style>
