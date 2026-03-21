<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { FoodLogEntry, MealQuickSuggestion, MealType } from '@/types'

const props = defineProps<{
  mealType: MealType
  entries: FoodLogEntry[]
  quickSuggestions?: MealQuickSuggestion[]
}>()

defineEmits<{
  add: [mealType: MealType]
  open: [mealType: MealType]
  quickAdd: [suggestion: MealQuickSuggestion]
}>()

const mealConfig: Record<MealType, { label: string; icon: string; accent: string }> = {
  breakfast: {
    label: 'Breakfast',
    icon: 'lucide:coffee',
    accent: 'bg-primary/12 text-primary',
  },
  lunch: {
    label: 'Lunch',
    icon: 'lucide:sun-medium',
    accent: 'bg-primary/12 text-primary',
  },
  dinner: { label: 'Dinner', icon: 'lucide:moon-star', accent: 'bg-primary/12 text-primary' },
  snack: { label: 'Snacks', icon: 'lucide:apple', accent: 'bg-primary/12 text-primary' },
}

const config = computed(() => mealConfig[props.mealType])
const totalCalories = computed(() =>
  Math.round(props.entries.reduce((sum, entry) => sum + entry.calories, 0)),
)
const itemCount = computed(() => props.entries.length)

const subline = computed(() => {
  if (itemCount.value === 0) {
    return props.quickSuggestions?.length
      ? 'Nothing logged yet. Repeat a usual meal or add something new.'
      : 'Nothing logged yet. Tap + to add the first item.'
  }
  return itemCount.value === 1
    ? `${totalCalories.value} kcal · 1 item`
    : `${totalCalories.value} kcal · ${itemCount.value} items`
})
</script>

<template>
  <div class="px-4 py-4 transition-colors hover:bg-muted/45">
    <div
      role="button"
      tabindex="0"
      class="flex w-full items-center gap-4 text-left"
      @click="$emit('open', mealType)"
      @keydown.enter="$emit('open', mealType)"
      @keydown.space.prevent="$emit('open', mealType)"
    >
      <div
        class="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-muted/35"
      >
        <div class="flex size-10 items-center justify-center rounded-full" :class="config.accent">
          <Icon :icon="config.icon" class="size-4.5" />
        </div>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <p class="truncate text-lg font-bold tracking-tight text-card-foreground">
            {{ config.label }}
          </p>
          <Icon icon="lucide:arrow-right" class="size-4 text-muted-foreground" />
        </div>
        <p class="mt-1 text-sm font-medium text-muted-foreground">
          {{ subline }}
        </p>
      </div>

      <button
        type="button"
        class="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-warm-md transition-transform hover:scale-[1.03]"
        @click.stop="$emit('add', mealType)"
      >
        <Icon icon="lucide:plus" class="size-7" />
      </button>
    </div>

    <div v-if="quickSuggestions?.length" class="mt-3 flex flex-wrap gap-2 pl-[4.5rem]">
      <button
        v-for="suggestion in quickSuggestions"
        :key="`${mealType}-${suggestion.foodItem.id}`"
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5"
        @click.stop="$emit('quickAdd', suggestion)"
      >
        <Icon
          :icon="suggestion.source === 'recent' ? 'lucide:history' : 'lucide:sparkles'"
          class="size-3.5 text-primary"
        />
        <span class="max-w-[11rem] truncate">{{ suggestion.foodItem.name }}</span>
      </button>
    </div>
  </div>
</template>
