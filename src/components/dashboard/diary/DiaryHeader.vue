<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Button } from '@/components/ui/button'

defineProps<{
  title: string
  subtitle: string
  isToday: boolean
  streakCount: number
  streakJustIncreased?: boolean
}>()

defineEmits<{
  prev: []
  next: []
  today: []
}>()
</script>

<template>
  <div
    class="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 pb-5 pt-4 backdrop-blur-xl lg:static lg:mx-0 lg:rounded-[2rem] lg:border lg:bg-card lg:px-6 lg:py-6"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="truncate text-4xl font-black tracking-tight text-foreground lg:text-5xl">
          {{ title }}
        </p>
        <p class="mt-2 text-sm font-medium text-muted-foreground lg:text-base">
          {{ subtitle }}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2 self-start">
        <div
          class="flex h-11 min-w-[4.5rem] items-center justify-center gap-2 rounded-full border px-3 shadow-sm transition-all duration-300"
          :class="
            streakCount > 0
              ? [
                  'border-amber-200/80 bg-amber-50 text-amber-700',
                  streakJustIncreased
                    ? 'scale-[1.03] shadow-[0_0_0_4px_rgba(251,191,36,0.16)]'
                    : '',
                ]
              : 'border-border bg-background text-muted-foreground'
          "
          aria-label="Current streak"
        >
          <Icon
            icon="lucide:flame"
            class="size-[18px]"
            :class="streakCount > 0 ? 'text-amber-500' : 'text-muted-foreground'"
          />
          <span class="text-base font-black tabular-nums leading-none">
            {{ streakCount }}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          class="size-11 rounded-full border border-border bg-background text-foreground hover:bg-muted hover:text-foreground"
          @click="$emit('prev')"
        >
          <Icon icon="lucide:chevron-left" class="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="size-11 rounded-full border border-border bg-background text-foreground hover:bg-muted hover:text-foreground"
          @click="$emit('next')"
        >
          <Icon icon="lucide:chevron-right" class="size-5" />
        </Button>
      </div>
    </div>

    <div v-if="!isToday" class="mt-4">
      <Button
        variant="ghost"
        class="h-9 rounded-full border border-primary/30 bg-primary/12 px-4 text-sm font-semibold text-primary hover:bg-primary/18"
        @click="$emit('today')"
      >
        Today
      </Button>
    </div>
  </div>
</template>
