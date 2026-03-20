import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import type {
  DailyFoodSummary,
  FoodDashboardTab,
  FoodFavorite,
  FoodFrequent,
  FoodItem,
  FoodLogEntry,
  FoodRecent,
  FoodSearchSource,
  MealType,
} from '@/types'
import { pb, COLLECTIONS } from '@/lib/pocketbase'
import type {
  FoodFavoriteRecord,
  FoodFrequentRecord,
  FoodItemRecord,
  FoodLogRecord,
  FoodRecentRecord,
} from '@/lib/pocketbase'
import { today } from '@/composables/useToday'

interface OFFSearchResult {
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

export interface FoodSelection {
  foodItemId?: string
  name: string
  brand?: string
  barcode?: string
  caloriesPer100g: number
  proteinPer100g?: number
  carbsPer100g?: number
  fatPer100g?: number
  defaultServingG: number
  source: FoodSearchSource
  itemSource: FoodItem['source']
  offId?: string
  nutritionPer?: number
}

interface LogFoodPayload {
  date: string
  mealType: MealType
  foodItem?: FoodItem | null
  foodName?: string
  amountG: number
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  note?: string
  sourceContext?: FoodSearchSource
}

function toFoodItem(r: FoodItemRecord): FoodItem {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand || undefined,
    barcode: r.barcode || undefined,
    caloriesPer100g: r.calories_per_100g,
    proteinPer100g: r.protein_per_100g || undefined,
    carbsPer100g: r.carbs_per_100g || undefined,
    fatPer100g: r.fat_per_100g || undefined,
    defaultServingG: r.default_serving_g || 100,
    source: r.source,
    offId: r.off_id || undefined,
  }
}

function toFoodLogEntry(r: FoodLogRecord): FoodLogEntry {
  return {
    id: r.id,
    date: r.date,
    mealType: r.meal_type,
    foodItem: r.food_item || undefined,
    foodName: r.food_name,
    amountG: r.amount_g,
    calories: r.calories,
    protein: r.protein || undefined,
    carbs: r.carbs || undefined,
    fat: r.fat || undefined,
    note: r.note || undefined,
  }
}

function toFoodFavorite(r: FoodFavoriteRecord): FoodFavorite {
  return {
    id: r.id,
    foodItem: r.food_item,
    created: r.created,
  }
}

function toFoodRecent(r: FoodRecentRecord): FoodRecent {
  return {
    id: r.id,
    foodItem: r.food_item,
    lastLoggedAt: r.last_logged_at,
    lastLoggedDate: r.last_logged_date,
    lastMealType: r.last_meal_type,
    lastAmountG: r.last_amount_g,
    timesLogged: r.times_logged,
  }
}

function toFoodFrequent(r: FoodFrequentRecord): FoodFrequent {
  return {
    id: r.id,
    foodItem: r.food_item,
    lastLoggedAt: r.last_logged_at,
    lastLoggedDate: r.last_logged_date,
    lastMealType: r.last_meal_type,
    lastAmountG: r.last_amount_g,
    timesLogged: r.times_logged,
  }
}

function cutoffISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function compareFoodNames(a: FoodItem | undefined, b: FoodItem | undefined): number {
  const aName = a?.name.toLocaleLowerCase() ?? ''
  const bName = b?.name.toLocaleLowerCase() ?? ''
  return aName.localeCompare(bName)
}

function dedupeByFoodItem<T extends { foodItem: string }>(
  items: T[],
  shouldReplace: (current: T, next: T) => boolean,
): T[] {
  const byFoodItem = new Map<string, T>()

  for (const item of items) {
    const existing = byFoodItem.get(item.foodItem)
    if (!existing || shouldReplace(existing, item)) {
      byFoodItem.set(item.foodItem, item)
    }
  }

  return [...byFoodItem.values()]
}

function compareUsageRecency(
  a: { lastLoggedDate: string; id: string },
  b: { lastLoggedDate: string; id: string },
) {
  const dateCmp = b.lastLoggedDate.localeCompare(a.lastLoggedDate)
  if (dateCmp !== 0) return dateCmp
  return b.id.localeCompare(a.id)
}

export const useFoodStore = defineStore('food', () => {
  const foodItems = ref<FoodItem[]>([])
  const foodLog = ref<FoodLogEntry[]>([])
  const favorites = ref<FoodFavorite[]>([])
  const recents = ref<FoodRecent[]>([])
  const frequent = ref<FoodFrequent[]>([])
  const searchResults = ref<OFFSearchResult[]>([])
  const dashboardQuery = ref('')
  const activeDashboardTab = ref<FoodDashboardTab>('frequent')
  const selectedFoodForLogging = ref<FoodSelection | null>(null)
  const isSearching = ref(false)
  const isLoading = ref(false)
  const isLookingUpBarcode = ref(false)
  const isSavingFoodSelection = ref(false)
  const visionConfigured = ref(false)

  function currentUserId() {
    return pb.authStore.record?.id ?? null
  }

  function resolveFoodItem(foodItemId: string | undefined) {
    if (!foodItemId) return undefined
    return foodItems.value.find((item) => item.id === foodItemId)
  }

  function selectionFromFoodItem(item: FoodItem, source: FoodSearchSource): FoodSelection {
    return {
      foodItemId: item.id,
      name: item.name,
      brand: item.brand,
      barcode: item.barcode,
      caloriesPer100g: item.caloriesPer100g,
      proteinPer100g: item.proteinPer100g,
      carbsPer100g: item.carbsPer100g,
      fatPer100g: item.fatPer100g,
      defaultServingG: item.defaultServingG || 100,
      source,
      itemSource: item.source,
      offId: item.offId,
    }
  }

  function selectionFromSearchResult(
    result: OFFSearchResult,
    source: FoodSearchSource,
    itemSource: FoodItem['source'],
  ): FoodSelection {
    return {
      name: result.name,
      brand: result.brand || undefined,
      barcode: result.barcode || undefined,
      caloriesPer100g: result.caloriesPer100g,
      proteinPer100g: result.proteinPer100g || undefined,
      carbsPer100g: result.carbsPer100g || undefined,
      fatPer100g: result.fatPer100g || undefined,
      defaultServingG: result.servingG || 100,
      source,
      itemSource,
      offId: result.offId || undefined,
      nutritionPer: result.nutritionPer,
    }
  }

  function selectFoodForLogging(food: FoodItem | OFFSearchResult, source: FoodSearchSource) {
    if ('id' in food) {
      selectedFoodForLogging.value = selectionFromFoodItem(food, source)
      return
    }
    selectedFoodForLogging.value = selectionFromSearchResult(
      food,
      source,
      source === 'ai' ? 'nutrition_label' : 'openfoodfacts',
    )
  }

  function clearSelectedFood() {
    selectedFoodForLogging.value = null
  }

  function setDashboardTab(tab: FoodDashboardTab) {
    activeDashboardTab.value = tab
  }

  async function checkVisionStatus() {
    try {
      const res = await pb.send<{ configured: boolean }>('/api/food/label/status', {
        method: 'GET',
      })
      visionConfigured.value = res.configured
    } catch {
      visionConfigured.value = false
    }
  }

  async function parseNutritionLabel(imageFile: File): Promise<OFFSearchResult | null> {
    const formData = new FormData()
    formData.append('image', imageFile)
    try {
      return await pb.send<OFFSearchResult>('/api/food/label', {
        method: 'POST',
        body: formData,
      })
    } catch {
      return null
    }
  }

  async function loadFoodDashboardData() {
    const userId = currentUserId()
    if (!userId) return

    isLoading.value = true
    try {
      const userFilter = pb.filter('user = {:userId}', { userId })
      const dateBoundFilter = pb.filter('user = {:userId} && date >= {:cutoff}', {
        userId,
        cutoff: cutoffISO(365),
      })

      const [itemRecords, logRecords, favoriteRecords, recentRecords, frequentRecords] =
        await Promise.all([
          pb
            .collection<FoodItemRecord>(COLLECTIONS.FOOD_ITEMS)
            .getFullList({ filter: userFilter, sort: 'name' }),
          pb
            .collection<FoodLogRecord>(COLLECTIONS.FOOD_LOG)
            .getFullList({ filter: dateBoundFilter, sort: 'date' }),
          pb
            .collection<FoodFavoriteRecord>(COLLECTIONS.FOOD_FAVORITES)
            .getFullList({ filter: userFilter }),
          pb
            .collection<FoodRecentRecord>(COLLECTIONS.FOOD_RECENTS)
            .getFullList({ filter: userFilter, sort: '-last_logged_at' }),
          pb
            .collection<FoodFrequentRecord>(COLLECTIONS.FOOD_FREQUENT)
            .getFullList({ filter: userFilter, sort: '-times_logged,-last_logged_at' }),
        ])

      foodItems.value = itemRecords.map(toFoodItem)
      foodLog.value = logRecords.map(toFoodLogEntry)
      favorites.value = dedupeByFoodItem(
        favoriteRecords.map(toFoodFavorite),
        (current, next) => (next.created ?? '').localeCompare(current.created ?? '') > 0,
      )
      recents.value = dedupeByFoodItem(
        recentRecords.map(toFoodRecent),
        (current, next) => (next.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0,
      )
      frequent.value = dedupeByFoodItem(
        frequentRecords.map(toFoodFrequent),
        (current, next) =>
          next.timesLogged > current.timesLogged ||
          (next.timesLogged === current.timesLogged &&
            (next.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0),
      )
      cleanupDetachedCollections()
    } finally {
      isLoading.value = false
    }

    void checkVisionStatus()
  }

  async function loadFoodData() {
    await loadFoodDashboardData()
  }

  async function searchFoods(query: string): Promise<OFFSearchResult[]> {
    if (!query.trim()) {
      searchResults.value = []
      return []
    }

    isSearching.value = true
    try {
      const results = await pb.send<OFFSearchResult[]>('/api/food/search', {
        method: 'GET',
        query: { q: query },
      })
      searchResults.value = results
      return results
    } catch {
      searchResults.value = []
      return []
    } finally {
      isSearching.value = false
    }
  }

  async function lookupBarcode(code: string): Promise<OFFSearchResult | null> {
    isLookingUpBarcode.value = true
    try {
      return await pb.send<OFFSearchResult>(`/api/food/barcode/${encodeURIComponent(code)}`, {
        method: 'GET',
      })
    } catch {
      return null
    } finally {
      isLookingUpBarcode.value = false
    }
  }

  async function addFoodItem(item: Omit<FoodItem, 'id'>): Promise<FoodItem> {
    const userId = currentUserId()
    if (!userId) throw new Error('Not authenticated')

    if (item.barcode) {
      const existingBarcodeMatch = foodItems.value.find((food) => food.barcode === item.barcode)
      if (existingBarcodeMatch) return existingBarcodeMatch
    }

    const rec = await pb.collection<FoodItemRecord>(COLLECTIONS.FOOD_ITEMS).create({
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
    })

    const foodItem = toFoodItem(rec)
    if (!foodItems.value.some((f) => f.id === foodItem.id)) {
      foodItems.value.push(foodItem)
      foodItems.value.sort((a, b) => a.name.localeCompare(b.name))
    }
    return foodItem
  }

  async function upsertRecentFromLog(
    foodItemId: string,
    log: Pick<FoodLogEntry, 'date' | 'mealType' | 'amountG'>,
  ) {
    const userId = currentUserId()
    if (!userId) return

    const existing = recents.value.find((item) => item.foodItem === foodItemId)
    const payload = {
      user: userId,
      food_item: foodItemId,
      last_logged_date: log.date,
      last_meal_type: log.mealType,
      last_amount_g: log.amountG,
      times_logged: (existing?.timesLogged ?? 0) + 1,
    }

    if (existing) {
      const updated = await pb
        .collection<FoodRecentRecord>(COLLECTIONS.FOOD_RECENTS)
        .update(existing.id, payload)
      const next = toFoodRecent(updated)
      recents.value = dedupeByFoodItem(
        [next, ...recents.value.filter((item) => item.id !== existing.id)],
        (current, incoming) =>
          (incoming.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0,
      )
      return
    }

    const created = await pb.collection<FoodRecentRecord>(COLLECTIONS.FOOD_RECENTS).create(payload)
    recents.value = dedupeByFoodItem(
      [toFoodRecent(created), ...recents.value],
      (current, incoming) =>
        (incoming.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0,
    )
  }

  async function upsertFrequentFromLog(
    foodItemId: string,
    log: Pick<FoodLogEntry, 'date' | 'mealType' | 'amountG'>,
  ) {
    const userId = currentUserId()
    if (!userId) return

    const existing = frequent.value.find((item) => item.foodItem === foodItemId)
    const payload = {
      user: userId,
      food_item: foodItemId,
      last_logged_date: log.date,
      last_meal_type: log.mealType,
      last_amount_g: log.amountG,
      times_logged: (existing?.timesLogged ?? 0) + 1,
    }

    if (existing) {
      const updated = await pb
        .collection<FoodFrequentRecord>(COLLECTIONS.FOOD_FREQUENT)
        .update(existing.id, payload)
      const next = toFoodFrequent(updated)
      frequent.value = dedupeByFoodItem(
        [next, ...frequent.value.filter((item) => item.id !== existing.id)],
        (current, incoming) =>
          incoming.timesLogged > current.timesLogged ||
          (incoming.timesLogged === current.timesLogged &&
            (incoming.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0),
      )
      return
    }

    const created = await pb
      .collection<FoodFrequentRecord>(COLLECTIONS.FOOD_FREQUENT)
      .create(payload)
    frequent.value = dedupeByFoodItem(
      [toFoodFrequent(created), ...frequent.value],
      (current, incoming) =>
        incoming.timesLogged > current.timesLogged ||
        (incoming.timesLogged === current.timesLogged &&
          (incoming.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0),
    )
  }

  async function recomputeUsageCollections(foodItemId: string) {
    const userId = currentUserId()
    if (!userId) return

    const relatedEntries = foodLog.value
      .filter((entry) => entry.foodItem === foodItemId)
      .sort((a, b) =>
        compareUsageRecency(
          { lastLoggedDate: a.date, id: a.id },
          { lastLoggedDate: b.date, id: b.id },
        ),
      )

    const existingRecent = recents.value.find((item) => item.foodItem === foodItemId)
    const existingFrequent = frequent.value.find((item) => item.foodItem === foodItemId)

    if (relatedEntries.length === 0) {
      if (existingRecent) {
        await pb.collection(COLLECTIONS.FOOD_RECENTS).delete(existingRecent.id)
        recents.value = recents.value.filter((item) => item.id !== existingRecent.id)
      }
      if (existingFrequent) {
        await pb.collection(COLLECTIONS.FOOD_FREQUENT).delete(existingFrequent.id)
        frequent.value = frequent.value.filter((item) => item.id !== existingFrequent.id)
      }
      return
    }

    const latest = relatedEntries[0]
    if (!latest) return
    const payload = {
      user: userId,
      food_item: foodItemId,
      last_logged_date: latest.date,
      last_meal_type: latest.mealType,
      last_amount_g: latest.amountG,
      times_logged: relatedEntries.length,
    }

    if (existingRecent) {
      const updated = await pb
        .collection<FoodRecentRecord>(COLLECTIONS.FOOD_RECENTS)
        .update(existingRecent.id, payload)
      recents.value = [
        toFoodRecent(updated),
        ...recents.value.filter((item) => item.id !== existingRecent.id),
      ]
    } else {
      const created = await pb
        .collection<FoodRecentRecord>(COLLECTIONS.FOOD_RECENTS)
        .create(payload)
      recents.value = [toFoodRecent(created), ...recents.value]
    }

    if (existingFrequent) {
      const updated = await pb
        .collection<FoodFrequentRecord>(COLLECTIONS.FOOD_FREQUENT)
        .update(existingFrequent.id, payload)
      frequent.value = [
        toFoodFrequent(updated),
        ...frequent.value.filter((item) => item.id !== existingFrequent.id),
      ]
    } else {
      const created = await pb
        .collection<FoodFrequentRecord>(COLLECTIONS.FOOD_FREQUENT)
        .create(payload)
      frequent.value = [toFoodFrequent(created), ...frequent.value]
    }
  }

  async function toggleFavorite(foodItemId: string) {
    const userId = currentUserId()
    if (!userId) throw new Error('Not authenticated')

    const existing = favorites.value.find((item) => item.foodItem === foodItemId)
    if (existing) {
      favorites.value = favorites.value.filter((item) => item.foodItem !== foodItemId)
      try {
        await pb.collection(COLLECTIONS.FOOD_FAVORITES).delete(existing.id)
      } catch (error) {
        favorites.value = [existing, ...favorites.value]
        throw error
      }
      return false
    }

    const created = await pb.collection<FoodFavoriteRecord>(COLLECTIONS.FOOD_FAVORITES).create({
      user: userId,
      food_item: foodItemId,
    })
    favorites.value = dedupeByFoodItem(
      [toFoodFavorite(created), ...favorites.value],
      (current, next) => (next.created ?? '').localeCompare(current.created ?? '') > 0,
    )
    return true
  }

  async function logFood(payload: LogFoodPayload) {
    const userId = currentUserId()
    if (!userId) return null

    const foodItem = payload.foodItem ?? null
    const factor = payload.amountG / 100
    const calories =
      payload.calories ?? (foodItem ? Math.round(foodItem.caloriesPer100g * factor * 10) / 10 : 0)
    const protein =
      payload.protein ??
      (foodItem ? Math.round((foodItem.proteinPer100g ?? 0) * factor * 10) / 10 : 0)
    const carbs =
      payload.carbs ?? (foodItem ? Math.round((foodItem.carbsPer100g ?? 0) * factor * 10) / 10 : 0)
    const fat =
      payload.fat ?? (foodItem ? Math.round((foodItem.fatPer100g ?? 0) * factor * 10) / 10 : 0)
    const foodName = payload.foodName ?? foodItem?.name ?? 'Quick entry'

    try {
      const rec = await pb.collection<FoodLogRecord>(COLLECTIONS.FOOD_LOG).create({
        user: userId,
        date: payload.date,
        meal_type: payload.mealType,
        food_item: foodItem?.id ?? '',
        food_name: foodName,
        amount_g: payload.amountG,
        calories,
        protein,
        carbs,
        fat,
        note: payload.note ?? '',
      })

      const entry = toFoodLogEntry(rec)
      if (!foodLog.value.some((e) => e.id === entry.id)) {
        foodLog.value.push(entry)
      }

      if (foodItem?.id) {
        await upsertRecentFromLog(foodItem.id, entry)
        await upsertFrequentFromLog(foodItem.id, entry)
      }

      return entry
    } catch {
      toast.error('Failed to log food entry')
      return null
    }
  }

  async function quickLog(date: string, mealType: MealType, calories: number, name?: string) {
    return logFood({
      date,
      mealType,
      amountG: 1,
      calories,
      foodName: name || 'Quick entry',
    })
  }

  async function updateFoodLogEntry(
    id: string,
    patch: Partial<
      Pick<FoodLogEntry, 'amountG' | 'mealType' | 'calories' | 'protein' | 'carbs' | 'fat' | 'note'>
    >,
  ) {
    const existing = foodLog.value.find((e) => e.id === id)
    if (!existing) return

    const payload: Record<string, unknown> = {}
    if (patch.amountG !== undefined) payload.amount_g = patch.amountG
    if (patch.mealType !== undefined) payload.meal_type = patch.mealType
    if (patch.calories !== undefined) payload.calories = patch.calories
    if (patch.protein !== undefined) payload.protein = patch.protein
    if (patch.carbs !== undefined) payload.carbs = patch.carbs
    if (patch.fat !== undefined) payload.fat = patch.fat
    if (patch.note !== undefined) payload.note = patch.note ?? ''

    try {
      await pb.collection(COLLECTIONS.FOOD_LOG).update(id, payload)
      const idx = foodLog.value.findIndex((e) => e.id === id)
      if (idx !== -1) {
        foodLog.value[idx] = { ...existing, ...patch }
      }
      if (existing.foodItem) {
        await recomputeUsageCollections(existing.foodItem)
      }
    } catch {
      toast.error('Failed to update food log entry')
    }
  }

  async function deleteFoodLogEntry(id: string) {
    const existing = foodLog.value.find((e) => e.id === id)
    try {
      await pb.collection(COLLECTIONS.FOOD_LOG).delete(id)
      foodLog.value = foodLog.value.filter((e) => e.id !== id)
      if (existing?.foodItem) {
        await recomputeUsageCollections(existing.foodItem)
      }
    } catch {
      toast.error('Failed to delete food log entry')
    }
  }

  function subscribeRealtime() {
    const userId = currentUserId()
    if (!userId) return

    const filter = pb.filter('user = {:userId}', { userId })

    void pb.collection<FoodItemRecord>(COLLECTIONS.FOOD_ITEMS).subscribe(
      '*',
      (e) => {
        if (e.action === 'create') {
          if (!foodItems.value.some((x) => x.id === e.record.id)) {
            foodItems.value.push(toFoodItem(e.record))
            foodItems.value.sort((a, b) => a.name.localeCompare(b.name))
          }
        } else if (e.action === 'update') {
          const idx = foodItems.value.findIndex((x) => x.id === e.record.id)
          if (idx !== -1) foodItems.value[idx] = toFoodItem(e.record)
        } else if (e.action === 'delete') {
          foodItems.value = foodItems.value.filter((x) => x.id !== e.record.id)
          cleanupDetachedCollections()
        }
      },
      { filter },
    )

    void pb.collection<FoodLogRecord>(COLLECTIONS.FOOD_LOG).subscribe(
      '*',
      (e) => {
        if (e.action === 'create') {
          if (!foodLog.value.some((x) => x.id === e.record.id)) {
            foodLog.value.push(toFoodLogEntry(e.record))
          }
        } else if (e.action === 'update') {
          const idx = foodLog.value.findIndex((x) => x.id === e.record.id)
          if (idx !== -1) foodLog.value[idx] = toFoodLogEntry(e.record)
        } else if (e.action === 'delete') {
          foodLog.value = foodLog.value.filter((x) => x.id !== e.record.id)
        }
      },
      { filter },
    )

    void pb.collection<FoodFavoriteRecord>(COLLECTIONS.FOOD_FAVORITES).subscribe(
      '*',
      (e) => {
        if (e.action === 'create') {
          favorites.value = dedupeByFoodItem(
            [toFoodFavorite(e.record), ...favorites.value],
            (current, next) => (next.created ?? '').localeCompare(current.created ?? '') > 0,
          )
        } else if (e.action === 'update') {
          favorites.value = dedupeByFoodItem(
            [
              toFoodFavorite(e.record),
              ...favorites.value.filter(
                (x) => x.id !== e.record.id && x.foodItem !== e.record.food_item,
              ),
            ],
            (current, next) => (next.created ?? '').localeCompare(current.created ?? '') > 0,
          )
        } else if (e.action === 'delete') {
          favorites.value = favorites.value.filter((x) => x.id !== e.record.id)
        }
      },
      { filter },
    )

    void pb.collection<FoodRecentRecord>(COLLECTIONS.FOOD_RECENTS).subscribe(
      '*',
      (e) => {
        if (e.action === 'create') {
          recents.value = dedupeByFoodItem(
            [toFoodRecent(e.record), ...recents.value],
            (current, next) =>
              (next.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0,
          )
        } else if (e.action === 'update') {
          recents.value = dedupeByFoodItem(
            [
              toFoodRecent(e.record),
              ...recents.value.filter(
                (x) => x.id !== e.record.id && x.foodItem !== e.record.food_item,
              ),
            ],
            (current, next) =>
              (next.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0,
          )
        } else if (e.action === 'delete') {
          recents.value = recents.value.filter((x) => x.id !== e.record.id)
        }
      },
      { filter },
    )

    void pb.collection<FoodFrequentRecord>(COLLECTIONS.FOOD_FREQUENT).subscribe(
      '*',
      (e) => {
        if (e.action === 'create') {
          frequent.value = dedupeByFoodItem(
            [toFoodFrequent(e.record), ...frequent.value],
            (current, next) =>
              next.timesLogged > current.timesLogged ||
              (next.timesLogged === current.timesLogged &&
                (next.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0),
          )
        } else if (e.action === 'update') {
          frequent.value = dedupeByFoodItem(
            [
              toFoodFrequent(e.record),
              ...frequent.value.filter(
                (x) => x.id !== e.record.id && x.foodItem !== e.record.food_item,
              ),
            ],
            (current, next) =>
              next.timesLogged > current.timesLogged ||
              (next.timesLogged === current.timesLogged &&
                (next.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0),
          )
        } else if (e.action === 'delete') {
          frequent.value = frequent.value.filter((x) => x.id !== e.record.id)
        }
      },
      { filter },
    )
  }

  function unsubscribeRealtime() {
    void pb.collection(COLLECTIONS.FOOD_ITEMS).unsubscribe('*')
    void pb.collection(COLLECTIONS.FOOD_LOG).unsubscribe('*')
    void pb.collection(COLLECTIONS.FOOD_FAVORITES).unsubscribe('*')
    void pb.collection(COLLECTIONS.FOOD_RECENTS).unsubscribe('*')
    void pb.collection(COLLECTIONS.FOOD_FREQUENT).unsubscribe('*')
  }

  function cleanupDetachedCollections() {
    const validIds = new Set(foodItems.value.map((item) => item.id))
    favorites.value = favorites.value.filter((item) => validIds.has(item.foodItem))
    recents.value = recents.value.filter((item) => validIds.has(item.foodItem))
    frequent.value = frequent.value.filter((item) => validIds.has(item.foodItem))
  }

  const dailyFoodSummaries = computed((): Map<string, DailyFoodSummary> => {
    const map = new Map<string, DailyFoodSummary>()

    for (const entry of foodLog.value) {
      let summary = map.get(entry.date)
      if (!summary) {
        summary = {
          meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
          totalCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFat: 0,
        }
        map.set(entry.date, summary)
      }

      summary.meals[entry.mealType].push(entry)
      summary.totalCalories = round1(summary.totalCalories + entry.calories)
      summary.totalProtein = round1(summary.totalProtein + (entry.protein ?? 0))
      summary.totalCarbs = round1(summary.totalCarbs + (entry.carbs ?? 0))
      summary.totalFat = round1(summary.totalFat + (entry.fat ?? 0))
    }

    return map
  })

  const todayFoodSummary = computed((): DailyFoodSummary | null => {
    return dailyFoodSummaries.value.get(today.value) ?? null
  })

  const favoriteFoods = computed((): FoodItem[] => {
    return [...favorites.value]
      .sort((a, b) => {
        const createdCmp = (b.created ?? '').localeCompare(a.created ?? '')
        if (createdCmp !== 0) return createdCmp
        return compareFoodNames(resolveFoodItem(a.foodItem), resolveFoodItem(b.foodItem))
      })
      .map((item) => resolveFoodItem(item.foodItem))
      .filter((item): item is FoodItem => item != null)
  })

  const recentFoodsPersisted = computed((): FoodItem[] => {
    return [...recents.value]
      .sort((a, b) => {
        const recencyCmp = (b.lastLoggedAt ?? '').localeCompare(a.lastLoggedAt ?? '')
        if (recencyCmp !== 0) return recencyCmp
        return compareFoodNames(resolveFoodItem(a.foodItem), resolveFoodItem(b.foodItem))
      })
      .map((item) => resolveFoodItem(item.foodItem))
      .filter((item): item is FoodItem => item != null)
  })

  const frequentFoodsPersisted = computed((): FoodItem[] => {
    return [...frequent.value]
      .sort((a, b) => {
        if (b.timesLogged !== a.timesLogged) return b.timesLogged - a.timesLogged
        const recencyCmp = (b.lastLoggedAt ?? '').localeCompare(a.lastLoggedAt ?? '')
        if (recencyCmp !== 0) return recencyCmp
        return compareFoodNames(resolveFoodItem(a.foodItem), resolveFoodItem(b.foodItem))
      })
      .map((item) => resolveFoodItem(item.foodItem))
      .filter((item): item is FoodItem => item != null)
  })

  function foodsForDashboardTab(tab: FoodDashboardTab): FoodItem[] {
    if (tab === 'favorites') return favoriteFoods.value
    if (tab === 'recent') return recentFoodsPersisted.value
    return frequentFoodsPersisted.value
  }

  const combinedSearchState = computed(() => {
    const query = dashboardQuery.value.trim().toLowerCase()
    const personalMatches = query
      ? foodItems.value
          .filter(
            (food) =>
              food.name.toLowerCase().includes(query) ||
              food.brand?.toLowerCase().includes(query) ||
              food.barcode?.toLowerCase().includes(query),
          )
          .slice(0, 8)
      : []

    return {
      query: dashboardQuery.value.trim(),
      personalMatches,
      remoteResults: searchResults.value,
      hasQuery: dashboardQuery.value.trim().length > 0,
      showEmptyState:
        dashboardQuery.value.trim().length > 0 &&
        !isSearching.value &&
        personalMatches.length === 0 &&
        searchResults.value.length === 0,
    }
  })

  const recentFoods = computed(() => recentFoodsPersisted.value)
  const frequentFoods = computed(() => frequentFoodsPersisted.value)

  function reset() {
    unsubscribeRealtime()
    foodItems.value = []
    foodLog.value = []
    favorites.value = []
    recents.value = []
    frequent.value = []
    searchResults.value = []
    dashboardQuery.value = ''
    activeDashboardTab.value = 'frequent'
    selectedFoodForLogging.value = null
    isSearching.value = false
    isLookingUpBarcode.value = false
    isSavingFoodSelection.value = false
    visionConfigured.value = false
  }

  return {
    foodItems,
    foodLog,
    favorites,
    recents,
    frequent,
    searchResults,
    dashboardQuery,
    activeDashboardTab,
    selectedFoodForLogging,
    isSearching,
    isLoading,
    isLookingUpBarcode,
    isSavingFoodSelection,
    visionConfigured,
    loadFoodData,
    loadFoodDashboardData,
    searchFoods,
    lookupBarcode,
    addFoodItem,
    logFood,
    quickLog,
    updateFoodLogEntry,
    deleteFoodLogEntry,
    toggleFavorite,
    upsertRecentFromLog,
    upsertFrequentFromLog,
    parseNutritionLabel,
    setDashboardTab,
    selectFoodForLogging,
    clearSelectedFood,
    subscribeRealtime,
    unsubscribeRealtime,
    dailyFoodSummaries,
    todayFoodSummary,
    favoriteFoods,
    recentFoods,
    recentFoodsPersisted,
    frequentFoods,
    frequentFoodsPersisted,
    foodsForDashboardTab,
    combinedSearchState,
    reset,
  }
})
