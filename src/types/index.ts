export interface WeightEntry {
  id: string
  date: string // ISO date string YYYY-MM-DD
  weightKg: number
  note?: string
}

export interface CalorieEntry {
  id: string
  date: string // ISO date string YYYY-MM-DD
  calories: number | null // null = not logged yet
  goalOverrideKcal?: number | null // per-day override, null/undefined = use global
  note?: string
}

export interface KcalGoalChange {
  id: string
  effectiveFrom: string // ISO date string YYYY-MM-DD
  kcal: number
}

export interface DailyCalorieRow {
  date: string
  consumedKcal: number | null
  goalKcal: number | null
  goalSource: 'global' | 'override' | 'none'
  deltaKcal: number | null // consumed - goal, null if either is missing
  isExceeded: boolean
  hasEntry: boolean // whether a CalorieEntry exists for this date
  note?: string
}

export type GoalVisibility = 'private' | 'group' | 'public'
export type GoalStatus = 'active' | 'completed' | 'abandoned'
export type GroupRole = 'owner' | 'member'

export interface Group {
  id: string
  name: string
  description?: string
  inviteCode: string
  createdBy: string
}

export interface GroupMember {
  id: string
  group: string
  user: string
  role: GroupRole
  expand?: {
    user?: { id: string; name?: string; username?: string; email?: string }
  }
}

export interface Goal {
  id: string
  user: string
  title: string
  description?: string
  targetValue?: number
  currentValue: number
  unit?: string
  visibility: GoalVisibility
  status: GoalStatus
  dueDate?: string
  updated: string
}

export type WeightUnit = 'kg' | 'lbs'

export type TimeRange = 7 | 30 | 90 | 'custom'

export type Sex = 'male' | 'female'
export type GoalDirection = 'loss' | 'gain'

export interface UserSettings {
  unit: WeightUnit
  goalWeightKg: number
  heightCm: number
  dateOfBirth?: string // YYYY-MM-DD
  sex?: Sex
  goalDirection?: GoalDirection
}
