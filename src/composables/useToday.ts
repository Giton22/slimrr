/**
 * Reactive "today" ref that updates automatically at midnight.
 *
 * Components call `useToday()` to start the timer (ties to component lifecycle).
 * Stores import the singleton `today` ref directly (no lifecycle needed — timer
 * is started by the first component that calls `useToday()`).
 */

import { ref, onUnmounted } from 'vue'
import { todayISO } from '@/lib/date'

/** Singleton reactive ref holding today's date as YYYY-MM-DD. */
export const today = ref(todayISO())

let refCount = 0
let intervalId: ReturnType<typeof setInterval> | null = null

function startTimer() {
  if (intervalId) return
  intervalId = setInterval(() => {
    const now = todayISO()
    if (today.value !== now) today.value = now
  }, 60_000) // check every 60 s
}

function stopTimer() {
  if (intervalId && refCount <= 0) {
    clearInterval(intervalId)
    intervalId = null
  }
}

/**
 * Composable entry-point for components.
 * Starts the midnight-check timer on mount, stops when all consumers unmount.
 */
export function useToday() {
  refCount++
  startTimer()

  onUnmounted(() => {
    refCount--
    if (refCount <= 0) stopTimer()
  })

  return today
}
