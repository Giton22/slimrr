<script setup lang="ts">
import { useWeightStore } from '@/stores/weight'
import type { TimeRange } from '@/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const store = useWeightStore()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onValueChange(value: any) {
  store.setTimeRange(Number(value) as TimeRange)
}
</script>

<template>
  <Select :model-value="String(store.selectedTimeRange)" @update:model-value="onValueChange">
    <SelectTrigger class="w-[140px]">
      <SelectValue placeholder="Time range" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="7">Last 7 days</SelectItem>
      <SelectItem value="30">Last 30 days</SelectItem>
      <SelectItem value="60">Last 60 days</SelectItem>
      <SelectItem value="90">Last 90 days</SelectItem>
    </SelectContent>
  </Select>
</template>
