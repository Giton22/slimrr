<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { toast } from 'vue-sonner'
import { Icon } from '@iconify/vue'
import { useWeightStore } from '@/stores/weight'
import { useNumericField } from '@/composables/useNumericField'
import { todayISO } from '@/lib/date'
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
const date = ref(todayISO())
const caloriesField = useNumericField({ min: 0, required: true, allowDecimals: false })
const note = ref('')
const saving = ref(false)
const caloriesInputRef = ref<InstanceType<typeof Input> | null>(null)

async function submit() {
  if (!caloriesField.validate() || !date.value || saving.value) return

  saving.value = true
  try {
    await store.saveDailyCalories({
      date: date.value,
      calories: Math.round(caloriesField.numericValue.value!),
      goalOverrideKcal: null,
      note: note.value || undefined,
    })

    // Reset
    caloriesField.reset()
    note.value = ''
    date.value = todayISO()
    open.value = false
  } catch {
    toast.error('Failed to save calorie entry')
  } finally {
    saving.value = false
  }
}

function onOpenChange(value: boolean) {
  if (value) {
    date.value = todayISO()
    nextTick(() => {
      const el = caloriesInputRef.value?.$el?.querySelector('input') ?? caloriesInputRef.value?.$el
      el?.focus()
    })
  }
  open.value = value
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogTrigger as-child>
      <Button>
        <Icon icon="lucide:plus" class="mr-2 h-4 w-4" />
        Log Calories
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon icon="lucide:flame" class="h-5 w-5 text-primary" />
          Log Calories
        </DialogTitle>
        <DialogDescription>Add calories consumed for a day.</DialogDescription>
      </DialogHeader>
      <form class="grid gap-4 py-4" @submit.prevent="submit">
        <div class="grid gap-2">
          <Label for="cal-date">Date</Label>
          <Input id="cal-date" v-model="date" type="date" />
        </div>
        <div class="grid gap-2">
          <Label for="cal-calories">Consumed kcal</Label>
          <Input
            id="cal-calories"
            ref="caloriesInputRef"
            v-model="caloriesField.displayValue.value"
            type="text"
            inputmode="numeric"
            placeholder="e.g. 2000"
            v-bind="caloriesField.inputAttrs.value"
            :class="{ 'animate-shake': caloriesField.shaking.value }"
          />
          <p v-if="caloriesField.error.value" class="text-xs text-destructive">
            {{ caloriesField.error.value }}
          </p>
        </div>
        <div class="grid gap-2">
          <Label for="cal-note">Note (optional)</Label>
          <Input id="cal-note" v-model="note" placeholder="e.g. Cheat day" />
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="!caloriesField.numericValue.value || !date || saving">
            <Icon v-if="saving" icon="lucide:loader-circle" class="mr-2 h-4 w-4 animate-spin" />
            Save
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
