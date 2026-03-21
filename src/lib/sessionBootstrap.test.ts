import { describe, expect, it, vi } from 'vite-plus/test'
import { createSessionBootstrap } from '@/lib/sessionBootstrap'

function createStores() {
  return {
    weight: {
      loadAll: vi.fn().mockResolvedValue(undefined),
      subscribeRealtime: vi.fn(),
      reset: vi.fn(),
    },
    food: {
      loadFoodData: vi.fn().mockResolvedValue(undefined),
      subscribeRealtime: vi.fn(),
      reset: vi.fn(),
    },
    groups: {
      loadMyGroups: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn(),
    },
  }
}

describe('sessionBootstrap', () => {
  it('loads each store once and subscribes once when authenticated', async () => {
    const stores = createStores()
    const bootstrap = createSessionBootstrap(stores)

    await bootstrap.sync(true)

    expect(stores.weight.loadAll).toHaveBeenCalledTimes(1)
    expect(stores.food.loadFoodData).toHaveBeenCalledTimes(1)
    expect(stores.groups.loadMyGroups).toHaveBeenCalledTimes(1)
    expect(stores.weight.subscribeRealtime).toHaveBeenCalledTimes(1)
    expect(stores.food.subscribeRealtime).toHaveBeenCalledTimes(1)
  })

  it('resets each store when unauthenticated', async () => {
    const stores = createStores()
    const bootstrap = createSessionBootstrap(stores)

    await bootstrap.sync(false)

    expect(stores.weight.reset).toHaveBeenCalledTimes(1)
    expect(stores.food.reset).toHaveBeenCalledTimes(1)
    expect(stores.groups.reset).toHaveBeenCalledTimes(1)
  })

  it('does not re-bootstrap on repeated authenticated syncs', async () => {
    const stores = createStores()
    const bootstrap = createSessionBootstrap(stores)

    await bootstrap.sync(true)
    await bootstrap.sync(true)

    expect(stores.weight.loadAll).toHaveBeenCalledTimes(1)
    expect(stores.food.loadFoodData).toHaveBeenCalledTimes(1)
    expect(stores.groups.loadMyGroups).toHaveBeenCalledTimes(1)
    expect(stores.weight.subscribeRealtime).toHaveBeenCalledTimes(1)
    expect(stores.food.subscribeRealtime).toHaveBeenCalledTimes(1)
  })

  it('resets partial state if bootstrap fails', async () => {
    const stores = createStores()
    const expectedError = new Error('boot failed')
    stores.food.loadFoodData.mockRejectedValueOnce(expectedError)
    const bootstrap = createSessionBootstrap(stores)

    await expect(bootstrap.sync(true)).rejects.toThrow('boot failed')

    expect(stores.weight.reset).toHaveBeenCalledTimes(1)
    expect(stores.food.reset).toHaveBeenCalledTimes(1)
    expect(stores.groups.reset).toHaveBeenCalledTimes(1)
    expect(stores.weight.subscribeRealtime).not.toHaveBeenCalled()
    expect(stores.food.subscribeRealtime).not.toHaveBeenCalled()
  })
})
