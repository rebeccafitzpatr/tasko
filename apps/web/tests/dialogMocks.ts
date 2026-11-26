import { vi } from 'vitest'

export function mockDialogs() {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }) },
    close: { configurable: true, value: vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    }) },
  })
}
