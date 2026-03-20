<script setup lang="ts">
import { computed, reactive } from 'vue'
import { Icon } from '@iconify/vue'
import { useHaptics } from '@/composables/useHaptics'
import type { FoodLogEntry, MealType } from '@/types'

const SWIPE_THRESHOLD = 80
const MAX_SWIPE = 100

const props = defineProps<{
  mealType: MealType
  entries: FoodLogEntry[]
}>()

const emit = defineEmits<{
  editEntry: [entry: FoodLogEntry]
  addFood: [mealType: MealType]
  deleteEntry: [entry: FoodLogEntry]
  duplicateEntry: [entry: FoodLogEntry]
}>()

const haptics = useHaptics()

const mealConfig: Record<MealType, { label: string; icon: string }> = {
  breakfast: { label: 'Breakfast', icon: 'lucide:sunrise' },
  lunch: { label: 'Lunch', icon: 'lucide:sun' },
  dinner: { label: 'Dinner', icon: 'lucide:sunset' },
  snack: { label: 'Snack', icon: 'lucide:cookie' },
}

const config = computed(() => mealConfig[props.mealType])

const subtotalCalories = computed(() => props.entries.reduce((s, e) => s + e.calories, 0))
const subtotalProtein = computed(() => props.entries.reduce((s, e) => s + (e.protein ?? 0), 0))
const subtotalCarbs = computed(() => props.entries.reduce((s, e) => s + (e.carbs ?? 0), 0))
const subtotalFat = computed(() => props.entries.reduce((s, e) => s + (e.fat ?? 0), 0))

// Swipe state per entry
const swipeOffsets = reactive<Record<string, number>>({})
const swipeTracking = new Map<string, { startX: number; startY: number; active: boolean }>()

function onTouchStart(e: TouchEvent, entry: FoodLogEntry) {
  const touch = e.touches[0]
  swipeTracking.set(entry.id, { startX: touch.clientX, startY: touch.clientY, active: false })
}

function onTouchMove(e: TouchEvent, entry: FoodLogEntry) {
  const state = swipeTracking.get(entry.id)
  if (!state) return

  const touch = e.touches[0]
  const deltaX = touch.clientX - state.startX
  const deltaY = touch.clientY - state.startY

  if (!state.active) {
    if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
      state.active = true
    } else if (Math.abs(deltaY) > 10) {
      swipeTracking.delete(entry.id)
      return
    } else {
      return
    }
  }

  e.preventDefault()
  swipeOffsets[entry.id] = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, deltaX))
}

function onTouchEnd(entry: FoodLogEntry) {
  const offset = swipeOffsets[entry.id] ?? 0
  const state = swipeTracking.get(entry.id)
  swipeTracking.delete(entry.id)

  if (offset <= -SWIPE_THRESHOLD) {
    haptics.error()
    emit('deleteEntry', entry)
  } else if (offset >= SWIPE_THRESHOLD) {
    haptics.light()
    emit('duplicateEntry', entry)
  } else if (!state?.active) {
    // No swipe — treat as tap
    emit('editEntry', entry)
  }

  swipeOffsets[entry.id] = 0
}
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Icon :icon="config.icon" class="h-4 w-4 text-muted-foreground" />
        <span class="text-sm font-medium">{{ config.label }}</span>
        <span v-if="entries.length > 0" class="text-xs text-muted-foreground">
          {{ subtotalCalories }} kcal
        </span>
      </div>
      <button
        type="button"
        class="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        @click="$emit('addFood', mealType)"
      >
        <Icon icon="lucide:plus" class="h-3.5 w-3.5" />
        Add
      </button>
    </div>

    <div v-if="entries.length === 0" class="py-2 text-center text-xs text-muted-foreground">
      No entries
    </div>

    <div v-else class="space-y-1">
      <div v-for="entry in entries" :key="entry.id" class="relative overflow-hidden rounded-md">
        <!-- Background actions (revealed by swipe) -->
        <div class="absolute inset-y-0 left-0 flex items-center gap-1 bg-primary px-4">
          <Icon icon="lucide:copy" class="size-4 text-primary-foreground" />
          <span class="text-xs font-medium text-primary-foreground">Copy</span>
        </div>
        <div class="absolute inset-y-0 right-0 flex items-center gap-1 bg-destructive px-4">
          <span class="text-xs font-medium text-white">Delete</span>
          <Icon icon="lucide:trash-2" class="size-4 text-white" />
        </div>

        <!-- Swipeable entry -->
        <div
          data-swipe-item
          class="relative flex cursor-pointer items-center justify-between bg-background px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
          :style="{
            transform: `translateX(${swipeOffsets[entry.id] ?? 0}px)`,
            transition: swipeOffsets[entry.id] ? 'none' : 'transform 0.2s ease',
          }"
          @touchstart="onTouchStart($event, entry)"
          @touchmove="onTouchMove($event, entry)"
          @touchend="onTouchEnd(entry)"
          @click.stop
        >
          <div class="min-w-0 flex-1">
            <span class="truncate">{{ entry.foodName }}</span>
            <span class="ml-2 text-xs text-muted-foreground">{{ entry.amountG }}g</span>
          </div>
          <div class="flex shrink-0 items-center gap-3 text-xs">
            <span class="font-medium">{{ entry.calories }} kcal</span>
            <span v-if="entry.protein" class="text-muted-foreground">P{{ entry.protein }}</span>
            <span v-if="entry.carbs" class="text-muted-foreground">C{{ entry.carbs }}</span>
            <span v-if="entry.fat" class="text-muted-foreground">F{{ entry.fat }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Subtotals row (only if there are entries with macros) -->
    <div
      v-if="entries.length > 1"
      class="flex items-center justify-end gap-3 border-t border-border/50 pt-1 text-xs text-muted-foreground"
    >
      <span class="font-medium text-foreground">{{ subtotalCalories }} kcal</span>
      <span v-if="subtotalProtein">P {{ subtotalProtein }}g</span>
      <span v-if="subtotalCarbs">C {{ subtotalCarbs }}g</span>
      <span v-if="subtotalFat">F {{ subtotalFat }}g</span>
    </div>
  </div>
</template>
