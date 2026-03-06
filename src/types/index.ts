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

export type WeightUnit = 'kg' | 'lbs'

export type TimeRange = 7 | 30 | 60 | 90

export interface UserSettings {
  unit: WeightUnit
  goalWeightKg: number
  heightCm: number
}
