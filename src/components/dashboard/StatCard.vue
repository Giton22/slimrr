<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

defineProps<{
  title: string
  value: string
  description?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}>()
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle class="text-sm font-medium text-muted-foreground">
        {{ title }}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div class="text-2xl font-bold">{{ value }}</div>
      <p v-if="description || trendValue" class="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <template v-if="trendValue">
          <span
            class="inline-flex items-center gap-0.5"
            :class="trend === 'down' ? 'text-success' : trend === 'up' ? 'text-destructive' : ''"
            :aria-label="`Trend: ${trendValue}`"
          >
            <Icon
              v-if="trend === 'down'"
              icon="lucide:trending-down"
              class="h-3 w-3"
              aria-hidden="true"
            />
            <Icon
              v-else-if="trend === 'up'"
              icon="lucide:trending-up"
              class="h-3 w-3"
              aria-hidden="true"
            />
            {{ trendValue }}
          </span>
        </template>
        <span v-if="description">{{ description }}</span>
      </p>
    </CardContent>
  </Card>
</template>
