// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AnalyticsView from '../src/views/AnalyticsView.vue'
import { exportHistory, fetchAnalytics, fetchPomodoros, fetchSkills, fetchTasks } from '../src/services/service'
import { downloadHistory } from '../src/services/historyDownload'

vi.mock('../src/services/service', () => ({
  exportHistory: vi.fn(), fetchAnalytics: vi.fn(), fetchPomodoros: vi.fn(), fetchSkills: vi.fn(), fetchTasks: vi.fn(),
  createManualSession: vi.fn(), editSession: vi.fn(),
}))
vi.mock('../src/services/historyDownload', () => ({ downloadHistory: vi.fn() }))
const wrappers: ReturnType<typeof mount>[] = []
async function render() {
  const wrapper = mount(AnalyticsView)
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
function exportButton(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('button').find(button => ['Export CSV', 'Exporting...'].includes(button.text()))!
}
beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  vi.mocked(fetchAnalytics).mockResolvedValue({ totalPomodoros: 145, totalMinutes: 145 })
  vi.mocked(fetchSkills).mockResolvedValue([])
  vi.mocked(fetchTasks).mockResolvedValue([])
  vi.mocked(fetchPomodoros).mockResolvedValue({ items: [], hasMore: true, nextCursor: 'older', limit: 25 })
})
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  wrappers.length = 0
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
describe('CSV history export UI', () => {
  it('exports the applied range across older pages, not draft dates or cursors', async () => {
    const wrapper = await render()
    await wrapper.get('[name="start"]').setValue('2026-01-01')
    await wrapper.get('[name="end"]').setValue('2026-01-31')
    await wrapper.get('.history-filters').trigger('submit')
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === 'Older sessions')!.trigger('click')
    await flushPromises()
    await wrapper.get('[name="start"]').setValue('2025-01-01')
    const csv = new Blob(['all 145 records'], { type: 'text/csv' })
    vi.mocked(exportHistory).mockResolvedValueOnce(csv)
    await exportButton(wrapper).trigger('click')
    await flushPromises()
    expect(exportHistory).toHaveBeenCalledWith({ start: '2026-01-01', end: '2026-01-31' })
    expect(downloadHistory).toHaveBeenCalledWith(csv, { start: '2026-01-01', end: '2026-01-31' })
    expect(wrapper.text()).toContain('CSV download started for all matching sessions')
    expect(fetchPomodoros).toHaveBeenCalledTimes(3)
  })
  it('shows progress, prevents double exports and explains empty results', async () => {
    const wrapper = await render()
    let finish!: (csv: Blob | null) => void
    vi.mocked(exportHistory).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await exportButton(wrapper).trigger('click')
    expect(wrapper.text()).toContain('Exporting all matching sessions')
    expect(exportButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.get('[name="period"]').attributes('disabled')).toBeDefined()
    finish(null)
    await flushPromises()
    expect(downloadHistory).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('No CSV file was created')
  })
  it('surfaces export/download failures and allows retry without changing totals', async () => {
    const wrapper = await render()
    vi.mocked(exportHistory).mockRejectedValueOnce(new Error('Export unavailable'))
    await exportButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Export unavailable')
    expect(wrapper.get('.analytics-summary').text()).toContain('145 min')
    vi.mocked(exportHistory).mockResolvedValue(new Blob(['history']))
    vi.mocked(downloadHistory).mockImplementationOnce(() => { throw new Error('Download unavailable') })
    await exportButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Download unavailable')
    await exportButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('CSV download started')
  })
})

describe('CSV service and download contracts', () => {
  it('requests the complete selected range, accepts empty responses and surfaces API errors', async () => {
    const actual = await vi.importActual<typeof import('../src/services/service')>('../src/services/service')
    const csv = new Blob(['complete export'], { type: 'text/csv' })
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, blob: async () => csv })
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Export failed.' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetch)
    expect(await actual.exportHistory({ start: '2026-01-01', end: '2026-01-31' })).toBe(csv)
    expect(fetch.mock.calls[0]?.[0]).toContain('/pomodoros/export?start=2026-01-01&end=2026-01-31')
    expect(fetch.mock.calls[0]?.[0]).not.toContain('cursor')
    expect(await actual.exportHistory()).toBeNull()
    await expect(actual.exportHistory()).rejects.toThrow('Export failed.')
  })
  it('uses the applied dates in the filename and cleans up even when clicking fails', async () => {
    const actual = await vi.importActual<typeof import('../src/services/historyDownload')>('../src/services/historyDownload')
    const create = vi.fn().mockReturnValue('blob:export')
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
    let filename = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { filename = this.download })
    const csv = new Blob(['history'])
    actual.downloadHistory(csv, { start: '2026-01-01', end: '2026-01-31' })
    expect(filename).toBe('tasko-sessions_2026-01-01_2026-01-31.csv')
    expect(revoke).toHaveBeenCalledWith('blob:export')
    expect(document.querySelector('a[download]')).toBeNull()
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(() => { throw new Error('Download blocked') })
    expect(() => actual.downloadHistory(csv, {})).toThrow('Download blocked')
    expect(revoke).toHaveBeenCalledTimes(2)
    expect(document.querySelector('a[download]')).toBeNull()
  })
})
