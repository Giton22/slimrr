<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useWeightStore } from '@/stores/weight'
import { useFoodStore } from '@/stores/food'
import { today } from '@/composables/useToday'
import { useSwipeDayNavigation } from '@/composables/useSwipeDayNavigation'
import { useStreaks } from '@/composables/useStreaks'
import { useUnits } from '@/composables/useUnits'
import { addDays, formatDateLong, formatDateShort } from '@/lib/date'
import type { FoodLogEntry, MealType, WeightEntry } from '@/types'
import DashboardSkeleton from '@/components/dashboard/skeletons/DashboardSkeleton.vue'
import EditFoodLogDialog from '@/components/dashboard/food/EditFoodLogDialog.vue'
import DailyFoodBreakdown from '@/components/dashboard/food/DailyFoodBreakdown.vue'
import LogWeightDialog from '@/components/dashboard/LogWeightDialog.vue'
import EditWeightDialog from '@/components/dashboard/EditWeightDialog.vue'
import DiaryHeader from '@/components/dashboard/diary/DiaryHeader.vue'
import DiarySummaryCard from '@/components/dashboard/diary/DiarySummaryCard.vue'
import DiaryMealsCard from '@/components/dashboard/diary/DiaryMealsCard.vue'
import DiaryWeightCard from '@/components/dashboard/diary/DiaryWeightCard.vue'

const weightStore = useWeightStore()
const foodStore = useFoodStore()
const router = useRouter()
const { format } = useUnits()
const { currentStreak, streakJustIncreased } = useStreaks()

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

function getIsoWeek(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`)
  const day = date.getDay() || 7
  date.setDate(date.getDate() + 4 - day)
  const yearStart = new Date(date.getFullYear(), 0, 1)
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return week
}

const headerTitle = computed(() => {
  if (selectedDate.value === today.value) return 'Today'
  if (selectedDate.value === addDays(today.value, -1)) return 'Yesterday'
  if (selectedDate.value === addDays(today.value, 1)) return 'Tomorrow'
  return formatDateShort(selectedDate.value)
})

const headerSubtitle = computed(
  () => `Week ${getIsoWeek(selectedDate.value)} · ${formatDateLong(selectedDate.value)}`,
)

const daySummary = computed(() => {
  return weightStore.dailyCalorieRows.find((row) => row.date === selectedDate.value) ?? null
})

const consumed = computed(() => daySummary.value?.consumedKcal ?? 0)
const goal = computed(() => daySummary.value?.goalKcal ?? 2000)

const dailyFoodSummary = computed(
  () => foodStore.dailyFoodSummaries.get(selectedDate.value) ?? null,
)
const meals = computed<Record<MealType, FoodLogEntry[]>>(() => ({
  breakfast: dailyFoodSummary.value?.meals.breakfast ?? [],
  lunch: dailyFoodSummary.value?.meals.lunch ?? [],
  dinner: dailyFoodSummary.value?.meals.dinner ?? [],
  snack: dailyFoodSummary.value?.meals.snack ?? [],
}))

const selectedWeightEntry = computed<WeightEntry | null>(() => {
  return weightStore.sortedEntries.find((entry) => entry.date === selectedDate.value) ?? null
})

const displayedWeight = computed(() => {
  if (selectedWeightEntry.value) return format(selectedWeightEntry.value.weightKg)
  return 'No entry'
})

const latestWeight = computed(() => {
  if (!weightStore.latestEntry) return null
  return weightStore.latestEntry ? format(weightStore.latestEntry.weightKg) : null
})

const selectedWeightLabel = computed(() => {
  if (isToday.value) return 'For today'
  return `For ${formatDateShort(selectedDate.value)}`
})

const editFoodOpen = ref(false)
const editingFoodEntry = ref<FoodLogEntry | null>(null)
const foodBreakdownOpen = ref(false)

const logWeightOpen = ref(false)
const editWeightOpen = ref(false)

function openAddFood(mealType: MealType) {
  void router.push({
    path: '/nutrition',
    query: {
      date: selectedDate.value,
      meal: mealType,
      source: 'diary',
    },
  })
}

function openMealBreakdown() {
  foodBreakdownOpen.value = true
}

function openEditFood(entry: FoodLogEntry) {
  editingFoodEntry.value = entry
  editFoodOpen.value = true
}

function openWeightLogger() {
  logWeightOpen.value = true
}

function openWeightEditor() {
  if (!selectedWeightEntry.value) return
  editWeightOpen.value = true
}

const containerRef = ref<HTMLElement | null>(null)

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

const macroGoals = computed(() => ({
  protein: weightStore.settings.proteinGoalG ?? 150,
  carbs: weightStore.settings.carbsGoalG ?? 250,
  fat: weightStore.settings.fatGoalG ?? 65,
}))
</script>

<template>
  <div
    ref="containerRef"
    class="min-h-full bg-background px-4 pb-8 pt-4 text-foreground lg:px-8 lg:pt-8"
  >
    <div class="mx-auto max-w-3xl space-y-6 lg:space-y-7">
      <DashboardSkeleton v-if="!weightStore.isSynced" />

      <template v-else>
        <DiaryHeader
          :title="headerTitle"
          :subtitle="headerSubtitle"
          :is-today="isToday"
          :streak-count="currentStreak"
          :streak-just-increased="streakJustIncreased"
          @prev="prevDay"
          @next="nextDay"
          @today="goToday"
        />

        <div
          class="relative overflow-hidden"
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
              <section class="space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <h2 class="text-3xl font-black tracking-tight text-foreground">Summary</h2>
                  <RouterLink
                    to="/nutrition/overview"
                    class="text-sm font-bold text-primary transition-opacity hover:opacity-80"
                  >
                    Details
                  </RouterLink>
                </div>

                <DiarySummaryCard
                  :consumed="consumed"
                  :goal="goal"
                  :protein="dailyFoodSummary?.totalProtein ?? 0"
                  :protein-goal="macroGoals.protein"
                  :carbs="dailyFoodSummary?.totalCarbs ?? 0"
                  :carbs-goal="macroGoals.carbs"
                  :fat="dailyFoodSummary?.totalFat ?? 0"
                  :fat-goal="macroGoals.fat"
                />
              </section>

              <section class="space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <h2 class="text-3xl font-black tracking-tight text-foreground">Nutrition</h2>
                  <RouterLink
                    to="/nutrition"
                    class="text-sm font-bold text-primary transition-opacity hover:opacity-80"
                  >
                    More
                  </RouterLink>
                </div>

                <DiaryMealsCard :meals="meals" @add="openAddFood" @open="openMealBreakdown" />
              </section>

              <section class="space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <h2 class="text-3xl font-black tracking-tight text-foreground">Measurements</h2>
                  <RouterLink
                    to="/weight"
                    class="text-sm font-bold text-primary transition-opacity hover:opacity-80"
                  >
                    More
                  </RouterLink>
                </div>

                <DiaryWeightCard
                  :display-value="displayedWeight"
                  :goal-value="format(weightStore.settings.goalWeightKg)"
                  :selected-date-label="selectedWeightLabel"
                  :latest-value="latestWeight"
                  :has-entry="!!selectedWeightEntry"
                  @edit="openWeightEditor"
                  @log="openWeightLogger"
                />
              </section>
            </div>
          </Transition>
        </div>
      </template>
    </div>
    <EditFoodLogDialog v-model:open="editFoodOpen" :entry="editingFoodEntry" />

    <DailyFoodBreakdown
      v-model:open="foodBreakdownOpen"
      :date="selectedDate"
      @add-food="openAddFood"
    />

    <LogWeightDialog v-model:open="logWeightOpen" :initial-date="selectedDate" hide-trigger />
    <EditWeightDialog v-model:open="editWeightOpen" :entry="selectedWeightEntry" />
  </div>
</template>
