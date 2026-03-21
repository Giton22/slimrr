import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const updateServiceWorkerMock = vi.fn()
const useRegisterSWMock = vi.fn()

vi.mock('virtual:pwa-register/vue', () => ({
  useRegisterSW: (options?: unknown) => useRegisterSWMock(options),
}))

import { setupPwaUpdateChecks, usePwaUpdate } from '@/composables/usePwaUpdate'

function createFakeWindow() {
  const fakeWindow = new EventTarget() as EventTarget & typeof globalThis

  fakeWindow.setTimeout = globalThis.setTimeout.bind(globalThis)
  fakeWindow.clearTimeout = globalThis.clearTimeout.bind(globalThis)
  fakeWindow.setInterval = globalThis.setInterval.bind(globalThis)
  fakeWindow.clearInterval = globalThis.clearInterval.bind(globalThis)

  return fakeWindow
}

function createFakeDocument() {
  const fakeDocument = new EventTarget() as EventTarget & Document

  Object.defineProperty(fakeDocument, 'visibilityState', {
    configurable: true,
    value: 'visible',
    writable: true,
  })

  return fakeDocument
}

function createRegistration() {
  const update = vi.fn().mockResolvedValue(undefined)
  const registration = {
    installing: null,
    update,
  } as unknown as ServiceWorkerRegistration

  return { registration, update }
}

describe('usePwaUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', createFakeWindow())
    vi.stubGlobal('document', createFakeDocument())
    vi.stubGlobal('navigator', { onLine: true })
    updateServiceWorkerMock.mockReset()
    useRegisterSWMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('schedules an initial update check and recurring polling', async () => {
    const { registration, update } = createRegistration()
    const cleanup = setupPwaUpdateChecks(registration)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(update).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5 * 60 * 1_000)
    expect(update).toHaveBeenCalledTimes(2)

    cleanup()
  })

  it('does not update while offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })

    const { registration, update } = createRegistration()
    const cleanup = setupPwaUpdateChecks(registration)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(update).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('focus'))
    expect(update).not.toHaveBeenCalled()

    cleanup()
  })

  it('does not update while a new service worker is installing', async () => {
    const { update } = createRegistration()
    const installingRegistration = {
      installing: {} as ServiceWorker,
      update,
    } as unknown as ServiceWorkerRegistration

    const cleanup = setupPwaUpdateChecks(installingRegistration)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(update).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('focus'))
    expect(update).not.toHaveBeenCalled()

    cleanup()
  })

  it('checks for updates when the window regains focus', () => {
    const { registration, update } = createRegistration()
    const cleanup = setupPwaUpdateChecks(registration)

    window.dispatchEvent(new Event('focus'))
    expect(update).toHaveBeenCalledTimes(1)

    cleanup()
  })

  it('checks for updates when the document becomes visible', () => {
    const { registration, update } = createRegistration()
    const cleanup = setupPwaUpdateChecks(registration)

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
      writable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(update).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
      writable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(update).toHaveBeenCalledTimes(1)

    cleanup()
  })

  it('calls updateServiceWorker and explicitly reloads the page', async () => {
    updateServiceWorkerMock.mockResolvedValue(undefined)
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadMock },
    })

    useRegisterSWMock.mockReturnValue({
      needRefresh: ref(true),
      offlineReady: ref(false),
      updateServiceWorker: updateServiceWorkerMock,
    })

    const { updateServiceWorker } = usePwaUpdate()
    await updateServiceWorker()

    expect(updateServiceWorkerMock).toHaveBeenCalledWith(true)
    expect(reloadMock).toHaveBeenCalledOnce()
  })

  it('cleans up listeners when the composable scope is disposed', () => {
    const { registration, update } = createRegistration()

    useRegisterSWMock.mockImplementation(
      (options?: {
        onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration) => void
      }) => {
        options?.onRegisteredSW?.('/sw.js', registration)

        return {
          needRefresh: ref(false),
          offlineReady: ref(false),
          updateServiceWorker: updateServiceWorkerMock,
        }
      },
    )

    const scope = effectScope()
    scope.run(() => {
      usePwaUpdate()
    })
    scope.stop()

    window.dispatchEvent(new Event('focus'))
    expect(update).not.toHaveBeenCalled()
  })
})
