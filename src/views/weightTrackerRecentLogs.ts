export type GoalDirection = 'loss' | 'gain'

const KG_TO_LBS = 2.20462

function kgToLbs(weightKg: number): number {
  return Math.round(weightKg * KG_TO_LBS * 10) / 10
}

export function roundWeightForDisplay(weightKg: number, unit: 'kg' | 'lbs'): number {
  return unit === 'kg' ? Math.round(weightKg * 10) / 10 : kgToLbs(weightKg)
}

export function getRecentLogDisplayDiff(
  currentWeightKg: number,
  previousWeightKg: number,
  unit: 'kg' | 'lbs',
): number {
  const current = roundWeightForDisplay(currentWeightKg, unit)
  const previous = roundWeightForDisplay(previousWeightKg, unit)
  return Math.round((current - previous) * 10) / 10
}

export function formatRecentLogDisplayDiff(diff: number, unit: 'kg' | 'lbs'): string {
  const sign = diff > 0 ? '+' : ''
  return `${sign}${diff} ${unit}`
}

export function getRecentLogChangeClass(diff: number, goalDirection: GoalDirection): string {
  if (diff === 0) return 'bg-muted text-muted-foreground'
  if (goalDirection === 'loss') {
    return diff < 0
      ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
  }
  return diff > 0
    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
}

export function getDeleteWeightEntryDescription(dateLabel: string): string {
  return `Are you sure you want to delete the weight entry for ${dateLabel}? This action cannot be undone.`
}
