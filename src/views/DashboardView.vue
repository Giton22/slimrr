<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useWeightStore } from '@/stores/weight'
import { useFoodStore } from '@/stores/food'
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import { Card, CardContent } from '@/components/ui/card'
import BmiHalfCircleGauge from '@/components/dashboard/BmiHalfCircleGauge.vue'
import CaloriesDonutChart from '@/components/dashboard/CaloriesDonutChart.vue'
import MacroProgressBars from '@/components/dashboard/MacroProgressBars.vue'
import WeightTrendBarChart from '@/components/dashboard/WeightTrendBarChart.vue'
import WeightGoalSummary from '@/components/dashboard/WeightGoalSummary.vue'
import DashboardSkeleton from '@/components/dashboard/skeletons/DashboardSkeleton.vue'
import StreakCard from '@/components/dashboard/StreakCard.vue'

const weightStore = useWeightStore()
const foodStore = useFoodStore()

const todaySummary = computed(() => weightStore.todayCalorieSummary)
const consumed = computed(() => todaySummary.value?.consumedKcal ?? 0)
const goal = computed(() => todaySummary.value?.goalKcal ?? 2000)

const todayMacros = computed(() => {
  const s = foodStore.todayFoodSummary
  return {
    protein: s?.totalProtein ?? 0,
    carbs: s?.totalCarbs ?? 0,
    fat: s?.totalFat ?? 0,
  }
})

// Pull-to-refresh
const containerRef = ref<HTMLElement | null>(null)
const { pullDistance, isRefreshing } = usePullToRefresh(containerRef, {
  async onRefresh() {
    await Promise.all([weightStore.loadAll(), foodStore.loadFoodData()])
  },
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

    <div class="mx-auto max-w-7xl space-y-6 lg:space-y-8">
      <!-- Page heading (desktop only) -->
      <div class="hidden lg:block">
        <h2 class="text-3xl font-black tracking-tight">Health Dashboard</h2>
        <p class="text-muted-foreground">Welcome back! Here's your health overview for today.</p>
      </div>

      <!-- Skeleton loading state -->
      <DashboardSkeleton v-if="!weightStore.isSynced" />

      <!-- Streak -->
      <StreakCard v-if="weightStore.isSynced" />

      <!-- Top Row: BMI | Macros + Calories Donut -->
      <div v-if="weightStore.isSynced" class="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <!-- BMI Gauge Card -->
        <Card class="animate-card-enter shadow-warm">
          <CardContent class="flex flex-col items-center justify-between pt-6">
            <div class="mb-4 flex w-full items-center justify-between">
              <h3 class="text-lg font-bold">Current BMI</h3>
              <span
                v-if="weightStore.bmiCategory"
                class="text-sm font-medium"
                :class="weightStore.bmiCategory.textColorClass"
              >
                {{ weightStore.bmiCategory.shortLabel }}
              </span>
            </div>
            <BmiHalfCircleGauge
              :bmi="weightStore.bmi"
              :category="weightStore.bmiCategory?.shortLabel"
            />
            <p
              v-if="weightStore.bmi !== null"
              class="mt-4 text-center text-sm text-muted-foreground"
            >
              Your BMI is in the
              <span class="font-semibold" :class="weightStore.bmiCategory?.textColorClass">
                {{ weightStore.bmiCategory?.shortLabel?.toLowerCase() }}
              </span>
              range.
            </p>
            <p v-else class="mt-4 text-center text-sm text-muted-foreground">
              Log weight and set height to see your BMI.
            </p>
          </CardContent>
        </Card>

        <!-- Daily Calories Card (macro bars + donut) -->
        <Card class="animate-card-enter shadow-warm lg:col-span-2" style="animation-delay: 50ms">
          <CardContent class="flex flex-col gap-6 pt-6 md:flex-row md:gap-8">
            <!-- Macro bars -->
            <div class="flex-1">
              <h3 class="mb-6 text-lg font-bold">Daily Calories</h3>
              <MacroProgressBars
                :protein="todayMacros.protein"
                :carbs="todayMacros.carbs"
                :fat="todayMacros.fat"
              />
            </div>
            <!-- Donut chart -->
            <div
              class="flex flex-col items-center justify-center border-t border-border pt-6 md:min-w-[200px] md:border-l md:border-t-0 md:pl-8 md:pt-0"
            >
              <CaloriesDonutChart :consumed="consumed" :goal="goal" />
              <p class="mt-2 text-sm font-semibold">Goal: {{ goal.toLocaleString() }} kcal</p>
              <p class="text-xs text-muted-foreground">
                {{ goal > 0 ? Math.round((consumed / goal) * 100) : 0 }}% of daily target
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Weight Trend Bar Chart -->
      <Card
        v-if="weightStore.isSynced"
        class="animate-card-enter shadow-warm"
        style="animation-delay: 100ms"
      >
        <CardContent class="pt-6">
          <WeightTrendBarChart />
          <WeightGoalSummary class="mt-6" />
        </CardContent>
      </Card>
    </div>
  </div>
</template>
