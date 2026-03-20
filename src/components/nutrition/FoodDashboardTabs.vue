<script setup lang="ts">
import type { FoodDashboardTab } from '@/types'

const props = defineProps<{
  modelValue: FoodDashboardTab
  counts: Record<FoodDashboardTab, number>
}>()

defineEmits<{
  'update:modelValue': [value: FoodDashboardTab]
}>()

const tabs: { value: FoodDashboardTab; label: string }[] = [
  { value: 'frequent', label: 'Frequent' },
  { value: 'recent', label: 'Recent' },
  { value: 'favorites', label: 'Favorites' },
]
</script>

<template>
  <div class="grid grid-cols-3 gap-2">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      class="flex min-w-0 items-center justify-center gap-1 rounded-full border px-2 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors sm:gap-2 sm:px-4 sm:text-sm sm:tracking-[0.18em]"
      :class="
        props.modelValue === tab.value
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground hover:text-foreground'
      "
      @click="$emit('update:modelValue', tab.value)"
    >
      <span class="truncate">{{ tab.label }}</span>
      <span
        class="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] tracking-normal text-foreground sm:px-2"
      >
        {{ counts[tab.value] }}
      </span>
    </button>
  </div>
</template>
