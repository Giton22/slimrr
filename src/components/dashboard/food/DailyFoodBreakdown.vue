<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import type { FoodLogEntry, MealType, DailyFoodSummary } from '@/types'
import { useFoodStore } from '@/stores/food'
import { formatDateLong } from '@/lib/date'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import MealSection from './MealSection.vue'
import EditFoodLogDialog from './EditFoodLogDialog.vue'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  date: string | null
}>()

defineEmits<{
  addFood: [mealType: MealType]
}>()

const foodStore = useFoodStore()
const router = useRouter()

const summary = computed((): DailyFoodSummary | null => {
  if (!props.date) return null
  return foodStore.dailyFoodSummaries.get(props.date) ?? null
})

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

const editDialogOpen = ref(false)
const editingEntry = ref<FoodLogEntry | null>(null)

function openEditEntry(entry: FoodLogEntry) {
  editingEntry.value = entry
  editDialogOpen.value = true
}

async function deleteEntry(entry: FoodLogEntry) {
  try {
    await foodStore.deleteFoodLogEntry(entry.id)
    toast.success('Entry deleted')
  } catch {
    toast.error('Failed to delete entry')
  }
}

async function duplicateEntry(entry: FoodLogEntry) {
  try {
    const matchedFood = entry.foodItem
      ? (foodStore.foodItems.find((item) => item.id === entry.foodItem) ?? null)
      : null

    await foodStore.logFood({
      date: entry.date,
      mealType: entry.mealType,
      foodItem: matchedFood,
      amountG: entry.amountG,
      calories: entry.calories,
      protein: entry.protein ?? 0,
      carbs: entry.carbs ?? 0,
      fat: entry.fat ?? 0,
      note: entry.note,
    })

    toast.success('Entry duplicated')
  } catch {
    toast.error('Failed to duplicate entry')
  }
}

function routeToMeal(mealType: MealType) {
  if (!props.date) return
  void router.push({
    path: '/nutrition',
    query: {
      date: props.date,
      meal: mealType,
      source: 'diary',
    },
  })
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>Daily Food Breakdown</DialogTitle>
        <DialogDescription v-if="date">
          {{ formatDateLong(date) }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="date" class="max-h-[60vh] space-y-4 overflow-auto py-4">
        <template v-if="summary">
          <MealSection
            v-for="mt in mealTypes"
            :key="mt"
            :meal-type="mt"
            :entries="summary.meals[mt]"
            @edit-entry="openEditEntry"
            @add-food="routeToMeal"
            @delete-entry="deleteEntry"
            @duplicate-entry="duplicateEntry"
          />

          <!-- Grand total -->
          <div class="rounded-lg border border-border bg-muted/30 p-3">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium">Total</span>
              <span class="font-semibold">{{ summary.totalCalories }} kcal</span>
            </div>
            <div class="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
              <span>Protein {{ summary.totalProtein }}g</span>
              <span>Carbs {{ summary.totalCarbs }}g</span>
              <span>Fat {{ summary.totalFat }}g</span>
            </div>
          </div>
        </template>

        <div v-else class="flex flex-col items-center gap-2 py-8 text-center">
          <Icon icon="lucide:utensils" class="h-10 w-10 text-muted-foreground/25" />
          <p class="text-sm text-muted-foreground">No food entries for this day</p>
        </div>
      </div>

      <EditFoodLogDialog v-model:open="editDialogOpen" :entry="editingEntry" />
    </DialogContent>
  </Dialog>
</template>
