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
import { pb, COLLECTIONS } from '@/lib/pocketbase'
import type {
  WeightEntryRecord,
  CalorieEntryRecord,
  KcalGoalChangeRecord,
  UserSettingsRecord,
  GoalRecord,
} from '@/lib/pocketbase'
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
  cutoffISO,
  filterWeightEntries,
  getISOWeekKey,
  sortEntriesByDate,
} from '@/lib/weight/metrics'
import { createDefaultUserSettings, saveUserSettings, toUserSettings } from '@/lib/weight/settings'
import { useGroupsStore } from '@/stores/groups'
import { useFoodStore } from '@/stores/food'

type AverageMode = WeightAverageMode
export type { CsvDataType, CsvImportError, CsvImportResult } from '@/lib/weight/csv'

// ── Record → domain type mappers ──

function toWeightEntry(r: WeightEntryRecord): WeightEntry {
  return {
    id: r.id,
    date: r.date,
    weightKg: r.weight_kg,
    note: r.note || undefined,
  }
}

function toCalorieEntry(r: CalorieEntryRecord): CalorieEntry {
  return {
    id: r.id,
    date: r.date,
    // PocketBase NumberField is non-nullable — null is stored/returned as 0.
    // Treat 0 as "no data" since 0 kcal is not a meaningful real value.
    calories: r.calories || null,
    goalOverrideKcal: r.goal_override_kcal || undefined,
    note: r.note || undefined,
  }
}

function toKcalGoalChange(r: KcalGoalChangeRecord): KcalGoalChange {
  return {
    id: r.id,
    effectiveFrom: r.effective_from,
    kcal: r.kcal,
  }
}

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

      const userFilter = pb.filter('user = {:userId}', { userId })
      const dateBoundFilter = pb.filter('user = {:userId} && date >= {:cutoff}', {
        userId,
        cutoff: cutoffISO(365),
      })

      const [weightRecords, calorieRecords, kcalGoalRecords, settingsRecords] = await Promise.all([
        pb
          .collection<WeightEntryRecord>(COLLECTIONS.WEIGHT_ENTRIES)
          .getFullList({ filter: dateBoundFilter, sort: 'date' }),
        pb
          .collection<CalorieEntryRecord>(COLLECTIONS.CALORIE_ENTRIES)
          .getFullList({ filter: dateBoundFilter, sort: 'date' }),
        pb
          .collection<KcalGoalChangeRecord>(COLLECTIONS.KCAL_GOAL_HISTORY)
          .getFullList({ filter: userFilter, sort: 'effective_from' }),
        pb
          .collection<UserSettingsRecord>(COLLECTIONS.USER_SETTINGS)
          .getFullList({ filter: userFilter }),
      ])

      entries.value = weightRecords.map(toWeightEntry)
      calorieEntries.value = calorieRecords.map(toCalorieEntry)
      kcalGoalHistory.value = kcalGoalRecords.map(toKcalGoalChange)

      if (settingsRecords.length > 0) {
        const rec = settingsRecords[0]!
        settings.value = toUserSettings(rec)
        settingsRecordId.value = rec.id
      }

      isSynced.value = true
    } finally {
      isLoading.value = false
    }
  }

  // ── Realtime subscriptions ──

  function subscribeRealtime() {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const filter = pb.filter('user = {:userId}', { userId })

    void pb.collection<WeightEntryRecord>(COLLECTIONS.WEIGHT_ENTRIES).subscribe(
      '*',
      (e) => {
        if (e.action === 'create') {
          // Skip if already present (optimistic insert or duplicate event)
          if (!entries.value.some((x) => x.id === e.record.id))
            entries.value.push(toWeightEntry(e.record))
        } else if (e.action === 'update') {
          const idx = entries.value.findIndex((x) => x.id === e.record.id)
          if (idx !== -1) entries.value[idx] = toWeightEntry(e.record)
        } else if (e.action === 'delete') {
          entries.value = entries.value.filter((x) => x.id !== e.record.id)
        }
      },
      { filter },
    )

    void pb.collection<CalorieEntryRecord>(COLLECTIONS.CALORIE_ENTRIES).subscribe(
      '*',
      (e) => {
        if (e.action === 'create') {
          if (!calorieEntries.value.some((x) => x.id === e.record.id))
            calorieEntries.value.push(toCalorieEntry(e.record))
        } else if (e.action === 'update') {
          const idx = calorieEntries.value.findIndex((x) => x.id === e.record.id)
          if (idx !== -1) calorieEntries.value[idx] = toCalorieEntry(e.record)
        } else if (e.action === 'delete') {
          calorieEntries.value = calorieEntries.value.filter((x) => x.id !== e.record.id)
        }
      },
      { filter },
    )

    void pb.collection<KcalGoalChangeRecord>(COLLECTIONS.KCAL_GOAL_HISTORY).subscribe(
      '*',
      (e) => {
        if (e.action === 'create') {
          if (!kcalGoalHistory.value.some((x) => x.id === e.record.id))
            kcalGoalHistory.value.push(toKcalGoalChange(e.record))
        } else if (e.action === 'update') {
          const idx = kcalGoalHistory.value.findIndex((x) => x.id === e.record.id)
          if (idx !== -1) kcalGoalHistory.value[idx] = toKcalGoalChange(e.record)
        } else if (e.action === 'delete') {
          kcalGoalHistory.value = kcalGoalHistory.value.filter((x) => x.id !== e.record.id)
        }
      },
      { filter },
    )

    void pb.collection<UserSettingsRecord>(COLLECTIONS.USER_SETTINGS).subscribe(
      '*',
      (e) => {
        if (e.action === 'update' || e.action === 'create') {
          settings.value = toUserSettings(e.record)
          settingsRecordId.value = e.record.id
        }
      },
      { filter },
    )
  }

  function unsubscribeRealtime() {
    void pb.collection(COLLECTIONS.WEIGHT_ENTRIES).unsubscribe('*')
    void pb.collection(COLLECTIONS.CALORIE_ENTRIES).unsubscribe('*')
    void pb.collection(COLLECTIONS.KCAL_GOAL_HISTORY).unsubscribe('*')
    void pb.collection(COLLECTIONS.USER_SETTINGS).unsubscribe('*')
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

    if (existing) {
      await pb.collection(COLLECTIONS.WEIGHT_ENTRIES).update(existing.id, {
        weight_kg: entry.weightKg,
        note: entry.note ?? '',
      })
      const idx = entries.value.findIndex((e) => e.id === existing.id)
      if (idx !== -1)
        entries.value[idx] = { ...existing, weightKg: entry.weightKg, note: entry.note }
    } else {
      try {
        const rec = await pb.collection<WeightEntryRecord>(COLLECTIONS.WEIGHT_ENTRIES).create({
          user: userId,
          date: entry.date,
          weight_kg: entry.weightKg,
          note: entry.note ?? '',
        })
        if (!entries.value.some((e) => e.id === rec.id)) {
          entries.value.push(toWeightEntry(rec))
        }
      } catch {
        toast.error('Failed to save weight entry. Please try again.')
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

    const payload: Record<string, unknown> = {}
    if (patch.weightKg !== undefined) payload.weight_kg = patch.weightKg
    if (patch.note !== undefined) payload.note = patch.note ?? ''

    await pb.collection(COLLECTIONS.WEIGHT_ENTRIES).update(id, payload)
    const idx = entries.value.findIndex((e) => e.id === id)
    if (idx !== -1) entries.value[idx] = { ...existing, ...patch }
  }

  async function deleteEntry(id: string) {
    await pb.collection(COLLECTIONS.WEIGHT_ENTRIES).delete(id)
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

    // Check if a goal change for today already exists
    const existing = kcalGoalHistory.value.find((g) => g.effectiveFrom === today)
    if (existing) {
      // Update existing
      await pb.collection(COLLECTIONS.KCAL_GOAL_HISTORY).update(existing.id, { kcal })
      kcalGoalHistory.value = kcalGoalHistory.value.map((g) =>
        g.effectiveFrom === today ? { ...g, kcal } : g,
      )
    } else {
      try {
        const rec = await pb
          .collection<KcalGoalChangeRecord>(COLLECTIONS.KCAL_GOAL_HISTORY)
          .create({
            user: userId,
            effective_from: today,
            kcal,
          })
        if (!kcalGoalHistory.value.some((g) => g.id === rec.id)) {
          kcalGoalHistory.value.push(toKcalGoalChange(rec))
        }
      } catch {
        toast.error('Failed to set calorie goal. Please try again.')
      }
    }
  }

  async function upsertCalorieEntry(
    date: string,
    patch: Partial<Pick<CalorieEntry, 'calories' | 'goalOverrideKcal' | 'note'>>,
  ) {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const existing = calorieEntries.value.find((e) => e.date === date)

    if (existing) {
      const updated = { ...existing, ...patch }
      await pb.collection(COLLECTIONS.CALORIE_ENTRIES).update(existing.id, {
        calories: updated.calories,
        goal_override_kcal: updated.goalOverrideKcal ?? null,
        note: updated.note ?? '',
      })
      const idx = calorieEntries.value.findIndex((e) => e.date === date)
      if (idx !== -1) calorieEntries.value[idx] = updated
    } else {
      try {
        const newEntry = { date, calories: null, ...patch }
        const rec = await pb.collection<CalorieEntryRecord>(COLLECTIONS.CALORIE_ENTRIES).create({
          user: userId,
          date,
          calories: newEntry.calories,
          goal_override_kcal: newEntry.goalOverrideKcal ?? null,
          note: newEntry.note ?? '',
        })
        if (!calorieEntries.value.some((e) => e.id === rec.id)) {
          calorieEntries.value.push(toCalorieEntry(rec))
        }
      } catch {
        toast.error('Failed to save calorie entry. Please try again.')
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

    await pb.collection(COLLECTIONS.CALORIE_ENTRIES).delete(entry.id)
    calorieEntries.value = calorieEntries.value.filter((e) => e.date !== date)
  }

  async function resetUserData() {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const userFilter = pb.filter('user = {:userId}', { userId })

    const [
      weightRecords,
      calorieRecords,
      kcalGoalRecords,
      goalRecords,
      foodItemRecords,
      foodLogRecords,
    ] = await Promise.all([
      pb
        .collection<WeightEntryRecord>(COLLECTIONS.WEIGHT_ENTRIES)
        .getFullList({ filter: userFilter }),
      pb
        .collection<CalorieEntryRecord>(COLLECTIONS.CALORIE_ENTRIES)
        .getFullList({ filter: userFilter }),
      pb
        .collection<KcalGoalChangeRecord>(COLLECTIONS.KCAL_GOAL_HISTORY)
        .getFullList({ filter: userFilter }),
      pb.collection<GoalRecord>(COLLECTIONS.GOALS).getFullList({ filter: userFilter }),
      pb.collection(COLLECTIONS.FOOD_ITEMS).getFullList({ filter: userFilter }),
      pb.collection(COLLECTIONS.FOOD_LOG).getFullList({ filter: userFilter }),
    ])

    // Delete food_log first (references food_items)
    await Promise.all(
      foodLogRecords.map((record) => pb.collection(COLLECTIONS.FOOD_LOG).delete(record.id)),
    )

    await Promise.all([
      ...weightRecords.map((record) => pb.collection(COLLECTIONS.WEIGHT_ENTRIES).delete(record.id)),
      ...calorieRecords.map((record) =>
        pb.collection(COLLECTIONS.CALORIE_ENTRIES).delete(record.id),
      ),
      ...kcalGoalRecords.map((record) =>
        pb.collection(COLLECTIONS.KCAL_GOAL_HISTORY).delete(record.id),
      ),
      ...goalRecords.map((record) => pb.collection(COLLECTIONS.GOALS).delete(record.id)),
      ...foodItemRecords.map((record) => pb.collection(COLLECTIONS.FOOD_ITEMS).delete(record.id)),
    ])

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
