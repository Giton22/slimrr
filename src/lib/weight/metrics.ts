import type { TimeRange, WeightEntry } from '@/types'

export type WeightAverageMode = 'daily' | 'weekly' | 'monthly'
export type CustomDateRange = { start: string; end: string }

export function getISOWeekKey(dateStr: string): string {
  const date = new Date(dateStr)
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const year = date.getUTCFullYear()
  const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function cutoffISO(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function isDateInRange(
  date: string,
  range: TimeRange,
  customRange: CustomDateRange | null,
): boolean {
  if (range === 'custom') {
    if (!customRange) {
      return date >= cutoffISO(30)
    }
    if (customRange.start > customRange.end) {
      return false
    }
    return date >= customRange.start && date <= customRange.end
  }

  return date >= cutoffISO(range)
}

export function sortEntriesByDate(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date))
}

export function filterWeightEntries(
  entries: WeightEntry[],
  range: TimeRange,
  customRange: CustomDateRange | null,
): WeightEntry[] {
  return entries.filter((entry) => isDateInRange(entry.date, range, customRange))
}

export function averageWeightEntries(
  entries: WeightEntry[],
  mode: WeightAverageMode,
): WeightEntry[] {
  if (mode === 'daily') return entries

  const groups = new Map<string, WeightEntry[]>()
  for (const entry of entries) {
    const key = mode === 'weekly' ? getISOWeekKey(entry.date) : entry.date.slice(0, 7)
    const group = groups.get(key) ?? []
    group.push(entry)
    groups.set(key, group)
  }

  return [...groups.values()].map((group) => {
    const avgKg = group.reduce((sum, entry) => sum + entry.weightKg, 0) / group.length
    const lastEntry = group[group.length - 1]!
    return {
      id: lastEntry.id,
      date: lastEntry.date,
      weightKg: roundTo(avgKg, 2),
    }
  })
}

export function calculateBmi(
  weightKg: number | null,
  heightCm: number | null | undefined,
): number | null {
  if (!weightKg || !heightCm) return null
  const heightM = heightCm / 100
  return roundTo(weightKg / (heightM * heightM), 1)
}

export function calculateHealthyWeightRange(
  heightCm: number | null | undefined,
): { minKg: number; maxKg: number } | null {
  if (!heightCm) return null
  const heightM = heightCm / 100
  return {
    minKg: roundTo(18.5 * heightM * heightM, 1),
    maxKg: roundTo(24.9 * heightM * heightM, 1),
  }
}

export function calculateWeightToHealthyBmi(
  currentWeightKg: number | null,
  range: { minKg: number; maxKg: number } | null,
): number | null {
  if (currentWeightKg === null || range === null) return null
  if (currentWeightKg < range.minKg) return roundTo(range.minKg - currentWeightKg, 1)
  if (currentWeightKg > range.maxKg) return roundTo(range.maxKg - currentWeightKg, 1)
  return 0
}

export function calculateAge(dateOfBirth: string | undefined, now = new Date()): number | null {
  if (!dateOfBirth) return null
  const birth = new Date(dateOfBirth)
  let years = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    years -= 1
  }
  return years >= 0 ? years : null
}

export function calculateWeightTrend(sortedEntries: WeightEntry[]): number | null {
  if (sortedEntries.length < 2) return null

  const recent = sortedEntries.slice(-7)
  const older = sortedEntries.slice(-14, -7)
  if (older.length === 0) return null

  const recentAvg = recent.reduce((sum, entry) => sum + entry.weightKg, 0) / recent.length
  const olderAvg = older.reduce((sum, entry) => sum + entry.weightKg, 0) / older.length
  return roundTo(recentAvg - olderAvg, 2)
}

export function calculatePeriodWeightAverage(
  sortedEntries: WeightEntry[],
  periodKey: string,
  keySelector: (date: string) => string,
): { avg: number; count: number } | null {
  const periodEntries = sortedEntries.filter((entry) => keySelector(entry.date) === periodKey)
  if (periodEntries.length === 0) return null

  const avg = periodEntries.reduce((sum, entry) => sum + entry.weightKg, 0) / periodEntries.length
  return { avg: roundTo(avg, 2), count: periodEntries.length }
}

export function buildWeightChartData(entries: WeightEntry[]) {
  return entries.map((entry) => ({
    date: new Date(entry.date).getTime(),
    weight: entry.weightKg,
  }))
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
