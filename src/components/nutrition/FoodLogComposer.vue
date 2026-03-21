<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mealLabel } from '@/lib/food-dashboard'
import type { FoodSelection } from '@/stores/food'
import type { MealType } from '@/types'

const props = defineProps<{
  selection: FoodSelection | null
  date: string
  meal: MealType
  amount: number
  favorite?: boolean
  saving?: boolean
}>()

defineEmits<{
  updateDate: [value: string]
  updateMeal: [meal: MealType]
  updateAmount: [value: number]
  toggleFavorite: []
  cancel: []
  save: []
}>()

const meals: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

const preview = computed(() => {
  if (!props.selection) return null
  const factor = props.amount / 100
  return {
    calories: Math.round(props.selection.caloriesPer100g * factor * 10) / 10,
    protein: Math.round((props.selection.proteinPer100g ?? 0) * factor * 10) / 10,
    carbs: Math.round((props.selection.carbsPer100g ?? 0) * factor * 10) / 10,
    fat: Math.round((props.selection.fatPer100g ?? 0) * factor * 10) / 10,
  }
})
</script>

<template>
  <div
    class="min-w-0 rounded-[1.6rem] border border-border bg-card p-3 shadow-warm-lg md:sticky md:top-6 md:rounded-[2rem] md:p-5"
  >
    <template v-if="selection">
      <div class="flex min-w-0 items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-primary">Ready to add</p>
          <h2 class="mt-2 line-clamp-2 break-words text-2xl font-black tracking-tight">
            {{ selection.name }}
          </h2>
          <p class="mt-1 truncate text-sm text-muted-foreground">
            {{ selection.brand || 'Food item' }}
          </p>
        </div>

        <button
          type="button"
          class="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted/25 transition-colors hover:text-primary"
          @click="$emit('toggleFavorite')"
        >
          <Icon
            :icon="favorite ? 'lucide:heart' : 'lucide:heart-plus'"
            class="size-5"
            :class="favorite ? 'fill-current text-primary' : 'text-muted-foreground'"
          />
        </button>
      </div>

      <div class="mt-4 grid gap-3 md:mt-5 md:gap-4">
        <div class="grid gap-2">
          <Label for="food-log-date">Date</Label>
          <Input
            id="food-log-date"
            :model-value="date"
            type="date"
            @update:model-value="$emit('updateDate', String($event))"
          />
        </div>

        <div class="grid gap-2">
          <Label for="food-log-meal">Meal</Label>
          <Select :model-value="meal" @update:model-value="$emit('updateMeal', $event as MealType)">
            <SelectTrigger id="food-log-meal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in meals" :key="option" :value="option">
                {{ mealLabel(option) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="grid gap-2">
          <Label for="food-log-amount">Amount (g)</Label>
          <Input
            id="food-log-amount"
            :model-value="String(amount)"
            type="number"
            min="1"
            max="99999"
            @update:model-value="$emit('updateAmount', Number($event))"
          />
        </div>

        <div class="rounded-[1.35rem] bg-muted/35 p-3.5 md:rounded-[1.5rem] md:p-4">
          <div class="flex items-end justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Nutrition preview
              </p>
              <p class="mt-2 text-2xl font-black tracking-tight text-foreground md:text-3xl">
                {{ preview?.calories ?? 0 }}
                <span class="text-base font-bold text-muted-foreground">kcal</span>
              </p>
            </div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {{ amount }} g
            </p>
          </div>

          <div class="mt-4 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
            <div class="rounded-xl bg-background/80 px-3 py-2">
              <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Protein</p>
              <p class="mt-1 font-bold">{{ preview?.protein ?? 0 }}g</p>
            </div>
            <div class="rounded-xl bg-background/80 px-3 py-2">
              <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Carbs</p>
              <p class="mt-1 font-bold">{{ preview?.carbs ?? 0 }}g</p>
            </div>
            <div class="rounded-xl bg-background/80 px-3 py-2">
              <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Fat</p>
              <p class="mt-1 font-bold">{{ preview?.fat ?? 0 }}g</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-[1fr_1.3fr] gap-2 md:gap-3">
          <Button
            type="button"
            variant="outline"
            class="h-11 rounded-full md:h-12"
            @click="$emit('cancel')"
          >
            Cancel
          </Button>
          <Button
            type="button"
            class="h-11 rounded-full text-base font-bold md:h-12"
            :disabled="saving"
            @click="$emit('save')"
          >
            <Icon v-if="saving" icon="lucide:loader-circle" class="mr-2 size-4 animate-spin" />
            Add
          </Button>
        </div>
      </div>
    </template>

    <template v-else>
      <div
        class="rounded-[1.6rem] border border-dashed border-border bg-muted/20 px-5 py-10 text-center"
      >
        <p class="text-lg font-bold text-foreground">Pick a food to start logging</p>
        <p class="mt-2 text-sm text-muted-foreground">
          Search by name, scan a barcode, or pick something from your recent foods.
        </p>
      </div>
    </template>
  </div>
</template>
