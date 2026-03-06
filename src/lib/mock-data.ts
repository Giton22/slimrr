import type { CalorieEntry, WeightEntry } from '@/types'

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return s / 2147483647
  }
}

export function generateMockEntries(): WeightEntry[] {
  const entries: WeightEntry[] = []
  const rand = seededRandom(42)
  const today = new Date()
  const startWeight = 120
  const endWeight = 80
  const totalDays = 90
  const weightPerDay = (startWeight - endWeight) / totalDays

  for (let i = totalDays; i >= 0; i--) {
    // Skip ~20% of days randomly
    if (rand() < 0.2) continue

    const date = new Date(today)
    date.setDate(date.getDate() - i)

    const dayIndex = totalDays - i
    const baseWeight = startWeight - weightPerDay * dayIndex
    const noise = (rand() - 0.5) * 1.0 // +/- 0.5kg
    const weight = Math.round((baseWeight + noise) * 10) / 10

    const dateStr = date.toISOString().split('T')[0]!

    entries.push({
      id: crypto.randomUUID(),
      date: dateStr,
      weightKg: weight,
      note: dayIndex === 0 ? 'Starting my journey!' : undefined,
    })
  }

  return entries
}

export function generateMockCalorieEntries(): CalorieEntry[] {
  const entries: CalorieEntry[] = []
  const rand = seededRandom(99)
  const today = new Date()
  const totalDays = 30

  for (let i = totalDays; i >= 0; i--) {
    // Skip ~30% of days randomly
    if (rand() < 0.3) continue

    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]!

    // Generate random calorie intake between 1400 and 2800
    const base = 1800
    const noise = (rand() - 0.5) * 1400
    const calories = Math.round(base + noise)

    entries.push({
      id: crypto.randomUUID(),
      date: dateStr,
      calories,
    })
  }

  return entries
}
