import { Effect } from 'effect'
import type { FoodFavorite, FoodFrequent, FoodItem, FoodLogEntry, FoodRecent } from '@/types'
import { fromPbPromise } from '@/lib/effect'
import { COLLECTIONS, pb } from '@/lib/pocketbase'
import type {
  FoodFavoriteRecord,
  FoodFrequentRecord,
  FoodItemRecord,
  FoodLogRecord,
  FoodRecentRecord,
} from '@/lib/pocketbase'

export interface OFFSearchResult {
  barcode: string
  name: string
  brand: string
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  servingG: number
  offId: string
  nutritionPer?: number
}

function cutoffISO(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function toFoodItem(record: FoodItemRecord): FoodItem {
  return {
    id: record.id,
    name: record.name,
    brand: record.brand || undefined,
    barcode: record.barcode || undefined,
    caloriesPer100g: record.calories_per_100g,
    proteinPer100g: record.protein_per_100g || undefined,
    carbsPer100g: record.carbs_per_100g || undefined,
    fatPer100g: record.fat_per_100g || undefined,
    defaultServingG: record.default_serving_g || 100,
    source: record.source,
    offId: record.off_id || undefined,
  }
}

export function toFoodLogEntry(record: FoodLogRecord): FoodLogEntry {
  return {
    id: record.id,
    date: record.date,
    mealType: record.meal_type,
    foodItem: record.food_item || undefined,
    foodName: record.food_name,
    amountG: record.amount_g,
    calories: record.calories,
    protein: record.protein || undefined,
    carbs: record.carbs || undefined,
    fat: record.fat || undefined,
    note: record.note || undefined,
  }
}

export function toFoodFavorite(record: FoodFavoriteRecord): FoodFavorite {
  return {
    id: record.id,
    foodItem: record.food_item,
    created: record.created,
  }
}

export function toFoodRecent(record: FoodRecentRecord): FoodRecent {
  return {
    id: record.id,
    foodItem: record.food_item,
    lastLoggedAt: record.last_logged_at,
    lastLoggedDate: record.last_logged_date,
    lastMealType: record.last_meal_type,
    lastAmountG: record.last_amount_g,
    timesLogged: record.times_logged,
  }
}

export function toFoodFrequent(record: FoodFrequentRecord): FoodFrequent {
  return {
    id: record.id,
    foodItem: record.food_item,
    lastLoggedAt: record.last_logged_at,
    lastLoggedDate: record.last_logged_date,
    lastMealType: record.last_meal_type,
    lastAmountG: record.last_amount_g,
    timesLogged: record.times_logged,
  }
}

export interface LoadedFoodDashboardData {
  foodItems: FoodItem[]
  foodLog: FoodLogEntry[]
  favorites: FoodFavorite[]
  recents: FoodRecent[]
  frequent: FoodFrequent[]
}

export function loadFoodDashboardRepositoryData(userId: string, lookbackDays = 365) {
  const userFilter = pb.filter('user = {:userId}', { userId })
  const dateBoundFilter = pb.filter('user = {:userId} && date >= {:cutoff}', {
    userId,
    cutoff: cutoffISO(lookbackDays),
  })

  return Effect.all(
    {
      itemRecords: fromPbPromise(
        (pb) =>
          pb.collection<FoodItemRecord>(COLLECTIONS.FOOD_ITEMS).getFullList({
            filter: userFilter,
            sort: 'name',
          }),
        COLLECTIONS.FOOD_ITEMS,
      ),
      logRecords: fromPbPromise(
        (pb) =>
          pb.collection<FoodLogRecord>(COLLECTIONS.FOOD_LOG).getFullList({
            filter: dateBoundFilter,
            sort: 'date',
          }),
        COLLECTIONS.FOOD_LOG,
      ),
      favoriteRecords: fromPbPromise(
        (pb) =>
          pb.collection<FoodFavoriteRecord>(COLLECTIONS.FOOD_FAVORITES).getFullList({
            filter: userFilter,
          }),
        COLLECTIONS.FOOD_FAVORITES,
      ),
      recentRecords: fromPbPromise(
        (pb) =>
          pb.collection<FoodRecentRecord>(COLLECTIONS.FOOD_RECENTS).getFullList({
            filter: userFilter,
            sort: '-last_logged_at',
          }),
        COLLECTIONS.FOOD_RECENTS,
      ),
      frequentRecords: fromPbPromise(
        (pb) =>
          pb.collection<FoodFrequentRecord>(COLLECTIONS.FOOD_FREQUENT).getFullList({
            filter: userFilter,
            sort: '-times_logged,-last_logged_at',
          }),
        COLLECTIONS.FOOD_FREQUENT,
      ),
    },
    { concurrency: 'unbounded' },
  ).pipe(
    Effect.map(({ itemRecords, logRecords, favoriteRecords, recentRecords, frequentRecords }) => ({
      foodItems: itemRecords.map(toFoodItem),
      foodLog: logRecords.map(toFoodLogEntry),
      favorites: favoriteRecords.map(toFoodFavorite),
      recents: recentRecords.map(toFoodRecent),
      frequent: frequentRecords.map(toFoodFrequent),
    })),
  )
}

export function checkVisionConfiguration() {
  return fromPbPromise(
    (pb) =>
      pb.send<{ configured: boolean }>('/api/food/label/status', {
        method: 'GET',
      }),
    'food_label_status',
  ).pipe(Effect.map((result) => result.configured))
}

export function parseNutritionLabelImage(imageFile: File) {
  const formData = new FormData()
  formData.append('image', imageFile)
  return fromPbPromise(
    (pb) =>
      pb.send<OFFSearchResult>('/api/food/label', {
        method: 'POST',
        body: formData,
      }),
    'food_label',
  )
}

export function searchFoodDatabase(query: string) {
  return fromPbPromise(
    (pb) =>
      pb.send<OFFSearchResult[]>('/api/food/search', {
        method: 'GET',
        query: { q: query },
      }),
    'food_search',
  )
}

export function lookupFoodBarcode(code: string) {
  return fromPbPromise(
    (pb) =>
      pb.send<OFFSearchResult>(`/api/food/barcode/${encodeURIComponent(code)}`, {
        method: 'GET',
      }),
    'food_barcode',
  )
}

export function createFoodItemRecord(userId: string, item: Omit<FoodItem, 'id'>) {
  return fromPbPromise(
    (pb) =>
      pb.collection<FoodItemRecord>(COLLECTIONS.FOOD_ITEMS).create({
        user: userId,
        name: item.name,
        brand: item.brand ?? '',
        barcode: item.barcode ?? '',
        calories_per_100g: item.caloriesPer100g,
        protein_per_100g: item.proteinPer100g ?? 0,
        carbs_per_100g: item.carbsPer100g ?? 0,
        fat_per_100g: item.fatPer100g ?? 0,
        default_serving_g: item.defaultServingG || 100,
        source: item.source,
        off_id: item.offId ?? '',
      }),
    COLLECTIONS.FOOD_ITEMS,
  ).pipe(Effect.map(toFoodItem))
}

export interface FoodRealtimeHandlers {
  onFoodItem: (action: string, item: FoodItem) => void
  onFoodLog: (action: string, entry: FoodLogEntry) => void
  onFavorite: (action: string, favorite: FoodFavorite) => void
  onRecent: (action: string, recent: FoodRecent) => void
  onFrequent: (action: string, frequent: FoodFrequent) => void
}

export function subscribeFoodRealtime(userId: string, handlers: FoodRealtimeHandlers) {
  const filter = pb.filter('user = {:userId}', { userId })

  void pb
    .collection<FoodItemRecord>(COLLECTIONS.FOOD_ITEMS)
    .subscribe('*', (event) => handlers.onFoodItem(event.action, toFoodItem(event.record)), {
      filter,
    })

  void pb
    .collection<FoodLogRecord>(COLLECTIONS.FOOD_LOG)
    .subscribe('*', (event) => handlers.onFoodLog(event.action, toFoodLogEntry(event.record)), {
      filter,
    })

  void pb
    .collection<FoodFavoriteRecord>(COLLECTIONS.FOOD_FAVORITES)
    .subscribe('*', (event) => handlers.onFavorite(event.action, toFoodFavorite(event.record)), {
      filter,
    })

  void pb
    .collection<FoodRecentRecord>(COLLECTIONS.FOOD_RECENTS)
    .subscribe('*', (event) => handlers.onRecent(event.action, toFoodRecent(event.record)), {
      filter,
    })

  void pb
    .collection<FoodFrequentRecord>(COLLECTIONS.FOOD_FREQUENT)
    .subscribe('*', (event) => handlers.onFrequent(event.action, toFoodFrequent(event.record)), {
      filter,
    })
}

export function unsubscribeFoodRealtime() {
  void pb.collection(COLLECTIONS.FOOD_ITEMS).unsubscribe('*')
  void pb.collection(COLLECTIONS.FOOD_LOG).unsubscribe('*')
  void pb.collection(COLLECTIONS.FOOD_FAVORITES).unsubscribe('*')
  void pb.collection(COLLECTIONS.FOOD_RECENTS).unsubscribe('*')
  void pb.collection(COLLECTIONS.FOOD_FREQUENT).unsubscribe('*')
}
