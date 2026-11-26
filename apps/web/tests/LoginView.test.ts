// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LoginView from '../src/views/LoginView.vue'

const { login, register, push } = vi.hoisted(() => ({
  login: vi.fn(), register: vi.fn(), push: vi.fn(),
}))
vi.mock('../src/stores/authStore', () => ({ useAuthStore: () => ({ login, register }) }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }), useRouter: () => ({ push }),
}))

const wrappers: ReturnType<typeof mount>[] = []
function render() {
  const wrapper = mount(LoginView, { attachTo: document.body })
  wrappers.push(wrapper)
  return wrapper
}
async function startSignup(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('.switch-mode').trigger('click')
  await wrapper.get('[name="email"]').setValue('test@example.com')
  await wrapper.get('[name="password"]').setValue('password123')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}
beforeEach(() => vi.resetAllMocks())
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  wrappers.length = 0
})

describe('two-step account creation', () => {
  it('collects credentials before the display name and creates only on the final step', async () => {
    const wrapper = render()
    await startSignup(wrapper)
    expect(register).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Step 2 of 2')
    expect(wrapper.get('.step-header .back-button').text()).toBe('Back')
    expect(wrapper.get('.step-header .step-progress').text()).toBe('Step 2 of 2')
    expect(wrapper.get('form').classes()).toContain('display-name-step')
    expect(wrapper.find('[name="email"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[name="displayName"]').element)
    await wrapper.get('[name="displayName"]').setValue('  Learner  ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(register).toHaveBeenCalledWith('test@example.com', 'password123', 'Learner')
    expect(push).toHaveBeenCalledWith('/tasks')
  })

  it('preserves entries when going back and allows an omitted display name', async () => {
    const wrapper = render()
    await startSignup(wrapper)
    await wrapper.findAll('button').find(button => button.text() === 'Back')!.trigger('click')
    expect((wrapper.get('[name="email"]').element as HTMLInputElement).value).toBe('test@example.com')
    expect((wrapper.get('[name="password"]').element as HTMLInputElement).value).toBe('password123')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(register).toHaveBeenCalledWith('test@example.com', 'password123', null)
  })

  it('does not advance invalid credentials and resets the step when switching to login', async () => {
    const wrapper = render()
    await wrapper.get('.switch-mode').trigger('click')
    await wrapper.get('[name="email"]').setValue('invalid')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Step 1 of 2')
    await wrapper.get('[name="email"]').setValue('test@example.com')
    await wrapper.get('[name="password"]').setValue('short')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Step 1 of 2')
    await wrapper.get('[name="password"]').setValue('password123')
    await wrapper.get('form').trigger('submit')
    await wrapper.findAll('.switch-mode').find(button => button.text().includes('Already have'))!.trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(login).toHaveBeenCalledWith('test@example.com', 'password123')
    expect(register).not.toHaveBeenCalled()
  })

  it('keeps the final step and its input after a failed registration', async () => {
    const wrapper = render()
    await startSignup(wrapper)
    register.mockRejectedValueOnce(new Error('Email already registered.'))
    await wrapper.get('[name="displayName"]').setValue('Learner')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Email already registered.')
    expect((wrapper.get('[name="displayName"]').element as HTMLInputElement).value).toBe('Learner')
    expect(push).not.toHaveBeenCalled()
  })
})
