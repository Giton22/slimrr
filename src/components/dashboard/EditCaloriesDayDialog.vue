<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Icon } from '@iconify/vue'
import type { DailyCalorieRow } from '@/types'
import { useWeightStore } from '@/stores/weight'
import { useNumericField } from '@/composables/useNumericField'
import { formatDateLong } from '@/lib/date'
import { getCalorieStatus } from '@/lib/calorieStatus'
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

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  row: DailyCalorieRow | null
}>()

const store = useWeightStore()

const consumedField = useNumericField({ min: 0, required: false, allowDecimals: false })
const overrideField = useNumericField({ min: 1, required: false, allowDecimals: false })
const saving = ref(false)

watch(
  () => ({ isOpen: open.value, row: props.row }),
  ({ isOpen, row }) => {
    if (!isOpen || !row) return
    consumedField.reset(row.consumedKcal !== null ? row.consumedKcal : undefined)
    overrideField.reset(row.goalSource === 'override' && row.goalKcal !== null ? row.goalKcal : undefined)
  },
  { immediate: true },
)

const resolvedGlobalGoal = computed(() => {
  if (!props.row) return null
  return store.kcalGoalHistory.length > 0
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
  const consumed = consumedField.numericValue.value
  const override = overrideField.numericValue.value
  const goal = override ?? resolvedGlobalGoal.value

  return getCalorieStatus(consumed ?? null, goal ?? null, store.settings.goalDirection)
})

function closeDialog() {
  open.value = false
}

async function save() {
  if (!props.row || saving.value) return

  const consumedValid = consumedField.validate()
  const overrideValid = overrideField.validate()
  if (!consumedValid || !overrideValid) return

  const calories = consumedField.numericValue.value ?? null
  const goalOverrideKcal = overrideField.numericValue.value ?? null

  saving.value = true
  try {
    await store.saveDailyCalories({
      date: props.row.date,
      calories: calories === null ? null : Math.round(calories),
      goalOverrideKcal: goalOverrideKcal === null ? null : Math.round(goalOverrideKcal),
    })

    closeDialog()
  } catch {
    toast.error('Failed to save calorie entry')
  } finally {
    saving.value = false
  }
}

function resetOverride() {
  overrideField.reset()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[460px]">
      <DialogHeader>
        <DialogTitle>Edit Daily Calories</DialogTitle>
        <DialogDescription v-if="row">
          Update calories and an optional per-day override for {{ formatDateLong(row.date) }}.
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
            v-model="consumedField.displayValue.value"
            type="text"
            inputmode="numeric"
            placeholder="Leave empty if not logged"
            v-bind="consumedField.inputAttrs.value"
            :class="{ 'animate-shake': consumedField.shaking.value }"
          />
          <p v-if="consumedField.error.value" class="text-xs text-destructive">
            {{ consumedField.error.value }}
          </p>
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
            v-model="overrideField.displayValue.value"
            type="text"
            inputmode="numeric"
            placeholder="Leave empty to use the global goal"
            v-bind="overrideField.inputAttrs.value"
            :class="{ 'animate-shake': overrideField.shaking.value }"
          />
          <p v-if="overrideField.error.value" class="text-xs text-destructive">
            {{ overrideField.error.value }}
          </p>
          <p class="text-xs text-muted-foreground">
            This field creates a custom goal only for this date.
          </p>
        </div>

        <div v-if="statusPreview" class="rounded-lg border border-border bg-background p-3 text-sm">
          <span class="text-muted-foreground">Preview:</span>
          <span class="ml-2 font-medium" :class="statusPreview.textClass">{{ statusPreview.label }}</span>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" @click="closeDialog">Cancel</Button>
        <Button type="button" :disabled="saving" @click="save">
          <Icon v-if="saving" icon="lucide:loader-circle" class="mr-2 h-4 w-4 animate-spin" />
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
