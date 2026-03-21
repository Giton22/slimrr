<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import type { FoodDashboardTab, FoodItem, MealType } from '@/types'
import { useFoodStore } from '@/stores/food'
import {
  buildNutritionRouteQuery,
  mealLabel,
  mealSearchPlaceholder,
  parseNutritionRouteContext,
} from '@/lib/food-dashboard'
import FoodLogDashboardHeader from '@/components/nutrition/FoodLogDashboardHeader.vue'
import FoodDashboardSearchHero from '@/components/nutrition/FoodDashboardSearchHero.vue'
import FoodDashboardTabs from '@/components/nutrition/FoodDashboardTabs.vue'
import FoodDashboardList from '@/components/nutrition/FoodDashboardList.vue'
import FoodLogComposer from '@/components/nutrition/FoodLogComposer.vue'
import NutritionLogSkeleton from '@/components/dashboard/skeletons/NutritionLogSkeleton.vue'
import BarcodeScannerDialog from '@/components/dashboard/food/BarcodeScannerDialog.vue'
import NutritionLabelDialog from '@/components/dashboard/food/NutritionLabelDialog.vue'

const route = useRoute()
const router = useRouter()
const foodStore = useFoodStore()

const selectedDate = ref('')
const selectedMeal = ref<MealType>('lunch')
const amountG = ref(100)
const barcodeDialogOpen = ref(false)
const labelDialogOpen = ref(false)
const pendingFavorite = ref(false)
const saveNotice = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
const feedbackRef = ref<HTMLElement | null>(null)

const showSkeleton = computed(() => foodStore.isLoading && foodStore.foodItems.length === 0)

const tabCounts = computed<Record<FoodDashboardTab, number>>(() => ({
  frequent: foodStore.frequentFoodsPersisted.length,
  recent: foodStore.recentFoodsPersisted.length,
  favorites: foodStore.favoriteFoods.length,
}))

const tabFoods = computed(() => foodStore.foodsForDashboardTab(foodStore.activeDashboardTab))
const favoriteIds = computed(() => foodStore.favorites.map((item) => item.foodItem))
const selectedFoodId = computed(() => foodStore.selectedFoodForLogging?.foodItemId)

const remoteSearchFoods = computed<FoodItem[]>(() =>
  foodStore.searchResults.map((result, index) => ({
    id: `remote:${result.barcode || result.offId || index}`,
    name: result.name,
    brand: result.brand || undefined,
    barcode: result.barcode || undefined,
    caloriesPer100g: result.caloriesPer100g,
    proteinPer100g: result.proteinPer100g || undefined,
    carbsPer100g: result.carbsPer100g || undefined,
    fatPer100g: result.fatPer100g || undefined,
    defaultServingG: result.servingG || 100,
    source: 'openfoodfacts',
    offId: result.offId || undefined,
  })),
)

function syncRouteState() {
  const context = parseNutritionRouteContext(route.query as Record<string, unknown>)
  selectedDate.value = context.date
  selectedMeal.value = context.meal
}

function replaceRouteQuery(source = route.query.source) {
  void router.replace({
    path: '/nutrition',
    query: buildNutritionRouteQuery({
      date: selectedDate.value,
      meal: selectedMeal.value,
      source: typeof source === 'string' ? source : 'manual',
    }),
  })
}

function resetComposerForSelection() {
  const selection = foodStore.selectedFoodForLogging
  amountG.value = selection?.defaultServingG || 100
  pendingFavorite.value = selection?.foodItemId
    ? favoriteIds.value.includes(selection.foodItemId)
    : false
}

function selectLocalFood(food: FoodItem, source: 'recent' | 'favorite' | 'frequent' | 'personal') {
  foodStore.selectFoodForLogging(food, source)
  resetComposerForSelection()
}

function selectRemoteFood(food: FoodItem) {
  const result = foodStore.searchResults.find(
    (item) => item.offId === food.offId || item.barcode === food.barcode,
  )
  if (!result) return
  foodStore.selectFoodForLogging(result, 'openfoodfacts')
  resetComposerForSelection()
}

async function toggleFavoriteForFood(food: FoodItem) {
  if (food.id.startsWith('remote:')) {
    selectRemoteFood(food)
    pendingFavorite.value = !pendingFavorite.value
    return
  }

  try {
    const active = await foodStore.toggleFavorite(food.id)
    if (foodStore.selectedFoodForLogging?.foodItemId === food.id) {
      pendingFavorite.value = active
    }
  } catch {
    toast.error('Failed to update favorite')
  }
}

async function onBarcodeScanned(code: string) {
  const result = await foodStore.lookupBarcode(code)
  if (!result) {
    toast.error('Product not found for this barcode')
    return
  }

  foodStore.selectFoodForLogging(result, 'barcode')
  resetComposerForSelection()
  replaceRouteQuery('barcode')
}

function onLabelScanned(result: Parameters<typeof foodStore.selectFoodForLogging>[0]) {
  if (!('name' in result) || !('caloriesPer100g' in result) || !result.caloriesPer100g) {
    toast.error('AI scan needs calories before the food can be logged')
    return
  }

  foodStore.selectFoodForLogging(result, 'ai')
  resetComposerForSelection()
  replaceRouteQuery('ai')
}

function clearComposer() {
  foodStore.clearSelectedFood()
  amountG.value = 100
  pendingFavorite.value = false
}

async function saveFood() {
  const selection = foodStore.selectedFoodForLogging
  const safeAmount = Math.max(1, Math.round(amountG.value || 0))
  if (!selection || foodStore.isSavingFoodSelection) return

  foodStore.isSavingFoodSelection = true
  try {
    let actualFood =
      selection.foodItemId != null
        ? (foodStore.foodItems.find((item) => item.id === selection.foodItemId) ?? null)
        : null

    if (!actualFood) {
      actualFood = await foodStore.addFoodItem({
        name: selection.name,
        brand: selection.brand,
        barcode: selection.barcode,
        caloriesPer100g: selection.caloriesPer100g,
        proteinPer100g: selection.proteinPer100g,
        carbsPer100g: selection.carbsPer100g,
        fatPer100g: selection.fatPer100g,
        defaultServingG: selection.defaultServingG || 100,
        source: selection.itemSource,
        offId: selection.offId,
      })
    }

    const entry = await foodStore.logFood({
      date: selectedDate.value,
      mealType: selectedMeal.value,
      foodItem: actualFood,
      amountG: safeAmount,
      sourceContext: selection.source,
    })

    if (!entry) return

    const isFavorite = favoriteIds.value.includes(actualFood.id)
    if (pendingFavorite.value !== isFavorite) {
      await foodStore.toggleFavorite(actualFood.id)
    }

    foodStore.dashboardQuery = ''
    foodStore.searchResults = []
    saveNotice.value = `Added ${actualFood.name} to ${mealLabel(selectedMeal.value).toLowerCase()} for ${selectedDate.value}.`
    clearComposer()
    replaceRouteQuery('manual')
    toast.success(`Logged ${actualFood.name}`)

    if (route.query.source === 'diary') {
      await nextTick()
      feedbackRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  } catch {
    toast.error('Failed to log food')
  } finally {
    foodStore.isSavingFoodSelection = false
  }
}

watch(
  () => route.query,
  () => {
    syncRouteState()
  },
  { immediate: true },
)

watch([selectedDate, selectedMeal], () => {
  if (!selectedDate.value) return
  replaceRouteQuery()
})

watch(
  () => foodStore.dashboardQuery,
  (query) => {
    if (searchTimer) clearTimeout(searchTimer)

    if (!query.trim()) {
      foodStore.searchResults = []
      return
    }

    searchTimer = setTimeout(() => {
      void foodStore.searchFoods(query)
    }, 350)
  },
)

const mobileSelectionSummary = computed(() => {
  const selection = foodStore.selectedFoodForLogging
  if (!selection) return null

  return {
    title: selection.name,
    subtitle: `${mealLabel(selectedMeal.value)} · ${selectedDate.value}`,
    meta: selection.brand || `${selection.defaultServingG || 100} g suggested serving`,
  }
})
</script>

<template>
  <div class="min-h-full px-3 pb-28 pt-3 sm:px-4 sm:pt-4 lg:px-8 lg:pb-8 lg:pt-8">
    <div class="mx-auto max-w-7xl">
      <div class="mb-5 flex gap-4 border-b border-border">
        <RouterLink
          to="/nutrition"
          class="border-b-2 px-1 pb-2 text-sm font-medium transition-colors"
          :class="
            route.path === '/nutrition'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
        >
          Food Log
        </RouterLink>
        <RouterLink
          to="/nutrition/overview"
          class="border-b-2 px-1 pb-2 text-sm font-medium transition-colors"
          :class="
            route.path === '/nutrition/overview'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
        >
          Overview
        </RouterLink>
      </div>

      <NutritionLogSkeleton v-if="showSkeleton" />

      <div
        v-else
        class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]"
      >
        <div class="space-y-4 sm:space-y-5">
          <FoodLogDashboardHeader
            :meal="selectedMeal"
            :date="selectedDate"
            @update-meal="selectedMeal = $event"
          />

          <div
            v-if="saveNotice"
            ref="feedbackRef"
            class="rounded-[1.6rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300"
          >
            {{ saveNotice }}
          </div>

          <div
            v-if="mobileSelectionSummary"
            class="rounded-[1.6rem] border border-primary/20 bg-primary/[0.06] px-4 py-3 lg:hidden"
          >
            <p class="text-xs font-bold uppercase tracking-[0.2em] text-primary">Selected food</p>
            <p class="mt-2 text-lg font-black tracking-tight text-foreground">
              {{ mobileSelectionSummary.title }}
            </p>
            <p class="mt-1 text-sm font-medium text-muted-foreground">
              {{ mobileSelectionSummary.subtitle }}
            </p>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ mobileSelectionSummary.meta }}
            </p>
          </div>

          <FoodDashboardSearchHero
            :model-value="foodStore.dashboardQuery"
            :placeholder="mealSearchPlaceholder(selectedMeal)"
            :loading="foodStore.isSearching || foodStore.isLookingUpBarcode"
            :ai-enabled="foodStore.visionConfigured"
            @update:model-value="foodStore.dashboardQuery = $event"
            @barcode="barcodeDialogOpen = true"
            @ai="labelDialogOpen = true"
          />

          <div
            v-if="!foodStore.dashboardQuery.trim()"
            class="rounded-[1.6rem] border border-dashed border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground"
          >
            Search by name, scan a barcode, or use recent foods to log {{ selectedMeal }} faster.
          </div>

          <FoodDashboardTabs
            :model-value="foodStore.activeDashboardTab"
            :counts="tabCounts"
            @update:model-value="foodStore.setDashboardTab($event)"
          />

          <FoodDashboardList
            :query="foodStore.combinedSearchState.query"
            :tab="foodStore.activeDashboardTab"
            :tab-foods="tabFoods"
            :personal-matches="foodStore.combinedSearchState.personalMatches"
            :remote-foods="remoteSearchFoods"
            :favorite-ids="favoriteIds"
            :selected-food-id="selectedFoodId"
            :show-empty-state="foodStore.combinedSearchState.showEmptyState"
            :is-searching="foodStore.isSearching"
            :ai-enabled="foodStore.visionConfigured"
            @select="
              $event.id.startsWith('remote:')
                ? selectRemoteFood($event)
                : selectLocalFood(
                    $event,
                    foodStore.combinedSearchState.query
                      ? 'personal'
                      : foodStore.activeDashboardTab === 'favorites'
                        ? 'favorite'
                        : foodStore.activeDashboardTab === 'recent'
                          ? 'recent'
                          : 'frequent',
                  )
            "
            @toggle-favorite="toggleFavoriteForFood"
          />
        </div>

        <div class="hidden lg:block">
          <FoodLogComposer
            :selection="foodStore.selectedFoodForLogging"
            :date="selectedDate"
            :meal="selectedMeal"
            :amount="amountG"
            :favorite="pendingFavorite"
            :saving="foodStore.isSavingFoodSelection"
            @update-date="selectedDate = $event"
            @update-meal="selectedMeal = $event"
            @update-amount="amountG = Math.max(1, $event || 1)"
            @toggle-favorite="pendingFavorite = !pendingFavorite"
            @cancel="clearComposer"
            @save="saveFood"
          />
        </div>
      </div>
    </div>

    <div
      class="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-40 px-3 sm:px-4 lg:hidden"
    >
      <FoodLogComposer
        v-if="foodStore.selectedFoodForLogging"
        :selection="foodStore.selectedFoodForLogging"
        :date="selectedDate"
        :meal="selectedMeal"
        :amount="amountG"
        :favorite="pendingFavorite"
        :saving="foodStore.isSavingFoodSelection"
        @update-date="selectedDate = $event"
        @update-meal="selectedMeal = $event"
        @update-amount="amountG = Math.max(1, $event || 1)"
        @toggle-favorite="pendingFavorite = !pendingFavorite"
        @cancel="clearComposer"
        @save="saveFood"
      />
    </div>

    <BarcodeScannerDialog
      v-model:open="barcodeDialogOpen"
      hide-trigger
      @scanned="onBarcodeScanned"
    />
    <NutritionLabelDialog
      v-if="foodStore.visionConfigured"
      v-model:open="labelDialogOpen"
      hide-trigger
      @scanned="onLabelScanned"
    />
  </div>
</template>
