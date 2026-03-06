<script setup lang="ts">
import { computed } from 'vue'
import { VisXYContainer, VisStackedBar, VisAxis, VisLine, VisCrosshair, VisTooltip } from '@unovis/vue'
import { useWeightStore } from '@/stores/weight'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'

interface ChartDatum {
  date: number
  consumed: number
  goal: number
  exceeded: boolean
  hasConsumed: boolean
  hasGoal: boolean
}

const store = useWeightStore()

const chartConfig: ChartConfig = {
  consumed: {
    label: 'Consumed',
    color: 'var(--chart-2)',
  },
  goal: {
    label: 'Goal',
    color: 'var(--chart-4)',
  },
}

const data = computed(() => store.calorieChartData as ChartDatum[])

const x = (d: ChartDatum) => d.date
const yConsumed = (d: ChartDatum) => d.hasConsumed ? d.consumed : 0

const barColor = (d: ChartDatum) => {
  if (!d.hasConsumed) return 'var(--muted)'
  if (d.exceeded) return 'var(--destructive)'
  return 'var(--chart-2)'
}

// Goal line accessor
const yGoal = (d: ChartDatum) => d.hasGoal ? d.goal : undefined

function formatDate(ms: number | Date): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const domainY = computed((): [number, number] => {
  if (data.value.length === 0) return [0, 3000]
  const values = data.value.flatMap(d => {
    const v: number[] = []
    if (d.hasConsumed) v.push(d.consumed)
    if (d.hasGoal) v.push(d.goal)
    return v
  })
  if (values.length === 0) return [0, 3000]
  const max = Math.max(...values)
  return [0, max * 1.15]
})
</script>

<template>
  <ChartContainer :config="chartConfig" class="h-[280px] w-full">
    <VisXYContainer :data="data" :margin="{ top: 10, right: 10, bottom: 30, left: 55 }" :domain-y="domainY">
      <VisStackedBar
        :x="x"
        :y="[yConsumed]"
        :color="barColor"
        :bar-padding="0.3"
        :rounded-corners="4"
      />
      <VisLine
        :x="x"
        :y="yGoal"
        color="var(--chart-4)"
        :line-width="2"
        :curve-type="'monotoneX'"
      />
      <VisAxis
        type="x"
        :tick-format="formatDate"
        :num-ticks="6"
        label=""
      />
      <VisAxis
        type="y"
        :tick-format="(v: number) => `${v} kcal`"
        :num-ticks="5"
        label=""
      />
      <VisCrosshair
        :template="(d: ChartDatum) => `${formatDate(d.date)}: ${d.hasConsumed ? d.consumed + ' kcal' : 'No data'}${d.hasGoal ? ' / Goal: ' + d.goal + ' kcal' : ''}`"
        color="var(--chart-2)"
      />
      <VisTooltip>
        <template #default="{ data: tooltipData }">
          <ChartTooltipContent
            v-if="tooltipData"
            :config="chartConfig"
            :payload="{ consumed: tooltipData.consumed, goal: tooltipData.goal }"
            :x="tooltipData.date"
            :label-formatter="formatDate"
          />
        </template>
      </VisTooltip>
    </VisXYContainer>
  </ChartContainer>
</template>
