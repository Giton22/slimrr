<script setup lang="ts">
import { mealLabel, nutritionContextSubtitle } from '@/lib/food-dashboard'
import type { MealType } from '@/types'

const props = defineProps<{
  meal: MealType
  date: string
}>()

defineEmits<{
  updateMeal: [meal: MealType]
}>()

const meals: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-sm font-medium uppercase tracking-[0.22em] text-primary/80">Food Log</p>
        <h1 class="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          {{ mealLabel(props.meal) }}
        </h1>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ nutritionContextSubtitle(props.date) }}
        </p>
      </div>

      <button
        type="button"
        class="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground"
        disabled
      >
        More soon
      </button>
    </div>

    <div
      class="grid grid-cols-2 gap-2 rounded-[1.6rem] border border-border/80 bg-card/70 p-2 sm:grid-cols-4"
    >
      <button
        v-for="option in meals"
        :key="option"
        type="button"
        class="min-w-0 rounded-[1.1rem] px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] transition-colors sm:px-3 sm:text-xs sm:tracking-[0.16em]"
        :class="
          option === props.meal
            ? 'bg-primary text-primary-foreground shadow-warm-md'
            : 'bg-muted/40 text-muted-foreground hover:bg-muted/75 hover:text-foreground'
        "
        @click="$emit('updateMeal', option)"
      >
        {{ mealLabel(option) }}
      </button>
    </div>
  </section>
</template>
