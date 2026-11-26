// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AnalyticsView from '../src/views/AnalyticsView.vue'
import { fetchAnalytics, fetchPomodoros, fetchSkills, fetchTasks, type AnalyticsSummary } from '../src/services/service'

vi.mock('../src/services/service', () => ({
  fetchAnalytics: vi.fn(), fetchPomodoros: vi.fn(), fetchSkills: vi.fn(), fetchTasks: vi.fn(),
  createManualSession: vi.fn(), editSession: vi.fn(),
}))
const current: AnalyticsSummary = {
  totalPomodoros: 3, totalMinutes: 60, totalTasks: 1,
  breakdown: [{ skillId: 1, minutes: 60, pomodoros: 3 }],
}
const wrappers: ReturnType<typeof mount>[] = []
async function render() {
  const wrapper = mount(AnalyticsView)
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  vi.mocked(fetchAnalytics).mockResolvedValue(current)
  vi.mocked(fetchPomodoros).mockResolvedValue({ items: [], limit: 25, hasMore: false, nextCursor: null })
  vi.mocked(fetchTasks).mockResolvedValue([])
  vi.mocked(fetchSkills).mockResolvedValue([{ id: 1, name: 'Coding' }, { id: 2, name: 'Languages' }])
})
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  wrappers.length = 0
  vi.useRealTimers()
})
async function customRange(wrapper: ReturnType<typeof mount>) {
  // Each committed date auto-applies and briefly disables the form, so settle between edits.
  await wrapper.get('[name="start"]').setValue('2026-01-08')
  await flushPromises()
  await wrapper.get('[name="end"]').setValue('2026-01-14')
  await flushPromises()
}
describe('analytics periods', () => {
  it('shows task and session counts for the same selected period as minutes', async () => {
    vi.mocked(fetchAnalytics).mockResolvedValue({
      totalPomodoros: 4, totalMinutes: 28,
      breakdown: [{
        skillId: 1, todayTasks: 1, todayPomodoros: 1, todayMinutes: 3,
        weekTasks: 2, weekPomodoros: 3, weekMinutes: 15,
        yearTasks: 2, yearPomodoros: 4, yearMinutes: 28,
      }],
    })
    const wrapper = await render()
    const stats = () => wrapper.find('.skill-stats').text()
    expect(stats()).toContain('1 task')
    expect(stats()).toContain('1 session')
    expect(stats()).toContain('3 mins')
    await wrapper.findAll('button').find(button => button.text() === 'this week')!.trigger('click')
    expect(stats()).toContain('2 tasks')
    expect(stats()).toContain('3 sessions')
    expect(stats()).toContain('15 mins')
    await wrapper.findAll('button').find(button => button.text() === 'this year')!.trigger('click')
    expect(stats()).toContain('2 tasks')
    expect(stats()).toContain('4 sessions')
    expect(stats()).toContain('28 mins')
  })

  it('hides the date filters until Filter is toggled, keeping applied dates intact', async () => {
    const wrapper = await render()
    const filters = wrapper.get('.history-filters')
    const toggle = wrapper.get('.filter-toggle')
    // jsdom has no layout engine, so check the v-show inline style directly.
    const filtersHidden = () => (filters.attributes('style') ?? '').includes('display: none')
    expect(filtersHidden()).toBe(true)
    expect(toggle.text()).toBe('Filter')
    await toggle.trigger('click')
    expect(filtersHidden()).toBe(false)
    expect(toggle.text()).toBe('Hide filter')
    await customRange(wrapper)
    await toggle.trigger('click')
    expect(filtersHidden()).toBe(true)
    // The applied range still filters history and is flagged on the button.
    expect(toggle.text()).toContain('Filter ●')
    expect(fetchPomodoros).toHaveBeenLastCalledWith(expect.objectContaining({ start: '2026-01-08', end: '2026-01-14' }))
  })
  it('applies presets to all reports and supports custom dates', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-06T10:00:00Z'))
    const wrapper = await render()
    await wrapper.get('[name="period"]').setValue('last7')
    await flushPromises()
    expect(fetchAnalytics).toHaveBeenLastCalledWith({ start: '2026-10-31', end: '2026-11-06' })
    expect(fetchPomodoros).toHaveBeenLastCalledWith(expect.objectContaining({ start: '2026-10-31', end: '2026-11-06' }))
    expect((wrapper.get('[name="start"]').element as HTMLInputElement).value).toBe('2026-10-31')
    expect((wrapper.get('[name="end"]').element as HTMLInputElement).value).toBe('2026-11-06')
    await customRange(wrapper)
    expect(fetchAnalytics).toHaveBeenLastCalledWith({ start: '2026-01-08', end: '2026-01-14' })
    expect((wrapper.get('[name="period"]').element as HTMLSelectElement).value).toBe('custom')
  })
  it('shows zero totals for an empty range', async () => {
    vi.mocked(fetchAnalytics).mockResolvedValue({ totalPomodoros: 0, totalMinutes: 0, breakdown: [] })
    const wrapper = await render()
    await customRange(wrapper)
    expect(wrapper.text()).toContain('No sessions in the selected range. Totals are zero.')
  })
  it('shows current analytics errors without falsely displaying zero totals for a new range', async () => {
    const wrapper = await render()
    await wrapper.get('[name="start"]').setValue('2026-01-08')
    await flushPromises()
    vi.mocked(fetchAnalytics).mockRejectedValueOnce(new Error('Analytics unavailable'))
    await wrapper.get('[name="end"]').setValue('2026-01-14')
    await flushPromises()
    expect(wrapper.find('.analytics-summary').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('Analytics unavailable')
    await wrapper.findAll('button').find(button => button.text() === 'Retry loading')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('.analytics-summary').text()).toContain('60 min')
  })
})
