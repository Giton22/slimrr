<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { VisXYContainer, VisStackedBar, VisAxis, VisCrosshair, VisTooltip } from '@unovis/vue'
import { useWeightStore } from '@/stores/weight'
import { formatDateCompact } from '@/lib/date'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'

interface ChartDatum {
  date: number
  consumed: number
  exceeded: boolean
  hasConsumed: boolean
}

const store = useWeightStore()

const chartConfig: ChartConfig = {
  consumed: {
    label: 'Consumed',
    color: 'var(--chart-2)',
  },
}

const data = computed(() => store.calorieChartData as ChartDatum[])

// Use index as X so each data point gets exactly one tick — no repeated date labels
const x = (_d: ChartDatum, i: number) => i

const yConsumed = (d: ChartDatum) => d.hasConsumed ? d.consumed : 0

const barColor = (d: ChartDatum) => {
  if (!d.hasConsumed) return 'var(--muted)'
  if (d.exceeded) return 'var(--destructive)'
  return 'var(--chart-2)'
}

// Map index back to the date label of that data point
const xTickFormat = (i: number) => {
  const d = data.value[Math.round(i)]
  return d ? formatDateCompact(d.date) : ''
}

const chartMargin = { top: 10, right: 10, bottom: 30, left: 55 }
const yAccessors = [yConsumed]

const numTicks = computed(() => Math.min(data.value.length, 12))

const domainY = computed((): [number, number] => {
  if (data.value.length === 0) return [0, 3000]
  const values = data.value.filter(d => d.hasConsumed).map(d => d.consumed)
  if (values.length === 0) return [0, 3000]
  return [0, Math.max(...values) * 1.15]
})
</script>

<template>
  <div v-if="data.length === 0" class="flex h-[280px] flex-col items-center justify-center gap-2 text-center">
    <Icon icon="lucide:bar-chart-3" class="h-10 w-10 text-muted-foreground/30" />
    <p class="text-sm text-muted-foreground">No calorie data in this range</p>
    <p class="text-xs text-muted-foreground">Log your first calories to see your chart</p>
  </div>
  <ChartContainer v-else :config="chartConfig" class="h-[280px] w-full">
    <VisXYContainer :data="data" :margin="chartMargin" :domain-y="domainY">
      <VisStackedBar
        :x="x"
        :y="yAccessors"
        :color="barColor"
        :bar-padding="0.3"
        :rounded-corners="4"
      />
      <VisAxis
        type="x"
        :tick-format="xTickFormat"
        :num-ticks="numTicks"
        label=""
      />
      <VisAxis
        type="y"
        :tick-format="(v: number) => `${v} kcal`"
        :num-ticks="5"
        label=""
      />
      <VisCrosshair
        :template="(d: ChartDatum) => d ? `${formatDateCompact(d.date)}: ${d.hasConsumed ? d.consumed + ' kcal' : 'No data'}` : ''"
        color="var(--chart-2)"
      />
      <VisTooltip>
        <template #default="{ data: tooltipData }">
          <ChartTooltipContent
            v-if="tooltipData"
            :config="chartConfig"
            :payload="{ consumed: tooltipData.consumed }"
            :x="tooltipData.date"
            :label-formatter="formatDateCompact"
          />
        </template>
      </VisTooltip>
    </VisXYContainer>
  </ChartContainer>
</template>
