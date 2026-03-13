<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Icon } from '@iconify/vue'
import { useWeightStore } from '@/stores/weight'
import { useNumericField } from '@/composables/useNumericField'
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
  DialogTrigger,
} from '@/components/ui/dialog'

const store = useWeightStore()

const open = ref(false)
const goalField = useNumericField({ min: 1, required: true, allowDecimals: false })
const saving = ref(false)

// Pre-fill with current global goal when dialog opens
watch(open, (isOpen) => {
  if (isOpen) {
    const current = store.currentGlobalKcalGoal
    goalField.reset(current ?? undefined)
  }
})

async function submit() {
  if (!goalField.validate() || saving.value) return

  saving.value = true
  try {
    await store.setGlobalKcalGoal(Math.round(goalField.numericValue.value!))

    goalField.reset()
    open.value = false
  } catch {
    toast.error('Failed to set calorie goal')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="outline" size="sm">
        <Icon icon="lucide:target" class="mr-2 h-4 w-4" />
        {{ store.currentGlobalKcalGoal !== null ? `Goal: ${store.currentGlobalKcalGoal} kcal` : 'Set Kcal Goal' }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon icon="lucide:target" class="h-5 w-5 text-primary" />
          Set Daily Kcal Goal
        </DialogTitle>
        <DialogDescription>
          This goal applies from today forward. Previous days keep their existing goals.
          You can override individual days from the table.
        </DialogDescription>
      </DialogHeader>
      <form class="grid gap-4 py-4" @submit.prevent="submit">
        <div class="grid gap-2">
          <Label for="kcal-goal">Daily Kcal Goal</Label>
          <Input
            id="kcal-goal"
            v-model="goalField.displayValue.value"
            type="text"
            inputmode="numeric"
            placeholder="e.g. 2000"
            v-bind="goalField.inputAttrs.value"
            :class="{ 'animate-shake': goalField.shaking.value }"
          />
          <p v-if="goalField.error.value" class="text-xs text-destructive">
            {{ goalField.error.value }}
          </p>
        </div>
        <p v-if="store.currentGlobalKcalGoal !== null" class="text-xs text-muted-foreground">
          Current goal: {{ store.currentGlobalKcalGoal }} kcal/day
        </p>
        <DialogFooter>
          <Button type="submit" :disabled="!goalField.numericValue.value || saving">
            <Icon v-if="saving" icon="lucide:loader-circle" class="mr-2 h-4 w-4 animate-spin" />
            Save
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
