<script setup lang="ts">
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import ChartSkeleton from './ChartSkeleton.vue'
</script>

<template>
  <div class="space-y-6 lg:space-y-8">
    <!-- Hero: current weight -->
    <Card class="shadow-warm">
      <CardContent class="flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between">
        <div class="space-y-2">
          <Skeleton class="h-4 w-24" />
          <Skeleton class="h-10 w-32" />
          <Skeleton class="h-4 w-36" />
          <Skeleton class="mt-2 h-1 w-64 max-w-xs" />
          <Skeleton class="h-3 w-40" />
        </div>
        <Skeleton class="h-10 w-36 rounded-md" />
      </CardContent>
    </Card>

    <!-- Grid: Goal Progress + Chart -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Goal Progress -->
      <Card class="shadow-warm lg:col-span-1">
        <CardContent class="pt-6 space-y-4">
          <Skeleton class="h-4 w-36" />
          <Skeleton class="h-12 w-24" />
          <Skeleton class="h-3 w-16" />
          <Skeleton class="mt-4 h-[120px] w-full" />
        </CardContent>
      </Card>

      <!-- Weight Chart -->
      <Card class="shadow-warm lg:col-span-2">
        <CardContent class="pt-6">
          <div class="mb-6 flex items-center justify-between">
            <Skeleton class="h-5 w-32" />
            <Skeleton class="h-8 w-24 rounded-md" />
          </div>
          <ChartSkeleton height="280px" />
        </CardContent>
      </Card>
    </div>

    <!-- Recent Logs Table -->
    <Card class="shadow-warm">
      <CardContent class="pt-6">
        <Skeleton class="mb-4 h-5 w-28" />
        <div class="space-y-3">
          <div
            v-for="i in 5"
            :key="i"
            class="flex items-center justify-between rounded-xl border border-border/50 p-4"
          >
            <div class="flex items-center gap-3">
              <Skeleton class="size-10 rounded-full" />
              <div class="space-y-1">
                <Skeleton class="h-4 w-16" />
                <Skeleton class="h-3 w-20" />
              </div>
            </div>
            <Skeleton class="size-8 rounded-md" />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
