// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SessionEditor from '../src/components/SessionEditor.vue'
import AnalyticsView from '../src/views/AnalyticsView.vue'
import {
  createManualSession, editSession, fetchTasks, fetchSkills, fetchPomodoros, fetchAnalytics,
  type PomodoroLog,
} from '../src/services/service'

vi.mock('../src/services/service', () => ({
  createManualSession: vi.fn(),
  editSession: vi.fn(),
  fetchTasks: vi.fn(),
  fetchSkills: vi.fn(),
  fetchPomodoros: vi.fn(),
  fetchAnalytics: vi.fn(),
}))

const tasks = [{ id: 12, name: 'Study', skillId: 4 }]
const skills = [{ id: 4, name: 'English' }]
const manual: PomodoroLog = {
  id: 1, type: 'manual', duration: 30, completedAt: '2026-01-01T12:00:00Z',
  taskId: null, skillId: null, taskName: null, skillName: null,
}
const wrappers: ReturnType<typeof mount>[] = []

function editor(session: PomodoroLog | null = null) {
  const wrapper = mount(SessionEditor, { props: { session, tasks, skills } })
  wrappers.push(wrapper)
  return wrapper
}

beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  vi.mocked(createManualSession).mockResolvedValue(manual)
  vi.mocked(editSession).mockResolvedValue({ ...manual, duration: 45 })
  vi.mocked(fetchTasks).mockResolvedValue(tasks)
  vi.mocked(fetchSkills).mockResolvedValue(skills)
  vi.mocked(fetchPomodoros).mockResolvedValue({ items: [], hasMore: false, nextCursor: null, limit: 25 })
  vi.mocked(fetchAnalytics).mockResolvedValue({
    totalPomodoros: 0, totalMinutes: 0, totalTasks: 1,
    breakdown: [{ skillId: 4, skillName: 'English', minutes: 0, pomodoros: 0 }],
  })
})

afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  wrappers.length = 0
})

describe('session editor', () => {
  it('creates a manual session with a zoned completion timestamp and optional assignments', async () => {
    const wrapper = editor()
    await wrapper.get('[name="completedAt"]').setValue('2026-01-01T12:00:00')
    await wrapper.get('[name="duration"]').setValue(30)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(createManualSession).toHaveBeenCalledWith({
      taskId: null, skillId: null, duration: 30,
      completedAt: new Date('2026-01-01T12:00:00').toISOString(),
    })
    expect(wrapper.emitted('saved')?.[0]).toEqual([manual])
  })

  it('supports skill-only assignments and derives the skill when selecting a task', async () => {
    const wrapper = editor()
    await wrapper.get('[name="skillId"]').setValue('4')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(createManualSession).toHaveBeenLastCalledWith(expect.objectContaining({ taskId: null, skillId: 4 }))
    await wrapper.get('[name="taskId"]').setValue('12')
    expect(wrapper.get('[name="skillId"]').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(createManualSession).toHaveBeenLastCalledWith(expect.objectContaining({ taskId: 12, skillId: 4 }))
  })

  it.each([0, -2, 1.5, ''])('rejects invalid duration %s before sending a request', async duration => {
    const wrapper = editor()
    await wrapper.get('[name="duration"]').setValue(duration)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('positive whole number')
    expect(createManualSession).not.toHaveBeenCalled()
  })

  it('rejects missing dates and future timestamps', async () => {
    const wrapper = editor()
    await wrapper.get('[name="completedAt"]').setValue('')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('valid completion')
    await wrapper.get('[name="completedAt"]').setValue('2099-01-01T12:00:00')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('future')
    expect(createManualSession).not.toHaveBeenCalled()
  })

  it('edits an existing timer without sending type or completionId changes', async () => {
    const wrapper = editor({ ...manual, type: 'timer', completionId: 'preserved-id' })
    await wrapper.get('[name="duration"]').setValue(45)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(editSession).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 45 }))
    const details = vi.mocked(editSession).mock.calls[0]?.[1]
    expect(details).not.toHaveProperty('type')
    expect(details).not.toHaveProperty('completionId')
    expect(createManualSession).not.toHaveBeenCalled()
  })

  it('retains form values and shows server failures without emitting success', async () => {
    vi.mocked(createManualSession).mockRejectedValue(new Error('Task no longer exists'))
    const wrapper = editor()
    await wrapper.get('[name="duration"]').setValue(45)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Task no longer exists')
    expect((wrapper.get('[name="duration"]').element as HTMLInputElement).value).toBe('45')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('blocks duplicate submits while saving', async () => {
    let finish!: (session: PomodoroLog) => void
    vi.mocked(createManualSession).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const wrapper = editor()
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    expect(createManualSession).toHaveBeenCalledTimes(1)
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    finish(manual)
    await flushPromises()
  })
})

describe('session history and analytics refresh', () => {
  async function analytics() {
    const wrapper = mount(AnalyticsView)
    wrappers.push(wrapper)
    await flushPromises()
    return wrapper
  }

  it('refreshes displayed records and totals after a manual save and an edit', async () => {
    const wrapper = await analytics()
    await wrapper.findAll('button').find(button => button.text() === 'Add manual session')!.trigger('click')
    vi.mocked(fetchPomodoros).mockResolvedValue({ items: [manual], hasMore: false, nextCursor: null, limit: 25 })
    vi.mocked(fetchAnalytics).mockResolvedValue({ totalPomodoros: 1, totalMinutes: 30, totalTasks: 1 })
    await wrapper.getComponent(SessionEditor).get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('tbody').text()).toContain('manual')
    expect(wrapper.find('.analytics-summary').text()).toContain('30 min')
    await wrapper.findAll('button').find(button => button.text() === 'Edit')!.trigger('click')
    await wrapper.getComponent(SessionEditor).get('[name="duration"]').setValue(45)
    vi.mocked(fetchPomodoros).mockResolvedValue({ items: [{ ...manual, duration: 45 }], hasMore: false, nextCursor: null, limit: 25 })
    vi.mocked(fetchAnalytics).mockResolvedValue({ totalPomodoros: 1, totalMinutes: 45, totalTasks: 1 })
    await wrapper.getComponent(SessionEditor).get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('tbody').text()).toContain('45 min')
    expect(wrapper.find('.analytics-summary').text()).toContain('45 min')
    expect(fetchPomodoros).toHaveBeenCalledTimes(3)
    expect(fetchAnalytics).toHaveBeenCalledTimes(3)
  })

  it('separates successful persistence from failed reporting refresh', async () => {
    const wrapper = await analytics()
    await wrapper.findAll('button').find(button => button.text() === 'Add manual session')!.trigger('click')
    vi.mocked(fetchPomodoros).mockRejectedValue(new Error('History unavailable'))
    await wrapper.getComponent(SessionEditor).get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('Session saved, but')
    expect(wrapper.get('[role="alert"]').text()).toContain('History unavailable')
    expect(wrapper.text()).toContain('Retry loading')
    expect(wrapper.findComponent(SessionEditor).exists()).toBe(false)
    expect(createManualSession).toHaveBeenCalledTimes(1)
  })

  it('browses older/newer pages without changing complete skill aggregates', async () => {
    vi.mocked(fetchPomodoros).mockResolvedValueOnce({
      items: [{ ...manual, taskName: 'Latest session' }], hasMore: true, nextCursor: 'older-cursor', limit: 25,
    })
    vi.mocked(fetchAnalytics).mockResolvedValue({
      totalPomodoros: 235, totalMinutes: 235, totalTasks: 1,
      breakdown: [{ skillId: 4, minutes: 235, pomodoros: 235, todayMinutes: 140, weekMinutes: 200, yearMinutes: 235 }],
    })
    const wrapper = await analytics()
    vi.mocked(fetchPomodoros).mockResolvedValueOnce({
      items: [{ ...manual, id: 2, taskName: 'Older session' }], hasMore: false, nextCursor: null, limit: 25,
    })
    await wrapper.findAll('button').find(button => button.text() === 'Older sessions')!.trigger('click')
    await flushPromises()
    expect(fetchPomodoros).toHaveBeenLastCalledWith({ limit: 25, cursor: 'older-cursor' })
    expect(wrapper.find('tbody').text()).toContain('Older session')
    expect(wrapper.text()).toContain('Page 2')
    expect(wrapper.find('.skill-metrics').text()).toContain('235 min')
    expect(wrapper.find('.skill-periods').text()).toContain('140')
    expect(wrapper.findAll('button').find(button => button.text() === 'Older sessions')!.attributes('disabled')).toBeDefined()
    vi.mocked(fetchPomodoros).mockResolvedValueOnce({
      items: [manual], hasMore: true, nextCursor: 'older-cursor', limit: 25,
    })
    await wrapper.findAll('button').find(button => button.text() === 'Newer sessions')!.trigger('click')
    await flushPromises()
    expect(fetchPomodoros).toHaveBeenLastCalledWith({ limit: 25, cursor: undefined })
    expect(wrapper.text()).toContain('Page 1')
    expect(fetchAnalytics).toHaveBeenCalledTimes(1)
  })

  it('shows loading and errors, preserves the current page and retries failed navigation', async () => {
    vi.mocked(fetchPomodoros).mockResolvedValueOnce({
      items: [manual], hasMore: true, nextCursor: 'cursor', limit: 25,
    })
    const wrapper = await analytics()
    let rejectPage!: (error: Error) => void
    vi.mocked(fetchPomodoros).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectPage = reject }))
    await wrapper.findAll('button').find(button => button.text() === 'Older sessions')!.trigger('click')
    expect(wrapper.text()).toContain('Loading sessions...')
    expect(wrapper.findAll('button').find(button => button.text() === 'Older sessions')!.attributes('disabled')).toBeDefined()
    rejectPage(new Error('History unavailable'))
    await flushPromises()
    expect(wrapper.find('tbody').text()).toContain('30 min')
    expect(wrapper.get('[role="alert"]').text()).toContain('History unavailable')
    vi.mocked(fetchPomodoros).mockResolvedValueOnce({ items: [], hasMore: false, nextCursor: null, limit: 25 })
    await wrapper.findAll('button').find(button => button.text() === 'Retry history')!.trigger('click')
    await flushPromises()
    expect(fetchPomodoros).toHaveBeenLastCalledWith({ limit: 25, cursor: 'cursor' })
    expect(wrapper.text()).toContain('Page 2')
    expect(wrapper.text()).toContain('No sessions match these dates.')
  })

  it('applies inclusive date filters to history and aggregates and resets navigation', async () => {
    const wrapper = await analytics()
    await wrapper.get('[name="start"]').setValue('2026-01-01')
    await wrapper.get('[name="end"]').setValue('2026-01-31')
    await wrapper.get('.history-filters').trigger('submit')
    await flushPromises()
    expect(fetchPomodoros).toHaveBeenLastCalledWith({
      start: '2026-01-01', end: '2026-01-31', limit: 25, cursor: undefined,
    })
    expect(fetchAnalytics).toHaveBeenLastCalledWith({ start: '2026-01-01', end: '2026-01-31' })
    await wrapper.findAll('button').find(button => button.text() === 'All dates')!.trigger('click')
    await flushPromises()
    expect(fetchPomodoros).toHaveBeenLastCalledWith({ start: undefined, end: undefined, limit: 25, cursor: undefined })
  })

  it('rejects reversed dates without requesting another page', async () => {
    const wrapper = await analytics()
    await wrapper.get('[name="start"]').setValue('2026-02-01')
    await wrapper.get('[name="end"]').setValue('2026-01-01')
    await wrapper.get('.history-filters').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('Start date')
    expect(fetchPomodoros).toHaveBeenCalledTimes(1)
  })
})
