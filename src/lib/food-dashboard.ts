import type {
  DashboardNextAction,
  FoodDashboardTab,
  FoodFrequent,
  FoodItem,
  FoodRecent,
  MealQuickSuggestion,
  MealType,
} from '@/types'
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

export function buildNutritionRouteQuery(context: {
  date: string
  meal: MealType
  source?: string
}) {
  return {
    date: context.date,
    meal: context.meal,
    source: context.source ?? 'manual',
  }
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

function defaultMealForAction(date: string, missingMeals: MealType[]): MealType {
  if (missingMeals.length === 0) return 'breakfast'
  if (date === todayISO()) {
    const guessed = guessCurrentMeal()
    if (missingMeals.includes(guessed)) return guessed
  }
  return missingMeals[0] ?? 'breakfast'
}

export function buildDashboardNextActions(options: {
  date: string
  hasWeightEntry: boolean
  hasAnyWeightEntries: boolean
  mealCounts: Record<MealType, number>
  hasGoalWeight: boolean
  hasCalorieGoal: boolean
}): DashboardNextAction[] {
  const { date, hasWeightEntry, hasAnyWeightEntries, mealCounts, hasGoalWeight, hasCalorieGoal } =
    options
  const totalMealsLogged = mealTypes.reduce((sum, meal) => sum + mealCounts[meal], 0)
  const missingMeals = mealTypes.filter((meal) => mealCounts[meal] === 0)
  const nextMeal = defaultMealForAction(date, missingMeals)
  const actions: DashboardNextAction[] = []

  if (!hasAnyWeightEntries) {
    actions.push({
      id: 'log-first-weight',
      kind: 'log-weight',
      label: 'Log your first weight',
      description: 'Start with a baseline so Slimrr can coach you from real progress.',
      priority: 700,
    })
  }

  if (!hasGoalWeight) {
    actions.push({
      id: 'set-goal-weight',
      kind: 'settings',
      label: 'Set your goal weight',
      description: 'Add a target so your dashboard can show progress and what to do next.',
      route: '/profile',
      hash: '#body-info',
      priority: 600,
    })
  }

  if (hasAnyWeightEntries && !hasWeightEntry) {
    actions.push({
      id: 'log-weight',
      kind: 'log-weight',
      label: date === todayISO() ? "Log today's weight" : `Log weight for ${formatDateLong(date)}`,
      description:
        totalMealsLogged === 0
          ? 'Start the day with your baseline measurement.'
          : 'Lock in your measurement before you review the day.',
      priority: 500,
    })
  }

  if (totalMealsLogged === 0) {
    actions.push({
      id: `add-${nextMeal}`,
      kind: 'add-meal',
      label: `Add ${mealLabel(nextMeal)}`,
      description: 'Get your first meal logged so your daily summary starts filling in.',
      mealType: nextMeal,
      priority: 400,
    })
  } else if (missingMeals.length > 0) {
    actions.push({
      id: `continue-${nextMeal}`,
      kind: 'add-meal',
      label: `Add ${mealLabel(nextMeal)}`,
      description: `Keep the day complete by filling in ${mealLabel(nextMeal).toLowerCase()}.`,
      mealType: nextMeal,
      priority: 350,
    })
  }

  if (!hasCalorieGoal) {
    actions.push({
      id: 'set-calorie-goals',
      kind: 'settings',
      label: 'Set calorie and macro goals',
      description: 'Add daily targets so the summary and nutrition progress bars become useful.',
      route: '/profile',
      hash: '#nutrition-goals',
      priority: 250,
    })
  }

  if (hasWeightEntry && totalMealsLogged > 0) {
    actions.push({
      id: 'review-day',
      kind: 'review',
      label: date === todayISO() ? "Review today's details" : 'Review details',
      description:
        missingMeals.length === 0
          ? 'Everything is logged. Review your full nutrition breakdown.'
          : 'Review the logged meals and decide what to add next.',
      route: '/nutrition/overview',
      priority: 150,
    })
  }

  return actions
    .sort((a, b) => b.priority - a.priority)
    .filter((action, index, list) => list.findIndex((item) => item.id === action.id) === index)
}

export function getQuickMealSuggestions(options: {
  mealType: MealType
  foodItems: FoodItem[]
  recents: FoodRecent[]
  frequent: FoodFrequent[]
  limit?: number
}): MealQuickSuggestion[] {
  const { mealType, foodItems, recents, frequent, limit = 3 } = options
  const byFoodId = new Map(foodItems.map((item) => [item.id, item]))
  const suggestions: MealQuickSuggestion[] = []
  const seen = new Set<string>()

  const recentMatches = [...recents]
    .filter((entry) => entry.lastMealType === mealType)
    .sort((a, b) => (b.lastLoggedAt ?? '').localeCompare(a.lastLoggedAt ?? ''))

  for (const entry of recentMatches) {
    if (seen.has(entry.foodItem)) continue
    const foodItem = byFoodId.get(entry.foodItem)
    if (!foodItem) continue
    seen.add(entry.foodItem)
    suggestions.push({
      foodItem,
      amountG: entry.lastAmountG || foodItem.defaultServingG || 100,
      mealType,
      source: 'recent',
    })
    if (suggestions.length >= limit) return suggestions
  }

  const frequentMatches = [...frequent]
    .filter((entry) => entry.lastMealType === mealType)
    .sort((a, b) => {
      if (b.timesLogged !== a.timesLogged) return b.timesLogged - a.timesLogged
      return (b.lastLoggedAt ?? '').localeCompare(a.lastLoggedAt ?? '')
    })

  for (const entry of frequentMatches) {
    if (seen.has(entry.foodItem)) continue
    const foodItem = byFoodId.get(entry.foodItem)
    if (!foodItem) continue
    seen.add(entry.foodItem)
    suggestions.push({
      foodItem,
      amountG: entry.lastAmountG || foodItem.defaultServingG || 100,
      mealType,
      source: 'frequent',
    })
    if (suggestions.length >= limit) return suggestions
  }

  return suggestions
}
