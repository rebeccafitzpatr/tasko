// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import PomodoroView from '../src/views/PomodoroView.vue'
import CustomSelect from '../src/components/CustomSelect.vue'
import { usePomodoroStore } from '../src/stores/pomodoroStore'

vi.mock('../src/services/service', () => ({
  fetchTasks: vi.fn().mockResolvedValue([{ id: 12, name: 'Study' }]),
}))

describe('timer recovery controls', () => {
  const wrappers: ReturnType<typeof mount>[] = []

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => {
    wrappers.forEach(wrapper => wrapper.unmount())
    wrappers.length = 0
    vi.restoreAllMocks()
  })

  it('binds the selected task to recovered store state', async () => {
    const store = usePomodoroStore()
    store.currentTaskId = 12
    store.timeLeft = 40
    const wrapper = mount(PomodoroView)
    wrappers.push(wrapper)
    await flushPromises()
    expect(wrapper.findComponent(CustomSelect).props('modelValue')).toBe(12)
    expect(wrapper.text()).toContain('00:40')
  })

  it('shows completion and persistence errors with a save/retry control', async () => {
    const store = usePomodoroStore()
    store.pendingCompletion = true
    store.completionError = 'Could not save session: Network failure'
    store.persistenceError = 'Cannot persist timer progress: Storage blocked'
    const wrapper = mount(PomodoroView)
    wrappers.push(wrapper)
    await flushPromises()
    expect(wrapper.findAll('[role="alert"]').map(alert => alert.text())).toContain(store.completionError)
    expect(wrapper.findAll('[role="alert"]').map(alert => alert.text())).toContain(store.persistenceError)
    expect(wrapper.findAll('button').some(button => button.text() === 'Save / retry session')).toBe(true)
    expect(wrapper.findAll('button').find(button => button.text() === 'Start')?.attributes('disabled')).toBeDefined()
  })
})
