<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { toast } from 'vue-sonner'
import { Icon } from '@iconify/vue'
import { useWeightStore } from '@/stores/weight'
import { useUnits } from '@/composables/useUnits'
import { useNumericField } from '@/composables/useNumericField'
import { useHaptics } from '@/composables/useHaptics'
import { todayISO } from '@/lib/date'
import { useIsMobile } from '@/components/ui/responsive-dialog/useIsMobile'
import { WeightScrollPicker } from '@/components/ui/scroll-picker'
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
import { DialogTrigger } from '@/components/ui/dialog'

const props = defineProps<{
  hideTrigger?: boolean
  initialDate?: string
}>()
const emit = defineEmits<{
  saved: [payload: { date: string; isUpdate: boolean }]
}>()

const store = useWeightStore()
const { isKg, convert, toKg } = useUnits()
const haptics = useHaptics()

const isMobile = useIsMobile()
const open = defineModel<boolean>('open', { default: false })
const date = ref(todayISO())
const weightField = useNumericField({ min: 1, required: true })
const note = ref('')
const saving = ref(false)
const weightInputRef = ref<InstanceType<typeof Input> | null>(null)

const existingEntry = computed(() => store.sortedEntries.find((e) => e.date === date.value))

const isUpdating = computed(() => !!existingEntry.value)

// Pre-fill when date changes to a date with an existing entry
watch(date, (newDate) => {
  const existing = store.sortedEntries.find((e) => e.date === newDate)
  if (existing) {
    weightField.reset(Math.round(convert(existing.weightKg) * 10) / 10)
    note.value = existing.note ?? ''
  } else {
    weightField.reset()
    note.value = ''
  }
})

// Auto-focus weight input when dialog opens
watch(open, (isOpen) => {
  if (isOpen) {
    date.value = props.initialDate ?? todayISO()
    // Pre-fill if today already has an entry
    const existing = store.sortedEntries.find((e) => e.date === date.value)
    if (existing) {
      weightField.reset(Math.round(convert(existing.weightKg) * 10) / 10)
      note.value = existing.note ?? ''
    }
    nextTick(() => {
      const el = weightInputRef.value?.$el?.querySelector('input') ?? weightInputRef.value?.$el
      el?.focus()
    })
  }
})

async function submit() {
  if (!weightField.validate() || !date.value || saving.value) return

  saving.value = true
  try {
    const savedDate = date.value
    const wasUpdate = isUpdating.value
    await store.addEntry({
      date: date.value,
      weightKg: toKg(weightField.numericValue.value!),
      note: note.value || undefined,
    })

    haptics.success()

    // Reset
    weightField.reset()
    note.value = ''
    date.value = props.initialDate ?? todayISO()
    open.value = false
    emit('saved', { date: savedDate, isUpdate: wasUpdate })
  } catch {
    toast.error('Failed to save weight entry')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger v-if="!hideTrigger" as-child>
      <Button>
        <Icon icon="lucide:plus" class="mr-2 h-4 w-4" />
        Log Weight
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon icon="lucide:scale" class="h-5 w-5 text-primary" />
          Log Weight
        </DialogTitle>
        <DialogDescription>{{
          isUpdating ? 'Update an existing weight entry.' : 'Add a new weight entry.'
        }}</DialogDescription>
      </DialogHeader>
      <form class="grid gap-4 py-4" @submit.prevent="submit">
        <div class="grid gap-2">
          <Label for="date">Date</Label>
          <Input id="date" v-model="date" type="date" />
          <p v-if="isUpdating" class="text-xs text-warning">Updating existing entry</p>
        </div>
        <div class="grid gap-2" data-vaul-no-drag>
          <Label for="weight">Weight ({{ isKg ? 'kg' : 'lbs' }})</Label>
          <!-- Mobile: scroll wheel picker -->
          <WeightScrollPicker
            v-if="isMobile"
            :model-value="weightField.displayValue.value || (isKg ? '70.0' : '154.0')"
            @update:model-value="weightField.displayValue.value = $event"
          />
          <!-- Desktop: numeric input -->
          <Input
            v-else
            id="weight"
            ref="weightInputRef"
            v-model="weightField.displayValue.value"
            type="text"
            inputmode="decimal"
            placeholder="Enter weight"
            v-bind="weightField.inputAttrs.value"
            :class="{ 'animate-shake': weightField.shaking.value }"
          />
          <p v-if="weightField.error.value" class="text-xs text-destructive">
            {{ weightField.error.value }}
          </p>
        </div>
        <div class="grid gap-2">
          <Label for="note">Note (optional)</Label>
          <Input id="note" v-model="note" placeholder="e.g. After workout" />
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="!weightField.numericValue.value || !date || saving">
            <Icon v-if="saving" icon="lucide:loader-circle" class="mr-2 h-4 w-4 animate-spin" />
            {{ isUpdating ? 'Update' : 'Save' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
