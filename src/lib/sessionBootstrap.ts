export interface SessionBootstrapStores {
  weight: {
    loadAll: () => Promise<void>
    subscribeRealtime: () => void
    reset: () => void
  }
  food: {
    loadFoodData: () => Promise<void>
    subscribeRealtime: () => void
    reset: () => void
  }
  groups: {
    loadMyGroups: () => Promise<void>
    reset: () => void
  }
}

export function createSessionBootstrap(stores: SessionBootstrapStores) {
  let isBootstrapped = false
  let sessionVersion = 0
  let bootPromise: Promise<void> | null = null

  function resetAllStores() {
    stores.weight.reset()
    stores.food.reset()
    stores.groups.reset()
  }

  async function bootstrap() {
    if (isBootstrapped) return
    if (bootPromise) return bootPromise

    const bootVersion = sessionVersion

    let inFlightBoot: Promise<void> | null = null

    inFlightBoot = (async () => {
      try {
        await Promise.all([
          stores.weight.loadAll(),
          stores.food.loadFoodData(),
          stores.groups.loadMyGroups(),
        ])

        if (bootVersion !== sessionVersion) {
          resetAllStores()
          return
        }

        stores.weight.subscribeRealtime()
        stores.food.subscribeRealtime()
        isBootstrapped = true
      } catch (error) {
        if (bootVersion === sessionVersion) {
          sessionVersion += 1
          isBootstrapped = false
          resetAllStores()
        }
        throw error
      } finally {
        if (bootPromise === inFlightBoot) {
          bootPromise = null
        }
      }
    })()

    bootPromise = inFlightBoot
    return inFlightBoot
  }

  function teardown() {
    sessionVersion += 1
    isBootstrapped = false
    resetAllStores()
  }

  async function sync(authenticated: boolean) {
    if (authenticated) {
      await bootstrap()
      return
    }

    teardown()
  }

  return {
    sync,
  }
}
