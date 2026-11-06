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
const previous: AnalyticsSummary = {
  totalPomodoros: 1, totalMinutes: 20, totalTasks: 1,
  breakdown: [{ skillId: 1, minutes: 20, pomodoros: 1 }],
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
  await wrapper.get('[name="start"]').setValue('2026-01-08')
  await wrapper.get('[name="end"]').setValue('2026-01-14')
  await wrapper.get('.history-filters').trigger('submit')
  await flushPromises()
}
describe('analytics period selection and comparisons', () => {
  it('applies presets to all reports, shows dates and supports custom ranges', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-06T10:00:00Z'))
    const wrapper = await render()
    await wrapper.get('[name="period"]').setValue('last7')
    await flushPromises()
    expect(fetchAnalytics).toHaveBeenLastCalledWith({ start: '2026-10-31', end: '2026-11-06' })
    expect(fetchPomodoros).toHaveBeenLastCalledWith(expect.objectContaining({ start: '2026-10-31', end: '2026-11-06' }))
    expect(wrapper.text()).toContain('2026-10-31 to 2026-11-06')
    await customRange(wrapper)
    expect(fetchAnalytics).toHaveBeenLastCalledWith({ start: '2026-01-08', end: '2026-01-14' })
    expect((wrapper.get('[name="period"]').element as HTMLSelectElement).value).toBe('custom')
  })
  it('compares totals and per-skill activity without replacing current totals or history', async () => {
    const wrapper = await render()
    await customRange(wrapper)
    vi.mocked(fetchAnalytics).mockResolvedValueOnce(previous)
    await wrapper.get('[name="compare"]').setValue(true)
    await flushPromises()
    expect(fetchAnalytics).toHaveBeenLastCalledWith({ start: '2026-01-01', end: '2026-01-07' })
    expect(wrapper.get('.comparison').text()).toContain('2026-01-01 to 2026-01-07')
    expect(wrapper.get('.comparison').text()).toContain('+40 min (+200%)')
    expect(wrapper.get('.skill-comparison').text()).toContain('Prior: 20 min / 1 sessions')
    expect(wrapper.get('.analytics-summary').text()).toContain('60 min')
    expect(wrapper.findAll('.skill-comparison')[1]?.text()).toContain('No sessions in either period')
    expect(fetchPomodoros).toHaveBeenCalledTimes(2)
  })
  it('explains unbounded periods and empty or zero comparison history', async () => {
    const wrapper = await render()
    await wrapper.get('[name="compare"]').setValue(true)
    expect(wrapper.text()).toContain('Choose both a start and end date')
    expect(fetchAnalytics).toHaveBeenCalledTimes(1)
    vi.mocked(fetchAnalytics).mockResolvedValue({ totalPomodoros: 0, totalMinutes: 0, breakdown: [] })
    await customRange(wrapper)
    expect(wrapper.text()).toContain('No sessions in the selected range. Totals are zero.')
    expect(wrapper.get('.comparison').text()).toContain('No sessions in either period')
    vi.mocked(fetchAnalytics).mockResolvedValueOnce(current).mockResolvedValueOnce({ totalPomodoros: 0, totalMinutes: 0 })
    await wrapper.get('.history-filters').trigger('submit')
    await flushPromises()
    expect(wrapper.get('.comparison').text()).toContain('no prior history (percentage unavailable)')
  })
  it('shows comparison loading and errors, with independent retry', async () => {
    const wrapper = await render()
    await customRange(wrapper)
    let reject!: (error: Error) => void
    vi.mocked(fetchAnalytics).mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
    await wrapper.get('[name="compare"]').setValue(true)
    expect(wrapper.text()).toContain('Loading prior period')
    reject(new Error('Prior period unavailable'))
    await flushPromises()
    expect(wrapper.get('.comparison [role="alert"]').text()).toContain('Prior period unavailable')
    expect(wrapper.get('.analytics-summary').text()).toContain('60 min')
    vi.mocked(fetchAnalytics).mockResolvedValueOnce(previous)
    await wrapper.get('.comparison button').trigger('click')
    await flushPromises()
    expect(wrapper.get('.comparison').text()).toContain('Prior time: 20 min')
  })
  it('ignores a stale prior response when comparison is disabled', async () => {
    const wrapper = await render()
    await customRange(wrapper)
    let finish!: (summary: AnalyticsSummary) => void
    vi.mocked(fetchAnalytics).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await wrapper.get('[name="compare"]').setValue(true)
    await wrapper.get('[name="compare"]').setValue(false)
    finish(previous)
    await flushPromises()
    expect(wrapper.find('.comparison').exists()).toBe(false)
  })
})
