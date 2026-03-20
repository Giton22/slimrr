import { describe, expect, it, vi } from 'vite-plus/test'
import {
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
})
