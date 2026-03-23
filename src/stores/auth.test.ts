import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { Effect } from 'effect'

const {
  checkSetupCompleteMock,
  markSetupCompleteMock,
  authStoreOnChangeMock,
  authStoreClearMock,
  collectionMock,
} = vi.hoisted(() => ({
  checkSetupCompleteMock: vi.fn(),
  markSetupCompleteMock: vi.fn(),
  authStoreOnChangeMock: vi.fn(),
  authStoreClearMock: vi.fn(),
  collectionMock: vi.fn(),
}))

vi.mock('@/lib/appConfig', () => ({
  checkSetupComplete: checkSetupCompleteMock,
  markSetupComplete: markSetupCompleteMock,
}))

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    authStore: {
      record: null,
      isValid: false,
      onChange: authStoreOnChangeMock,
      clear: authStoreClearMock,
    },
    collection: collectionMock,
  },
}))

import { useAuthStore } from '@/stores/auth'

function deferredPromise<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve
    reject = innerReject
  })

  return { promise, resolve, reject }
}

describe('auth store checkSetup', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    checkSetupCompleteMock.mockReset()
    markSetupCompleteMock.mockReset()
    authStoreOnChangeMock.mockReset()
    authStoreClearMock.mockReset()
    collectionMock.mockReset()
  })

  it('deduplicates concurrent setup checks', async () => {
    const pendingCheck = deferredPromise<{ setupComplete: boolean }>()
    checkSetupCompleteMock.mockReturnValueOnce(Effect.tryPromise(() => pendingCheck.promise))

    const store = useAuthStore()
    const firstCall = store.checkSetup()
    const secondCall = store.checkSetup()

    pendingCheck.resolve({ setupComplete: false })

    await expect(firstCall).resolves.toBe(false)
    await expect(secondCall).resolves.toBe(false)
    expect(checkSetupCompleteMock).toHaveBeenCalledTimes(1)
    expect(store.setupComplete).toBe(false)
  })

  it('reuses the cached setup result after the first successful fetch', async () => {
    checkSetupCompleteMock.mockReturnValueOnce(Effect.succeed({ setupComplete: true }))

    const store = useAuthStore()

    await expect(store.checkSetup()).resolves.toBe(true)
    await expect(store.checkSetup()).resolves.toBe(true)
    expect(checkSetupCompleteMock).toHaveBeenCalledTimes(1)
    expect(store.setupComplete).toBe(true)
  })

  it('falls back to setup complete when the config check fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    checkSetupCompleteMock.mockReturnValueOnce(Effect.fail(new Error('network down')))

    const store = useAuthStore()

    await expect(store.checkSetup()).resolves.toBe(true)
    expect(store.setupComplete).toBe(true)
    expect(checkSetupCompleteMock).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
  })
})
