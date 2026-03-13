<script setup lang="ts">
import { computed } from 'vue'
import { useWeightStore } from '@/stores/weight'

const store = useWeightStore()

const modes = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const

const activeIndex = computed(() => modes.findIndex((m) => m.value === store.averageMode))
</script>

<template>
  <div class="rounded-lg bg-muted p-1">
    <div class="relative grid grid-cols-3">
      <!-- Sliding pill: w-1/3 matches grid columns, translateX(N*100%) shifts by own width -->
      <div
        class="absolute inset-y-0 w-1/3 rounded-md bg-card shadow-warm-sm transition-transform duration-200 ease-out"
        :style="{ transform: `translateX(${activeIndex * 100}%)` }"
      />
      <button
        v-for="mode in modes"
        :key="mode.value"
        type="button"
        class="relative z-10 rounded-md px-3 py-1.5 text-center text-xs font-medium transition-colors duration-200"
        :class="
          store.averageMode === mode.value
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        "
        @click="store.setAverageMode(mode.value)"
      >
        {{ mode.label }}
      </button>
    </div>
  </div>
</template>
