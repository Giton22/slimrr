<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Input } from '@/components/ui/input'

defineProps<{
  modelValue: string
  placeholder: string
  loading?: boolean
  aiEnabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
  barcode: []
  ai: []
}>()
</script>

<template>
  <section
    class="rounded-[1.7rem] border border-border/70 bg-card px-3 py-3 shadow-warm-lg sm:rounded-[2rem] sm:px-5 sm:py-5"
  >
    <div
      class="flex items-center gap-2 rounded-[1.25rem] border border-primary/40 bg-background/70 p-2.5 sm:gap-3 sm:rounded-[1.4rem] sm:p-3"
    >
      <div
        class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:size-11"
      >
        <Icon icon="lucide:search" class="size-5" />
      </div>

      <div class="min-w-0 flex-1">
        <Input
          :model-value="modelValue"
          :placeholder="placeholder"
          class="h-auto border-0 bg-transparent px-0 py-0 text-[15px] shadow-none ring-0 placeholder:text-muted-foreground/85 focus-visible:ring-0 sm:text-base"
          @update:model-value="$emit('update:modelValue', $event)"
        />
      </div>

      <button
        type="button"
        class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/35 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary sm:size-11"
        @click="$emit('barcode')"
      >
        <Icon icon="lucide:scan-barcode" class="size-5" />
      </button>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
      <button
        type="button"
        class="flex items-center justify-center gap-2 rounded-[1.2rem] border border-border bg-muted/30 px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/55 sm:rounded-[1.4rem] sm:px-4"
        @click="$emit('barcode')"
      >
        <Icon icon="lucide:scan-line" class="size-4.5 text-primary" />
        Barcode Scan
      </button>

      <button
        type="button"
        class="flex items-center justify-center gap-2 rounded-[1.2rem] border border-border bg-muted/30 px-3 py-3 text-sm font-semibold transition-colors sm:rounded-[1.4rem] sm:px-4"
        :class="
          aiEnabled
            ? 'text-foreground hover:bg-muted/55'
            : 'cursor-not-allowed text-muted-foreground opacity-60'
        "
        :disabled="!aiEnabled"
        @click="$emit('ai')"
      >
        <Icon icon="lucide:camera" class="size-4.5 text-primary" />
        AI Scan
      </button>
    </div>

    <div
      v-if="loading"
      class="mt-3 flex items-center gap-2 text-sm font-medium text-muted-foreground"
    >
      <Icon icon="lucide:loader-circle" class="size-4 animate-spin" />
      Searching foods...
    </div>
  </section>
</template>
