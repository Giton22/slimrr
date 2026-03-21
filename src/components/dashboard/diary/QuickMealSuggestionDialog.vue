<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Icon } from '@iconify/vue'
import { useFoodStore } from '@/stores/food'
import { round1 } from '@/lib/food/helpers'
import { mealLabel, nutritionContextSubtitle } from '@/lib/food-dashboard'
import type { MealQuickSuggestion, MealType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  suggestion: MealQuickSuggestion | null
  date: string
  mealType: MealType
}>()

const emit = defineEmits<{
  saved: [payload: { foodName: string; mealType: MealType }]
}>()

const foodStore = useFoodStore()

const amount = ref(100)
const saving = ref(false)

watch(
  () => props.suggestion,
  (suggestion) => {
    amount.value = suggestion?.amountG || suggestion?.foodItem.defaultServingG || 100
  },
  { immediate: true },
)

const preview = computed(() => {
  if (!props.suggestion) return null
  const factor = Math.max(1, amount.value || 1) / 100
  return {
    calories: round1(props.suggestion.foodItem.caloriesPer100g * factor),
    protein: round1((props.suggestion.foodItem.proteinPer100g ?? 0) * factor),
    carbs: round1((props.suggestion.foodItem.carbsPer100g ?? 0) * factor),
    fat: round1((props.suggestion.foodItem.fatPer100g ?? 0) * factor),
  }
})

async function save() {
  if (!props.suggestion || saving.value) return

  saving.value = true
  try {
    const entry = await foodStore.logFood({
      date: props.date,
      mealType: props.mealType,
      foodItem: props.suggestion.foodItem,
      amountG: Math.max(1, Math.round(amount.value || 1)),
      sourceContext: props.suggestion.source,
    })

    if (!entry) return

    toast.success(`Logged ${props.suggestion.foodItem.name}`)
    emit('saved', {
      foodName: props.suggestion.foodItem.name,
      mealType: props.mealType,
    })
    open.value = false
  } catch {
    toast.error('Failed to log food')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon icon="lucide:sparkles" class="size-5 text-primary" />
          Quick Add
        </DialogTitle>
        <DialogDescription>
          Repeat a recent {{ mealLabel(mealType).toLowerCase() }} for
          {{ nutritionContextSubtitle(date) }}.
        </DialogDescription>
      </DialogHeader>

      <div v-if="suggestion" class="space-y-4 py-2">
        <div class="rounded-[1.5rem] border border-border bg-muted/20 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                {{ suggestion.source === 'recent' ? 'Recent repeat' : 'Frequent repeat' }}
              </p>
              <p class="mt-2 text-xl font-black tracking-tight text-foreground">
                {{ suggestion.foodItem.name }}
              </p>
              <p class="mt-1 text-sm text-muted-foreground">
                {{ suggestion.foodItem.brand || 'Saved food item' }}
              </p>
            </div>

            <div
              class="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground"
            >
              {{ mealLabel(mealType) }}
            </div>
          </div>
        </div>

        <div class="grid gap-2">
          <Label for="quick-meal-amount">Amount (g)</Label>
          <Input
            id="quick-meal-amount"
            :model-value="String(amount)"
            type="number"
            min="1"
            max="99999"
            @update:model-value="amount = Number($event)"
          />
        </div>

        <div class="rounded-[1.5rem] bg-muted/35 p-4">
          <div class="flex items-end justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Nutrition preview
              </p>
              <p class="mt-2 text-2xl font-black tracking-tight text-foreground">
                {{ preview?.calories ?? 0 }}
                <span class="text-base font-bold text-muted-foreground">kcal</span>
              </p>
            </div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {{ amount || 0 }} g
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
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="saving" @click="open = false">
          Cancel
        </Button>
        <Button type="button" :disabled="saving || !suggestion" @click="save">
          <Icon v-if="saving" icon="lucide:loader-circle" class="mr-2 size-4 animate-spin" />
          Add to {{ mealLabel(mealType) }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
