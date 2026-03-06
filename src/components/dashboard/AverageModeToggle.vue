<script setup lang="ts">
import { useWeightStore } from '@/stores/weight'
import { Button } from '@/components/ui/button'

const store = useWeightStore()

const modes = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const
</script>

<template>
  <div class="flex rounded-md border overflow-hidden">
    <Button
      v-for="mode in modes"
      :key="mode.value"
      :variant="store.averageMode === mode.value ? 'secondary' : 'ghost'"
      size="sm"
      class="rounded-none border-0 h-9 px-3 text-xs"
      @click="store.setAverageMode(mode.value)"
    >
      {{ mode.label }}
    </Button>
  </div>
</template>
