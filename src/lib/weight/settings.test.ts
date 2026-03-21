import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const { filterMock, getFullListMock, updateMock, createMock, collectionMock } = vi.hoisted(() => ({
  filterMock: vi.fn(),
  getFullListMock: vi.fn(),
  updateMock: vi.fn(),
  createMock: vi.fn(),
  collectionMock: vi.fn(),
}))

vi.mock('@/lib/pocketbase', () => ({
  COLLECTIONS: {
    USER_SETTINGS: 'user_settings',
  },
  pb: {
    filter: filterMock,
    collection: collectionMock,
  },
}))

import { createDefaultUserSettings, saveUserSettings, toUserSettings } from '@/lib/weight/settings'

describe('weight settings helpers', () => {
  beforeEach(() => {
    filterMock.mockReset()
    getFullListMock.mockReset()
    updateMock.mockReset()
    createMock.mockReset()
    collectionMock.mockReset()
    filterMock.mockReturnValue('user-filter')
    collectionMock.mockReturnValue({
      getFullList: getFullListMock,
      update: updateMock,
      create: createMock,
    })
  })

  it('creates the default user settings state', () => {
    expect(createDefaultUserSettings()).toEqual({
      unit: 'kg',
      goalWeightKg: null,
      heightCm: 178,
      dateOfBirth: undefined,
      sex: undefined,
      proteinGoalG: undefined,
      carbsGoalG: undefined,
      fatGoalG: undefined,
      dashboardLayout: undefined,
    })
  })

  it('maps persisted records into app settings', () => {
    const result = toUserSettings({
      id: 'settings-1',
      collectionId: 'col',
      collectionName: 'user_settings',
      created: '2026-03-20 12:00:00.000Z',
      updated: '2026-03-20 12:00:00.000Z',
      user: 'user-1',
      unit: 'lbs',
      goal_weight_kg: 70,
      height_cm: 180,
      date_of_birth: '1990-01-02',
      sex: 'male',
      goal_direction: 'loss',
      protein_goal_g: 140,
      carbs_goal_g: 200,
      fat_goal_g: 60,
      dashboard_layout: '[{"id":"weight","visible":true}]',
    })

    expect(result).toEqual({
      unit: 'lbs',
      goalWeightKg: 70,
      heightCm: 180,
      dateOfBirth: '1990-01-02',
      sex: 'male',
      goalDirection: 'loss',
      proteinGoalG: 140,
      carbsGoalG: 200,
      fatGoalG: 60,
      dashboardLayout: [{ id: 'weight', visible: true }],
    })
  })

  it('updates an existing settings record when one is already known', async () => {
    updateMock.mockResolvedValueOnce(undefined)

    const recordId = await saveUserSettings(
      'user-1',
      {
        unit: 'kg',
        goalWeightKg: 80,
        heightCm: 182,
      },
      'settings-1',
    )

    expect(recordId).toBe('settings-1')
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('finds and reuses the latest existing settings record before creating a new one', async () => {
    getFullListMock.mockResolvedValueOnce([{ id: 'settings-2' }])
    updateMock.mockResolvedValueOnce(undefined)

    const recordId = await saveUserSettings(
      'user-1',
      {
        unit: 'kg',
        goalWeightKg: 80,
        heightCm: 182,
      },
      null,
    )

    expect(filterMock).toHaveBeenCalledWith('user = {:userId}', { userId: 'user-1' })
    expect(recordId).toBe('settings-2')
    expect(updateMock).toHaveBeenCalledWith(
      'settings-2',
      expect.objectContaining({ user: 'user-1' }),
    )
    expect(createMock).not.toHaveBeenCalled()
  })

  it('creates a settings record when none exists yet', async () => {
    getFullListMock.mockResolvedValueOnce([])
    createMock.mockResolvedValueOnce({ id: 'settings-3' })

    const recordId = await saveUserSettings(
      'user-1',
      {
        unit: 'kg',
        goalWeightKg: 80,
        heightCm: 182,
      },
      null,
    )

    expect(recordId).toBe('settings-3')
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(updateMock).not.toHaveBeenCalled()
  })
})
