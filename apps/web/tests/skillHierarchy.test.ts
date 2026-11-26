// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SkillsView from '../src/views/SkillsView.vue'
import TasksView from '../src/views/TasksView.vue'
import SessionEditor from '../src/components/SessionEditor.vue'
import CustomSelect from '../src/components/CustomSelect.vue'
import { useSkillStore } from '../src/stores/skillStore'
import { skillLabel } from '../src/services/skillLabels'
import * as service from '../src/services/service'

vi.mock('../src/services/service', () => ({
  fetchSkills: vi.fn(), createSkill: vi.fn(), updateSkill: vi.fn(), deleteSkill: vi.fn(),
  updateSkillMinutes: vi.fn(), fetchTasks: vi.fn(), createTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(),
  createManualSession: vi.fn(), editSession: vi.fn(),
}))
const skills = [
  { id: 1, name: 'Languages', parentId: null },
  { id: 2, name: 'French', parentId: 1, parentName: 'Languages' },
  { id: 3, name: 'Coding', parentId: null },
]
const tasks = [{ id: 4, name: 'Practice', skillId: 2 }]
const wrappers: ReturnType<typeof mount>[] = []
function render(component: typeof SkillsView | typeof TasksView) {
  const wrapper = mount(component)
  wrappers.push(wrapper)
  return wrapper
}
function button(wrapper: ReturnType<typeof mount>, text: string) {
  const result = wrapper.findAll('button').find(item => item.text() === text)
  if (!result) throw new Error(`Button not found: ${text}`)
  return result
}
beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  vi.mocked(service.fetchSkills).mockResolvedValue(skills.map(skill => ({ ...skill })))
  vi.mocked(service.fetchTasks).mockResolvedValue(tasks.map(task => ({ ...task })))
})
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  wrappers.length = 0
  vi.unstubAllGlobals()
})

describe('hierarchical skill controls', () => {
  it('groups standalone skills and sub-skills and blocks deleting parents', async () => {
    const wrapper = render(SkillsView)
    await flushPromises()
    expect(wrapper.text()).toContain('Languages / French')
    expect(wrapper.text()).toContain('Standalone skill')
    const deletes = wrapper.findAll('button').filter(item => item.text() === 'Delete')
    expect(deletes[0]?.attributes('disabled')).toBeDefined()
    expect(deletes[1]?.attributes('disabled')).toBeUndefined()
  })
  it('creates a child and clears the form only after success', async () => {
    const wrapper = render(SkillsView)
    await flushPromises()
    const scrollIntoView = vi.fn()
    Object.defineProperty(wrapper.get('form').element, 'scrollIntoView', { value: scrollIntoView })
    await button(wrapper, 'Add sub-skill').trigger('click')
    await wrapper.get('[name="skillName"]').setValue('Spanish')
    vi.mocked(service.createSkill).mockResolvedValue({ id: 5, name: 'Spanish', parentId: 1, parentName: 'Languages' })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(service.createSkill).toHaveBeenCalledWith('Spanish', 1)
    expect(wrapper.text()).toContain('Languages / Spanish')
    expect((wrapper.get('[name="skillName"]').element as HTMLInputElement).value).toBe('')
  })
  it('focuses and scrolls to the add form with the selected parent when adding a sub-skill', async () => {
    const wrapper = mount(SkillsView, { attachTo: document.body })
    wrappers.push(wrapper)
    await flushPromises()
    const form = wrapper.get('form')
    const scrollIntoView = vi.fn()
    Object.defineProperty(form.element, 'scrollIntoView', { value: scrollIntoView })
    await wrapper.get('[name="skillName"]').setValue('Old draft')
    const addButtons = wrapper.findAll('button').filter(item => item.text() === 'Add sub-skill')
    await addButtons[1]!.trigger('click')
    expect(document.activeElement).toBe(wrapper.get('[name="skillName"]').element)
    expect((wrapper.get('[name="skillName"]').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('[name="parentId"]').element as HTMLSelectElement).value).toBe('3')
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
  })
  it('retains the form and list after a failed save or deletion', async () => {
    const wrapper = render(SkillsView)
    await flushPromises()
    await wrapper.get('[name="skillName"]').setValue('Spanish')
    vi.mocked(service.createSkill).mockRejectedValue(new Error('Name already exists.'))
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Name already exists.')
    expect((wrapper.get('[name="skillName"]').element as HTMLInputElement).value).toBe('Spanish')
    vi.mocked(service.deleteSkill).mockRejectedValue(new Error('Unable to delete skill.'))
    const deletes = wrapper.findAll('button').filter(item => item.text() === 'Delete')
    await deletes[1]!.trigger('click')
    await flushPromises()
    expect(useSkillStore().skills).toHaveLength(3)
    expect(wrapper.get('[role="alert"]').text()).toContain('Unable to delete skill.')
  })
  it('edits and promotes a child, while preserving state on failed moves', async () => {
    const wrapper = render(SkillsView)
    await flushPromises()
    await wrapper.get('[name="skillName"]').setValue('Draft new skill')
    await button(wrapper, 'Edit / move').trigger('click')
    const form = wrapper.get('.skill-edit')
    expect(form.element.closest('li')?.parentElement?.getAttribute('aria-label')).toBe('Sub-skills')
    expect((form.get('[name="editSkillName"]').element as HTMLInputElement).value).toBe('French')
    expect((wrapper.get('[name="skillName"]').element as HTMLInputElement).value).toBe('Draft new skill')
    await form.get('[name="editParentId"]').setValue('3')
    vi.mocked(service.updateSkill).mockRejectedValueOnce(new Error('Parent unavailable.'))
    await form.trigger('submit')
    await flushPromises()
    expect(form.get('[role="alert"]').text()).toContain('Parent unavailable.')
    expect((form.get('[name="editParentId"]').element as HTMLSelectElement).value).toBe('3')
    expect(useSkillStore().skills[1]?.parentId).toBe(1)
    await form.get('[name="editParentId"]').setValue('')
    vi.mocked(service.updateSkill).mockResolvedValue({ id: 2, name: 'French', parentId: null, parentName: null })
    await form.trigger('submit')
    await flushPromises()
    expect(service.updateSkill).toHaveBeenLastCalledWith(2, 'French', null)
    expect(useSkillStore().skills[1]?.parentId).toBeNull()
    expect(wrapper.find('.skill-edit').exists()).toBe(false)
    expect((wrapper.get('[name="skillName"]').element as HTMLInputElement).value).toBe('Draft new skill')
  })
  it('edits a parent in its card, prevents moving parents with children and cancels without saving', async () => {
    const wrapper = render(SkillsView)
    await flushPromises()
    await button(wrapper, 'Edit').trigger('click')
    const form = wrapper.get('.skill-edit')
    expect((form.get('[name="editSkillName"]').element as HTMLInputElement).value).toBe('Languages')
    expect(form.get('[name="editParentId"]').attributes('disabled')).toBeDefined()
    expect(form.text()).toContain('Move or promote the sub-skills')
    await form.get('[name="editSkillName"]').setValue('  ')
    await form.trigger('submit')
    expect(form.get('[role="alert"]').text()).toContain('Enter a skill name')
    expect(service.updateSkill).not.toHaveBeenCalled()
    await form.get('[name="editSkillName"]').setValue('Speech')
    await button(wrapper, 'Cancel').trigger('click')
    expect(wrapper.find('.skill-edit').exists()).toBe(false)
    expect(wrapper.text()).toContain('Languages / French')
    expect(service.updateSkill).not.toHaveBeenCalled()
  })
  it('saves a renamed parent in its card and updates child labels', async () => {
    const wrapper = render(SkillsView)
    await flushPromises()
    await button(wrapper, 'Edit').trigger('click')
    const form = wrapper.get('.skill-edit')
    await form.get('[name="editSkillName"]').setValue('  Speech  ')
    vi.mocked(service.updateSkill).mockResolvedValue({ id: 1, name: 'Speech', parentId: null })
    await form.trigger('submit')
    await flushPromises()
    expect(service.updateSkill).toHaveBeenCalledWith(1, 'Speech', null)
    expect(wrapper.text()).toContain('Speech / French')
    expect(wrapper.find('.skill-edit').exists()).toBe(false)
  })
  it('surfaces load errors with retry and uses current parent names after rename', async () => {
    vi.mocked(service.fetchSkills).mockRejectedValueOnce(new Error('Connection lost.'))
    const wrapper = render(SkillsView)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Connection lost.')
    await button(wrapper, 'Retry loading').trigger('click')
    await flushPromises()
    const store = useSkillStore()
    vi.mocked(service.updateSkill).mockResolvedValue({ id: 1, name: 'Speech', parentId: null })
    await store.updateSkill({ id: 1, name: 'Speech' })
    expect(skillLabel(store.skills[1]!, store.skills)).toBe('Speech / French')
  })
})

describe('skill assignment labels', () => {
  it('allows a task to select a sub-skill and edit its assignment', async () => {
    const wrapper = render(TasksView)
    await flushPromises()
    const select = wrapper.findComponent(CustomSelect)
    expect(select.props('options')).toEqual(expect.arrayContaining([
      { value: 2, label: 'Languages / French' }, { value: 3, label: 'Coding' },
    ]))
    expect(wrapper.text()).toContain('Practice (Languages / French)')
    await wrapper.get('input').setValue('Read')
    select.vm.$emit('update:modelValue', 2)
    vi.mocked(service.createTask).mockResolvedValue({ id: 5, name: 'Read', skillId: 2 })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(service.createTask).toHaveBeenCalledWith('Read', 2)
    await wrapper.get('.details input').setValue('Draft task')
    await button(wrapper, 'Edit').trigger('click')
    const form = wrapper.get('.task-edit')
    expect(form.element.closest('.task-item')).not.toBeNull()
    expect((form.get('[name="editTaskName"]').element as HTMLInputElement).value).toBe('Practice')
    form.getComponent(CustomSelect).vm.$emit('update:modelValue', 3)
    vi.mocked(service.updateTask).mockResolvedValue({ id: 4, name: 'Practice', skillId: 3 })
    await form.trigger('submit')
    await flushPromises()
    expect(service.updateTask).toHaveBeenCalledWith(4, expect.objectContaining({ skillId: 3 }))
    expect(wrapper.text()).toContain('Practice (Coding)')
    expect(wrapper.find('.task-edit').exists()).toBe(false)
    expect((wrapper.get('.details input').element as HTMLInputElement).value).toBe('Draft task')
  })
  it('keeps task edit input on save failure and cancels without changing the saved task', async () => {
    const wrapper = render(TasksView)
    await flushPromises()
    await button(wrapper, 'Edit').trigger('click')
    const form = wrapper.get('.task-edit')
    await form.get('input').setValue('Renamed task')
    vi.mocked(service.updateTask).mockRejectedValueOnce(new Error('Could not update task.'))
    await form.trigger('submit')
    await flushPromises()
    expect(form.get('[role="alert"]').text()).toContain('Could not update task.')
    expect((form.get('input').element as HTMLInputElement).value).toBe('Renamed task')
    await button(wrapper, 'Cancel').trigger('click')
    expect(wrapper.find('.task-edit').exists()).toBe(false)
    expect(wrapper.text()).toContain('Practice (Languages / French)')
    expect(service.updateTask).toHaveBeenCalledTimes(1)
  })
  it('validates task edits in the card before saving', async () => {
    const wrapper = render(TasksView)
    await flushPromises()
    await button(wrapper, 'Edit').trigger('click')
    const form = wrapper.get('.task-edit')
    await form.get('input').setValue('  ')
    await form.trigger('submit')
    expect(form.get('[role="alert"]').text()).toContain('Enter a task name.')
    await form.get('input').setValue('  Read  ')
    form.getComponent(CustomSelect).vm.$emit('update:modelValue', null)
    await form.trigger('submit')
    expect(form.get('[role="alert"]').text()).toContain('Choose a skill')
    expect(service.updateTask).not.toHaveBeenCalled()
    form.getComponent(CustomSelect).vm.$emit('update:modelValue', 2)
    vi.mocked(service.updateTask).mockResolvedValue({ id: 4, name: 'Read', skillId: 2 })
    await form.trigger('submit')
    await flushPromises()
    expect(service.updateTask).toHaveBeenCalledWith(4, { id: 4, name: 'Read', skillId: 2 })
    expect(wrapper.text()).toContain('Read (Languages / French)')
  })

  describe('skill service request contracts', () => {
    it('sends standalone creation and explicit parent promotion without changing omitted parents', async () => {
      const actual = await vi.importActual<typeof service>('../src/services/service')
      const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(skills[0]), {
        headers: { 'Content-Type': 'application/json' },
      })))
      vi.stubGlobal('fetch', fetch)
      await actual.createSkill('Languages')
      await actual.updateSkill(2, 'French')
      await actual.updateSkill(2, 'French', null)
      expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ name: 'Languages', parentId: null })
      expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({ name: 'French' })
      expect(JSON.parse(fetch.mock.calls[2]![1].body)).toEqual({ name: 'French', parentId: null })
    })
    it('shows the actionable deletion error and handles empty successful responses', async () => {
      const actual = await vi.importActual<typeof service>('../src/services/service')
      const fetch = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Move sub-skills before deleting their parent.' }), {
          status: 409, headers: { 'Content-Type': 'application/json' },
        }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
      vi.stubGlobal('fetch', fetch)
      await expect(actual.deleteSkill(1)).rejects.toThrow('Move sub-skills before deleting their parent.')
      await expect(actual.deleteSkill(2)).resolves.toBeUndefined()
    })
  })
  it('shows full skill paths in manual task/skill selectors and preserves historical display', () => {
    const wrapper = mount(SessionEditor, { props: {
      skills, tasks, session: {
        id: 8, taskId: null, skillId: null, skillName: 'French', skillPath: 'Former parent / French',
        type: 'manual', duration: 25, completedAt: '2026-01-01T12:00:00Z',
      },
    } })
    wrappers.push(wrapper)
    expect(wrapper.get('[name="taskId"]').text()).toContain('Practice (Languages / French)')
    expect(wrapper.get('[name="skillId"]').text()).toContain('Languages / French')
    expect(wrapper.text()).toContain('Recorded skill: Former parent / French')
  })
})
