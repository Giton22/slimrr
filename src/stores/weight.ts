import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import type {
  CalorieEntry,
  DailyCalorieRow,
  KcalGoalChange,
  TimeRange,
  UserSettings,
  WeightEntry,
} from '@/types'
import { pb } from '@/lib/pocketbase'
import { todayISO } from '@/lib/date'
import { today } from '@/composables/useToday'
import { getBmiCategory } from '@/composables/useBmi'
import {
  buildCalorieChartData,
  buildDailyCalorieRows,
  calculateWeeklyCalorieAverage,
  getGlobalKcalGoalForDate as lookupGlobalKcalGoalForDate,
  getTodayCalorieSummary,
} from '@/lib/weight/calories'
import type { CsvDataType, CsvImportError, CsvImportResult } from '@/lib/weight/csv'
import { exportCsvData, importCsvData } from '@/lib/weight/csv'
import type { CustomDateRange, WeightAverageMode } from '@/lib/weight/metrics'
import {
  averageWeightEntries,
  buildWeightChartData,
  calculateAge,
  calculateBmi,
  calculateHealthyWeightRange,
  calculatePeriodWeightAverage,
  calculateWeightToHealthyBmi,
  calculateWeightTrend,
  filterWeightEntries,
  getISOWeekKey,
  sortEntriesByDate,
} from '@/lib/weight/metrics'
import {
  deleteCalorieEntryRecord,
  deleteWeightEntryRecord,
  loadWeightStoreData,
  patchWeightEntryRecord,
  resetWeightUserData,
  saveCalorieEntryRecord,
  saveGlobalKcalGoalRecord,
  saveWeightEntryRecord,
  subscribeWeightRealtime,
  unsubscribeWeightRealtime,
} from '@/lib/weight/repository'
import { createDefaultUserSettings, saveUserSettings } from '@/lib/weight/settings'
import { useGroupsStore } from '@/stores/groups'
import { useFoodStore } from '@/stores/food'

type AverageMode = WeightAverageMode
export type { CsvDataType, CsvImportError, CsvImportResult } from '@/lib/weight/csv'

// ── Store ──

export const useWeightStore = defineStore('weight', () => {
  // ── Weight state ──

  const entries = ref<WeightEntry[]>([])
  const settings = ref<UserSettings>(createDefaultUserSettings())
  // PocketBase record ID for settings (needed for update calls)
  const settingsRecordId = ref<string | null>(null)

  const weightTimeRange = ref<TimeRange>(90)
  const calorieTimeRange = ref<TimeRange>(30)
  const weightCustomRange = ref<CustomDateRange | null>(null)
  const calorieCustomRange = ref<CustomDateRange | null>(null)
  const averageMode = ref<AverageMode>('daily')

  // ── Calorie state ──

  const calorieEntries = ref<CalorieEntry[]>([])
  const kcalGoalHistory = ref<KcalGoalChange[]>([])

  // Loading state
  const isLoading = ref(false)
  const isSynced = ref(false)

  // ── Data loading ──

  async function loadAll() {
    isLoading.value = true
    try {
      const userId = pb.authStore.record?.id
      if (!userId) return

      const data = await loadWeightStoreData(userId)
      entries.value = data.entries
      calorieEntries.value = data.calorieEntries
      kcalGoalHistory.value = data.kcalGoalHistory
      settings.value = data.settings ?? createDefaultUserSettings()
      settingsRecordId.value = data.settingsRecordId

      isSynced.value = true
    } finally {
      isLoading.value = false
    }
  }

  // ── Realtime subscriptions ──

  function subscribeRealtime() {
    const userId = pb.authStore.record?.id
    if (!userId) return

    subscribeWeightRealtime(userId, {
      onWeightEntry(action, entry) {
        if (action === 'create') {
          if (!entries.value.some((item) => item.id === entry.id)) entries.value.push(entry)
        } else if (action === 'update') {
          const idx = entries.value.findIndex((item) => item.id === entry.id)
          if (idx !== -1) entries.value[idx] = entry
        } else if (action === 'delete') {
          entries.value = entries.value.filter((item) => item.id !== entry.id)
        }
      },
      onCalorieEntry(action, entry) {
        if (action === 'create') {
          if (!calorieEntries.value.some((item) => item.id === entry.id))
            calorieEntries.value.push(entry)
        } else if (action === 'update') {
          const idx = calorieEntries.value.findIndex((item) => item.id === entry.id)
          if (idx !== -1) calorieEntries.value[idx] = entry
        } else if (action === 'delete') {
          calorieEntries.value = calorieEntries.value.filter((item) => item.id !== entry.id)
        }
      },
      onKcalGoalChange(action, change) {
        if (action === 'create') {
          if (!kcalGoalHistory.value.some((item) => item.id === change.id))
            kcalGoalHistory.value.push(change)
        } else if (action === 'update') {
          const idx = kcalGoalHistory.value.findIndex((item) => item.id === change.id)
          if (idx !== -1) kcalGoalHistory.value[idx] = change
        } else if (action === 'delete') {
          kcalGoalHistory.value = kcalGoalHistory.value.filter((item) => item.id !== change.id)
        }
      },
      onUserSettings(nextSettings, recordId) {
        settings.value = nextSettings
        settingsRecordId.value = recordId
      },
    })
  }

  function unsubscribeRealtime() {
    unsubscribeWeightRealtime()
  }

  function reset() {
    unsubscribeRealtime()
    entries.value = []
    calorieEntries.value = []
    kcalGoalHistory.value = []
    settings.value = createDefaultUserSettings()
    settingsRecordId.value = null
    weightTimeRange.value = 90
    calorieTimeRange.value = 30
    weightCustomRange.value = null
    calorieCustomRange.value = null
    averageMode.value = 'daily'
    isSynced.value = false
  }

  // ── Settings helpers ──

  async function persistSettings(patch: Partial<UserSettings>) {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const next = { ...settings.value, ...patch }
    settings.value = next
    settingsRecordId.value = await saveUserSettings(userId, next, settingsRecordId.value)

    // Sync weight goal for groups when goal weight changes
    const sorted = [...entries.value].sort((a, b) => a.date.localeCompare(b.date))
    const latestWeight = sorted.at(-1)?.weightKg
    if (next.goalWeightKg && latestWeight) {
      void useGroupsStore().syncWeightGoal(
        latestWeight,
        next.goalWeightKg,
        next.unit,
        next.goalDirection,
      )
    }
  }

  // ── Weight getters ──

  const sortedEntries = computed(() => sortEntriesByDate(entries.value))

  const filteredEntries = computed(() =>
    filterWeightEntries(sortedEntries.value, weightTimeRange.value, weightCustomRange.value),
  )

  const latestEntry = computed(() => sortedEntries.value.at(-1))

  const currentWeight = computed(() => latestEntry.value?.weightKg ?? null)

  const bmi = computed(() => calculateBmi(currentWeight.value, settings.value.heightCm))

  // WHO BMI category (delegated to shared composable)
  const bmiCategory = computed(() => getBmiCategory(bmi.value))

  const healthyWeightRange = computed(() => calculateHealthyWeightRange(settings.value.heightCm))

  const weightToHealthyBmi = computed(() =>
    calculateWeightToHealthyBmi(currentWeight.value, healthyWeightRange.value),
  )

  const age = computed(() => calculateAge(settings.value.dateOfBirth))

  const weightTrend = computed(() => calculateWeightTrend(sortedEntries.value))

  const averagedEntries = computed(() =>
    averageWeightEntries(filteredEntries.value, averageMode.value),
  )

  const weeklyAverage = computed<{ avg: number; count: number } | null>(() =>
    calculatePeriodWeightAverage(sortedEntries.value, getISOWeekKey(today.value), getISOWeekKey),
  )

  const monthlyAverage = computed<{ avg: number; count: number } | null>(() =>
    calculatePeriodWeightAverage(sortedEntries.value, today.value.slice(0, 7), (date) =>
      date.slice(0, 7),
    ),
  )

  const chartData = computed(() => buildWeightChartData(filteredEntries.value))

  // ── Kcal goal helpers ──

  const sortedKcalGoalHistory = computed(() =>
    [...kcalGoalHistory.value].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),
  )

  const currentGlobalKcalGoal = computed<number | null>(() => {
    return lookupGlobalKcalGoalForDate(sortedKcalGoalHistory.value, today.value)
  })

  // ── Derived daily calorie rows — only dates with a logged entry ──

  const dailyCalorieRows = computed((): DailyCalorieRow[] =>
    buildDailyCalorieRows({
      calorieEntries: calorieEntries.value,
      foodSummaries: useFoodStore().dailyFoodSummaries,
      goals: sortedKcalGoalHistory.value,
      range: calorieTimeRange.value,
      customRange: calorieCustomRange.value,
    }),
  )

  // ── Kcal chart data ──

  const calorieChartData = computed(() => buildCalorieChartData(dailyCalorieRows.value))

  // ── Kcal summary stats ──

  const todayCalorieSummary = computed(() =>
    getTodayCalorieSummary(dailyCalorieRows.value, today.value),
  )

  const weeklyCalorieAverage = computed<number | null>(() =>
    calculateWeeklyCalorieAverage(dailyCalorieRows.value, today.value),
  )

  // ── Weight actions ──

  async function addEntry(entry: Omit<WeightEntry, 'id'>) {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const existing = entries.value.find((e) => e.date === entry.date)

    try {
      const savedEntry = await saveWeightEntryRecord(userId, entry, existing)
      if (existing) {
        const idx = entries.value.findIndex((e) => e.id === existing.id)
        if (idx !== -1) entries.value[idx] = savedEntry
      } else if (!entries.value.some((e) => e.id === savedEntry.id)) {
        entries.value.push(savedEntry)
      }
    } catch {
      if (!existing) {
        toast.error('Failed to save weight entry. Please try again.')
      } else {
        throw new Error('Failed to update weight entry')
      }
    }

    // Sync weight goal for groups
    if (settings.value.goalWeightKg) {
      void useGroupsStore().syncWeightGoal(
        entry.weightKg,
        settings.value.goalWeightKg,
        settings.value.unit,
        settings.value.goalDirection,
      )
    }
  }

  async function updateEntry(id: string, patch: Partial<Pick<WeightEntry, 'weightKg' | 'note'>>) {
    const existing = entries.value.find((e) => e.id === id)
    if (!existing) return

    await patchWeightEntryRecord(id, patch)
    const idx = entries.value.findIndex((e) => e.id === id)
    if (idx !== -1) entries.value[idx] = { ...existing, ...patch }
  }

  async function deleteEntry(id: string) {
    await deleteWeightEntryRecord(id)
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  function setUnit(unit: 'kg' | 'lbs') {
    void persistSettings({ unit })
  }

  function setWeightTimeRange(range: TimeRange) {
    weightTimeRange.value = range
  }

  function setCalorieTimeRange(range: TimeRange) {
    calorieTimeRange.value = range
  }

  function setWeightCustomRange(range: CustomDateRange | null) {
    weightCustomRange.value = range
  }

  function setCalorieCustomRange(range: CustomDateRange | null) {
    calorieCustomRange.value = range
  }

  function setAverageMode(mode: AverageMode) {
    averageMode.value = mode
  }

  // ── Calorie actions ──

  async function setGlobalKcalGoal(kcal: number) {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const today = todayISO()

    const existing = kcalGoalHistory.value.find((goal) => goal.effectiveFrom === today)
    try {
      const savedGoal = await saveGlobalKcalGoalRecord(userId, today, kcal, existing)
      if (existing) {
        kcalGoalHistory.value = kcalGoalHistory.value.map((goal) =>
          goal.effectiveFrom === today ? savedGoal : goal,
        )
      } else if (!kcalGoalHistory.value.some((goal) => goal.id === savedGoal.id)) {
        kcalGoalHistory.value.push(savedGoal)
      }
    } catch {
      if (!existing) {
        toast.error('Failed to set calorie goal. Please try again.')
      } else {
        throw new Error('Failed to update calorie goal')
      }
    }
  }

  async function upsertCalorieEntry(
    date: string,
    patch: Partial<Pick<CalorieEntry, 'calories' | 'goalOverrideKcal' | 'note'>>,
  ) {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const existing = calorieEntries.value.find((entry) => entry.date === date)

    try {
      const savedEntry = await saveCalorieEntryRecord(userId, date, patch, existing)
      if (existing) {
        const idx = calorieEntries.value.findIndex((entry) => entry.date === date)
        if (idx !== -1) calorieEntries.value[idx] = savedEntry
      } else if (!calorieEntries.value.some((entry) => entry.id === savedEntry.id)) {
        calorieEntries.value.push(savedEntry)
      }
    } catch {
      try {
        if (!existing) {
          toast.error('Failed to save calorie entry. Please try again.')
          return
        }
        throw new Error('Failed to update calorie entry')
      } catch (error) {
        if (error instanceof Error && error.message === 'Failed to update calorie entry')
          throw error
      }
    }
  }

  function setCaloriesForDate(date: string, calories: number | null) {
    return upsertCalorieEntry(date, { calories })
  }

  function setDayGoalOverride(date: string, kcal: number | null) {
    return upsertCalorieEntry(date, { goalOverrideKcal: kcal })
  }

  async function saveDailyCalories(payload: {
    date: string
    calories: number | null
    goalOverrideKcal: number | null
    note?: string
  }) {
    // Merge both fields in a single upsert to avoid two round-trips
    await upsertCalorieEntry(payload.date, {
      calories: payload.calories,
      goalOverrideKcal: payload.goalOverrideKcal,
      ...(payload.note !== undefined ? { note: payload.note } : {}),
    })
  }

  async function deleteCalorieEntry(date: string) {
    const entry = calorieEntries.value.find((e) => e.date === date)
    if (!entry) return

    await deleteCalorieEntryRecord(entry.id)
    calorieEntries.value = calorieEntries.value.filter((e) => e.date !== date)
  }

  async function resetUserData() {
    const userId = pb.authStore.record?.id
    if (!userId) return

    await resetWeightUserData(userId)

    entries.value = []
    calorieEntries.value = []
    kcalGoalHistory.value = []
    useFoodStore().reset()
  }

  async function importCsv(type: CsvDataType, file: File): Promise<CsvImportResult> {
    const result = await importCsvData(type, file)
    await Promise.all([loadAll(), useFoodStore().loadFoodData()])
    return result
  }

  async function exportCsv(type: CsvDataType): Promise<{ filename: string; blob: Blob }> {
    return exportCsvData(type)
  }

  return {
    // Weight
    entries,
    settings,
    weightTimeRange,
    calorieTimeRange,
    weightCustomRange,
    calorieCustomRange,
    averageMode,
    isLoading,
    isSynced,
    sortedEntries,
    filteredEntries,
    averagedEntries,
    latestEntry,
    currentWeight,
    bmi,
    bmiCategory,
    healthyWeightRange,
    weightToHealthyBmi,
    age,
    weightTrend,
    weeklyAverage,
    monthlyAverage,
    chartData,
    addEntry,
    updateEntry,
    deleteEntry,
    setUnit,
    persistSettings,
    setWeightTimeRange,
    setCalorieTimeRange,
    setWeightCustomRange,
    setCalorieCustomRange,
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
    resetUserData,
    importCsv,
    exportCsv,
    settingsRecordId,
    // Lifecycle
    loadAll,
    subscribeRealtime,
    unsubscribeRealtime,
    reset,
  }
})
