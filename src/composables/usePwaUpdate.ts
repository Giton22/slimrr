import { useRegisterSW } from 'virtual:pwa-register/vue'

const intervalMS = 60 * 60 * 1000 // 1 hour

export function usePwaUpdate() {
  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      setInterval(async () => {
        if (!(!registration.installing && navigator)) return
        if ('connection' in navigator && !navigator.onLine) return

        await registration.update()
      }, intervalMS)
    },
  })

  function close() {
    offlineReady.value = false
    needRefresh.value = false
  }

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker,
    close,
  }
}
