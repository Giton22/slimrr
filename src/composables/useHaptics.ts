export function useHaptics() {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator

  function vibrate(pattern: number | number[]) {
    if (isSupported) {
      navigator.vibrate(pattern)
    }
  }

  return {
    isSupported,
    success: () => vibrate(50),
    error: () => vibrate([50, 50, 50]),
    light: () => vibrate(10),
    tick: () => vibrate(5),
  }
}
