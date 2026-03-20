import { computed, ref, watch } from 'vue'
import { useWeightStore } from '@/stores/weight'
import { useFoodStore } from '@/stores/food'
import { today } from '@/composables/useToday'
import { addDays } from '@/lib/date'

export function useStreaks() {
  const weightStore = useWeightStore()
  const foodStore = useFoodStore()

  const loggedDates = computed(() => {
    const dates = new Set<string>()
    for (const entry of weightStore.entries) {
      dates.add(entry.date)
    }
    for (const entry of foodStore.foodLog) {
      dates.add(entry.date)
    }
    return dates
  })

  const currentStreak = computed(() => {
    const dates = loggedDates.value
    if (dates.size === 0) return 0

    // Start from today; if today isn't logged yet, give 1-day grace and start from yesterday
    let checkDate = today.value
    if (!dates.has(checkDate)) {
      checkDate = addDays(checkDate, -1)
      if (!dates.has(checkDate)) return 0
    }

    let streak = 0
    while (dates.has(checkDate)) {
      streak++
      checkDate = addDays(checkDate, -1)
    }
    return streak
  })

  const bestStreak = computed(() => {
    const dates = loggedDates.value
    if (dates.size === 0) return 0

    const sorted = [...dates].sort()
    let best = 1
    let current = 1

    for (let i = 1; i < sorted.length; i++) {
      if (addDays(sorted[i - 1]!, 1) === sorted[i]) {
        current++
        if (current > best) best = current
      } else {
        current = 1
      }
    }
    return best
  })

  // Track streak increases for animation
  const streakJustIncreased = ref(false)
  let previousStreak = currentStreak.value

  watch(currentStreak, (newStreak) => {
    if (newStreak > previousStreak && previousStreak > 0) {
      streakJustIncreased.value = true
      setTimeout(() => {
        streakJustIncreased.value = false
      }, 1500)
    }
    previousStreak = newStreak
  })

  return {
    currentStreak,
    bestStreak,
    streakJustIncreased,
  }
}
