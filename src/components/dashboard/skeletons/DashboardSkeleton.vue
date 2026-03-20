<script setup lang="ts">
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import ChartSkeleton from './ChartSkeleton.vue'
</script>

<template>
  <div class="space-y-6 lg:space-y-8">
    <!-- Top Row: BMI | Macros + Calories Donut -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
      <!-- BMI Gauge Card -->
      <Card class="shadow-warm">
        <CardContent class="flex flex-col items-center pt-6">
          <div class="mb-4 flex w-full items-center justify-between">
            <Skeleton class="h-6 w-28" />
            <Skeleton class="h-5 w-16" />
          </div>
          <Skeleton class="h-[160px] w-[200px] rounded-full" />
          <Skeleton class="mt-4 h-4 w-48" />
        </CardContent>
      </Card>

      <!-- Daily Calories Card -->
      <Card class="shadow-warm lg:col-span-2">
        <CardContent class="flex flex-col gap-6 pt-6 md:flex-row md:gap-8">
          <div class="flex-1 space-y-4">
            <Skeleton class="h-6 w-32" />
            <div class="space-y-3">
              <div v-for="i in 3" :key="i" class="space-y-1">
                <div class="flex justify-between">
                  <Skeleton class="h-3 w-16" />
                  <Skeleton class="h-3 w-10" />
                </div>
                <Skeleton class="h-2 w-full" />
              </div>
            </div>
          </div>
          <div
            class="flex flex-col items-center justify-center border-t border-border pt-6 md:min-w-[200px] md:border-l md:border-t-0 md:pl-8 md:pt-0"
          >
            <Skeleton class="size-[160px] rounded-full" />
            <Skeleton class="mt-2 h-4 w-32" />
            <Skeleton class="mt-1 h-3 w-24" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Weight Trend Bar Chart -->
    <Card class="shadow-warm">
      <CardContent class="pt-6">
        <ChartSkeleton height="280px" />
        <div class="mt-6 space-y-2">
          <Skeleton class="h-4 w-40" />
          <Skeleton class="h-3 w-64" />
        </div>
      </CardContent>
    </Card>
  </div>
</template>
