<script setup lang="ts">
import { computed, watch } from 'vue'
import { useUnits } from '@/composables/useUnits'
import ScrollPicker from './ScrollPicker.vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { isKg } = useUnits()

const minInt = computed(() => (isKg.value ? 20 : 44))
const maxInt = computed(() => (isKg.value ? 250 : 550))

const integerItems = computed(() => {
  const items: number[] = []
  for (let i = minInt.value; i <= maxInt.value; i++) {
    items.push(i)
  }
  return items
})

const decimalItems = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

// Parse the current value into integer and decimal parts
const intValue = computed(() => {
  const num = parseFloat(props.modelValue)
  if (isNaN(num)) return isKg.value ? 70 : 154
  return Math.floor(num)
})

const decValue = computed(() => {
  const num = parseFloat(props.modelValue)
  if (isNaN(num)) return 0
  return Math.round((num - Math.floor(num)) * 10)
})

function onIntChange(val: number | string) {
  const newValue = `${val}.${decValue.value}`
  emit('update:modelValue', newValue)
}

function onDecChange(val: number | string) {
  const newValue = `${intValue.value}.${val}`
  emit('update:modelValue', newValue)
}
</script>

<template>
  <div class="flex items-center justify-center gap-0">
    <div class="w-20">
      <ScrollPicker
        :items="integerItems"
        :model-value="intValue"
        @update:model-value="onIntChange"
      />
    </div>
    <span class="text-2xl font-bold text-muted-foreground">.</span>
    <div class="w-16">
      <ScrollPicker
        :items="decimalItems"
        :model-value="decValue"
        @update:model-value="onDecChange"
      />
    </div>
    <span class="ml-2 text-sm font-medium text-muted-foreground">
      {{ isKg ? 'kg' : 'lbs' }}
    </span>
  </div>
</template>
