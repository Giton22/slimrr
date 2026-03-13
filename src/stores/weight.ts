import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import type { CalorieEntry, DailyCalorieRow, GoalDirection, KcalGoalChange, Sex, TimeRange, UserSettings, WeightEntry } from '@/types'
import { pb, COLLECTIONS } from '@/lib/pocketbase'
import type { WeightEntryRecord, CalorieEntryRecord, KcalGoalChangeRecord, UserSettingsRecord, GoalRecord } from '@/lib/pocketbase'
import { todayISO } from '@/lib/date'
import { today } from '@/composables/useToday'
import { getBmiCategory } from '@/composables/useBmi'
import { useGroupsStore } from '@/stores/groups'

type AverageMode = 'daily' | 'weekly' | 'monthly'

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

function toUserSettings(r: UserSettingsRecord): UserSettings {
  return {
    unit: r.unit,
    goalWeightKg: r.goal_weight_kg,
    heightCm: r.height_cm,
    dateOfBirth: r.date_of_birth || undefined,
    sex: (r.sex as Sex) || undefined,
    goalDirection: (r.goal_direction as GoalDirection) || undefined,
  }
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

function cutoffISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Store ──

export const useWeightStore = defineStore('weight', () => {
  // ── Weight state ──

  const entries = ref<WeightEntry[]>([])
  const settings = ref<UserSettings>({
    unit: 'kg',
    goalWeightKg: 75,
    heightCm: 178,
    dateOfBirth: undefined,
    sex: undefined,
  })
  // PocketBase record ID for settings (needed for update calls)
  const settingsRecordId = ref<string | null>(null)

  const weightTimeRange = ref<TimeRange>(90)
  const calorieTimeRange = ref<TimeRange>(30)
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
      const dateBoundFilter = pb.filter(
        'user = {:userId} && date >= {:cutoff}',
        { userId, cutoff: cutoffISO(365) },
      )

      const [weightRecords, calorieRecords, kcalGoalRecords, settingsRecords] = await Promise.all([
        pb.collection<WeightEntryRecord>(COLLECTIONS.WEIGHT_ENTRIES).getFullList({ filter: dateBoundFilter, sort: 'date' }),
        pb.collection<CalorieEntryRecord>(COLLECTIONS.CALORIE_ENTRIES).getFullList({ filter: dateBoundFilter, sort: 'date' }),
        pb.collection<KcalGoalChangeRecord>(COLLECTIONS.KCAL_GOAL_HISTORY).getFullList({ filter: userFilter, sort: 'effective_from' }),
        pb.collection<UserSettingsRecord>(COLLECTIONS.USER_SETTINGS).getFullList({ filter: userFilter }),
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
    }
    finally {
      isLoading.value = false
    }
  }

  // ── Realtime subscriptions ──

  function subscribeRealtime() {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const filter = pb.filter('user = {:userId}', { userId })

    pb.collection<WeightEntryRecord>(COLLECTIONS.WEIGHT_ENTRIES).subscribe('*', (e) => {
      if (e.action === 'create') {
        // Skip if already present (optimistic insert or duplicate event)
        if (!entries.value.some(x => x.id === e.record.id))
          entries.value.push(toWeightEntry(e.record))
      }
      else if (e.action === 'update') {
        const idx = entries.value.findIndex(x => x.id === e.record.id)
        if (idx !== -1) entries.value[idx] = toWeightEntry(e.record)
      }
      else if (e.action === 'delete') {
        entries.value = entries.value.filter(x => x.id !== e.record.id)
      }
    }, { filter })

    pb.collection<CalorieEntryRecord>(COLLECTIONS.CALORIE_ENTRIES).subscribe('*', (e) => {
      if (e.action === 'create') {
        if (!calorieEntries.value.some(x => x.id === e.record.id))
          calorieEntries.value.push(toCalorieEntry(e.record))
      }
      else if (e.action === 'update') {
        const idx = calorieEntries.value.findIndex(x => x.id === e.record.id)
        if (idx !== -1) calorieEntries.value[idx] = toCalorieEntry(e.record)
      }
      else if (e.action === 'delete') {
        calorieEntries.value = calorieEntries.value.filter(x => x.id !== e.record.id)
      }
    }, { filter })

    pb.collection<KcalGoalChangeRecord>(COLLECTIONS.KCAL_GOAL_HISTORY).subscribe('*', (e) => {
      if (e.action === 'create') {
        if (!kcalGoalHistory.value.some(x => x.id === e.record.id))
          kcalGoalHistory.value.push(toKcalGoalChange(e.record))
      }
      else if (e.action === 'update') {
        const idx = kcalGoalHistory.value.findIndex(x => x.id === e.record.id)
        if (idx !== -1) kcalGoalHistory.value[idx] = toKcalGoalChange(e.record)
      }
      else if (e.action === 'delete') {
        kcalGoalHistory.value = kcalGoalHistory.value.filter(x => x.id !== e.record.id)
      }
    }, { filter })

    pb.collection<UserSettingsRecord>(COLLECTIONS.USER_SETTINGS).subscribe('*', (e) => {
      if (e.action === 'update' || e.action === 'create') {
        settings.value = toUserSettings(e.record)
        settingsRecordId.value = e.record.id
      }
    }, { filter })
  }

  function unsubscribeRealtime() {
    pb.collection(COLLECTIONS.WEIGHT_ENTRIES).unsubscribe('*')
    pb.collection(COLLECTIONS.CALORIE_ENTRIES).unsubscribe('*')
    pb.collection(COLLECTIONS.KCAL_GOAL_HISTORY).unsubscribe('*')
    pb.collection(COLLECTIONS.USER_SETTINGS).unsubscribe('*')
  }

  function reset() {
    unsubscribeRealtime()
    entries.value = []
    calorieEntries.value = []
    kcalGoalHistory.value = []
    settings.value = { unit: 'kg', goalWeightKg: 75, heightCm: 178, dateOfBirth: undefined, sex: undefined }
    settingsRecordId.value = null
    isSynced.value = false
  }

  // ── Settings helpers ──

  async function persistSettings(patch: Partial<UserSettings>) {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const next = { ...settings.value, ...patch }
    settings.value = next

    const     payload = {
      user: userId,
      unit: next.unit,
      goal_weight_kg: next.goalWeightKg,
      height_cm: next.heightCm,
      date_of_birth: next.dateOfBirth ?? '',
      sex: next.sex ?? '',
      goal_direction: next.goalDirection ?? '',
    }

    if (settingsRecordId.value) {
      await pb.collection(COLLECTIONS.USER_SETTINGS).update(settingsRecordId.value, payload)
    }
    else {
      const rec = await pb.collection<UserSettingsRecord>(COLLECTIONS.USER_SETTINGS).create(payload)
      settingsRecordId.value = rec.id
    }

    // Sync weight goal for groups when goal weight changes
    const sorted = [...entries.value].sort((a, b) => a.date.localeCompare(b.date))
    const latestWeight = sorted.at(-1)?.weightKg
    if (next.goalWeightKg && latestWeight) {
      useGroupsStore().syncWeightGoal(latestWeight, next.goalWeightKg, next.unit, next.goalDirection)
    }
  }

  // ── Weight getters ──

  const sortedEntries = computed(() =>
    [...entries.value].sort((a, b) => a.date.localeCompare(b.date)),
  )

  const filteredEntries = computed(() => {
    const cutoffStr = cutoffISO(weightTimeRange.value)
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

  // WHO BMI category (delegated to shared composable)
  const bmiCategory = computed(() => getBmiCategory(bmi.value))

  // Healthy weight range (BMI 18.5–24.9) at user's height
  const healthyWeightRange = computed((): { minKg: number; maxKg: number } | null => {
    if (!settings.value.heightCm) return null
    const heightM = settings.value.heightCm / 100
    const minKg = Math.round(18.5 * heightM * heightM * 10) / 10
    const maxKg = Math.round(24.9 * heightM * heightM * 10) / 10
    return { minKg, maxKg }
  })

  // How many kg to gain/lose to reach the healthy BMI range (negative = need to lose, positive = need to gain)
  const weightToHealthyBmi = computed((): number | null => {
    const w = currentWeight.value
    const range = healthyWeightRange.value
    if (w === null || range === null) return null
    if (w < range.minKg) return Math.round((range.minKg - w) * 10) / 10 // need to gain
    if (w > range.maxKg) return Math.round((range.maxKg - w) * 10) / 10 // negative = need to lose
    return 0 // already in range
  })

  // Age derived from dateOfBirth
  const age = computed((): number | null => {
    const dob = settings.value.dateOfBirth
    if (!dob) return null
    const birth = new Date(dob)
    const today = new Date()
    let years = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      years--
    }
    return years >= 0 ? years : null
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
    const currentWeekKey = getISOWeekKey(today.value)
    const weekEntries = sortedEntries.value.filter(e => getISOWeekKey(e.date) === currentWeekKey)
    if (weekEntries.length === 0) return null
    const avg = weekEntries.reduce((s, e) => s + e.weightKg, 0) / weekEntries.length
    return { avg: Math.round(avg * 100) / 100, count: weekEntries.length }
  })

  const monthlyAverage = computed<{ avg: number; count: number } | null>(() => {
    const currentMonthKey = today.value.slice(0, 7)
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
    return getGlobalKcalGoalForDate(today.value)
  })

  function getGlobalKcalGoalForDate(date: string): number | null {
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
    const entry = calorieEntries.value.find(e => e.date === date)
    if (entry?.goalOverrideKcal != null) {
      return { goal: entry.goalOverrideKcal, source: 'override' }
    }
    const globalGoal = getGlobalKcalGoalForDate(date)
    if (globalGoal !== null) {
      return { goal: globalGoal, source: 'global' }
    }
    return { goal: null, source: 'none' }
  }

  // ── Derived daily calorie rows — only dates with a logged entry ──

  const dailyCalorieRows = computed((): DailyCalorieRow[] => {
    const cutoffStr = cutoffISO(calorieTimeRange.value)

    // Only include entries within the time range, sorted oldest → newest
    const inRange = [...calorieEntries.value]
      .filter(e => e.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date))

    return inRange.map((entry) => {
      const { goal, source } = getEffectiveKcalGoal(entry.date)
      const consumed = entry.calories

      let delta: number | null = null
      let exceeded = false
      if (consumed !== null && goal !== null) {
        delta = consumed - goal
        exceeded = consumed > goal
      }

      return {
        date: entry.date,
        consumedKcal: consumed,
        goalKcal: goal,
        goalSource: source,
        deltaKcal: delta,
        isExceeded: exceeded,
        hasEntry: true,
        note: entry.note,
      }
    })
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
    const row = dailyCalorieRows.value.find(r => r.date === today.value)
    return row ?? null
  })

  const weeklyCalorieAverage = computed<number | null>(() => {
    const currentWeekKey = getISOWeekKey(today.value)
    const weekRows = dailyCalorieRows.value.filter(
      r => r.consumedKcal !== null && getISOWeekKey(r.date) === currentWeekKey,
    )
    if (weekRows.length === 0) return null
    const sum = weekRows.reduce((s, r) => s + r.consumedKcal!, 0)
    return Math.round(sum / weekRows.length)
  })

  // ── Weight actions ──

  async function addEntry(entry: Omit<WeightEntry, 'id'>) {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const existing = entries.value.find(e => e.date === entry.date)

    if (existing) {
      await pb.collection(COLLECTIONS.WEIGHT_ENTRIES).update(existing.id, {
        weight_kg: entry.weightKg,
        note: entry.note ?? '',
      })
      const idx = entries.value.findIndex(e => e.id === existing.id)
      if (idx !== -1) entries.value[idx] = { ...existing, weightKg: entry.weightKg, note: entry.note }
    }
    else {
      try {
        const rec = await pb.collection<WeightEntryRecord>(COLLECTIONS.WEIGHT_ENTRIES).create({
          user: userId,
          date: entry.date,
          weight_kg: entry.weightKg,
          note: entry.note ?? '',
        })
        if (!entries.value.some(e => e.id === rec.id)) {
          entries.value.push(toWeightEntry(rec))
        }
      }
      catch {
        toast.error('Failed to save weight entry. Please try again.')
      }
    }

    // Sync weight goal for groups
    if (settings.value.goalWeightKg) {
      useGroupsStore().syncWeightGoal(entry.weightKg, settings.value.goalWeightKg, settings.value.unit, settings.value.goalDirection)
    }
  }

  async function updateEntry(id: string, patch: Partial<Pick<WeightEntry, 'weightKg' | 'note'>>) {
    const existing = entries.value.find(e => e.id === id)
    if (!existing) return

    const payload: Record<string, unknown> = {}
    if (patch.weightKg !== undefined) payload.weight_kg = patch.weightKg
    if (patch.note !== undefined) payload.note = patch.note ?? ''

    await pb.collection(COLLECTIONS.WEIGHT_ENTRIES).update(id, payload)
    const idx = entries.value.findIndex(e => e.id === id)
    if (idx !== -1) entries.value[idx] = { ...existing, ...patch }
  }

  async function deleteEntry(id: string) {
    await pb.collection(COLLECTIONS.WEIGHT_ENTRIES).delete(id)
    entries.value = entries.value.filter(e => e.id !== id)
  }

  function setUnit(unit: 'kg' | 'lbs') {
    persistSettings({ unit })
  }

  function setWeightTimeRange(range: TimeRange) {
    weightTimeRange.value = range
  }

  function setCalorieTimeRange(range: TimeRange) {
    calorieTimeRange.value = range
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
    const existing = kcalGoalHistory.value.find(g => g.effectiveFrom === today)
    if (existing) {
      // Update existing
      await pb.collection(COLLECTIONS.KCAL_GOAL_HISTORY).update(existing.id, { kcal })
      kcalGoalHistory.value = kcalGoalHistory.value.map(g =>
        g.effectiveFrom === today ? { ...g, kcal } : g,
      )
    }
    else {
      try {
        const rec = await pb.collection<KcalGoalChangeRecord>(COLLECTIONS.KCAL_GOAL_HISTORY).create({
          user: userId,
          effective_from: today,
          kcal,
        })
        if (!kcalGoalHistory.value.some(g => g.id === rec.id)) {
          kcalGoalHistory.value.push(toKcalGoalChange(rec))
        }
      }
      catch {
        toast.error('Failed to set calorie goal. Please try again.')
      }
    }
  }

  async function upsertCalorieEntry(date: string, patch: Partial<Pick<CalorieEntry, 'calories' | 'goalOverrideKcal' | 'note'>>) {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const existing = calorieEntries.value.find(e => e.date === date)

    if (existing) {
      const updated = { ...existing, ...patch }
      await pb.collection(COLLECTIONS.CALORIE_ENTRIES).update(existing.id, {
        calories: updated.calories,
        goal_override_kcal: updated.goalOverrideKcal ?? null,
        note: updated.note ?? '',
      })
      const idx = calorieEntries.value.findIndex(e => e.date === date)
      if (idx !== -1) calorieEntries.value[idx] = updated
    }
    else {
      try {
        const newEntry = { date, calories: null, ...patch }
        const rec = await pb.collection<CalorieEntryRecord>(COLLECTIONS.CALORIE_ENTRIES).create({
          user: userId,
          date,
          calories: newEntry.calories,
          goal_override_kcal: newEntry.goalOverrideKcal ?? null,
          note: newEntry.note ?? '',
        })
        if (!calorieEntries.value.some(e => e.id === rec.id)) {
          calorieEntries.value.push(toCalorieEntry(rec))
        }
      }
      catch {
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

  async function saveDailyCalories(payload: { date: string; calories: number | null; goalOverrideKcal: number | null; note?: string }) {
    // Merge both fields in a single upsert to avoid two round-trips
    await upsertCalorieEntry(payload.date, {
      calories: payload.calories,
      goalOverrideKcal: payload.goalOverrideKcal,
      ...(payload.note !== undefined ? { note: payload.note } : {}),
    })
  }

  async function deleteCalorieEntry(date: string) {
    const entry = calorieEntries.value.find(e => e.date === date)
    if (!entry) return

    await pb.collection(COLLECTIONS.CALORIE_ENTRIES).delete(entry.id)
    calorieEntries.value = calorieEntries.value.filter(e => e.date !== date)
  }

  async function resetUserData() {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const userFilter = pb.filter('user = {:userId}', { userId })

    const [weightRecords, calorieRecords, kcalGoalRecords, goalRecords] = await Promise.all([
      pb.collection<WeightEntryRecord>(COLLECTIONS.WEIGHT_ENTRIES).getFullList({ filter: userFilter }),
      pb.collection<CalorieEntryRecord>(COLLECTIONS.CALORIE_ENTRIES).getFullList({ filter: userFilter }),
      pb.collection<KcalGoalChangeRecord>(COLLECTIONS.KCAL_GOAL_HISTORY).getFullList({ filter: userFilter }),
      pb.collection<GoalRecord>(COLLECTIONS.GOALS).getFullList({ filter: userFilter }),
    ])

    await Promise.all([
      ...weightRecords.map(record => pb.collection(COLLECTIONS.WEIGHT_ENTRIES).delete(record.id)),
      ...calorieRecords.map(record => pb.collection(COLLECTIONS.CALORIE_ENTRIES).delete(record.id)),
      ...kcalGoalRecords.map(record => pb.collection(COLLECTIONS.KCAL_GOAL_HISTORY).delete(record.id)),
      ...goalRecords.map(record => pb.collection(COLLECTIONS.GOALS).delete(record.id)),
    ])

    entries.value = []
    calorieEntries.value = []
    kcalGoalHistory.value = []
  }

  return {
    // Weight
    entries,
    settings,
    weightTimeRange,
    calorieTimeRange,
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
    settingsRecordId,
    // Lifecycle
    loadAll,
    subscribeRealtime,
    unsubscribeRealtime,
    reset,
  }
})
