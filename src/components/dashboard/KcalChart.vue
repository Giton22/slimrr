<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { VisXYContainer, VisStackedBar, VisAxis, VisCrosshair, VisTooltip } from '@unovis/vue'
import { useWeightStore } from '@/stores/weight'
import { formatDateCompact } from '@/lib/date'
import { getCalorieStatus } from '@/lib/calorieStatus'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'

interface ChartDatum {
  date: number
  consumed: number
  goal: number
  hasConsumed: boolean
  hasGoal: boolean
}

const store = useWeightStore()

const chartConfig: ChartConfig = {
  consumed: {
    label: 'Consumed',
    color: 'var(--chart-2)',
  },
}

const data = computed(() => store.calorieChartData as ChartDatum[])

const plottedData = computed((): ChartDatum[] => {
  if (data.value.length <= 120) return data.value

  const bucketSize = Math.ceil(data.value.length / 120)
  const buckets: ChartDatum[] = []

  for (let i = 0; i < data.value.length; i += bucketSize) {
    const chunk = data.value.slice(i, i + bucketSize)
    if (chunk.length === 0) continue

    const consumedValues = chunk.filter((d) => d.hasConsumed).map((d) => d.consumed)
    const goalValues = chunk.filter((d) => d.hasGoal).map((d) => d.goal)

    const consumed =
      consumedValues.length > 0
        ? Math.round(consumedValues.reduce((sum, value) => sum + value, 0) / consumedValues.length)
        : 0
    const goal =
      goalValues.length > 0
        ? Math.round(goalValues.reduce((sum, value) => sum + value, 0) / goalValues.length)
        : 0

    const last = chunk[chunk.length - 1]!
    buckets.push({
      date: last.date,
      consumed,
      goal,
      hasConsumed: consumedValues.length > 0,
      hasGoal: goalValues.length > 0,
    })
  }

  return buckets
})

// Use index as X so each data point gets exactly one tick — no repeated date labels
const x = (_d: ChartDatum, i: number) => i

const yConsumed = (d: ChartDatum) => (d.hasConsumed ? d.consumed : 0)

const barColor = (d: ChartDatum) => {
  if (!d.hasConsumed) return 'var(--muted)'

  const status = getCalorieStatus(
    d.consumed,
    d.hasGoal ? d.goal : null,
    store.settings.goalDirection,
  )

  if (!status) return 'var(--chart-2)'
  return status.chartColor
}

const tooltipIndicatorColor = (d: ChartDatum) => barColor(d)

// Map index back to the date label of that data point
const xTickFormat = (i: number) => {
  const d = plottedData.value[Math.round(i)]
  return d ? formatDateCompact(d.date) : ''
}

const chartMargin = { top: 10, right: 10, bottom: 30, left: 55 }
const yAccessors = [yConsumed]

const numTicks = computed(() => Math.min(plottedData.value.length, 12))

const domainY = computed((): [number, number] => {
  if (plottedData.value.length === 0) return [0, 3000]
  const values = plottedData.value.filter((d) => d.hasConsumed).map((d) => d.consumed)
  if (values.length === 0) return [0, 3000]
  return [0, Math.max(...values) * 1.15]
})

const barPadding = computed(() => (plottedData.value.length > 80 ? 0.1 : 0.3))
</script>

<template>
  <div
    v-if="plottedData.length === 0"
    class="flex h-[280px] flex-col items-center justify-center gap-2 text-center"
  >
    <Icon icon="lucide:bar-chart-3" class="h-12 w-12 text-muted-foreground/25 animate-gentle-bob" />
    <p class="text-sm font-medium text-foreground/70">No calorie data in this range</p>
    <p class="text-xs text-muted-foreground">Log your first calories to see your chart</p>
  </div>
  <ChartContainer v-else :config="chartConfig" class="h-[280px] w-full">
    <VisXYContainer :data="plottedData" :margin="chartMargin" :domain-y="domainY">
      <VisStackedBar
        :x="x"
        :y="yAccessors"
        :color="barColor"
        :bar-padding="barPadding"
        :rounded-corners="4"
      />
      <VisAxis type="x" :tick-format="xTickFormat" :num-ticks="numTicks" label="" />
      <VisAxis type="y" :tick-format="(v: number) => `${v} kcal`" :num-ticks="5" label="" />
      <VisCrosshair
        :template="
          (d: ChartDatum) =>
            d
              ? `${formatDateCompact(d.date)}: ${d.hasConsumed ? d.consumed + ' kcal' : 'No data'}`
              : ''
        "
        color="var(--chart-2)"
      />
      <VisTooltip>
        <template #default="{ data: tooltipData }">
          <ChartTooltipContent
            v-if="tooltipData"
            :config="chartConfig"
            :payload="{ consumed: tooltipData.consumed }"
            :color="tooltipIndicatorColor(tooltipData)"
            :x="tooltipData.date"
            :label-formatter="formatDateCompact"
          />
        </template>
      </VisTooltip>
    </VisXYContainer>
  </ChartContainer>
</template>
