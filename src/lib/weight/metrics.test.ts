import { describe, expect, it } from 'vite-plus/test'
import {
  averageWeightEntries,
  buildWeightChartData,
  calculateAge,
  calculateBmi,
  calculateHealthyWeightRange,
  calculatePeriodWeightAverage,
  calculateWeightToHealthyBmi,
  calculateWeightTrend,
  filterWeightEntries,
  getISOWeekKey,
} from '@/lib/weight/metrics'

describe('weight metrics helpers', () => {
  it('filters entries by custom date range', () => {
    const entries = [
      { id: '1', date: '2026-03-01', weightKg: 80 },
      { id: '2', date: '2026-03-10', weightKg: 79.8 },
      { id: '3', date: '2026-03-20', weightKg: 79.2 },
    ]

    expect(
      filterWeightEntries(entries, 'custom', { start: '2026-03-05', end: '2026-03-15' }),
    ).toEqual([{ id: '2', date: '2026-03-10', weightKg: 79.8 }])
  })

  it('averages weekly and monthly entries', () => {
    const entries = [
      { id: '1', date: '2026-03-03', weightKg: 80 },
      { id: '2', date: '2026-03-04', weightKg: 79.6 },
      { id: '3', date: '2026-03-18', weightKg: 79 },
    ]

    expect(averageWeightEntries(entries, 'weekly')).toEqual([
      { id: '2', date: '2026-03-04', weightKg: 79.8 },
      { id: '3', date: '2026-03-18', weightKg: 79 },
    ])
    expect(averageWeightEntries(entries, 'monthly')).toEqual([
      { id: '3', date: '2026-03-18', weightKg: 79.53 },
    ])
  })

  it('calculates bmi and healthy range values', () => {
    const range = calculateHealthyWeightRange(180)

    expect(calculateBmi(81, 180)).toBe(25)
    expect(range).toEqual({ minKg: 59.9, maxKg: 80.7 })
    expect(calculateWeightToHealthyBmi(83, range)).toBe(-2.3)
  })

  it('calculates age using the provided clock', () => {
    expect(calculateAge('1990-03-25', new Date('2026-03-21T12:00:00Z'))).toBe(35)
    expect(calculateAge('1990-03-20', new Date('2026-03-21T12:00:00Z'))).toBe(36)
  })

  it('calculates recent trend and period averages', () => {
    const entries = [
      { id: '1', date: '2026-03-01', weightKg: 81 },
      { id: '2', date: '2026-03-02', weightKg: 80.8 },
      { id: '3', date: '2026-03-03', weightKg: 80.7 },
      { id: '4', date: '2026-03-04', weightKg: 80.5 },
      { id: '5', date: '2026-03-05', weightKg: 80.3 },
      { id: '6', date: '2026-03-06', weightKg: 80.2 },
      { id: '7', date: '2026-03-07', weightKg: 80 },
      { id: '8', date: '2026-03-08', weightKg: 79.9 },
      { id: '9', date: '2026-03-09', weightKg: 79.8 },
      { id: '10', date: '2026-03-10', weightKg: 79.7 },
      { id: '11', date: '2026-03-11', weightKg: 79.6 },
      { id: '12', date: '2026-03-12', weightKg: 79.4 },
      { id: '13', date: '2026-03-13', weightKg: 79.3 },
      { id: '14', date: '2026-03-14', weightKg: 79.1 },
    ]

    expect(calculateWeightTrend(entries)).toBe(-0.96)
    expect(
      calculatePeriodWeightAverage(entries, getISOWeekKey('2026-03-10'), getISOWeekKey),
    ).toEqual({
      avg: 79.48,
      count: 6,
    })
  })

  it('builds chart points from dates and weights', () => {
    const points = buildWeightChartData([{ id: '1', date: '2026-03-10', weightKg: 79.7 }])
    expect(points).toEqual([{ date: new Date('2026-03-10').getTime(), weight: 79.7 }])
  })
})
