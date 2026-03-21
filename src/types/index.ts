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

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type FoodSource = 'manual' | 'openfoodfacts' | 'nutrition_label'
export type FoodDashboardTab = 'frequent' | 'recent' | 'favorites'
export type DashboardNextActionKind = 'log-weight' | 'add-meal' | 'review' | 'settings'
export type FoodSearchSource =
  | 'personal'
  | 'openfoodfacts'
  | 'recent'
  | 'favorite'
  | 'frequent'
  | 'barcode'
  | 'ai'

export interface FoodItem {
  id: string
  name: string
  brand?: string
  barcode?: string
  caloriesPer100g: number
  proteinPer100g?: number
  carbsPer100g?: number
  fatPer100g?: number
  defaultServingG: number
  source: FoodSource
  offId?: string
}

export interface FoodLogEntry {
  id: string
  date: string
  mealType: MealType
  foodItem?: string
  foodName: string
  amountG: number
  calories: number
  protein?: number
  carbs?: number
  fat?: number
  note?: string
}

export interface FoodFavorite {
  id: string
  foodItem: string
  created: string
}

export interface FoodRecent {
  id: string
  foodItem: string
  lastLoggedAt: string
  lastLoggedDate: string
  lastMealType: MealType
  lastAmountG: number
  timesLogged: number
}

export interface FoodFrequent {
  id: string
  foodItem: string
  lastLoggedAt: string
  lastLoggedDate: string
  lastMealType: MealType
  lastAmountG: number
  timesLogged: number
}

export interface MealQuickSuggestion {
  foodItem: FoodItem
  amountG: number
  mealType: MealType
  source: 'recent' | 'frequent'
}

export interface DashboardNextAction {
  id: string
  kind: DashboardNextActionKind
  label: string
  description: string
  mealType?: MealType
  route?: string
  hash?: string
  priority: number
}

export interface DailyFoodSummary {
  meals: Record<MealType, FoodLogEntry[]>
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
}

export type WeightUnit = 'kg' | 'lbs'

export type TimeRange = 7 | 30 | 90 | 'custom'

export type Sex = 'male' | 'female'
export type GoalDirection = 'loss' | 'gain'

export interface UserSettings {
  unit: WeightUnit
  goalWeightKg: number | null
  heightCm: number
  dateOfBirth?: string // YYYY-MM-DD
  sex?: Sex
  goalDirection?: GoalDirection
  proteinGoalG?: number
  carbsGoalG?: number
  fatGoalG?: number
  dashboardLayout?: { id: string; visible: boolean }[]
}
