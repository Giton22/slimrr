<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useWeightStore } from '@/stores/weight'
import type { TimeRange } from '@/types'
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
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{
  target: 'weight' | 'calories'
}>()

const store = useWeightStore()
const customDialogOpen = ref(false)
const customStart = ref('')
const customEnd = ref('')

const presetOptions: { value: Exclude<TimeRange, 'custom'>; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]

const currentValue = computed(() =>
  props.target === 'weight' ? store.weightTimeRange : store.calorieTimeRange,
)

const currentCustomRange = computed(() =>
  props.target === 'weight' ? store.weightCustomRange : store.calorieCustomRange,
)

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function daysAgoISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toISODate(d)
}

function parseISODate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`)
}

function onValueChange(value: string) {
  if (value === 'custom') {
    customDialogOpen.value = true
    return
  }

  const range = Number(value) as Exclude<TimeRange, 'custom'>
  if (props.target === 'weight') {
    store.setWeightTimeRange(range)
    return
  }

  store.setCalorieTimeRange(range)
}

const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

function formatShortDate(isoDate: string): string {
  return fmt.format(parseISODate(isoDate))
}

const currentLabel = computed(() => {
  if (currentValue.value === 'custom') {
    if (!currentCustomRange.value) {
      return 'Custom range'
    }
    return `Custom: ${formatShortDate(currentCustomRange.value.start)} - ${formatShortDate(currentCustomRange.value.end)}`
  }

  return presetOptions.find((option) => option.value === currentValue.value)?.label ?? 'Time range'
})

watch(customDialogOpen, (isOpen) => {
  if (!isOpen) return

  customStart.value = currentCustomRange.value?.start ?? daysAgoISO(30)
  customEnd.value = currentCustomRange.value?.end ?? todayISO()
})

function applyCustomRange() {
  if (!customStart.value || !customEnd.value) {
    toast.error('Please select both a start and end date.')
    return
  }

  if (customStart.value > customEnd.value) {
    toast.error('Start date must be on or before end date.')
    return
  }

  const range = { start: customStart.value, end: customEnd.value }
  if (props.target === 'weight') {
    store.setWeightCustomRange(range)
    store.setWeightTimeRange('custom')
  } else {
    store.setCalorieCustomRange(range)
    store.setCalorieTimeRange('custom')
  }

  customDialogOpen.value = false
}
</script>

<template>
  <Select :model-value="String(currentValue)" @update:model-value="onValueChange">
    <SelectTrigger class="w-[220px]">
      <SelectValue :placeholder="currentLabel">{{ currentLabel }}</SelectValue>
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="opt in presetOptions" :key="opt.value" :value="String(opt.value)">
        {{ opt.label }}
      </SelectItem>
      <SelectItem value="custom">Custom range</SelectItem>
    </SelectContent>
  </Select>

  <Dialog v-model:open="customDialogOpen">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Choose custom range</DialogTitle>
        <DialogDescription>Select the date interval to display in this chart.</DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-2">
        <div class="grid gap-2">
          <Label for="custom-range-start">Start date</Label>
          <Input id="custom-range-start" v-model="customStart" type="date" />
        </div>
        <div class="grid gap-2">
          <Label for="custom-range-end">End date</Label>
          <Input id="custom-range-end" v-model="customEnd" type="date" />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" @click="customDialogOpen = false">Cancel</Button>
        <Button type="button" @click="applyCustomRange">Apply</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
