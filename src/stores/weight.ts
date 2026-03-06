import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { CalorieEntry, DailyCalorieRow, KcalGoalChange, TimeRange, UserSettings, WeightEntry } from '@/types'
import { generateMockEntries, generateMockCalorieEntries } from '@/lib/mock-data'

type AverageMode = 'daily' | 'weekly' | 'monthly'

// ── Persistence helpers ──

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  }
  catch { /* ignore parse errors */ }
  return fallback
}

function saveToStorage(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

// ── Week helpers ──

function getISOWeekKey(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const year = d.getUTCFullYear()
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]!
}

// ── Store ──

export const useWeightStore = defineStore('weight', () => {
  // ── Weight state ──

  const entries = ref<WeightEntry[]>(
    loadFromStorage('bw-weight-entries', generateMockEntries()),
  )

  const settings = ref<UserSettings>(
    loadFromStorage('bw-settings', {
      unit: 'kg',
      goalWeightKg: 75,
      heightCm: 178,
    }),
  )

  const selectedTimeRange = ref<TimeRange>(90)
  const averageMode = ref<AverageMode>('daily')

  // ── Calorie state ──

  const calorieEntries = ref<CalorieEntry[]>(
    loadFromStorage('bw-calorie-entries', generateMockCalorieEntries()),
  )

  const kcalGoalHistory = ref<KcalGoalChange[]>(
    loadFromStorage('bw-kcal-goal-history', []),
  )

  // ── Persistence watchers ──

  watch(entries, v => saveToStorage('bw-weight-entries', v), { deep: true })
  watch(settings, v => saveToStorage('bw-settings', v), { deep: true })
  watch(calorieEntries, v => saveToStorage('bw-calorie-entries', v), { deep: true })
  watch(kcalGoalHistory, v => saveToStorage('bw-kcal-goal-history', v), { deep: true })

  // ── Weight getters ──

  const sortedEntries = computed(() =>
    [...entries.value].sort((a, b) => a.date.localeCompare(b.date)),
  )

  const filteredEntries = computed(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - selectedTimeRange.value)
    const cutoffStr = cutoff.toISOString().split('T')[0]!
    return sortedEntries.value.filter(e => e.date >= cutoffStr)
  })

  const latestEntry = computed(() =>
    sortedEntries.value.at(-1),
  )

  const currentWeight = computed(() =>
    latestEntry.value?.weightKg ?? null,
  )

  const bmi = computed(() => {
    if (!currentWeight.value || !settings.value.heightCm) return null
    const heightM = settings.value.heightCm / 100
    return Math.round((currentWeight.value / (heightM * heightM)) * 10) / 10
  })

  const weightTrend = computed(() => {
    const sorted = sortedEntries.value
    if (sorted.length < 2) return null

    const recent = sorted.slice(-7)
    const older = sorted.slice(-14, -7)
    if (older.length === 0) return null

    const recentAvg = recent.reduce((s, e) => s + e.weightKg, 0) / recent.length
    const olderAvg = older.reduce((s, e) => s + e.weightKg, 0) / older.length
    return Math.round((recentAvg - olderAvg) * 100) / 100
  })

  const averagedEntries = computed((): WeightEntry[] => {
    const data = filteredEntries.value
    if (averageMode.value === 'daily') return data

    const groups = new Map<string, WeightEntry[]>()
    for (const entry of data) {
      const key = averageMode.value === 'weekly'
        ? getISOWeekKey(entry.date)
        : entry.date.slice(0, 7) // YYYY-MM
      const group = groups.get(key) ?? []
      group.push(entry)
      groups.set(key, group)
    }

    return [...groups.values()].map(group => {
      const avgKg = group.reduce((s, e) => s + e.weightKg, 0) / group.length
      return {
        id: group[group.length - 1]!.id,
        date: group[group.length - 1]!.date,
        weightKg: Math.round(avgKg * 100) / 100,
      }
    })
  })

  const weeklyAverage = computed<{ avg: number; count: number } | null>(() => {
    const currentWeekKey = getISOWeekKey(todayISO())
    const weekEntries = sortedEntries.value.filter(e => getISOWeekKey(e.date) === currentWeekKey)
    if (weekEntries.length === 0) return null
    const avg = weekEntries.reduce((s, e) => s + e.weightKg, 0) / weekEntries.length
    return { avg: Math.round(avg * 100) / 100, count: weekEntries.length }
  })

  const monthlyAverage = computed<{ avg: number; count: number } | null>(() => {
    const currentMonthKey = todayISO().slice(0, 7)
    const monthEntries = sortedEntries.value.filter(e => e.date.slice(0, 7) === currentMonthKey)
    if (monthEntries.length === 0) return null
    const avg = monthEntries.reduce((s, e) => s + e.weightKg, 0) / monthEntries.length
    return { avg: Math.round(avg * 100) / 100, count: monthEntries.length }
  })

  const chartData = computed(() =>
    filteredEntries.value.map(e => ({
      date: new Date(e.date).getTime(),
      weight: e.weightKg,
    })),
  )

  // ── Kcal goal helpers ──

  const sortedKcalGoalHistory = computed(() =>
    [...kcalGoalHistory.value].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),
  )

  const currentGlobalKcalGoal = computed<number | null>(() => {
    const today = todayISO()
    return getGlobalKcalGoalForDate(today)
  })

  function getGlobalKcalGoalForDate(date: string): number | null {
    // Find the latest goal change where effectiveFrom <= date
    const sorted = sortedKcalGoalHistory.value
    let result: number | null = null
    for (const change of sorted) {
      if (change.effectiveFrom <= date) {
        result = change.kcal
      }
      else {
        break
      }
    }
    return result
  }

  function getEffectiveKcalGoal(date: string): { goal: number | null; source: 'global' | 'override' | 'none' } {
    // Check for per-day override first
    const entry = calorieEntries.value.find(e => e.date === date)
    if (entry?.goalOverrideKcal != null) {
      return { goal: entry.goalOverrideKcal, source: 'override' }
    }
    // Fall back to global goal
    const globalGoal = getGlobalKcalGoalForDate(date)
    if (globalGoal !== null) {
      return { goal: globalGoal, source: 'global' }
    }
    return { goal: null, source: 'none' }
  }

  // ── Derived daily calorie rows for selected time range ──

  const dailyCalorieRows = computed((): DailyCalorieRow[] => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - selectedTimeRange.value)
    const cutoffStr = cutoff.toISOString().split('T')[0]!
    const today = todayISO()

    // Build a map of calorie entries by date for fast lookup
    const entryMap = new Map<string, CalorieEntry>()
    for (const entry of calorieEntries.value) {
      entryMap.set(entry.date, entry)
    }

    // Generate one row for every day in range, oldest first
    const rows: DailyCalorieRow[] = []
    const current = new Date(cutoffStr)
    const end = new Date(today)

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0]!
      const entry = entryMap.get(dateStr)
      const { goal, source } = getEffectiveKcalGoal(dateStr)
      const consumed = entry?.calories ?? null

      let delta: number | null = null
      let exceeded = false
      if (consumed !== null && goal !== null) {
        delta = consumed - goal
        exceeded = consumed > goal
      }

      rows.push({
        date: dateStr,
        consumedKcal: consumed,
        goalKcal: goal,
        goalSource: source,
        deltaKcal: delta,
        isExceeded: exceeded,
        hasEntry: !!entry,
        note: entry?.note,
      })

      current.setDate(current.getDate() + 1)
    }

    return rows
  })

  // ── Kcal chart data ──

  const calorieChartData = computed(() =>
    dailyCalorieRows.value.map(row => ({
      date: new Date(row.date).getTime(),
      consumed: row.consumedKcal ?? 0,
      goal: row.goalKcal ?? 0,
      exceeded: row.isExceeded,
      hasConsumed: row.consumedKcal !== null,
      hasGoal: row.goalKcal !== null,
    })),
  )

  // ── Kcal summary stats ──

  const todayCalorieSummary = computed(() => {
    const today = todayISO()
    const row = dailyCalorieRows.value.find(r => r.date === today)
    return row ?? null
  })

  const weeklyCalorieAverage = computed<number | null>(() => {
    const currentWeekKey = getISOWeekKey(todayISO())
    const weekRows = dailyCalorieRows.value.filter(
      r => r.consumedKcal !== null && getISOWeekKey(r.date) === currentWeekKey,
    )
    if (weekRows.length === 0) return null
    const sum = weekRows.reduce((s, r) => s + r.consumedKcal!, 0)
    return Math.round(sum / weekRows.length)
  })

  // ── Weight actions ──

  function addEntry(entry: Omit<WeightEntry, 'id'>) {
    entries.value.push({
      ...entry,
      id: crypto.randomUUID(),
    })
  }

  function deleteEntry(id: string) {
    entries.value = entries.value.filter(e => e.id !== id)
  }

  function setUnit(unit: 'kg' | 'lbs') {
    settings.value.unit = unit
  }

  function setTimeRange(range: TimeRange) {
    selectedTimeRange.value = range
  }

  function setAverageMode(mode: AverageMode) {
    averageMode.value = mode
  }

  // ── Calorie actions ──

  function setGlobalKcalGoal(kcal: number) {
    const today = todayISO()
    // Remove any existing goal change for today (replace it)
    kcalGoalHistory.value = kcalGoalHistory.value.filter(g => g.effectiveFrom !== today)
    kcalGoalHistory.value.push({
      id: crypto.randomUUID(),
      effectiveFrom: today,
      kcal,
    })
  }

  function setCaloriesForDate(date: string, calories: number | null) {
    const existing = calorieEntries.value.find(e => e.date === date)
    if (existing) {
      existing.calories = calories
    }
    else {
      calorieEntries.value.push({
        id: crypto.randomUUID(),
        date,
        calories,
      })
    }
  }

  function setDayGoalOverride(date: string, kcal: number | null) {
    const existing = calorieEntries.value.find(e => e.date === date)
    if (existing) {
      existing.goalOverrideKcal = kcal
    }
    else {
      calorieEntries.value.push({
        id: crypto.randomUUID(),
        date,
        calories: null,
        goalOverrideKcal: kcal,
      })
    }
  }

  function saveDailyCalories(payload: { date: string; calories: number | null; goalOverrideKcal: number | null }) {
    setCaloriesForDate(payload.date, payload.calories)
    setDayGoalOverride(payload.date, payload.goalOverrideKcal)
  }

  function deleteCalorieEntry(date: string) {
    calorieEntries.value = calorieEntries.value.filter(e => e.date !== date)
  }

  return {
    // Weight
    entries,
    settings,
    selectedTimeRange,
    averageMode,
    sortedEntries,
    filteredEntries,
    averagedEntries,
    latestEntry,
    currentWeight,
    bmi,
    weightTrend,
    weeklyAverage,
    monthlyAverage,
    chartData,
    addEntry,
    deleteEntry,
    setUnit,
    setTimeRange,
    setAverageMode,
    // Calories
    calorieEntries,
    kcalGoalHistory,
    currentGlobalKcalGoal,
    dailyCalorieRows,
    calorieChartData,
    todayCalorieSummary,
    weeklyCalorieAverage,
    setGlobalKcalGoal,
    setCaloriesForDate,
    setDayGoalOverride,
    saveDailyCalories,
    deleteCalorieEntry,
  }
})
