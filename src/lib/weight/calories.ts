import type { CalorieEntry, DailyCalorieRow, KcalGoalChange } from '@/types'
import type { CustomDateRange } from '@/lib/weight/metrics'
import { getISOWeekKey, isDateInRange } from '@/lib/weight/metrics'

export function getGlobalKcalGoalForDate(goals: KcalGoalChange[], date: string): number | null {
  let result: number | null = null
  for (const change of goals) {
    if (change.effectiveFrom <= date) {
      result = change.kcal
    } else {
      break
    }
  }
  return result
}

export function buildDailyCalorieRows(options: {
  calorieEntries: CalorieEntry[]
  foodSummaries: Map<string, { totalCalories: number }>
  goals: KcalGoalChange[]
  range: 7 | 30 | 90 | 'custom'
  customRange: CustomDateRange | null
}): DailyCalorieRow[] {
  const { calorieEntries, foodSummaries, goals, range, customRange } = options

  const dateSet = new Set<string>()
  for (const entry of calorieEntries) {
    if (isDateInRange(entry.date, range, customRange)) {
      dateSet.add(entry.date)
    }
  }
  for (const [date] of foodSummaries) {
    if (isDateInRange(date, range, customRange)) {
      dateSet.add(date)
    }
  }

  const allDates = [...dateSet].sort()
  const calorieByDate = new Map<string, CalorieEntry>()
  for (const entry of calorieEntries) {
    calorieByDate.set(entry.date, entry)
  }

  let goalIndex = 0
  let activeGlobalGoal: number | null = null

  return allDates.map((date) => {
    while (goalIndex < goals.length && goals[goalIndex]!.effectiveFrom <= date) {
      activeGlobalGoal = goals[goalIndex]!.kcal
      goalIndex += 1
    }

    const calorieEntry = calorieByDate.get(date)
    const foodSummary = foodSummaries.get(date)

    const hasOverride = calorieEntry?.goalOverrideKcal != null
    const goal = hasOverride ? calorieEntry!.goalOverrideKcal! : activeGlobalGoal
    const goalSource: DailyCalorieRow['goalSource'] = hasOverride
      ? 'override'
      : goal !== null
        ? 'global'
        : 'none'

    let consumed: number | null = null
    if (foodSummary) {
      consumed = foodSummary.totalCalories
    } else if (calorieEntry) {
      consumed = calorieEntry.calories
    }

    let delta: number | null = null
    let exceeded = false
    if (consumed !== null && goal !== null) {
      delta = consumed - goal
      exceeded = consumed > goal
    }

    return {
      date,
      consumedKcal: consumed,
      goalKcal: goal,
      goalSource,
      deltaKcal: delta,
      isExceeded: exceeded,
      hasEntry: true,
      note: calorieEntry?.note,
    }
  })
}

export function buildCalorieChartData(rows: DailyCalorieRow[]) {
  return rows.map((row) => ({
    date: new Date(row.date).getTime(),
    consumed: row.consumedKcal ?? 0,
    goal: row.goalKcal ?? 0,
    exceeded: row.isExceeded,
    hasConsumed: row.consumedKcal !== null,
    hasGoal: row.goalKcal !== null,
  }))
}

export function getTodayCalorieSummary(
  rows: DailyCalorieRow[],
  today: string,
): DailyCalorieRow | null {
  return rows.find((row) => row.date === today) ?? null
}

export function calculateWeeklyCalorieAverage(
  rows: DailyCalorieRow[],
  today: string,
): number | null {
  const currentWeekKey = getISOWeekKey(today)
  const weekRows = rows.filter(
    (row) => row.consumedKcal !== null && getISOWeekKey(row.date) === currentWeekKey,
  )
  if (weekRows.length === 0) return null

  const sum = weekRows.reduce((total, row) => total + row.consumedKcal!, 0)
  return Math.round(sum / weekRows.length)
}
