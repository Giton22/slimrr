import { Effect } from 'effect'
import type { CalorieEntry, KcalGoalChange, UserSettings, WeightEntry } from '@/types'
import { fromPbPromise } from '@/lib/effect'
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

export function loadWeightStoreData(userId: string, lookbackDays = 365) {
  const userFilter = pb.filter('user = {:userId}', { userId })
  const dateBoundFilter = pb.filter('user = {:userId} && date >= {:cutoff}', {
    userId,
    cutoff: cutoffISO(lookbackDays),
  })

  return Effect.all(
    {
      weightRecords: fromPbPromise(
        (pb) =>
          pb
            .collection<WeightEntryRecord>(COLLECTIONS.WEIGHT_ENTRIES)
            .getFullList({ filter: dateBoundFilter, sort: 'date' }),
        COLLECTIONS.WEIGHT_ENTRIES,
      ),
      calorieRecords: fromPbPromise(
        (pb) =>
          pb
            .collection<CalorieEntryRecord>(COLLECTIONS.CALORIE_ENTRIES)
            .getFullList({ filter: dateBoundFilter, sort: 'date' }),
        COLLECTIONS.CALORIE_ENTRIES,
      ),
      kcalGoalRecords: fromPbPromise(
        (pb) =>
          pb
            .collection<KcalGoalChangeRecord>(COLLECTIONS.KCAL_GOAL_HISTORY)
            .getFullList({ filter: userFilter, sort: 'effective_from' }),
        COLLECTIONS.KCAL_GOAL_HISTORY,
      ),
      settingsRecords: fromPbPromise(
        (pb) =>
          pb.collection<UserSettingsRecord>(COLLECTIONS.USER_SETTINGS).getFullList({
            filter: userFilter,
          }),
        COLLECTIONS.USER_SETTINGS,
      ),
    },
    { concurrency: 'unbounded' },
  ).pipe(
    Effect.map(({ weightRecords, calorieRecords, kcalGoalRecords, settingsRecords }) => {
      const settingsRecord = settingsRecords[0] ?? null

      return {
        entries: weightRecords.map(toWeightEntry),
        calorieEntries: calorieRecords.map(toCalorieEntry),
        kcalGoalHistory: kcalGoalRecords.map(toKcalGoalChange),
        settings: settingsRecord ? toUserSettings(settingsRecord) : null,
        settingsRecordId: settingsRecord?.id ?? null,
      }
    }),
  )
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

export function saveWeightEntryRecord(
  userId: string,
  entry: Omit<WeightEntry, 'id'>,
  existing?: WeightEntry,
) {
  if (existing) {
    return fromPbPromise(
      (pb) =>
        pb.collection(COLLECTIONS.WEIGHT_ENTRIES).update(existing.id, {
          weight_kg: entry.weightKg,
          note: entry.note ?? '',
        }),
      COLLECTIONS.WEIGHT_ENTRIES,
    ).pipe(Effect.as({ ...existing, weightKg: entry.weightKg, note: entry.note }))
  }

  return fromPbPromise(
    (pb) =>
      pb.collection<WeightEntryRecord>(COLLECTIONS.WEIGHT_ENTRIES).create({
        user: userId,
        date: entry.date,
        weight_kg: entry.weightKg,
        note: entry.note ?? '',
      }),
    COLLECTIONS.WEIGHT_ENTRIES,
  ).pipe(Effect.map(toWeightEntry))
}

export function patchWeightEntryRecord(
  id: string,
  patch: Partial<Pick<WeightEntry, 'weightKg' | 'note'>>,
) {
  const payload: Record<string, unknown> = {}
  if (patch.weightKg !== undefined) payload.weight_kg = patch.weightKg
  if (patch.note !== undefined) payload.note = patch.note ?? ''
  return fromPbPromise(
    (pb) => pb.collection(COLLECTIONS.WEIGHT_ENTRIES).update(id, payload),
    COLLECTIONS.WEIGHT_ENTRIES,
  ).pipe(Effect.asVoid)
}

export function deleteWeightEntryRecord(id: string) {
  return fromPbPromise(
    (pb) => pb.collection(COLLECTIONS.WEIGHT_ENTRIES).delete(id),
    COLLECTIONS.WEIGHT_ENTRIES,
  ).pipe(Effect.asVoid)
}

export function saveGlobalKcalGoalRecord(
  userId: string,
  effectiveFrom: string,
  kcal: number,
  existing?: KcalGoalChange,
) {
  if (existing) {
    return fromPbPromise(
      (pb) => pb.collection(COLLECTIONS.KCAL_GOAL_HISTORY).update(existing.id, { kcal }),
      COLLECTIONS.KCAL_GOAL_HISTORY,
    ).pipe(Effect.as({ ...existing, kcal }))
  }

  return fromPbPromise(
    (pb) =>
      pb.collection<KcalGoalChangeRecord>(COLLECTIONS.KCAL_GOAL_HISTORY).create({
        user: userId,
        effective_from: effectiveFrom,
        kcal,
      }),
    COLLECTIONS.KCAL_GOAL_HISTORY,
  ).pipe(Effect.map(toKcalGoalChange))
}

export function saveCalorieEntryRecord(
  userId: string,
  date: string,
  patch: Partial<Pick<CalorieEntry, 'calories' | 'goalOverrideKcal' | 'note'>>,
  existing?: CalorieEntry,
) {
  if (existing) {
    const updated = { ...existing, ...patch }
    return fromPbPromise(
      (pb) =>
        pb.collection(COLLECTIONS.CALORIE_ENTRIES).update(existing.id, {
          calories: updated.calories,
          goal_override_kcal: updated.goalOverrideKcal ?? null,
          note: updated.note ?? '',
        }),
      COLLECTIONS.CALORIE_ENTRIES,
    ).pipe(Effect.as(updated))
  }

  const newEntry = { date, calories: null, ...patch }
  return fromPbPromise(
    (pb) =>
      pb.collection<CalorieEntryRecord>(COLLECTIONS.CALORIE_ENTRIES).create({
        user: userId,
        date,
        calories: newEntry.calories,
        goal_override_kcal: newEntry.goalOverrideKcal ?? null,
        note: newEntry.note ?? '',
      }),
    COLLECTIONS.CALORIE_ENTRIES,
  ).pipe(Effect.map(toCalorieEntry))
}

export function deleteCalorieEntryRecord(id: string) {
  return fromPbPromise(
    (pb) => pb.collection(COLLECTIONS.CALORIE_ENTRIES).delete(id),
    COLLECTIONS.CALORIE_ENTRIES,
  ).pipe(Effect.asVoid)
}

export function resetWeightUserData(userId: string) {
  const userFilter = pb.filter('user = {:userId}', { userId })

  return Effect.all(
    {
      weightRecords: fromPbPromise(
        (pb) =>
          pb.collection<WeightEntryRecord>(COLLECTIONS.WEIGHT_ENTRIES).getFullList({
            filter: userFilter,
          }),
        COLLECTIONS.WEIGHT_ENTRIES,
      ),
      calorieRecords: fromPbPromise(
        (pb) =>
          pb.collection<CalorieEntryRecord>(COLLECTIONS.CALORIE_ENTRIES).getFullList({
            filter: userFilter,
          }),
        COLLECTIONS.CALORIE_ENTRIES,
      ),
      kcalGoalRecords: fromPbPromise(
        (pb) =>
          pb.collection<KcalGoalChangeRecord>(COLLECTIONS.KCAL_GOAL_HISTORY).getFullList({
            filter: userFilter,
          }),
        COLLECTIONS.KCAL_GOAL_HISTORY,
      ),
      goalRecords: fromPbPromise(
        (pb) => pb.collection<GoalRecord>(COLLECTIONS.GOALS).getFullList({ filter: userFilter }),
        COLLECTIONS.GOALS,
      ),
      foodItemRecords: fromPbPromise(
        (pb) => pb.collection(COLLECTIONS.FOOD_ITEMS).getFullList({ filter: userFilter }),
        COLLECTIONS.FOOD_ITEMS,
      ),
      foodLogRecords: fromPbPromise(
        (pb) => pb.collection(COLLECTIONS.FOOD_LOG).getFullList({ filter: userFilter }),
        COLLECTIONS.FOOD_LOG,
      ),
    },
    { concurrency: 'unbounded' },
  ).pipe(
    Effect.flatMap(
      ({
        weightRecords,
        calorieRecords,
        kcalGoalRecords,
        goalRecords,
        foodItemRecords,
        foodLogRecords,
      }) =>
        Effect.all(
          foodLogRecords.map((record) =>
            fromPbPromise(
              (pb) => pb.collection(COLLECTIONS.FOOD_LOG).delete(record.id),
              COLLECTIONS.FOOD_LOG,
            ),
          ),
          { concurrency: 'unbounded' },
        ).pipe(
          Effect.flatMap(() =>
            Effect.all(
              [
                ...weightRecords.map((record) =>
                  fromPbPromise(
                    (pb) => pb.collection(COLLECTIONS.WEIGHT_ENTRIES).delete(record.id),
                    COLLECTIONS.WEIGHT_ENTRIES,
                  ),
                ),
                ...calorieRecords.map((record) =>
                  fromPbPromise(
                    (pb) => pb.collection(COLLECTIONS.CALORIE_ENTRIES).delete(record.id),
                    COLLECTIONS.CALORIE_ENTRIES,
                  ),
                ),
                ...kcalGoalRecords.map((record) =>
                  fromPbPromise(
                    (pb) => pb.collection(COLLECTIONS.KCAL_GOAL_HISTORY).delete(record.id),
                    COLLECTIONS.KCAL_GOAL_HISTORY,
                  ),
                ),
                ...goalRecords.map((record) =>
                  fromPbPromise(
                    (pb) => pb.collection(COLLECTIONS.GOALS).delete(record.id),
                    COLLECTIONS.GOALS,
                  ),
                ),
                ...foodItemRecords.map((record) =>
                  fromPbPromise(
                    (pb) => pb.collection(COLLECTIONS.FOOD_ITEMS).delete(record.id),
                    COLLECTIONS.FOOD_ITEMS,
                  ),
                ),
              ],
              { concurrency: 'unbounded' },
            ),
          ),
        ),
    ),
    Effect.asVoid,
  )
}
