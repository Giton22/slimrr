<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DailyCalorieRow } from '@/types'
import { useWeightStore } from '@/stores/weight'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const props = defineProps<{
  open: boolean
  row: DailyCalorieRow | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const store = useWeightStore()

const consumedValue = ref<string | number>('')
const overrideValue = ref<string | number>('')

function normalizeInput(value: string | number): string {
  return String(value).trim()
}

watch(
  () => ({ isOpen: props.open, row: props.row }),
  ({ isOpen, row }) => {
    if (!isOpen || !row) return
    consumedValue.value = row.consumedKcal !== null ? String(row.consumedKcal) : ''
    overrideValue.value = row.goalSource === 'override' && row.goalKcal !== null ? String(row.goalKcal) : ''
  },
  { immediate: true },
)

const resolvedGlobalGoal = computed(() => {
  if (!props.row) return null
  return store.kcalGoalHistory.length >= 0
    ? (() => {
        const history = [...store.kcalGoalHistory].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
        let result: number | null = null
        for (const change of history) {
          if (change.effectiveFrom <= props.row!.date) result = change.kcal
          else break
        }
        return result
      })()
    : null
})

const statusPreview = computed(() => {
  const consumedRaw = normalizeInput(consumedValue.value)
  const overrideRaw = normalizeInput(overrideValue.value)
  const consumed = consumedRaw === '' ? null : Number(consumedRaw)
  const override = overrideRaw === '' ? null : Number(overrideRaw)
  const goal = override ?? resolvedGlobalGoal.value

  if (consumed === null || Number.isNaN(consumed) || goal === null || Number.isNaN(goal)) return null
  const delta = Math.round(consumed - goal)
  if (delta > 0) return `+${delta} kcal over`
  if (delta < 0) return `${Math.abs(delta)} kcal under`
  return 'On target'
})

function closeDialog() {
  emit('update:open', false)
}

function save() {
  if (!props.row) return

  const rawConsumed = normalizeInput(consumedValue.value)
  const rawOverride = normalizeInput(overrideValue.value)

  const calories = rawConsumed === '' ? null : Number(rawConsumed)
  const goalOverrideKcal = rawOverride === '' ? null : Number(rawOverride)

  if ((calories !== null && (Number.isNaN(calories) || calories < 0))
    || (goalOverrideKcal !== null && (Number.isNaN(goalOverrideKcal) || goalOverrideKcal <= 0))) {
    return
  }

  store.saveDailyCalories({
    date: props.row.date,
    calories: calories === null ? null : Math.round(calories),
    goalOverrideKcal: goalOverrideKcal === null ? null : Math.round(goalOverrideKcal),
  })

  closeDialog()
}

function resetOverride() {
  overrideValue.value = ''
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[460px]">
      <DialogHeader>
        <DialogTitle>Edit Daily Calories</DialogTitle>
        <DialogDescription v-if="row">
          Update calories and an optional per-day override for {{ formatDate(row.date) }}.
        </DialogDescription>
      </DialogHeader>

      <div v-if="row" class="grid gap-4 py-4">
        <div class="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div class="flex items-center justify-between gap-3">
            <span class="text-muted-foreground">Global goal for this day</span>
            <span class="font-medium">{{ resolvedGlobalGoal !== null ? `${resolvedGlobalGoal} kcal` : 'No global goal' }}</span>
          </div>
        </div>

        <div class="grid gap-2">
          <Label for="day-consumed">Consumed kcal</Label>
          <Input
            id="day-consumed"
            v-model="consumedValue"
            type="number"
            min="0"
            step="1"
            placeholder="Leave empty if not logged"
          />
        </div>

        <div class="grid gap-2">
          <div class="flex items-center justify-between gap-3">
            <Label for="day-override">Per-day goal override</Label>
            <Button
              v-if="row.goalSource === 'override'"
              type="button"
              variant="ghost"
              size="sm"
              class="h-7 px-2 text-xs"
              @click="resetOverride"
            >
              Reset to global
            </Button>
          </div>
          <Input
            id="day-override"
            v-model="overrideValue"
            type="number"
            min="0"
            step="1"
            placeholder="Leave empty to use the global goal"
          />
          <p class="text-xs text-muted-foreground">
            This field creates a custom goal only for this date.
          </p>
        </div>

        <div v-if="statusPreview" class="rounded-lg border border-border bg-background p-3 text-sm">
          <span class="text-muted-foreground">Preview:</span>
          <span class="ml-2 font-medium">{{ statusPreview }}</span>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" @click="closeDialog">Cancel</Button>
        <Button type="button" @click="save">Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
