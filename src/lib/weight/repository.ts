import type { CalorieEntry, KcalGoalChange, UserSettings, WeightEntry } from '@/types'
import { COLLECTIONS, pb } from '@/lib/pocketbase'
import type {
  CalorieEntryRecord,
  GoalRecord,
  KcalGoalChangeRecord,
  UserSettingsRecord,
  WeightEntryRecord,
} from '@/lib/pocketbase'
import { cutoffISO } from '@/lib/weight/metrics'
import { toUserSettings } from '@/lib/weight/settings'

function toWeightEntry(record: WeightEntryRecord): WeightEntry {
  return {
    id: record.id,
    date: record.date,
    weightKg: record.weight_kg,
    note: record.note || undefined,
  }
}

function toCalorieEntry(record: CalorieEntryRecord): CalorieEntry {
  return {
    id: record.id,
    date: record.date,
    calories: record.calories || null,
    goalOverrideKcal: record.goal_override_kcal || undefined,
    note: record.note || undefined,
  }
}

function toKcalGoalChange(record: KcalGoalChangeRecord): KcalGoalChange {
  return {
    id: record.id,
    effectiveFrom: record.effective_from,
    kcal: record.kcal,
  }
}

export interface LoadedWeightStoreData {
  entries: WeightEntry[]
  calorieEntries: CalorieEntry[]
  kcalGoalHistory: KcalGoalChange[]
  settings: UserSettings | null
  settingsRecordId: string | null
}

export async function loadWeightStoreData(
  userId: string,
  lookbackDays = 365,
): Promise<LoadedWeightStoreData> {
  const userFilter = pb.filter('user = {:userId}', { userId })
  const dateBoundFilter = pb.filter('user = {:userId} && date >= {:cutoff}', {
    userId,
    cutoff: cutoffISO(lookbackDays),
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

  const settingsRecord = settingsRecords[0] ?? null

  return {
    entries: weightRecords.map(toWeightEntry),
    calorieEntries: calorieRecords.map(toCalorieEntry),
    kcalGoalHistory: kcalGoalRecords.map(toKcalGoalChange),
    settings: settingsRecord ? toUserSettings(settingsRecord) : null,
    settingsRecordId: settingsRecord?.id ?? null,
  }
}

export interface WeightRealtimeHandlers {
  onWeightEntry: (action: string, entry: WeightEntry) => void
  onCalorieEntry: (action: string, entry: CalorieEntry) => void
  onKcalGoalChange: (action: string, change: KcalGoalChange) => void
  onUserSettings: (settings: UserSettings, recordId: string) => void
}

export function subscribeWeightRealtime(userId: string, handlers: WeightRealtimeHandlers) {
  const filter = pb.filter('user = {:userId}', { userId })

  void pb.collection<WeightEntryRecord>(COLLECTIONS.WEIGHT_ENTRIES).subscribe(
    '*',
    (event) => {
      handlers.onWeightEntry(event.action, toWeightEntry(event.record))
    },
    { filter },
  )

  void pb.collection<CalorieEntryRecord>(COLLECTIONS.CALORIE_ENTRIES).subscribe(
    '*',
    (event) => {
      handlers.onCalorieEntry(event.action, toCalorieEntry(event.record))
    },
    { filter },
  )

  void pb.collection<KcalGoalChangeRecord>(COLLECTIONS.KCAL_GOAL_HISTORY).subscribe(
    '*',
    (event) => {
      handlers.onKcalGoalChange(event.action, toKcalGoalChange(event.record))
    },
    { filter },
  )

  void pb.collection<UserSettingsRecord>(COLLECTIONS.USER_SETTINGS).subscribe(
    '*',
    (event) => {
      if (event.action === 'update' || event.action === 'create') {
        handlers.onUserSettings(toUserSettings(event.record), event.record.id)
      }
    },
    { filter },
  )
}

export function unsubscribeWeightRealtime() {
  void pb.collection(COLLECTIONS.WEIGHT_ENTRIES).unsubscribe('*')
  void pb.collection(COLLECTIONS.CALORIE_ENTRIES).unsubscribe('*')
  void pb.collection(COLLECTIONS.KCAL_GOAL_HISTORY).unsubscribe('*')
  void pb.collection(COLLECTIONS.USER_SETTINGS).unsubscribe('*')
}

export async function saveWeightEntryRecord(
  userId: string,
  entry: Omit<WeightEntry, 'id'>,
  existing?: WeightEntry,
): Promise<WeightEntry> {
  if (existing) {
    await pb.collection(COLLECTIONS.WEIGHT_ENTRIES).update(existing.id, {
      weight_kg: entry.weightKg,
      note: entry.note ?? '',
    })
    return { ...existing, weightKg: entry.weightKg, note: entry.note }
  }

  const record = await pb.collection<WeightEntryRecord>(COLLECTIONS.WEIGHT_ENTRIES).create({
    user: userId,
    date: entry.date,
    weight_kg: entry.weightKg,
    note: entry.note ?? '',
  })

  return toWeightEntry(record)
}

export async function patchWeightEntryRecord(
  id: string,
  patch: Partial<Pick<WeightEntry, 'weightKg' | 'note'>>,
): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (patch.weightKg !== undefined) payload.weight_kg = patch.weightKg
  if (patch.note !== undefined) payload.note = patch.note ?? ''
  await pb.collection(COLLECTIONS.WEIGHT_ENTRIES).update(id, payload)
}

export async function deleteWeightEntryRecord(id: string): Promise<void> {
  await pb.collection(COLLECTIONS.WEIGHT_ENTRIES).delete(id)
}

export async function saveGlobalKcalGoalRecord(
  userId: string,
  effectiveFrom: string,
  kcal: number,
  existing?: KcalGoalChange,
): Promise<KcalGoalChange> {
  if (existing) {
    await pb.collection(COLLECTIONS.KCAL_GOAL_HISTORY).update(existing.id, { kcal })
    return { ...existing, kcal }
  }

  const record = await pb.collection<KcalGoalChangeRecord>(COLLECTIONS.KCAL_GOAL_HISTORY).create({
    user: userId,
    effective_from: effectiveFrom,
    kcal,
  })
  return toKcalGoalChange(record)
}

export async function saveCalorieEntryRecord(
  userId: string,
  date: string,
  patch: Partial<Pick<CalorieEntry, 'calories' | 'goalOverrideKcal' | 'note'>>,
  existing?: CalorieEntry,
): Promise<CalorieEntry> {
  if (existing) {
    const updated = { ...existing, ...patch }
    await pb.collection(COLLECTIONS.CALORIE_ENTRIES).update(existing.id, {
      calories: updated.calories,
      goal_override_kcal: updated.goalOverrideKcal ?? null,
      note: updated.note ?? '',
    })
    return updated
  }

  const newEntry = { date, calories: null, ...patch }
  const record = await pb.collection<CalorieEntryRecord>(COLLECTIONS.CALORIE_ENTRIES).create({
    user: userId,
    date,
    calories: newEntry.calories,
    goal_override_kcal: newEntry.goalOverrideKcal ?? null,
    note: newEntry.note ?? '',
  })
  return toCalorieEntry(record)
}

export async function deleteCalorieEntryRecord(id: string): Promise<void> {
  await pb.collection(COLLECTIONS.CALORIE_ENTRIES).delete(id)
}

export async function resetWeightUserData(userId: string): Promise<void> {
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

  await Promise.all(
    foodLogRecords.map((record) => pb.collection(COLLECTIONS.FOOD_LOG).delete(record.id)),
  )

  await Promise.all([
    ...weightRecords.map((record) => pb.collection(COLLECTIONS.WEIGHT_ENTRIES).delete(record.id)),
    ...calorieRecords.map((record) => pb.collection(COLLECTIONS.CALORIE_ENTRIES).delete(record.id)),
    ...kcalGoalRecords.map((record) =>
      pb.collection(COLLECTIONS.KCAL_GOAL_HISTORY).delete(record.id),
    ),
    ...goalRecords.map((record) => pb.collection(COLLECTIONS.GOALS).delete(record.id)),
    ...foodItemRecords.map((record) => pb.collection(COLLECTIONS.FOOD_ITEMS).delete(record.id)),
  ])
}
