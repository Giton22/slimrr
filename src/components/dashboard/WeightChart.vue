<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { VisXYContainer, VisLine, VisAxis, VisCrosshair, VisTooltip, VisScatter } from '@unovis/vue'
import { useWeightStore } from '@/stores/weight'
import { useUnits } from '@/composables/useUnits'
import { formatDateCompact } from '@/lib/date'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'

interface WeightDatum {
  date: number
  weight: number
}

const store = useWeightStore()
const { convert, isKg } = useUnits()

const chartConfig: ChartConfig = {
  weight: {
    label: 'Weight',
    color: 'var(--chart-1)',
  },
}

const data = computed((): WeightDatum[] =>
  store.averagedEntries.map((e) => ({
    date: new Date(e.date).getTime(),
    weight: convert(e.weightKg),
  })),
)

const plottedData = computed((): WeightDatum[] => {
  if (data.value.length <= 180) return data.value
  const step = Math.ceil(data.value.length / 180)
  return data.value.filter((_, i) => i % step === 0 || i === data.value.length - 1)
})

// Use index as X so each data point gets exactly one tick — no repeated date labels
const x = (_d: WeightDatum, i: number) => i
const y = (d: WeightDatum) => d.weight

// Map index back to the date label of that data point
const xTickFormat = (i: number) => {
  const d = plottedData.value[Math.round(i)]
  return d ? formatDateCompact(d.date) : ''
}

const numTicks = computed(() => Math.min(plottedData.value.length, 12))

const chartMargin = { top: 10, right: 10, bottom: 30, left: 45 }

const unitLabel = computed(() => (isKg.value ? 'kg' : 'lbs'))

const domainY = computed((): [number, number] => {
  if (plottedData.value.length === 0) return [0, 100]
  const weights = plottedData.value.map((d) => d.weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  return [Math.floor(min / 10) * 10, Math.ceil(max / 10) * 10]
})

const showPoints = computed(() => plottedData.value.length <= 120)
</script>

<template>
  <div
    v-if="plottedData.length === 0"
    class="flex h-[280px] flex-col items-center justify-center gap-2 text-center"
  >
    <Icon icon="lucide:line-chart" class="h-12 w-12 text-muted-foreground/25 animate-gentle-bob" />
    <p class="text-sm font-medium text-foreground/70">No weight data in this range</p>
    <p class="text-xs text-muted-foreground">Log your first weight to see your chart</p>
  </div>
  <ChartContainer v-else :config="chartConfig" class="h-[280px] w-full">
    <VisXYContainer :data="plottedData" :margin="chartMargin" :domain-y="domainY">
      <VisLine :x="x" :y="y" color="var(--chart-1)" :line-width="2" :curve-type="'monotoneX'" />
      <VisScatter
        v-if="showPoints"
        :x="x"
        :y="y"
        color="none"
        stroke-color="var(--chart-1)"
        :stroke-width="2"
        :size="8"
      />
      <VisAxis type="x" :tick-format="xTickFormat" :num-ticks="numTicks" label="" />
      <VisAxis type="y" :tick-format="(v: number) => `${v} ${unitLabel}`" :num-ticks="5" label="" />
      <VisCrosshair
        :template="
          (d: WeightDatum) => (d ? `${formatDateCompact(d.date)}: ${d.weight} ${unitLabel}` : '')
        "
        color="var(--chart-1)"
      />
      <VisTooltip>
        <template #default="{ data: tooltipData }">
          <ChartTooltipContent
            v-if="tooltipData"
            :config="chartConfig"
            :payload="{ weight: tooltipData.weight }"
            :x="tooltipData.date"
            :label-formatter="formatDateCompact"
          />
        </template>
      </VisTooltip>
    </VisXYContainer>
  </ChartContainer>
</template>
