import { describe, expect, it } from 'vite-plus/test'
import {
  formatRecentLogDisplayDiff,
  getDeleteWeightEntryDescription,
  getRecentLogChangeClass,
  getRecentLogDisplayDiff,
} from '@/views/weightTrackerRecentLogs'

describe('weightTrackerRecentLogs', () => {
  it('returns zero change for equal visible kg values', () => {
    const diff = getRecentLogDisplayDiff(84.2, 84.2, 'kg')

    expect(diff).toBe(0)
    expect(formatRecentLogDisplayDiff(diff, 'kg')).toBe('0 kg')
    expect(getRecentLogChangeClass(diff, 'loss')).toBe('bg-muted text-muted-foreground')
  })

  it('ignores hidden precision mismatch for kg users', () => {
    const diff = getRecentLogDisplayDiff(84.24, 84.15, 'kg')

    expect(diff).toBe(0)
    expect(formatRecentLogDisplayDiff(diff, 'kg')).toBe('0 kg')
    expect(getRecentLogChangeClass(diff, 'loss')).toBe('bg-muted text-muted-foreground')
  })

  it('keeps visible decreases negative for kg users', () => {
    const diff = getRecentLogDisplayDiff(84.1, 84.2, 'kg')

    expect(diff).toBe(-0.1)
    expect(formatRecentLogDisplayDiff(diff, 'kg')).toBe('-0.1 kg')
    expect(getRecentLogChangeClass(diff, 'loss')).toContain('text-green-600')
    expect(getRecentLogChangeClass(diff, 'gain')).toContain('text-red-600')
  })

  it('keeps visible increases positive for kg users', () => {
    const diff = getRecentLogDisplayDiff(84.7, 84.2, 'kg')

    expect(diff).toBe(0.5)
    expect(formatRecentLogDisplayDiff(diff, 'kg')).toBe('+0.5 kg')
    expect(getRecentLogChangeClass(diff, 'loss')).toContain('text-red-600')
    expect(getRecentLogChangeClass(diff, 'gain')).toContain('text-green-600')
  })

  it('uses displayed lbs precision instead of raw kg precision', () => {
    const diff = getRecentLogDisplayDiff(84.24, 84.15, 'lbs')

    expect(diff).toBe(0.2)
    expect(formatRecentLogDisplayDiff(diff, 'lbs')).toBe('+0.2 lbs')
  })

  it('builds a clear delete confirmation message', () => {
    expect(getDeleteWeightEntryDescription('Sat, Mar 21')).toBe(
      'Are you sure you want to delete the weight entry for Sat, Mar 21? This action cannot be undone.',
    )
  })
})
