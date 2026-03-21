import { describe, expect, it, vi } from 'vite-plus/test'
import {
  buildDashboardNextActions,
  buildNutritionRouteQuery,
  getQuickMealSuggestions,
  isFoodDashboardTab,
  isMealType,
  mealSearchPlaceholder,
  parseNutritionRouteContext,
} from '@/lib/food-dashboard'

describe('food-dashboard helpers', () => {
  it('parses valid route query context', () => {
    const result = parseNutritionRouteContext({
      date: '2026-03-21',
      meal: 'breakfast',
      source: 'diary',
    })

    expect(result).toEqual({
      date: '2026-03-21',
      meal: 'breakfast',
      source: 'diary',
    })
  })

  it('falls back for invalid route query values', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T08:00:00'))

    const result = parseNutritionRouteContext({
      date: 'not-a-date',
      meal: 'dessert',
    })

    expect(result.date).toBe('2026-03-21')
    expect(result.meal).toBe('breakfast')
    expect(result.source).toBe('manual')

    vi.useRealTimers()
  })

  it('exposes meal and tab guards', () => {
    expect(isMealType('lunch')).toBe(true)
    expect(isMealType('dessert')).toBe(false)
    expect(isFoodDashboardTab('favorites')).toBe(true)
    expect(isFoodDashboardTab('saved')).toBe(false)
  })

  it('builds meal-aware search placeholders', () => {
    expect(mealSearchPlaceholder('breakfast')).toBe('What did you have for breakfast?')
  })

  it('builds a stable nutrition route query for repeated save or cancel actions', () => {
    expect(
      buildNutritionRouteQuery({
        date: '2026-03-21',
        meal: 'dinner',
        source: 'diary',
      }),
    ).toEqual({
      date: '2026-03-21',
      meal: 'dinner',
      source: 'diary',
    })
  })

  it('prioritizes weight logging before meals on an empty day', () => {
    expect(
      buildDashboardNextActions({
        date: '2026-03-21',
        hasWeightEntry: false,
        hasAnyWeightEntries: false,
        mealCounts: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
        hasGoalWeight: true,
        hasCalorieGoal: true,
      }).map((action) => action.kind),
    ).toEqual(['log-weight', 'add-meal'])
  })

  it('uses the current meal for today when it is still missing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T19:00:00'))

    expect(
      buildDashboardNextActions({
        date: '2026-03-21',
        hasWeightEntry: true,
        hasAnyWeightEntries: true,
        mealCounts: { breakfast: 1, lunch: 0, dinner: 0, snack: 1 },
        hasGoalWeight: true,
        hasCalorieGoal: true,
      })[0],
    ).toMatchObject({
      kind: 'add-meal',
      mealType: 'dinner',
    })

    vi.useRealTimers()
  })

  it('falls back to the first missing meal for past dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T19:00:00'))

    expect(
      buildDashboardNextActions({
        date: '2026-03-18',
        hasWeightEntry: true,
        hasAnyWeightEntries: true,
        mealCounts: { breakfast: 1, lunch: 0, dinner: 0, snack: 1 },
        hasGoalWeight: true,
        hasCalorieGoal: true,
      })[0],
    ).toMatchObject({
      kind: 'add-meal',
      mealType: 'lunch',
    })

    vi.useRealTimers()
  })

  it('inserts goal-setting actions when key settings are missing', () => {
    const actions = buildDashboardNextActions({
      date: '2026-03-21',
      hasWeightEntry: true,
      hasAnyWeightEntries: true,
      mealCounts: { breakfast: 1, lunch: 1, dinner: 1, snack: 1 },
      hasGoalWeight: false,
      hasCalorieGoal: false,
    })

    expect(actions[0]).toMatchObject({
      kind: 'settings',
      route: '/profile',
      hash: '#body-info',
    })

    expect(actions[1]).toMatchObject({
      kind: 'settings',
      route: '/profile',
      hash: '#nutrition-goals',
    })
  })

  it('returns actions in descending priority order', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T19:00:00'))

    const actions = buildDashboardNextActions({
      date: '2026-03-21',
      hasWeightEntry: false,
      hasAnyWeightEntries: true,
      mealCounts: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
      hasGoalWeight: false,
      hasCalorieGoal: false,
    })

    expect(actions.map((action) => action.id)).toEqual([
      'set-goal-weight',
      'log-weight',
      'add-dinner',
      'set-calorie-goals',
    ])

    vi.useRealTimers()
  })

  it('builds quick meal suggestions from recent entries first, then frequent fallbacks', () => {
    const suggestions = getQuickMealSuggestions({
      mealType: 'breakfast',
      foodItems: [
        {
          id: 'oats',
          name: 'Oats',
          caloriesPer100g: 389,
          defaultServingG: 60,
          source: 'manual',
        },
        {
          id: 'yogurt',
          name: 'Yogurt',
          caloriesPer100g: 90,
          defaultServingG: 150,
          source: 'manual',
        },
      ],
      recents: [
        {
          id: 'recent-1',
          foodItem: 'oats',
          lastLoggedAt: '2026-03-21 08:00:00',
          lastLoggedDate: '2026-03-21',
          lastMealType: 'breakfast',
          lastAmountG: 75,
          timesLogged: 4,
        },
      ],
      frequent: [
        {
          id: 'freq-1',
          foodItem: 'oats',
          lastLoggedAt: '2026-03-20 08:00:00',
          lastLoggedDate: '2026-03-20',
          lastMealType: 'breakfast',
          lastAmountG: 60,
          timesLogged: 9,
        },
        {
          id: 'freq-2',
          foodItem: 'yogurt',
          lastLoggedAt: '2026-03-19 08:00:00',
          lastLoggedDate: '2026-03-19',
          lastMealType: 'breakfast',
          lastAmountG: 150,
          timesLogged: 6,
        },
      ],
    })

    expect(suggestions).toHaveLength(2)
    expect(suggestions[0]).toMatchObject({
      source: 'recent',
      amountG: 75,
    })
    expect(suggestions[1]).toMatchObject({
      source: 'frequent',
      amountG: 150,
    })
  })
})
