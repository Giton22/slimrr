import { Effect } from 'effect'
import type { GoalDirection, Sex, UserSettings } from '@/types'
import { COLLECTIONS } from '@/lib/pocketbase'
import type { UserSettingsRecord } from '@/lib/pocketbase'
import { fromPbPromise } from '@/lib/effect'

export function createDefaultUserSettings(): UserSettings {
  return {
    unit: 'kg',
    goalWeightKg: null,
    heightCm: 178,
    dateOfBirth: undefined,
    sex: undefined,
    proteinGoalG: undefined,
    carbsGoalG: undefined,
    fatGoalG: undefined,
    dashboardLayout: undefined,
  }
}

export function toUserSettings(record: UserSettingsRecord): UserSettings {
  let dashboardLayout: { id: string; visible: boolean }[] | undefined

  if (record.dashboard_layout) {
    try {
      dashboardLayout =
        typeof record.dashboard_layout === 'string'
          ? JSON.parse(record.dashboard_layout)
          : record.dashboard_layout
    } catch {
      dashboardLayout = undefined
    }
  }

  return {
    unit: record.unit,
    goalWeightKg: record.goal_weight_kg ?? null,
    heightCm: record.height_cm,
    dateOfBirth: record.date_of_birth || undefined,
    sex: (record.sex as Sex) || undefined,
    goalDirection: (record.goal_direction as GoalDirection) || undefined,
    proteinGoalG: record.protein_goal_g || undefined,
    carbsGoalG: record.carbs_goal_g || undefined,
    fatGoalG: record.fat_goal_g || undefined,
    dashboardLayout,
  }
}

export function saveUserSettings(
  userId: string,
  settings: UserSettings,
  settingsRecordId: string | null,
) {
  const payload = {
    user: userId,
    unit: settings.unit,
    goal_weight_kg: settings.goalWeightKg ?? null,
    height_cm: settings.heightCm,
    date_of_birth: settings.dateOfBirth ?? '',
    sex: settings.sex ?? '',
    goal_direction: settings.goalDirection ?? '',
    protein_goal_g: settings.proteinGoalG ?? null,
    carbs_goal_g: settings.carbsGoalG ?? null,
    fat_goal_g: settings.fatGoalG ?? null,
    dashboard_layout: JSON.stringify(settings.dashboardLayout ?? []),
  }

  return Effect.flatMap(
    settingsRecordId ? Effect.succeed(settingsRecordId) : findLatestUserSettingsRecordId(userId),
    (recordId) => {
      if (recordId) {
        return fromPbPromise(
          (pb) => pb.collection(COLLECTIONS.USER_SETTINGS).update(recordId, payload),
          COLLECTIONS.USER_SETTINGS,
        ).pipe(Effect.as(recordId))
      }

      return fromPbPromise(
        (pb) => pb.collection<UserSettingsRecord>(COLLECTIONS.USER_SETTINGS).create(payload),
        COLLECTIONS.USER_SETTINGS,
      ).pipe(Effect.map((record) => record.id))
    },
  )
}

function findLatestUserSettingsRecordId(userId: string) {
  return fromPbPromise(
    (pb) =>
      pb.collection<UserSettingsRecord>(COLLECTIONS.USER_SETTINGS).getFullList({
        filter: pb.filter('user = {:userId}', { userId }),
      }),
    COLLECTIONS.USER_SETTINGS,
  ).pipe(Effect.map((existingSettings) => existingSettings[0]?.id ?? null))
}
