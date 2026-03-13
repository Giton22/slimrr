import type { GoalDirection } from '@/types'

export type CalorieStatusTone = 'target' | 'near' | 'mild' | 'moderate' | 'severe'

export interface CalorieStatus {
  label: string
  side: 'under' | 'over' | 'target'
  isAlignedWithGoal: boolean
  deviationPct: number
  tone: CalorieStatusTone
  chartColor: string
  badgeClass: string
  textClass: string
}

function getTone(deviationPct: number): CalorieStatusTone {
  if (deviationPct === 0) return 'target'
  if (deviationPct <= 0.05) return 'near'
  if (deviationPct <= 0.10) return 'mild'
  if (deviationPct <= 0.20) return 'moderate'
  return 'severe'
}

function getToneClasses(tone: CalorieStatusTone, isAlignedWithGoal: boolean): { badgeClass: string; textClass: string } {
  if (tone === 'target') {
    return {
      badgeClass: 'border-transparent bg-emerald-500 text-white dark:bg-emerald-500/85',
      textClass: 'text-emerald-600 dark:text-emerald-400',
    }
  }

  if (isAlignedWithGoal) {
    switch (tone) {
      case 'near':
        return {
          badgeClass: 'border-transparent bg-emerald-500 text-white dark:bg-emerald-500/85',
          textClass: 'text-emerald-600 dark:text-emerald-400',
        }
      case 'mild':
        return {
          badgeClass: 'border-transparent bg-green-500 text-white dark:bg-green-500/85',
          textClass: 'text-green-600 dark:text-green-400',
        }
      case 'moderate':
        return {
          badgeClass: 'border-transparent bg-green-600 text-white dark:bg-green-600/85',
          textClass: 'text-green-700 dark:text-green-400',
        }
      case 'severe':
        return {
          badgeClass: 'border-transparent bg-green-700 text-white dark:bg-green-700/85',
          textClass: 'text-green-700 dark:text-green-400',
        }
      default:
        return {
          badgeClass: 'border-transparent bg-emerald-500 text-white dark:bg-emerald-500/85',
          textClass: 'text-emerald-600 dark:text-emerald-400',
        }
    }
  }

  switch (tone) {
    case 'near':
      return {
        badgeClass: 'border-transparent bg-amber-500 text-white dark:bg-amber-500/85',
        textClass: 'text-amber-600 dark:text-amber-400',
      }
    case 'mild':
      return {
        badgeClass: 'border-transparent bg-orange-500 text-white dark:bg-orange-500/85',
        textClass: 'text-orange-600 dark:text-orange-400',
      }
    case 'moderate':
      return {
        badgeClass: 'border-transparent bg-orange-600 text-white dark:bg-orange-600/85',
        textClass: 'text-orange-700 dark:text-orange-400',
      }
    case 'severe':
      return {
        badgeClass: 'border-transparent bg-red-500 text-white dark:bg-red-500/85',
        textClass: 'text-red-600 dark:text-red-400',
      }
    default:
      return {
        badgeClass: 'border-transparent bg-amber-500 text-white dark:bg-amber-500/85',
        textClass: 'text-amber-600 dark:text-amber-400',
      }
  }
}

function getChartColor(tone: CalorieStatusTone, isAlignedWithGoal: boolean): string {
  if (tone === 'target') return '#10b981'

  if (isAlignedWithGoal) {
    switch (tone) {
      case 'near':
        return '#22c55e'
      case 'mild':
        return '#16a34a'
      case 'moderate':
        return '#15803d'
      case 'severe':
        return '#166534'
      default:
        return '#22c55e'
    }
  }

  switch (tone) {
    case 'near':
      return '#f59e0b'
    case 'mild':
      return '#f97316'
    case 'moderate':
      return '#ea580c'
    case 'severe':
      return '#dc2626'
    default:
      return '#f59e0b'
  }
}

export function getCalorieStatus(
  consumedKcal: number | null,
  goalKcal: number | null,
  goalDirection?: GoalDirection,
): CalorieStatus | null {
  if (consumedKcal === null || goalKcal === null || goalKcal <= 0) return null

  const delta = Math.round(consumedKcal - goalKcal)
  const deviationPct = Math.abs(delta) / goalKcal
  const tone = getTone(deviationPct)
  const direction = goalDirection ?? 'loss'
  const isAlignedWithGoal = delta === 0
    || (direction === 'loss' ? delta < 0 : delta > 0)
  const { badgeClass, textClass } = getToneClasses(tone, isAlignedWithGoal)
  const chartColor = getChartColor(tone, isAlignedWithGoal)

  if (delta === 0) {
    return {
      label: 'On target',
      side: 'target',
      isAlignedWithGoal,
      deviationPct,
      tone,
      chartColor,
      badgeClass,
      textClass,
    }
  }

  if (delta > 0) {
    return {
      label: `+${delta} over`,
      side: 'over',
      isAlignedWithGoal,
      deviationPct,
      tone,
      chartColor,
      badgeClass,
      textClass,
    }
  }

  return {
    label: `${Math.abs(delta)} under`,
    side: 'under',
    isAlignedWithGoal,
    deviationPct,
    tone,
    chartColor,
    badgeClass,
    textClass,
  }
}
