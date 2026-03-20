<script setup lang="ts">
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
</script>

<template>
  <div class="space-y-6">
    <!-- Date Navigator -->
    <div class="flex items-center justify-center gap-3">
      <Skeleton class="size-11 rounded-md" />
      <Skeleton class="h-5 w-[120px]" />
      <Skeleton class="size-11 rounded-md" />
    </div>

    <!-- Summary Card -->
    <Card class="shadow-warm">
      <CardContent class="space-y-4 pt-6">
        <Skeleton class="mx-auto size-[120px] rounded-full" />
        <div class="grid grid-cols-3 gap-2 border-t border-border pt-4">
          <div v-for="i in 3" :key="i" class="flex flex-col items-center gap-1">
            <Skeleton class="h-3 w-12" />
            <Skeleton class="h-5 w-10" />
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Macro cards -->
    <div class="grid grid-cols-3 gap-3">
      <Card v-for="i in 3" :key="i">
        <CardContent class="p-3">
          <Skeleton class="h-3 w-12" />
          <Skeleton class="mt-1 h-5 w-10" />
          <Skeleton class="mt-2 h-1 w-full" />
        </CardContent>
      </Card>
    </div>

    <!-- Quick Add Bar -->
    <Card class="shadow-warm">
      <CardContent class="pt-4">
        <div class="flex gap-2">
          <Skeleton v-for="i in 3" :key="i" class="h-9 flex-1 rounded-md" />
        </div>
      </CardContent>
    </Card>

    <!-- Meal Sections -->
    <Card v-for="i in 4" :key="i" class="shadow-warm">
      <CardContent class="pt-4 space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Skeleton class="size-4" />
            <Skeleton class="h-4 w-20" />
          </div>
          <Skeleton class="h-7 w-12 rounded-md" />
        </div>
        <div v-for="j in 2" :key="j" class="flex items-center justify-between py-1.5">
          <Skeleton class="h-4 w-32" />
          <Skeleton class="h-4 w-16" />
        </div>
      </CardContent>
    </Card>
  </div>
</template>
