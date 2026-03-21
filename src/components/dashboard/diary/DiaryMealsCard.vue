<script setup lang="ts">
import { computed } from 'vue'
import type { FoodLogEntry, MealQuickSuggestion, MealType } from '@/types'
import DiaryMealRow from './DiaryMealRow.vue'

defineEmits<{
  add: [mealType: MealType]
  open: [mealType: MealType]
  quickAdd: [suggestion: MealQuickSuggestion]
}>()

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const props = defineProps<{
  meals: Record<MealType, FoodLogEntry[]>
  quickSuggestions?: Record<MealType, MealQuickSuggestion[]>
}>()

const loggedMealCount = computed(
  () => mealTypes.filter((mealType) => props.meals[mealType].length > 0).length,
)
const missingMealCount = computed(() => mealTypes.length - loggedMealCount.value)
const summaryLabel = computed(() => {
  if (loggedMealCount.value === 0) return '0 of 4 meal groups logged'
  if (missingMealCount.value === 0) return 'All 4 meal groups logged'
  if (missingMealCount.value === 1) return '1 meal group missing'
  return `${missingMealCount.value} meal groups missing`
})
</script>

<template>
  <div class="overflow-hidden rounded-[2rem] border border-border bg-card shadow-warm-lg">
    <div class="border-b border-border bg-background/55 px-4 py-3">
      <p class="text-sm font-semibold text-card-foreground">{{ summaryLabel }}</p>
      <p class="mt-1 text-xs text-muted-foreground">
        Fill missing meal groups to make the daily coach more accurate.
      </p>
    </div>

    <template v-for="mealType in mealTypes" :key="mealType">
      <DiaryMealRow
        :meal-type="mealType"
        :entries="props.meals[mealType]"
        :quick-suggestions="props.quickSuggestions?.[mealType] ?? []"
        @add="$emit('add', $event)"
        @open="$emit('open', $event)"
        @quick-add="$emit('quickAdd', $event)"
      />
      <div v-if="mealType !== 'snack'" class="mx-4 h-px bg-border" />
    </template>
  </div>
</template>
