import type { FoodDashboardTab, MealType } from '@/types'
import { formatDateLong, todayISO } from '@/lib/date'

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const dashboardTabs: FoodDashboardTab[] = ['frequent', 'recent', 'favorites']

export function isMealType(value: unknown): value is MealType {
  return typeof value === 'string' && mealTypes.includes(value as MealType)
}

export function isFoodDashboardTab(value: unknown): value is FoodDashboardTab {
  return typeof value === 'string' && dashboardTabs.includes(value as FoodDashboardTab)
}

export function guessCurrentMeal(date = new Date()): MealType {
  const hour = date.getHours()
  if (hour < 10) return 'breakfast'
  if (hour < 14) return 'lunch'
  if (hour < 17) return 'snack'
  return 'dinner'
}

export function parseNutritionRouteContext(query: Record<string, unknown>) {
  const date =
    typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
      ? query.date
      : todayISO()

  const meal = isMealType(query.meal) ? query.meal : guessCurrentMeal()
  const source = typeof query.source === 'string' ? query.source : 'manual'

  return { date, meal, source }
}

export function mealLabel(meal: MealType) {
  return meal.charAt(0).toUpperCase() + meal.slice(1)
}

export function mealSearchPlaceholder(meal: MealType) {
  return `What did you have for ${meal}?`
}

export function nutritionContextSubtitle(date: string) {
  return formatDateLong(date)
}
