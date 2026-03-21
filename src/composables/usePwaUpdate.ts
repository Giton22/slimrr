import { getCurrentScope, onScopeDispose } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'

const initialCheckDelayMS = 5 * 1000
const updateIntervalMS = 5 * 60 * 1000

function canCheckForUpdates(registration: ServiceWorkerRegistration) {
  if (registration.installing) return false
  if (typeof navigator === 'undefined') return false
  if ('onLine' in navigator && !navigator.onLine) return false

  return true
}

async function checkForUpdates(registration: ServiceWorkerRegistration) {
  if (!canCheckForUpdates(registration)) return

  await registration.update()
}

export function setupPwaUpdateChecks(registration: ServiceWorkerRegistration) {
  const runUpdateCheck = () => {
    void checkForUpdates(registration)
  }

  const timeoutId = window.setTimeout(runUpdateCheck, initialCheckDelayMS)
  const intervalId = window.setInterval(runUpdateCheck, updateIntervalMS)

  const handleFocus = () => {
    runUpdateCheck()
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return

    runUpdateCheck()
  }

  window.addEventListener('focus', handleFocus)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    window.clearTimeout(timeoutId)
    window.clearInterval(intervalId)
    window.removeEventListener('focus', handleFocus)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}

export function usePwaUpdate() {
  let cleanupUpdateChecks: (() => void) | undefined

  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      cleanupUpdateChecks?.()

      if (!registration) return

      cleanupUpdateChecks = setupPwaUpdateChecks(registration)
    },
  })

  if (getCurrentScope()) {
    onScopeDispose(() => {
      cleanupUpdateChecks?.()
    })
  }

  function close() {
    offlineReady.value = false
    needRefresh.value = false
  }

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: async () => {
      await updateServiceWorker(true)
      // vite-plugin-pwa v0.13.2+ ignores the reloadPage param and relies on
      // the workbox-window "controlling" event to trigger window.location.reload().
      // That event doesn't fire reliably on mobile standalone PWAs, so we
      // explicitly reload after giving the SW time to call skipWaiting().
      window.location.reload()
    },
    close,
  }
}
