<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  displayValue: string
  goalValue?: string | null
  selectedDateLabel: string
  latestValue?: string | null
  latestDateLabel?: string | null
  hasEntry: boolean
}>()

defineEmits<{
  edit: []
  log: []
}>()
</script>

<template>
  <div
    class="overflow-hidden rounded-[2rem] border border-border bg-card p-5 text-card-foreground shadow-warm-lg"
  >
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-xl font-bold tracking-tight">Weight</p>
        <p class="mt-2 text-sm font-medium text-muted-foreground">
          Goal: {{ goalValue || 'Not set' }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ selectedDateLabel }}
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="flex size-14 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
          :disabled="!hasEntry"
          @click="$emit('edit')"
        >
          <Icon icon="lucide:pencil" class="size-5" />
        </button>
        <button
          type="button"
          class="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-warm-md transition-transform hover:scale-[1.03]"
          @click="$emit('log')"
        >
          <Icon icon="lucide:plus" class="size-7" />
        </button>
      </div>
    </div>

    <div class="mt-8">
      <p class="text-4xl font-black tracking-tight sm:text-5xl">
        {{ displayValue }}
      </p>
      <p v-if="hasEntry" class="mt-2 text-sm text-muted-foreground">Entry logged for this day</p>
      <p v-else class="mt-2 text-sm text-muted-foreground">
        No entry for this day
        <span v-if="latestDateLabel" class="text-muted-foreground/70">
          · Latest entry is from {{ latestDateLabel }}
          <span v-if="latestValue">({{ latestValue }})</span>
        </span>
        <span v-else-if="latestValue" class="text-muted-foreground/70"
          >· Latest {{ latestValue }}</span
        >
      </p>
    </div>
  </div>
</template>
