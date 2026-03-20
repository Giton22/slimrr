import PocketBase from 'pocketbase'
import type { RecordModel } from 'pocketbase'

// ── PocketBase client (singleton) ──

const configuredPbUrl = import.meta.env.VITE_PB_URL?.trim()
export const pocketbaseUrl = new URL(configuredPbUrl || '/', window.location.origin).toString()

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
  protein_goal_g: number
  carbs_goal_g: number
  fat_goal_g: number
  dashboard_layout: string // JSON string from PocketBase
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

/** GroupMemberRecord with user relation expanded. */
export interface GroupMemberWithUserExpand extends GroupMemberRecord {
  expand?: { user?: { id: string; name?: string; username?: string; email?: string } }
}

/** GroupMemberRecord with group relation expanded. */
export interface GroupMemberWithGroupExpand extends GroupMemberRecord {
  expand?: { group?: GroupRecord }
}

export interface FoodItemRecord extends RecordModel {
  user: string
  name: string
  brand: string
  barcode: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  default_serving_g: number
  source: 'manual' | 'openfoodfacts' | 'nutrition_label'
  off_id: string
}

export interface FoodLogRecord extends RecordModel {
  user: string
  date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  food_item: string
  food_name: string
  amount_g: number
  calories: number
  protein: number
  carbs: number
  fat: number
  note: string
}

export interface FoodFavoriteRecord extends RecordModel {
  user: string
  food_item: string
}

export interface FoodRecentRecord extends RecordModel {
  user: string
  food_item: string
  last_logged_at: string
  last_logged_date: string
  last_meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  last_amount_g: number
  times_logged: number
}

export interface FoodFrequentRecord extends RecordModel {
  user: string
  food_item: string
  last_logged_at: string
  last_logged_date: string
  last_meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  last_amount_g: number
  times_logged: number
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
  FOOD_ITEMS: 'food_items',
  FOOD_LOG: 'food_log',
  FOOD_FAVORITES: 'food_favorites',
  FOOD_RECENTS: 'food_recents',
  FOOD_FREQUENT: 'food_frequent',
} as const
