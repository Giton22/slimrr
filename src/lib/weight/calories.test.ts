import { describe, expect, it } from 'vite-plus/test'
import {
  buildCalorieChartData,
  buildDailyCalorieRows,
  calculateWeeklyCalorieAverage,
  getGlobalKcalGoalForDate,
  getTodayCalorieSummary,
} from '@/lib/weight/calories'

describe('weight calorie helpers', () => {
  it('finds the applicable global goal for a date', () => {
    expect(
      getGlobalKcalGoalForDate(
        [
          { id: '1', effectiveFrom: '2026-03-01', kcal: 2200 },
          { id: '2', effectiveFrom: '2026-03-10', kcal: 2100 },
        ],
        '2026-03-12',
      ),
    ).toBe(2100)
  })

  it('builds daily calorie rows from calorie entries and food logs', () => {
    const rows = buildDailyCalorieRows({
      calorieEntries: [
        {
          id: 'cal-1',
          date: '2026-03-12',
          calories: 2050,
          goalOverrideKcal: 2000,
          note: 'higher activity',
        },
      ],
      foodSummaries: new Map([
        ['2026-03-12', { totalCalories: 1980 }],
        ['2026-03-13', { totalCalories: 2150 }],
      ]),
      goals: [{ id: 'goal-1', effectiveFrom: '2026-03-01', kcal: 2100 }],
      range: 'custom',
      customRange: { start: '2026-03-10', end: '2026-03-15' },
    })

    expect(rows).toEqual([
      {
        date: '2026-03-12',
        consumedKcal: 1980,
        goalKcal: 2000,
        goalSource: 'override',
        deltaKcal: -20,
        isExceeded: false,
        hasEntry: true,
        note: 'higher activity',
      },
      {
        date: '2026-03-13',
        consumedKcal: 2150,
        goalKcal: 2100,
        goalSource: 'global',
        deltaKcal: 50,
        isExceeded: true,
        hasEntry: true,
        note: undefined,
      },
    ])
  })

  it('builds chart data and summary statistics from calorie rows', () => {
    const rows = [
      {
        date: '2026-03-10',
        consumedKcal: 2000,
        goalKcal: 2100,
        goalSource: 'global' as const,
        deltaKcal: -100,
        isExceeded: false,
        hasEntry: true,
        note: undefined,
      },
      {
        date: '2026-03-11',
        consumedKcal: 2200,
        goalKcal: 2100,
        goalSource: 'global' as const,
        deltaKcal: 100,
        isExceeded: true,
        hasEntry: true,
        note: undefined,
      },
    ]

    expect(buildCalorieChartData(rows)).toEqual([
      {
        date: new Date('2026-03-10').getTime(),
        consumed: 2000,
        goal: 2100,
        exceeded: false,
        hasConsumed: true,
        hasGoal: true,
      },
      {
        date: new Date('2026-03-11').getTime(),
        consumed: 2200,
        goal: 2100,
        exceeded: true,
        hasConsumed: true,
        hasGoal: true,
      },
    ])
    expect(getTodayCalorieSummary(rows, '2026-03-11')).toEqual(rows[1])
    expect(calculateWeeklyCalorieAverage(rows, '2026-03-11')).toBe(2100)
  })
})
