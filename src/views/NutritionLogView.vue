<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue-sonner'
import { useWeightStore } from '@/stores/weight'
import { useFoodStore } from '@/stores/food'
import { today } from '@/composables/useToday'
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import { useSwipeDayNavigation } from '@/composables/useSwipeDayNavigation'
import { addDays, formatDateShort } from '@/lib/date'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import CaloriesRingProgress from '@/components/dashboard/CaloriesRingProgress.vue'
import MacroProgressBars from '@/components/dashboard/MacroProgressBars.vue'
import MealSection from '@/components/dashboard/food/MealSection.vue'
import LogFoodDialog from '@/components/dashboard/food/LogFoodDialog.vue'
import EditFoodLogDialog from '@/components/dashboard/food/EditFoodLogDialog.vue'
import QuickLogDialog from '@/components/dashboard/food/QuickLogDialog.vue'
import BarcodeScannerDialog from '@/components/dashboard/food/BarcodeScannerDialog.vue'
import NutritionLabelDialog from '@/components/dashboard/food/NutritionLabelDialog.vue'
import type { FoodLogEntry, MealType } from '@/types'
import NutritionLogSkeleton from '@/components/dashboard/skeletons/NutritionLogSkeleton.vue'

const route = useRoute()

const showSkeleton = computed(() => foodStore.isLoading && foodStore.foodLog.length === 0)
const weightStore = useWeightStore()
const foodStore = useFoodStore()

// ── Date navigation ──
const selectedDate = ref(today.value)
const isToday = computed(() => selectedDate.value === today.value)

function prevDay() {
  selectedDate.value = addDays(selectedDate.value, -1)
}
function nextDay() {
  selectedDate.value = addDays(selectedDate.value, 1)
}
function goToday() {
  selectedDate.value = today.value
}

const dateLabel = computed(() => {
  if (selectedDate.value === today.value) return 'Today'
  if (selectedDate.value === addDays(today.value, -1)) return 'Yesterday'
  if (selectedDate.value === addDays(today.value, 1)) return 'Tomorrow'
  return formatDateShort(selectedDate.value)
})

// ── Calorie & macro data for selected date ──
const daySummary = computed(() => {
  return weightStore.dailyCalorieRows.find((r) => r.date === selectedDate.value) ?? null
})
const consumed = computed(() => daySummary.value?.consumedKcal ?? 0)
const goal = computed(() => daySummary.value?.goalKcal ?? 2000)

const dayMacros = computed(() => {
  const s = foodStore.dailyFoodSummaries.get(selectedDate.value)
  return {
    protein: s?.totalProtein ?? 0,
    carbs: s?.totalCarbs ?? 0,
    fat: s?.totalFat ?? 0,
  }
})

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

function entriesForMeal(meal: MealType) {
  return foodStore.foodLog.filter((e) => e.date === selectedDate.value && e.mealType === meal)
}

// Dialog state
const logFoodOpen = ref(false)
const logFoodInitialMeal = ref<MealType | undefined>(undefined)
const editFoodOpen = ref(false)
const editingFoodEntry = ref<FoodLogEntry | null>(null)
const barcodeOpen = ref(false)
const labelScanOpen = ref(false)
const scannedBarcode = ref<string | undefined>(undefined)
const scannedLabelResult = ref<
  | {
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
  | undefined
>(undefined)

function onBarcodeScanned(code: string) {
  scannedBarcode.value = code
  scannedLabelResult.value = undefined
  logFoodOpen.value = true
}

function onLabelScanned(result: NonNullable<typeof scannedLabelResult.value>) {
  scannedLabelResult.value = result
  scannedBarcode.value = undefined
  logFoodOpen.value = true
}

function onLogFoodClosed(isOpen: boolean) {
  logFoodOpen.value = isOpen
  if (!isOpen) {
    scannedBarcode.value = undefined
    scannedLabelResult.value = undefined
  }
}

function openAddFood(meal: MealType) {
  logFoodInitialMeal.value = meal
  logFoodOpen.value = true
}

function openEditFood(entry: FoodLogEntry) {
  editingFoodEntry.value = entry
  editFoodOpen.value = true
}

async function deleteEntry(entry: FoodLogEntry) {
  try {
    await foodStore.deleteFoodLogEntry(entry.id)
    toast.success('Entry deleted')
  } catch {
    toast.error('Failed to delete entry')
  }
}

async function duplicateEntry(entry: FoodLogEntry) {
  try {
    await foodStore.logFood({
      date: entry.date,
      mealType: entry.mealType,
      foodName: entry.foodName,
      amountG: entry.amountG,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
    })
    toast.success('Entry duplicated')
  } catch {
    toast.error('Failed to duplicate entry')
  }
}

// Pull-to-refresh
const containerRef = ref<HTMLElement | null>(null)
const { pullDistance, isRefreshing } = usePullToRefresh(containerRef, {
  async onRefresh() {
    await foodStore.loadFoodData()
  },
})

// Swipe between days
const swipeDirection = ref<'left' | 'right' | null>(null)
const { offsetX, onTouchStart, onTouchMove, onTouchEnd } = useSwipeDayNavigation(containerRef, {
  onPrev() {
    swipeDirection.value = 'right'
    prevDay()
  },
  onNext() {
    swipeDirection.value = 'left'
    nextDay()
  },
})

// Recent food items (from food log, deduplicated by name)
const recentFoods = computed(() => {
  const seen = new Set<string>()
  const items: { name: string; amount: string; calories: number }[] = []
  for (const entry of foodStore.foodLog) {
    if (seen.has(entry.foodName)) continue
    seen.add(entry.foodName)
    items.push({
      name: entry.foodName,
      amount: `${entry.amountG}g`,
      calories: entry.calories,
    })
    if (items.length >= 5) break
  }
  return items
})
</script>

<template>
  <div ref="containerRef" class="p-4 lg:p-8">
    <!-- Pull-to-refresh indicator -->
    <div
      v-if="pullDistance > 0 || isRefreshing"
      class="flex items-center justify-center pb-2 lg:hidden"
      :style="{ height: `${Math.max(pullDistance, isRefreshing ? 40 : 0)}px` }"
    >
      <Icon
        icon="lucide:loader-circle"
        class="size-5 text-primary"
        :class="{ 'animate-spin': isRefreshing }"
      />
    </div>

    <div class="mx-auto max-w-7xl">
      <!-- Desktop heading -->
      <div class="mb-6 hidden lg:block">
        <h2 class="text-3xl font-black tracking-tight">Nutrition Log</h2>
        <p class="text-muted-foreground">Track your daily food intake and macros.</p>
      </div>

      <!-- Tab navigation -->
      <div class="mb-6 flex gap-4 border-b border-border">
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

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <!-- Main column -->
        <div class="space-y-6 lg:col-span-8">
          <!-- Skeleton loading state -->
          <NutritionLogSkeleton v-if="showSkeleton" />

          <!-- Date Navigator -->
          <div v-if="!showSkeleton" class="flex items-center justify-center gap-3">
            <Button variant="ghost" size="icon" class="size-11" @click="prevDay">
              <Icon icon="lucide:chevron-left" class="size-5" />
            </Button>
            <button
              class="min-w-[120px] text-center text-sm font-semibold"
              :class="isToday ? '' : 'cursor-pointer hover:underline'"
              @click="goToday"
            >
              {{ dateLabel }}
            </button>
            <Button variant="ghost" size="icon" class="size-11" @click="nextDay">
              <Icon icon="lucide:chevron-right" class="size-5" />
            </Button>
            <Button
              v-if="!isToday"
              variant="outline"
              size="sm"
              class="ml-1 h-7 text-xs"
              @click="goToday"
            >
              Today
            </Button>
          </div>

          <!-- Swipeable day content -->
          <div
            v-if="!showSkeleton"
            class="relative min-h-[200px] overflow-hidden"
            @touchstart.passive="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
          >
            <Transition
              :name="swipeDirection === 'left' ? 'slide-left' : 'slide-right'"
              mode="out-in"
            >
              <div
                :key="selectedDate"
                class="space-y-6"
                :style="{
                  transform: offsetX ? `translateX(${offsetX}px)` : undefined,
                  transition: offsetX ? 'none' : undefined,
                }"
              >
                <!-- Summary Card -->
                <Card class="animate-card-enter shadow-warm">
                  <CardContent class="space-y-4 pt-6">
                    <CaloriesRingProgress :consumed="consumed" :goal="goal" />
                    <div class="grid grid-cols-3 gap-2 border-t border-border pt-4">
                      <div class="text-center">
                        <p class="text-xs uppercase tracking-wider text-muted-foreground">Goal</p>
                        <p class="font-bold">{{ goal.toLocaleString() }}</p>
                      </div>
                      <div class="text-center">
                        <p class="text-xs uppercase tracking-wider text-muted-foreground">Food</p>
                        <p class="font-bold">{{ consumed.toLocaleString() }}</p>
                      </div>
                      <div class="text-center">
                        <p class="text-xs uppercase tracking-wider text-muted-foreground">
                          Remaining
                        </p>
                        <p class="font-bold">{{ Math.max(0, goal - consumed).toLocaleString() }}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <!-- Macro cards (mobile) / stat cards (desktop) -->
                <div class="grid grid-cols-3 gap-3 lg:grid-cols-4">
                  <Card class="animate-card-enter" style="animation-delay: 50ms">
                    <CardContent class="p-3 lg:p-5">
                      <p class="text-[10px] font-bold uppercase text-muted-foreground">Protein</p>
                      <p class="text-sm font-bold lg:text-2xl">{{ dayMacros.protein }}g</p>
                      <div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          class="h-full rounded-full bg-primary"
                          :style="{ width: `${Math.min(100, (dayMacros.protein / 150) * 100)}%` }"
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <Card class="animate-card-enter" style="animation-delay: 75ms">
                    <CardContent class="p-3 lg:p-5">
                      <p class="text-[10px] font-bold uppercase text-muted-foreground">Carbs</p>
                      <p class="text-sm font-bold lg:text-2xl">{{ dayMacros.carbs }}g</p>
                      <div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          class="h-full rounded-full bg-orange-400"
                          :style="{ width: `${Math.min(100, (dayMacros.carbs / 250) * 100)}%` }"
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <Card class="animate-card-enter" style="animation-delay: 100ms">
                    <CardContent class="p-3 lg:p-5">
                      <p class="text-[10px] font-bold uppercase text-muted-foreground">Fat</p>
                      <p class="text-sm font-bold lg:text-2xl">{{ dayMacros.fat }}g</p>
                      <div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          class="h-full rounded-full bg-purple-400"
                          :style="{ width: `${Math.min(100, (dayMacros.fat / 65) * 100)}%` }"
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <!-- Remaining kcal card (desktop only) -->
                  <Card class="animate-card-enter hidden lg:block" style="animation-delay: 125ms">
                    <CardContent class="p-5">
                      <p
                        class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Remaining
                      </p>
                      <p class="text-2xl font-bold text-primary">
                        {{ Math.max(0, goal - consumed).toLocaleString() }}
                      </p>
                      <p class="mt-1 text-xs text-muted-foreground">kcal left</p>
                    </CardContent>
                  </Card>
                </div>

                <!-- Quick Add Bar -->
                <Card
                  class="animate-card-enter border-2 border-primary/20 shadow-warm"
                  style="animation-delay: 150ms"
                >
                  <CardContent class="space-y-4 pt-4">
                    <div class="flex flex-wrap justify-between gap-2">
                      <Button variant="outline" class="flex-1 gap-2" @click="logFoodOpen = true">
                        <Icon icon="lucide:pencil" class="size-4 text-primary" />
                        Manual
                      </Button>
                      <Button variant="outline" class="flex-1 gap-2" @click="barcodeOpen = true">
                        <Icon icon="lucide:scan-barcode" class="size-4 text-primary" />
                        Barcode
                      </Button>
                      <Button variant="outline" class="flex-1 gap-2" @click="labelScanOpen = true">
                        <Icon icon="lucide:camera" class="size-4 text-primary" />
                        AI Scan
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <!-- Meal Sections -->
                <div class="space-y-4">
                  <Card
                    v-for="meal in mealTypes"
                    :key="meal"
                    class="animate-card-enter shadow-warm"
                    :style="{ animationDelay: `${200 + mealTypes.indexOf(meal) * 50}ms` }"
                  >
                    <CardContent class="pt-4">
                      <MealSection
                        :meal-type="meal"
                        :entries="entriesForMeal(meal)"
                        @add-food="openAddFood"
                        @edit-entry="openEditFood"
                        @delete-entry="deleteEntry"
                        @duplicate-entry="duplicateEntry"
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Right sidebar (desktop) -->
        <div class="hidden space-y-6 lg:col-span-4 lg:block">
          <!-- Frequent Foods -->
          <Card class="animate-card-enter shadow-warm" style="animation-delay: 200ms">
            <CardContent class="pt-6">
              <div class="mb-4 flex items-center justify-between">
                <h3 class="text-base font-bold">Recent Foods</h3>
                <Icon icon="lucide:history" class="size-4 text-muted-foreground" />
              </div>
              <div
                v-if="recentFoods.length === 0"
                class="py-6 text-center text-sm text-muted-foreground"
              >
                No recent foods
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="food in recentFoods"
                  :key="food.name"
                  class="flex items-center justify-between rounded-lg p-2 hover:bg-muted/50"
                >
                  <div class="flex items-center gap-3">
                    <div class="flex size-8 items-center justify-center rounded-full bg-primary/10">
                      <Icon icon="lucide:zap" class="size-4 text-primary" />
                    </div>
                    <div>
                      <p class="text-sm font-semibold">{{ food.name }}</p>
                      <p class="text-xs text-muted-foreground">{{ food.amount }}</p>
                    </div>
                  </div>
                  <p class="text-sm font-bold">{{ food.calories }} kcal</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

    <LogFoodDialog
      :open="logFoodOpen"
      :initial-date="selectedDate"
      :initial-meal-type="logFoodInitialMeal"
      :initial-barcode="scannedBarcode"
      :initial-label-result="scannedLabelResult"
      hide-trigger
      @update:open="onLogFoodClosed"
    />
    <EditFoodLogDialog v-model:open="editFoodOpen" :entry="editingFoodEntry" />
    <BarcodeScannerDialog v-model:open="barcodeOpen" hide-trigger @scanned="onBarcodeScanned" />
    <NutritionLabelDialog v-model:open="labelScanOpen" hide-trigger @scanned="onLabelScanned" />
  </div>
</template>
