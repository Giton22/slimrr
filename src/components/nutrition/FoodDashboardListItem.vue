<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { FoodItem } from '@/types'

const props = defineProps<{
  food: FoodItem
  active?: boolean
  favorite?: boolean
  meta?: string
}>()

defineEmits<{
  select: [food: FoodItem]
  toggleFavorite: [food: FoodItem]
}>()

const macros = computed(() => {
  const parts: string[] = []
  if (props.food.proteinPer100g) parts.push(`P ${props.food.proteinPer100g}g`)
  if (props.food.carbsPer100g) parts.push(`C ${props.food.carbsPer100g}g`)
  if (props.food.fatPer100g) parts.push(`F ${props.food.fatPer100g}g`)
  return parts.join(' · ')
})
</script>

<template>
  <div
    class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-[1.35rem] border px-3 py-3 transition-colors sm:gap-3 sm:rounded-[1.6rem] sm:px-4 sm:py-4"
    :class="
      active
        ? 'border-primary bg-primary/8'
        : 'border-border/80 bg-card hover:border-primary/25 hover:bg-muted/20'
    "
  >
    <button type="button" class="min-w-0 overflow-hidden text-left" @click="$emit('select', food)">
      <div class="min-w-0">
        <p class="line-clamp-2 break-words text-[15px] font-bold text-foreground sm:text-base">
          {{ food.name }}
        </p>
        <p class="mt-1 truncate text-sm text-muted-foreground">
          {{ food.brand || meta || 'Personal food library' }}
        </p>
        <p v-if="macros" class="mt-2 truncate text-xs font-medium text-muted-foreground">
          {{ macros }}
        </p>
      </div>
    </button>

    <div class="ml-1 flex shrink-0 items-center gap-2">
      <div class="min-w-[58px] text-right">
        <p class="text-base font-black tracking-tight text-foreground sm:text-lg">
          {{ food.caloriesPer100g }}
        </p>
        <p
          class="text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px] sm:tracking-[0.18em]"
        >
          kcal / 100g
        </p>
      </div>

      <button
        type="button"
        class="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground sm:size-10"
        @click="$emit('toggleFavorite', food)"
      >
        <Icon
          :icon="favorite ? 'lucide:heart' : 'lucide:heart-plus'"
          class="size-4 sm:size-4.5"
          :class="favorite ? 'fill-current text-primary' : ''"
        />
      </button>

      <button
        type="button"
        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-warm-md transition-transform hover:scale-[1.03] sm:size-11"
        @click="$emit('select', food)"
      >
        <Icon icon="lucide:plus" class="size-4.5 sm:size-5" />
      </button>
    </div>
  </div>
</template>
