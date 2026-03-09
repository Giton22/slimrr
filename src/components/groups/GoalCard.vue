<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { Goal } from '@/types'
import { Card, CardContent } from '@/components/ui/card'

const props = defineProps<{
  goal: Goal
}>()

const direction = computed(() => props.goal.description as 'loss' | 'gain' | '')

const progress = computed(() => {
  const target = props.goal.targetValue
  const current = props.goal.currentValue
  if (!target || !current) return null

  let pct: number
  if (direction.value === 'loss') {
    // Loss: 100% when current <= target, 0% when infinitely far
    pct = Math.round((target / current) * 100)
  } else {
    // Gain: 100% when current >= target
    pct = Math.round((current / target) * 100)
  }
  return Math.max(0, Math.min(100, pct))
})
</script>

<template>
  <Card>
    <CardContent class="py-3 space-y-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-sm">
          <Icon icon="lucide:target" class="h-4 w-4 text-primary" />
          <span class="font-medium">{{ goal.title }}</span>
        </div>
        <span v-if="progress !== null" class="text-xs font-medium text-muted-foreground">{{ progress }}%</span>
      </div>

      <div v-if="goal.targetValue" class="flex items-center gap-2 text-sm">
        <span class="font-semibold">{{ goal.currentValue }} {{ goal.unit || '' }}</span>
        <Icon icon="lucide:arrow-right" class="h-3.5 w-3.5 text-muted-foreground" />
        <span class="text-muted-foreground">{{ goal.targetValue }} {{ goal.unit || '' }}</span>
      </div>

      <div v-if="progress !== null" class="h-2 w-full rounded-full bg-muted">
        <div
          class="h-2 rounded-full bg-primary transition-all"
          :style="{ width: `${progress}%` }"
        />
      </div>
    </CardContent>
  </Card>
</template>
