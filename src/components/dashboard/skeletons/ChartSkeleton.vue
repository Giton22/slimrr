<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton'

defineProps<{
  height?: string
}>()
</script>

<template>
  <div class="flex items-end gap-1.5" :style="{ height: height ?? '200px' }">
    <Skeleton
      v-for="i in 12"
      :key="i"
      class="flex-1"
      :style="{ height: `${30 + Math.sin(i * 0.8) * 25 + 25}%` }"
    />
  </div>
</template>
