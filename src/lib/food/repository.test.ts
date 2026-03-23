import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { Effect } from 'effect'

const {
  filterMock,
  getFullListMock,
  sendMock,
  createMock,
  subscribeMock,
  unsubscribeMock,
  collectionMock,
} = vi.hoisted(() => ({
  filterMock: vi.fn(),
  getFullListMock: vi.fn(),
  sendMock: vi.fn(),
  createMock: vi.fn(),
  subscribeMock: vi.fn(),
  unsubscribeMock: vi.fn(),
  collectionMock: vi.fn(),
}))

vi.mock('@/lib/pocketbase', () => ({
  COLLECTIONS: {
    FOOD_ITEMS: 'food_items',
    FOOD_LOG: 'food_log',
    FOOD_FAVORITES: 'food_favorites',
    FOOD_RECENTS: 'food_recents',
    FOOD_FREQUENT: 'food_frequent',
  },
  pb: {
    filter: filterMock,
    send: sendMock,
    collection: collectionMock,
  },
}))

import { PocketBaseService } from '@/lib/effect'
import {
  checkVisionConfiguration,
  createFoodItemRecord,
  loadFoodDashboardRepositoryData,
  lookupFoodBarcode,
  parseNutritionLabelImage,
  searchFoodDatabase,
  subscribeFoodRealtime,
  unsubscribeFoodRealtime,
} from '@/lib/food/repository'

function collectionApi() {
  return {
    getFullList: getFullListMock,
    create: createMock,
    subscribe: subscribeMock,
    unsubscribe: unsubscribeMock,
  }
}

const mockPb = {
  filter: filterMock,
  send: sendMock,
  collection: collectionMock,
}

function runWithPb<A>(effect: Effect.Effect<A, unknown, PocketBaseService>) {
  return Effect.runPromise(effect.pipe(Effect.provideService(PocketBaseService, mockPb as never)))
}

describe('food repository', () => {
  beforeEach(() => {
    filterMock.mockReset()
    getFullListMock.mockReset()
    sendMock.mockReset()
    createMock.mockReset()
    subscribeMock.mockReset()
    unsubscribeMock.mockReset()
    collectionMock.mockReset()
    filterMock.mockImplementation((value) => value)
    collectionMock.mockReturnValue(collectionApi())
  })

  it('loads mapped dashboard food data', async () => {
    getFullListMock
      .mockResolvedValueOnce([
        {
          id: 'item-1',
          name: 'Greek Yogurt',
          brand: 'Brand',
          barcode: '123',
          calories_per_100g: 59,
          protein_per_100g: 10,
          carbs_per_100g: 4,
          fat_per_100g: 0,
          default_serving_g: 170,
          source: 'manual',
          off_id: '',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'log-1',
          date: '2026-03-21',
          meal_type: 'breakfast',
          food_item: 'item-1',
          food_name: 'Greek Yogurt',
          amount_g: 170,
          calories: 100,
          protein: 17,
          carbs: 7,
          fat: 0,
          note: '',
        },
      ])
      .mockResolvedValueOnce([
        { id: 'fav-1', food_item: 'item-1', created: '2026-03-21 10:00:00.000Z' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'recent-1',
          food_item: 'item-1',
          last_logged_at: '2026-03-21 10:00:00.000Z',
          last_logged_date: '2026-03-21',
          last_meal_type: 'breakfast',
          last_amount_g: 170,
          times_logged: 3,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'freq-1',
          food_item: 'item-1',
          last_logged_at: '2026-03-21 10:00:00.000Z',
          last_logged_date: '2026-03-21',
          last_meal_type: 'breakfast',
          last_amount_g: 170,
          times_logged: 6,
        },
      ])

    const result = await runWithPb(loadFoodDashboardRepositoryData('user-1'))

    expect(result.foodItems).toEqual([
      {
        id: 'item-1',
        name: 'Greek Yogurt',
        brand: 'Brand',
        barcode: '123',
        caloriesPer100g: 59,
        proteinPer100g: 10,
        carbsPer100g: 4,
        fatPer100g: undefined,
        defaultServingG: 170,
        source: 'manual',
        offId: undefined,
      },
    ])
    expect(result.foodLog).toHaveLength(1)
    expect(result.favorites).toHaveLength(1)
    expect(result.recents).toHaveLength(1)
    expect(result.frequent).toHaveLength(1)
  })

  it('delegates vision, search, barcode, and label requests through PocketBase', async () => {
    sendMock
      .mockResolvedValueOnce({ configured: true })
      .mockResolvedValueOnce([{ name: 'Banana' }])
      .mockResolvedValueOnce({ name: 'Milk' })
      .mockResolvedValueOnce({ name: 'Nutrition Label' })

    await expect(runWithPb(checkVisionConfiguration())).resolves.toBe(true)
    await expect(runWithPb(searchFoodDatabase('banana'))).resolves.toEqual([{ name: 'Banana' }])
    await expect(runWithPb(lookupFoodBarcode('123'))).resolves.toEqual({ name: 'Milk' })

    const file = new File(['img'], 'label.jpg', { type: 'image/jpeg' })
    await expect(runWithPb(parseNutritionLabelImage(file))).resolves.toEqual({
      name: 'Nutrition Label',
    })
  })

  it('creates mapped food items and wires realtime subscriptions', async () => {
    createMock.mockResolvedValueOnce({
      id: 'item-2',
      name: 'Oats',
      brand: '',
      barcode: '',
      calories_per_100g: 389,
      protein_per_100g: 17,
      carbs_per_100g: 66,
      fat_per_100g: 7,
      default_serving_g: 40,
      source: 'manual',
      off_id: '',
    })

    await expect(
      runWithPb(
        createFoodItemRecord('user-1', {
          name: 'Oats',
          caloriesPer100g: 389,
          proteinPer100g: 17,
          carbsPer100g: 66,
          fatPer100g: 7,
          defaultServingG: 40,
          source: 'manual',
        }),
      ),
    ).resolves.toEqual({
      id: 'item-2',
      name: 'Oats',
      brand: undefined,
      barcode: undefined,
      caloriesPer100g: 389,
      proteinPer100g: 17,
      carbsPer100g: 66,
      fatPer100g: 7,
      defaultServingG: 40,
      source: 'manual',
      offId: undefined,
    })

    subscribeFoodRealtime('user-1', {
      onFoodItem: vi.fn(),
      onFoodLog: vi.fn(),
      onFavorite: vi.fn(),
      onRecent: vi.fn(),
      onFrequent: vi.fn(),
    })
    unsubscribeFoodRealtime()

    expect(subscribeMock).toHaveBeenCalledTimes(5)
    expect(unsubscribeMock).toHaveBeenCalledTimes(5)
  })
})
