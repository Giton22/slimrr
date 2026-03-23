import { Effect } from 'effect'
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
import { fromPbPromise, runPb } from '@/lib/effect'
import { pb, COLLECTIONS } from '@/lib/pocketbase'
import type {
  FoodFavoriteRecord,
  FoodFrequentRecord,
  FoodLogRecord,
  FoodRecentRecord,
} from '@/lib/pocketbase'
import { today } from '@/composables/useToday'
import {
  checkVisionConfiguration,
  createFoodItemRecord,
  type OFFSearchResult,
  loadFoodDashboardRepositoryData,
  lookupFoodBarcode,
  parseNutritionLabelImage,
  searchFoodDatabase,
  subscribeFoodRealtime,
  toFoodFavorite,
  toFoodFrequent,
  toFoodLogEntry,
  toFoodRecent,
  unsubscribeFoodRealtime,
} from '@/lib/food/repository'
import {
  buildCombinedSearchState,
  buildDailyFoodSummaries,
  buildFavoriteFoods,
  buildFrequentFoods,
  buildRecentFoods,
  cleanupDetachedFoodCollections,
  compareUsageRecency,
  dedupeByFoodItem,
  foodsForDashboardTab as getFoodsForDashboardTab,
} from '@/lib/food/helpers'

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
      visionConfigured.value = await runPb(checkVisionConfiguration())
    } catch {
      visionConfigured.value = false
    }
  }

  async function parseNutritionLabel(imageFile: File): Promise<OFFSearchResult | null> {
    try {
      return await runPb(parseNutritionLabelImage(imageFile))
    } catch {
      return null
    }
  }

  async function loadFoodDashboardData() {
    const userId = currentUserId()
    if (!userId) return

    isLoading.value = true
    try {
      const data = await runPb(loadFoodDashboardRepositoryData(userId))
      foodItems.value = data.foodItems
      foodLog.value = data.foodLog
      favorites.value = dedupeByFoodItem(
        data.favorites,
        (current, next) => (next.created ?? '').localeCompare(current.created ?? '') > 0,
      )
      recents.value = dedupeByFoodItem(
        data.recents,
        (current, next) => (next.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0,
      )
      frequent.value = dedupeByFoodItem(
        data.frequent,
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
      const results = await runPb(
        searchFoodDatabase(query).pipe(Effect.catchAll(() => Effect.succeed([]))),
      )
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
      return await runPb(lookupFoodBarcode(code))
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

    const foodItem = await runPb(createFoodItemRecord(userId, item))
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
      const updated = await runPb(
        fromPbPromise(
          (pb) =>
            pb.collection<FoodRecentRecord>(COLLECTIONS.FOOD_RECENTS).update(existing.id, payload),
          COLLECTIONS.FOOD_RECENTS,
        ),
      )
      const next = toFoodRecent(updated)
      recents.value = dedupeByFoodItem(
        [next, ...recents.value.filter((item) => item.id !== existing.id)],
        (current, incoming) =>
          (incoming.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0,
      )
      return
    }

    const created = await runPb(
      fromPbPromise(
        (pb) => pb.collection<FoodRecentRecord>(COLLECTIONS.FOOD_RECENTS).create(payload),
        COLLECTIONS.FOOD_RECENTS,
      ),
    )
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
      const updated = await runPb(
        fromPbPromise(
          (pb) =>
            pb
              .collection<FoodFrequentRecord>(COLLECTIONS.FOOD_FREQUENT)
              .update(existing.id, payload),
          COLLECTIONS.FOOD_FREQUENT,
        ),
      )
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

    const created = await runPb(
      fromPbPromise(
        (pb) => pb.collection<FoodFrequentRecord>(COLLECTIONS.FOOD_FREQUENT).create(payload),
        COLLECTIONS.FOOD_FREQUENT,
      ),
    )
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
        await runPb(
          fromPbPromise(
            (pb) => pb.collection(COLLECTIONS.FOOD_RECENTS).delete(existingRecent.id),
            COLLECTIONS.FOOD_RECENTS,
          ),
        )
        recents.value = recents.value.filter((item) => item.id !== existingRecent.id)
      }
      if (existingFrequent) {
        await runPb(
          fromPbPromise(
            (pb) => pb.collection(COLLECTIONS.FOOD_FREQUENT).delete(existingFrequent.id),
            COLLECTIONS.FOOD_FREQUENT,
          ),
        )
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
      const updated = await runPb(
        fromPbPromise(
          (pb) =>
            pb
              .collection<FoodRecentRecord>(COLLECTIONS.FOOD_RECENTS)
              .update(existingRecent.id, payload),
          COLLECTIONS.FOOD_RECENTS,
        ),
      )
      recents.value = [
        toFoodRecent(updated),
        ...recents.value.filter((item) => item.id !== existingRecent.id),
      ]
    } else {
      const created = await runPb(
        fromPbPromise(
          (pb) => pb.collection<FoodRecentRecord>(COLLECTIONS.FOOD_RECENTS).create(payload),
          COLLECTIONS.FOOD_RECENTS,
        ),
      )
      recents.value = [toFoodRecent(created), ...recents.value]
    }

    if (existingFrequent) {
      const updated = await runPb(
        fromPbPromise(
          (pb) =>
            pb
              .collection<FoodFrequentRecord>(COLLECTIONS.FOOD_FREQUENT)
              .update(existingFrequent.id, payload),
          COLLECTIONS.FOOD_FREQUENT,
        ),
      )
      frequent.value = [
        toFoodFrequent(updated),
        ...frequent.value.filter((item) => item.id !== existingFrequent.id),
      ]
    } else {
      const created = await runPb(
        fromPbPromise(
          (pb) => pb.collection<FoodFrequentRecord>(COLLECTIONS.FOOD_FREQUENT).create(payload),
          COLLECTIONS.FOOD_FREQUENT,
        ),
      )
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
        await runPb(
          fromPbPromise(
            (pb) => pb.collection(COLLECTIONS.FOOD_FAVORITES).delete(existing.id),
            COLLECTIONS.FOOD_FAVORITES,
          ),
        )
      } catch (error) {
        favorites.value = [existing, ...favorites.value]
        throw error
      }
      return false
    }

    const created = await runPb(
      fromPbPromise(
        (pb) =>
          pb.collection<FoodFavoriteRecord>(COLLECTIONS.FOOD_FAVORITES).create({
            user: userId,
            food_item: foodItemId,
          }),
        COLLECTIONS.FOOD_FAVORITES,
      ),
    )
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
      const rec = await runPb(
        fromPbPromise(
          (pb) =>
            pb.collection<FoodLogRecord>(COLLECTIONS.FOOD_LOG).create({
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
            }),
          COLLECTIONS.FOOD_LOG,
        ),
      )

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
      await runPb(
        fromPbPromise(
          (pb) => pb.collection(COLLECTIONS.FOOD_LOG).update(id, payload),
          COLLECTIONS.FOOD_LOG,
        ),
      )
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
      await runPb(
        fromPbPromise((pb) => pb.collection(COLLECTIONS.FOOD_LOG).delete(id), COLLECTIONS.FOOD_LOG),
      )
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

    subscribeFoodRealtime(userId, {
      onFoodItem(action, item) {
        if (action === 'create') {
          if (!foodItems.value.some((existing) => existing.id === item.id)) {
            foodItems.value.push(item)
            foodItems.value.sort((a, b) => a.name.localeCompare(b.name))
          }
        } else if (action === 'update') {
          const idx = foodItems.value.findIndex((existing) => existing.id === item.id)
          if (idx !== -1) foodItems.value[idx] = item
        } else if (action === 'delete') {
          foodItems.value = foodItems.value.filter((existing) => existing.id !== item.id)
          cleanupDetachedCollections()
        }
      },
      onFoodLog(action, entry) {
        if (action === 'create') {
          if (!foodLog.value.some((existing) => existing.id === entry.id)) {
            foodLog.value.push(entry)
          }
        } else if (action === 'update') {
          const idx = foodLog.value.findIndex((existing) => existing.id === entry.id)
          if (idx !== -1) foodLog.value[idx] = entry
        } else if (action === 'delete') {
          foodLog.value = foodLog.value.filter((existing) => existing.id !== entry.id)
        }
      },
      onFavorite(action, favorite) {
        if (action === 'create') {
          favorites.value = dedupeByFoodItem(
            [favorite, ...favorites.value],
            (current, next) => (next.created ?? '').localeCompare(current.created ?? '') > 0,
          )
        } else if (action === 'update') {
          favorites.value = dedupeByFoodItem(
            [
              favorite,
              ...favorites.value.filter(
                (existing) =>
                  existing.id !== favorite.id && existing.foodItem !== favorite.foodItem,
              ),
            ],
            (current, next) => (next.created ?? '').localeCompare(current.created ?? '') > 0,
          )
        } else if (action === 'delete') {
          favorites.value = favorites.value.filter((existing) => existing.id !== favorite.id)
        }
      },
      onRecent(action, recentEntry) {
        if (action === 'create') {
          recents.value = dedupeByFoodItem(
            [recentEntry, ...recents.value],
            (current, next) =>
              (next.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0,
          )
        } else if (action === 'update') {
          recents.value = dedupeByFoodItem(
            [
              recentEntry,
              ...recents.value.filter(
                (existing) =>
                  existing.id !== recentEntry.id && existing.foodItem !== recentEntry.foodItem,
              ),
            ],
            (current, next) =>
              (next.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0,
          )
        } else if (action === 'delete') {
          recents.value = recents.value.filter((existing) => existing.id !== recentEntry.id)
        }
      },
      onFrequent(action, frequentEntry) {
        if (action === 'create') {
          frequent.value = dedupeByFoodItem(
            [frequentEntry, ...frequent.value],
            (current, next) =>
              next.timesLogged > current.timesLogged ||
              (next.timesLogged === current.timesLogged &&
                (next.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0),
          )
        } else if (action === 'update') {
          frequent.value = dedupeByFoodItem(
            [
              frequentEntry,
              ...frequent.value.filter(
                (existing) =>
                  existing.id !== frequentEntry.id && existing.foodItem !== frequentEntry.foodItem,
              ),
            ],
            (current, next) =>
              next.timesLogged > current.timesLogged ||
              (next.timesLogged === current.timesLogged &&
                (next.lastLoggedAt ?? '').localeCompare(current.lastLoggedAt ?? '') > 0),
          )
        } else if (action === 'delete') {
          frequent.value = frequent.value.filter((existing) => existing.id !== frequentEntry.id)
        }
      },
    })
  }

  function unsubscribeRealtime() {
    unsubscribeFoodRealtime()
  }

  function cleanupDetachedCollections() {
    favorites.value = cleanupDetachedFoodCollections(foodItems.value, favorites.value)
    recents.value = cleanupDetachedFoodCollections(foodItems.value, recents.value)
    frequent.value = cleanupDetachedFoodCollections(foodItems.value, frequent.value)
  }

  const dailyFoodSummaries = computed(
    (): Map<string, DailyFoodSummary> => buildDailyFoodSummaries(foodLog.value),
  )

  const todayFoodSummary = computed((): DailyFoodSummary | null => {
    return dailyFoodSummaries.value.get(today.value) ?? null
  })

  const favoriteFoods = computed(() => buildFavoriteFoods(favorites.value, resolveFoodItem))

  const recentFoodsPersisted = computed(() => buildRecentFoods(recents.value, resolveFoodItem))

  const frequentFoodsPersisted = computed(() => buildFrequentFoods(frequent.value, resolveFoodItem))

  function foodsForDashboardTab(tab: FoodDashboardTab): FoodItem[] {
    return getFoodsForDashboardTab(
      tab,
      favoriteFoods.value,
      recentFoodsPersisted.value,
      frequentFoodsPersisted.value,
    )
  }

  const combinedSearchState = computed(() =>
    buildCombinedSearchState({
      dashboardQuery: dashboardQuery.value,
      foodItems: foodItems.value,
      searchResults: searchResults.value,
      isSearching: isSearching.value,
    }),
  )

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
