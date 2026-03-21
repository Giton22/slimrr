<script setup lang="ts">
import { computed } from 'vue'
import { useWeightStore } from '@/stores/weight'
import { useUnits } from '@/composables/useUnits'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StatCard from '@/components/dashboard/StatCard.vue'
import QuickLogWeight from '@/components/dashboard/QuickLogWeight.vue'
import WeightChart from '@/components/dashboard/WeightChart.vue'
import RecentEntries from '@/components/dashboard/RecentEntries.vue'
import AverageModeToggle from '@/components/dashboard/AverageModeToggle.vue'
import TimeRangeSelect from '@/components/dashboard/TimeRangeSelect.vue'

const store = useWeightStore()
const { format, formatDelta } = useUnits()

const goalRemaining = computed(() => {
  if (store.currentWeight === null || store.settings.goalWeightKg === null) return null
  const diff = store.currentWeight - store.settings.goalWeightKg
  const direction = store.settings.goalDirection

  if (direction === 'gain') {
    // Weight gain: negative diff means still need to gain, 0+ means reached
    return diff >= 0 ? 0 : diff
  }
  // Weight loss (default): positive diff means still need to lose, 0- means reached
  return diff <= 0 ? 0 : diff
})

const goalDescription = computed(() => {
  if (goalRemaining.value === null) return undefined
  if (goalRemaining.value === 0) return 'Goal reached!'
  return `${formatDelta(goalRemaining.value)} remaining`
})

const filteredEntryCount = computed(() => store.filteredEntries.length)
const totalEntryCount = computed(() => store.sortedEntries.length)

const entriesCountHint = computed(() => {
  if (totalEntryCount.value === 0) return ''
  return `Showing ${filteredEntryCount.value} of ${totalEntryCount.value} entries`
})
</script>

<template>
  <div class="space-y-6">
    <!-- Weight Stat Cards -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <QuickLogWeight
        class="col-span-2 xl:col-span-1 animate-card-enter"
        style="animation-delay: 0ms"
      />
      <StatCard
        class="animate-card-enter"
        style="animation-delay: 50ms"
        title="Goal Weight"
        :value="store.settings.goalWeightKg !== null ? format(store.settings.goalWeightKg) : '—'"
        :description="goalDescription"
      />
      <StatCard
        class="animate-card-enter"
        style="animation-delay: 100ms"
        title="BMI"
        :value="store.bmi !== null ? String(store.bmi) : '—'"
        :value-class="store.bmiCategory?.textColorClass"
        :description="store.bmiCategory?.shortLabel ?? ''"
      />
      <StatCard
        class="animate-card-enter"
        style="animation-delay: 150ms"
        title="7-Day Trend"
        :value="store.weightTrend !== null ? formatDelta(store.weightTrend) : '—'"
        :trend="
          store.weightTrend !== null
            ? store.weightTrend < 0
              ? 'down'
              : store.weightTrend > 0
                ? 'up'
                : 'neutral'
            : undefined
        "
        :trend-value="
          store.weightTrend !== null ? formatDelta(store.weightTrend) + '/week' : undefined
        "
        description="vs previous 7 days"
      />
      <StatCard
        class="animate-card-enter"
        style="animation-delay: 200ms"
        title="Weekly Average"
        :value="store.weeklyAverage !== null ? format(store.weeklyAverage.avg) : '—'"
        :description="
          store.weeklyAverage !== null
            ? `This week (${store.weeklyAverage.count} entries)`
            : 'No entries this week'
        "
      />
      <StatCard
        class="animate-card-enter"
        style="animation-delay: 250ms"
        title="Monthly Average"
        :value="store.monthlyAverage !== null ? format(store.monthlyAverage.avg) : '—'"
        :description="
          store.monthlyAverage !== null
            ? `This month (${store.monthlyAverage.count} entries)`
            : 'No entries this month'
        "
      />
    </div>

    <!-- Weight Chart -->
    <Card class="animate-card-enter" style="animation-delay: 300ms">
      <CardHeader class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Weight History</CardTitle>
        <div class="flex flex-wrap items-center gap-2">
          <AverageModeToggle />
          <TimeRangeSelect target="weight" />
        </div>
      </CardHeader>
      <CardContent>
        <WeightChart />
      </CardContent>
    </Card>

    <!-- Recent Weight Entries -->
    <Card class="animate-card-enter" style="animation-delay: 350ms">
      <CardHeader>
        <div class="flex flex-wrap items-end justify-between gap-2">
          <CardTitle>Recent Entries</CardTitle>
          <p v-if="entriesCountHint" class="text-xs text-muted-foreground">
            {{ entriesCountHint }}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <RecentEntries />
      </CardContent>
    </Card>
  </div>
</template>
