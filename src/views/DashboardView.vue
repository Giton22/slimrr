<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { RouterLink, useRouter } from 'vue-router'
import { useWeightStore } from '@/stores/weight'
import { useFoodStore } from '@/stores/food'
import { today } from '@/composables/useToday'
import { useSwipeDayNavigation } from '@/composables/useSwipeDayNavigation'
import { useStreaks } from '@/composables/useStreaks'
import { useUnits } from '@/composables/useUnits'
import { addDays, formatDateLong, formatDateShort } from '@/lib/date'
import { buildDashboardNextActions, getQuickMealSuggestions, mealLabel } from '@/lib/food-dashboard'
import { clearSetupCoachWelcomePending, hasSetupCoachWelcomePending } from '@/lib/setupCoach'
import type {
  DashboardNextAction,
  FoodLogEntry,
  MealQuickSuggestion,
  MealType,
  WeightEntry,
} from '@/types'
import DashboardSkeleton from '@/components/dashboard/skeletons/DashboardSkeleton.vue'
import EditFoodLogDialog from '@/components/dashboard/food/EditFoodLogDialog.vue'
import DailyFoodBreakdown from '@/components/dashboard/food/DailyFoodBreakdown.vue'
import LogWeightDialog from '@/components/dashboard/LogWeightDialog.vue'
import EditWeightDialog from '@/components/dashboard/EditWeightDialog.vue'
import DiaryHeader from '@/components/dashboard/diary/DiaryHeader.vue'
import DiarySummaryCard from '@/components/dashboard/diary/DiarySummaryCard.vue'
import DiaryMealsCard from '@/components/dashboard/diary/DiaryMealsCard.vue'
import DiaryWeightCard from '@/components/dashboard/diary/DiaryWeightCard.vue'
import QuickMealSuggestionDialog from '@/components/dashboard/diary/QuickMealSuggestionDialog.vue'

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
const goal = computed(() => daySummary.value?.goalKcal ?? weightStore.currentGlobalKcalGoal ?? 0)
const hasCalorieGoal = computed(
  () => (daySummary.value?.goalKcal ?? weightStore.currentGlobalKcalGoal ?? null) !== null,
)

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
const latestWeightDateLabel = computed(() => {
  if (!weightStore.latestEntry) return null
  return formatDateShort(weightStore.latestEntry.date)
})
const hasAnyWeightEntries = computed(() => weightStore.sortedEntries.length > 0)
const hasGoalWeight = computed(() => weightStore.settings.goalWeightKg !== null)

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

const mealCounts = computed<Record<MealType, number>>(() => ({
  breakfast: meals.value.breakfast.length,
  lunch: meals.value.lunch.length,
  dinner: meals.value.dinner.length,
  snack: meals.value.snack.length,
}))

const nextActions = computed<DashboardNextAction[]>(() =>
  buildDashboardNextActions({
    date: selectedDate.value,
    hasWeightEntry: !!selectedWeightEntry.value,
    hasAnyWeightEntries: hasAnyWeightEntries.value,
    mealCounts: mealCounts.value,
    hasGoalWeight: hasGoalWeight.value,
    hasCalorieGoal: hasCalorieGoal.value,
  }),
)

const primaryNextAction = computed(() => nextActions.value[0] ?? null)
const secondaryNextActions = computed(() => nextActions.value.slice(1, 3))

const quickSuggestions = computed<Record<MealType, MealQuickSuggestion[]>>(() => ({
  breakfast: getQuickMealSuggestions({
    mealType: 'breakfast',
    foodItems: foodStore.foodItems,
    recents: foodStore.recents,
    frequent: foodStore.frequent,
  }),
  lunch: getQuickMealSuggestions({
    mealType: 'lunch',
    foodItems: foodStore.foodItems,
    recents: foodStore.recents,
    frequent: foodStore.frequent,
  }),
  dinner: getQuickMealSuggestions({
    mealType: 'dinner',
    foodItems: foodStore.foodItems,
    recents: foodStore.recents,
    frequent: foodStore.frequent,
  }),
  snack: getQuickMealSuggestions({
    mealType: 'snack',
    foodItems: foodStore.foodItems,
    recents: foodStore.recents,
    frequent: foodStore.frequent,
  }),
}))

const quickSuggestionDialogOpen = ref(false)
const selectedSuggestion = ref<MealQuickSuggestion | null>(null)
const dashboardNotice = ref('')
const showSetupCoachWelcome = ref(hasSetupCoachWelcomePending())
let dashboardNoticeTimeout: ReturnType<typeof setTimeout> | null = null

function setDashboardNotice(message: string) {
  dashboardNotice.value = message
  if (dashboardNoticeTimeout) clearTimeout(dashboardNoticeTimeout)
  dashboardNoticeTimeout = setTimeout(() => {
    dashboardNotice.value = ''
  }, 3000)
}

function clearSetupCoachWelcome() {
  if (!showSetupCoachWelcome.value) return
  showSetupCoachWelcome.value = false
  clearSetupCoachWelcomePending()
}

watch(hasAnyWeightEntries, (value) => {
  if (value) clearSetupCoachWelcome()
})

onBeforeUnmount(() => {
  clearSetupCoachWelcome()
  if (dashboardNoticeTimeout) clearTimeout(dashboardNoticeTimeout)
})

function coachActionIcon(action: DashboardNextAction) {
  if (action.kind === 'log-weight') return 'lucide:scale'
  if (action.kind === 'add-meal') return 'lucide:utensils'
  if (action.kind === 'settings') return 'lucide:sliders-horizontal'
  return 'lucide:chart-column'
}

function triggerNextAction(action: DashboardNextAction) {
  if (action.kind === 'log-weight') {
    openWeightLogger()
    return
  }

  if (action.kind === 'add-meal' && action.mealType) {
    openAddFood(action.mealType)
    return
  }

  if (action.kind === 'settings' && action.route) {
    void router.push({
      path: action.route,
      hash: action.hash,
    })
    return
  }

  void router.push(action.route ?? '/nutrition/overview')
}

function openQuickAddSuggestion(suggestion: MealQuickSuggestion) {
  selectedSuggestion.value = suggestion
  quickSuggestionDialogOpen.value = true
}

function handleQuickSuggestionSaved(payload: { foodName: string; mealType: MealType }) {
  clearSetupCoachWelcome()
  setDashboardNotice(`Added ${payload.foodName} to ${mealLabel(payload.mealType).toLowerCase()}.`)
}

function handleWeightSaved(payload: { date: string; isUpdate: boolean }) {
  clearSetupCoachWelcome()
  setDashboardNotice(
    payload.isUpdate
      ? `Updated your weight for ${payload.date}.`
      : `Logged your weight for ${payload.date}.`,
  )
}

function openNutritionGoals() {
  void router.push({
    path: '/profile',
    hash: '#nutrition-goals',
  })
}
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

        <section v-if="primaryNextAction" class="space-y-3">
          <div
            class="overflow-hidden rounded-[2rem] border border-primary/20 bg-primary/[0.07] shadow-warm-lg"
          >
            <div
              class="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="min-w-0">
                <p class="text-xs font-bold uppercase tracking-[0.24em] text-primary">
                  {{ showSetupCoachWelcome ? 'Welcome to Slimrr' : 'Next best action' }}
                </p>
                <h2 class="mt-2 text-2xl font-black tracking-tight text-foreground">
                  {{ primaryNextAction.label }}
                </h2>
                <p class="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {{ primaryNextAction.description }}
                </p>
                <p
                  v-if="showSetupCoachWelcome"
                  class="mt-3 max-w-2xl rounded-2xl border border-primary/15 bg-background/70 px-3 py-2 text-sm text-muted-foreground"
                >
                  You’re ready. Start with one small step and the coach will keep the rest of the
                  day focused.
                </p>
              </div>

              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-warm-md transition-transform hover:scale-[1.01]"
                @click="triggerNextAction(primaryNextAction)"
              >
                <Icon :icon="coachActionIcon(primaryNextAction)" class="size-4" />
                {{ primaryNextAction.label }}
              </button>
            </div>

            <div
              v-if="secondaryNextActions.length || dashboardNotice"
              class="border-t border-primary/10 bg-background/60 px-5 py-3"
            >
              <div class="flex flex-wrap items-center gap-2">
                <div
                  v-if="dashboardNotice"
                  class="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                >
                  <Icon icon="lucide:circle-check-big" class="size-4" />
                  {{ dashboardNotice }}
                </div>

                <button
                  v-for="action in secondaryNextActions"
                  :key="action.id"
                  type="button"
                  class="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5"
                  @click="triggerNextAction(action)"
                >
                  <Icon :icon="coachActionIcon(action)" class="size-4 text-primary" />
                  {{ action.label }}
                </button>
              </div>
            </div>
          </div>
        </section>

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
                  :has-calorie-goal="hasCalorieGoal"
                  :protein="dailyFoodSummary?.totalProtein ?? 0"
                  :protein-goal="macroGoals.protein"
                  :carbs="dailyFoodSummary?.totalCarbs ?? 0"
                  :carbs-goal="macroGoals.carbs"
                  :fat="dailyFoodSummary?.totalFat ?? 0"
                  :fat-goal="macroGoals.fat"
                  @open-goals="openNutritionGoals"
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

                <DiaryMealsCard
                  :meals="meals"
                  :quick-suggestions="quickSuggestions"
                  @add="openAddFood"
                  @open="openMealBreakdown"
                  @quick-add="openQuickAddSuggestion"
                />
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
                  :goal-value="
                    weightStore.settings.goalWeightKg !== null
                      ? format(weightStore.settings.goalWeightKg)
                      : null
                  "
                  :selected-date-label="selectedWeightLabel"
                  :latest-value="latestWeight"
                  :latest-date-label="latestWeightDateLabel"
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

    <LogWeightDialog
      v-model:open="logWeightOpen"
      :initial-date="selectedDate"
      hide-trigger
      @saved="handleWeightSaved"
    />
    <EditWeightDialog v-model:open="editWeightOpen" :entry="selectedWeightEntry" />
    <QuickMealSuggestionDialog
      v-model:open="quickSuggestionDialogOpen"
      :suggestion="selectedSuggestion"
      :date="selectedDate"
      :meal-type="selectedSuggestion?.mealType ?? 'lunch'"
      @saved="handleQuickSuggestionSaved"
    />
  </div>
</template>
