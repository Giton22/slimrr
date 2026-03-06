<script setup lang="ts">
import { computed } from 'vue'
import { useWeightStore } from '@/stores/weight'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StatCard from '@/components/dashboard/StatCard.vue'
import KcalChart from '@/components/dashboard/KcalChart.vue'
import DailyCaloriesTable from '@/components/dashboard/DailyCaloriesTable.vue'
import TimeRangeSelect from '@/components/dashboard/TimeRangeSelect.vue'
import SetKcalGoalDialog from '@/components/dashboard/SetKcalGoalDialog.vue'

const store = useWeightStore()

const todayKcalRemaining = computed(() => {
  const summary = store.todayCalorieSummary
  if (!summary || summary.goalKcal === null || summary.consumedKcal === null) return null
  return summary.goalKcal - summary.consumedKcal
})
</script>

<template>
  <div class="space-y-6">
    <!-- Kcal Stat Cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        title="Today's Intake"
        :value="store.todayCalorieSummary?.consumedKcal !== null && store.todayCalorieSummary?.consumedKcal !== undefined ? `${store.todayCalorieSummary.consumedKcal} kcal` : '—'"
        :description="store.todayCalorieSummary?.goalKcal !== null && store.todayCalorieSummary?.goalKcal !== undefined ? `Goal: ${store.todayCalorieSummary.goalKcal} kcal` : 'No goal set'"
      />
      <StatCard
        title="Kcal Remaining"
        :value="todayKcalRemaining !== null ? `${todayKcalRemaining} kcal` : '—'"
        :trend="todayKcalRemaining !== null ? (todayKcalRemaining < 0 ? 'up' : todayKcalRemaining > 0 ? 'down' : 'neutral') : undefined"
        :trend-value="todayKcalRemaining !== null && todayKcalRemaining < 0 ? `${Math.abs(todayKcalRemaining)} kcal over` : undefined"
        :description="todayKcalRemaining !== null && todayKcalRemaining >= 0 ? 'Under goal' : todayKcalRemaining !== null ? 'Over goal' : undefined"
      />
      <StatCard
        title="Weekly Avg Kcal"
        :value="store.weeklyCalorieAverage !== null ? `${store.weeklyCalorieAverage} kcal` : '—'"
        description="This week average"
      />
    </div>

    <!-- Kcal Chart -->
    <Card>
      <CardHeader class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Calorie History</CardTitle>
        <div class="flex flex-wrap items-center gap-2">
          <TimeRangeSelect />
          <SetKcalGoalDialog />
        </div>
      </CardHeader>
      <CardContent>
        <KcalChart />
      </CardContent>
    </Card>

    <!-- Daily Calories Table -->
    <Card>
      <CardHeader class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Daily Calories</CardTitle>
        <SetKcalGoalDialog />
      </CardHeader>
      <CardContent>
        <DailyCaloriesTable />
      </CardContent>
    </Card>
  </div>
</template>
