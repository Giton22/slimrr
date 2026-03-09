import PocketBase from 'pocketbase'
import type { RecordModel } from 'pocketbase'

// ── PocketBase client (singleton) ──

const configuredPbUrl = import.meta.env.VITE_PB_URL?.trim()
const pocketbaseUrl = new URL(configuredPbUrl || '/', window.location.origin).toString()

export const pb = new PocketBase(pocketbaseUrl)

// Keep auth token fresh across page reloads automatically
pb.autoCancellation(false)

// ── PocketBase collection record types ──
// Each extends RecordModel which adds: id, collectionId, collectionName, created, updated

export interface WeightEntryRecord extends RecordModel {
  user: string // relation → users
  date: string // YYYY-MM-DD
  weight_kg: number
  note: string
}

export interface CalorieEntryRecord extends RecordModel {
  user: string
  date: string
  calories: number | null
  goal_override_kcal: number | null
  note: string
}

export interface KcalGoalChangeRecord extends RecordModel {
  user: string
  effective_from: string
  kcal: number
}

export interface UserSettingsRecord extends RecordModel {
  user: string // one-to-one with users
  unit: 'kg' | 'lbs'
  goal_weight_kg: number
  height_cm: number
  date_of_birth: string // YYYY-MM-DD or ''
  sex: 'male' | 'female' | ''
  goal_direction: 'loss' | 'gain' | ''
}

export interface GroupRecord extends RecordModel {
  name: string
  description: string
  invite_code: string
  created_by: string
}

export interface GroupMemberRecord extends RecordModel {
  group: string
  user: string
  role: 'owner' | 'member'
}

export interface GoalRecord extends RecordModel {
  user: string
  title: string
  description: string
  target_value: number
  current_value: number
  unit: string
  visibility: 'private' | 'group' | 'public'
  status: 'active' | 'completed' | 'abandoned'
  due_date: string
}

// ── Collection name constants ──

export const COLLECTIONS = {
  WEIGHT_ENTRIES: 'weight_entries',
  CALORIE_ENTRIES: 'calorie_entries',
  KCAL_GOAL_HISTORY: 'kcal_goal_history',
  USER_SETTINGS: 'user_settings',
  GROUPS: 'groups',
  GROUP_MEMBERS: 'group_members',
  GOALS: 'goals',
} as const
