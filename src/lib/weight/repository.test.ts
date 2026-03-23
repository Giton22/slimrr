import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { Effect } from 'effect'

const {
  filterMock,
  getFullListMock,
  subscribeMock,
  unsubscribeMock,
  updateMock,
  createMock,
  deleteMock,
  collectionMock,
} = vi.hoisted(() => ({
  filterMock: vi.fn(),
  getFullListMock: vi.fn(),
  subscribeMock: vi.fn(),
  unsubscribeMock: vi.fn(),
  updateMock: vi.fn(),
  createMock: vi.fn(),
  deleteMock: vi.fn(),
  collectionMock: vi.fn(),
}))

vi.mock('@/lib/pocketbase', () => ({
  COLLECTIONS: {
    WEIGHT_ENTRIES: 'weight_entries',
    CALORIE_ENTRIES: 'calorie_entries',
    KCAL_GOAL_HISTORY: 'kcal_goal_history',
    USER_SETTINGS: 'user_settings',
    GOALS: 'goals',
    FOOD_ITEMS: 'food_items',
    FOOD_LOG: 'food_log',
  },
  pb: {
    filter: filterMock,
    collection: collectionMock,
  },
}))

import { PocketBaseService } from '@/lib/effect'
import {
  deleteCalorieEntryRecord,
  deleteWeightEntryRecord,
  loadWeightStoreData,
  patchWeightEntryRecord,
  saveCalorieEntryRecord,
  saveGlobalKcalGoalRecord,
  saveWeightEntryRecord,
  subscribeWeightRealtime,
  unsubscribeWeightRealtime,
} from '@/lib/weight/repository'

function collectionApi() {
  return {
    getFullList: getFullListMock,
    subscribe: subscribeMock,
    unsubscribe: unsubscribeMock,
    update: updateMock,
    create: createMock,
    delete: deleteMock,
  }
}

const mockPb = {
  filter: filterMock,
  collection: collectionMock,
}

function runWithPb<A>(effect: Effect.Effect<A, unknown, PocketBaseService>) {
  return Effect.runPromise(effect.pipe(Effect.provideService(PocketBaseService, mockPb as never)))
}

describe('weight repository', () => {
  beforeEach(() => {
    filterMock.mockReset()
    getFullListMock.mockReset()
    subscribeMock.mockReset()
    unsubscribeMock.mockReset()
    updateMock.mockReset()
    createMock.mockReset()
    deleteMock.mockReset()
    collectionMock.mockReset()
    filterMock.mockImplementation((value) => value)
    collectionMock.mockReturnValue(collectionApi())
  })

  it('loads mapped weight store data', async () => {
    getFullListMock
      .mockResolvedValueOnce([{ id: 'w1', date: '2026-03-20', weight_kg: 80, note: '' }])
      .mockResolvedValueOnce([
        { id: 'c1', date: '2026-03-20', calories: 2100, goal_override_kcal: null, note: '' },
      ])
      .mockResolvedValueOnce([{ id: 'g1', effective_from: '2026-03-01', kcal: 2200 }])
      .mockResolvedValueOnce([
        {
          id: 's1',
          user: 'user-1',
          unit: 'kg',
          goal_weight_kg: 75,
          height_cm: 180,
          date_of_birth: '',
          sex: '',
          goal_direction: '',
          protein_goal_g: 0,
          carbs_goal_g: 0,
          fat_goal_g: 0,
          dashboard_layout: '',
        },
      ])

    const result = await runWithPb(loadWeightStoreData('user-1'))

    expect(result).toEqual({
      entries: [{ id: 'w1', date: '2026-03-20', weightKg: 80, note: undefined }],
      calorieEntries: [
        {
          id: 'c1',
          date: '2026-03-20',
          calories: 2100,
          goalOverrideKcal: undefined,
          note: undefined,
        },
      ],
      kcalGoalHistory: [{ id: 'g1', effectiveFrom: '2026-03-01', kcal: 2200 }],
      settings: {
        unit: 'kg',
        goalWeightKg: 75,
        heightCm: 180,
        dateOfBirth: undefined,
        sex: undefined,
        goalDirection: undefined,
        proteinGoalG: undefined,
        carbsGoalG: undefined,
        fatGoalG: undefined,
        dashboardLayout: undefined,
      },
      settingsRecordId: 's1',
    })
  })

  it('saves weight and calorie records in create and update modes', async () => {
    updateMock.mockResolvedValue(undefined)
    createMock
      .mockResolvedValueOnce({ id: 'w1', date: '2026-03-20', weight_kg: 80.2, note: '' })
      .mockResolvedValueOnce({
        id: 'c1',
        date: '2026-03-20',
        calories: 2000,
        goal_override_kcal: null,
        note: '',
      })

    await expect(
      runWithPb(saveWeightEntryRecord('user-1', { date: '2026-03-20', weightKg: 80.2 }, undefined)),
    ).resolves.toEqual({
      id: 'w1',
      date: '2026-03-20',
      weightKg: 80.2,
      note: undefined,
    })

    await expect(
      runWithPb(
        saveWeightEntryRecord(
          'user-1',
          { date: '2026-03-20', weightKg: 79.8, note: 'updated' },
          { id: 'w1', date: '2026-03-20', weightKg: 80.2 },
        ),
      ),
    ).resolves.toEqual({
      id: 'w1',
      date: '2026-03-20',
      weightKg: 79.8,
      note: 'updated',
    })

    await expect(
      runWithPb(saveCalorieEntryRecord('user-1', '2026-03-20', { calories: 2000 }, undefined)),
    ).resolves.toEqual({
      id: 'c1',
      date: '2026-03-20',
      calories: 2000,
      goalOverrideKcal: undefined,
      note: undefined,
    })
  })

  it('updates goals and delegates deletes', async () => {
    updateMock.mockResolvedValue(undefined)
    createMock.mockResolvedValueOnce({ id: 'g2', effective_from: '2026-03-21', kcal: 2100 })
    deleteMock.mockResolvedValue(undefined)

    await expect(
      runWithPb(
        saveGlobalKcalGoalRecord('user-1', '2026-03-20', 2200, {
          id: 'g1',
          effectiveFrom: '2026-03-20',
          kcal: 2300,
        }),
      ),
    ).resolves.toEqual({ id: 'g1', effectiveFrom: '2026-03-20', kcal: 2200 })

    await expect(
      runWithPb(saveGlobalKcalGoalRecord('user-1', '2026-03-21', 2100)),
    ).resolves.toEqual({
      id: 'g2',
      effectiveFrom: '2026-03-21',
      kcal: 2100,
    })

    await runWithPb(patchWeightEntryRecord('w1', { weightKg: 79.9, note: 'patched' }))
    await runWithPb(deleteWeightEntryRecord('w1'))
    await runWithPb(deleteCalorieEntryRecord('c1'))

    expect(updateMock).toHaveBeenCalledWith('w1', { weight_kg: 79.9, note: 'patched' })
    expect(deleteMock).toHaveBeenCalledWith('w1')
    expect(deleteMock).toHaveBeenCalledWith('c1')
  })

  it('wires realtime subscriptions and unsubscriptions', () => {
    const handlers = {
      onWeightEntry: vi.fn(),
      onCalorieEntry: vi.fn(),
      onKcalGoalChange: vi.fn(),
      onUserSettings: vi.fn(),
    }

    subscribeWeightRealtime('user-1', handlers)
    unsubscribeWeightRealtime()

    expect(subscribeMock).toHaveBeenCalledTimes(4)
    expect(unsubscribeMock).toHaveBeenCalledTimes(4)
  })
})
