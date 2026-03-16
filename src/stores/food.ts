import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import type { FoodItem, FoodLogEntry, MealType, DailyFoodSummary } from '@/types'
import { pb, COLLECTIONS } from '@/lib/pocketbase'
import type { FoodItemRecord, FoodLogRecord } from '@/lib/pocketbase'
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

function cutoffISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const useFoodStore = defineStore('food', () => {
  const foodItems = ref<FoodItem[]>([])
  const foodLog = ref<FoodLogEntry[]>([])
  const searchResults = ref<OFFSearchResult[]>([])
  const isSearching = ref(false)
  const isLoading = ref(false)
  const visionConfigured = ref(false)

  // ── Vision label scanning ──

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

  // ── Data loading ──

  async function loadFoodData() {
    const userId = pb.authStore.record?.id
    if (!userId) return

    isLoading.value = true
    try {
      const userFilter = pb.filter('user = {:userId}', { userId })
      const dateBoundFilter = pb.filter('user = {:userId} && date >= {:cutoff}', {
        userId,
        cutoff: cutoffISO(365),
      })

      const [itemRecords, logRecords] = await Promise.all([
        pb
          .collection<FoodItemRecord>(COLLECTIONS.FOOD_ITEMS)
          .getFullList({ filter: userFilter, sort: 'name' }),
        pb
          .collection<FoodLogRecord>(COLLECTIONS.FOOD_LOG)
          .getFullList({ filter: dateBoundFilter, sort: 'date' }),
      ])

      foodItems.value = itemRecords.map(toFoodItem)
      foodLog.value = logRecords.map(toFoodLogEntry)
    } finally {
      isLoading.value = false
    }

    // Check vision API availability (non-blocking)
    void checkVisionStatus()
  }

  // ── Search ──

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
    try {
      return await pb.send<OFFSearchResult>(`/api/food/barcode/${encodeURIComponent(code)}`, {
        method: 'GET',
      })
    } catch {
      return null
    }
  }

  // ── Food item CRUD ──

  async function addFoodItem(item: Omit<FoodItem, 'id'>): Promise<FoodItem> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Not authenticated')

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
    }
    return foodItem
  }

  // ── Food logging ──

  async function logFood(
    date: string,
    mealType: MealType,
    foodItem: FoodItem | null,
    amountG: number,
    overrides?: {
      calories?: number
      protein?: number
      carbs?: number
      fat?: number
      note?: string
    },
  ) {
    const userId = pb.authStore.record?.id
    if (!userId) return

    let calories: number
    let protein: number
    let carbs: number
    let fat: number
    let foodName: string

    if (foodItem) {
      const factor = amountG / 100
      calories = overrides?.calories ?? Math.round(foodItem.caloriesPer100g * factor * 10) / 10
      protein = overrides?.protein ?? Math.round((foodItem.proteinPer100g ?? 0) * factor * 10) / 10
      carbs = overrides?.carbs ?? Math.round((foodItem.carbsPer100g ?? 0) * factor * 10) / 10
      fat = overrides?.fat ?? Math.round((foodItem.fatPer100g ?? 0) * factor * 10) / 10
      foodName = foodItem.name
    } else {
      calories = overrides?.calories ?? 0
      protein = overrides?.protein ?? 0
      carbs = overrides?.carbs ?? 0
      fat = overrides?.fat ?? 0
      foodName = 'Quick entry'
    }

    try {
      const rec = await pb.collection<FoodLogRecord>(COLLECTIONS.FOOD_LOG).create({
        user: userId,
        date,
        meal_type: mealType,
        food_item: foodItem?.id ?? '',
        food_name: foodName,
        amount_g: amountG,
        calories,
        protein,
        carbs,
        fat,
        note: overrides?.note ?? '',
      })

      const entry = toFoodLogEntry(rec)
      if (!foodLog.value.some((e) => e.id === entry.id)) {
        foodLog.value.push(entry)
      }
    } catch {
      toast.error('Failed to log food entry')
    }
  }

  async function quickLog(date: string, mealType: MealType, calories: number, name?: string) {
    const userId = pb.authStore.record?.id
    if (!userId) return

    try {
      const rec = await pb.collection<FoodLogRecord>(COLLECTIONS.FOOD_LOG).create({
        user: userId,
        date,
        meal_type: mealType,
        food_item: '',
        food_name: name || 'Quick entry',
        amount_g: 1,
        calories,
        protein: 0,
        carbs: 0,
        fat: 0,
        note: '',
      })

      const entry = toFoodLogEntry(rec)
      if (!foodLog.value.some((e) => e.id === entry.id)) {
        foodLog.value.push(entry)
      }
    } catch {
      toast.error('Failed to log quick entry')
    }
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
      if (idx !== -1) foodLog.value[idx] = { ...existing, ...patch }
    } catch {
      toast.error('Failed to update food log entry')
    }
  }

  async function deleteFoodLogEntry(id: string) {
    try {
      await pb.collection(COLLECTIONS.FOOD_LOG).delete(id)
      foodLog.value = foodLog.value.filter((e) => e.id !== id)
    } catch {
      toast.error('Failed to delete food log entry')
    }
  }

  // ── Realtime ──

  function subscribeRealtime() {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const filter = pb.filter('user = {:userId}', { userId })

    void pb.collection<FoodItemRecord>(COLLECTIONS.FOOD_ITEMS).subscribe(
      '*',
      (e) => {
        if (e.action === 'create') {
          if (!foodItems.value.some((x) => x.id === e.record.id))
            foodItems.value.push(toFoodItem(e.record))
        } else if (e.action === 'update') {
          const idx = foodItems.value.findIndex((x) => x.id === e.record.id)
          if (idx !== -1) foodItems.value[idx] = toFoodItem(e.record)
        } else if (e.action === 'delete') {
          foodItems.value = foodItems.value.filter((x) => x.id !== e.record.id)
        }
      },
      { filter },
    )

    void pb.collection<FoodLogRecord>(COLLECTIONS.FOOD_LOG).subscribe(
      '*',
      (e) => {
        if (e.action === 'create') {
          if (!foodLog.value.some((x) => x.id === e.record.id))
            foodLog.value.push(toFoodLogEntry(e.record))
        } else if (e.action === 'update') {
          const idx = foodLog.value.findIndex((x) => x.id === e.record.id)
          if (idx !== -1) foodLog.value[idx] = toFoodLogEntry(e.record)
        } else if (e.action === 'delete') {
          foodLog.value = foodLog.value.filter((x) => x.id !== e.record.id)
        }
      },
      { filter },
    )
  }

  function unsubscribeRealtime() {
    void pb.collection(COLLECTIONS.FOOD_ITEMS).unsubscribe('*')
    void pb.collection(COLLECTIONS.FOOD_LOG).unsubscribe('*')
  }

  // ── Computed ──

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
      summary.totalCalories += entry.calories
      summary.totalProtein += entry.protein ?? 0
      summary.totalCarbs += entry.carbs ?? 0
      summary.totalFat += entry.fat ?? 0
    }

    return map
  })

  const todayFoodSummary = computed((): DailyFoodSummary | null => {
    return dailyFoodSummaries.value.get(today.value) ?? null
  })

  const recentFoods = computed((): FoodItem[] => {
    const seen = new Set<string>()
    const result: FoodItem[] = []
    const sorted = [...foodLog.value].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date)
      if (dateCmp !== 0) return dateCmp
      return b.id.localeCompare(a.id)
    })

    for (const entry of sorted) {
      if (!entry.foodItem || seen.has(entry.foodItem)) continue
      seen.add(entry.foodItem)
      const item = foodItems.value.find((f) => f.id === entry.foodItem)
      if (item) result.push(item)
      if (result.length >= 10) break
    }

    return result
  })

  const frequentFoods = computed((): FoodItem[] => {
    const counts = new Map<string, number>()
    for (const entry of foodLog.value) {
      if (!entry.foodItem) continue
      counts.set(entry.foodItem, (counts.get(entry.foodItem) ?? 0) + 1)
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => foodItems.value.find((f) => f.id === id))
      .filter((f): f is FoodItem => f != null)
  })

  function reset() {
    unsubscribeRealtime()
    foodItems.value = []
    foodLog.value = []
    searchResults.value = []
    isSearching.value = false
    visionConfigured.value = false
  }

  return {
    foodItems,
    foodLog,
    searchResults,
    isSearching,
    isLoading,
    visionConfigured,
    loadFoodData,
    searchFoods,
    lookupBarcode,
    addFoodItem,
    logFood,
    quickLog,
    updateFoodLogEntry,
    deleteFoodLogEntry,
    parseNutritionLabel,
    subscribeRealtime,
    unsubscribeRealtime,
    dailyFoodSummaries,
    todayFoodSummary,
    recentFoods,
    frequentFoods,
    reset,
  }
})
