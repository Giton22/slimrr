<script setup lang="ts">
import { useRoute } from 'vue-router'
import KcalSection from '@/components/dashboard/KcalSection.vue'

const route = useRoute()
</script>

<template>
  <div class="min-h-full px-3 pb-20 pt-3 sm:px-4 sm:pt-4 lg:px-8 lg:pb-8 lg:pt-8">
    <div class="mx-auto max-w-7xl">
      <div class="mb-6 flex gap-4 border-b border-border">
        <RouterLink
          to="/nutrition"
          class="border-b-2 px-1 pb-2 text-sm font-medium transition-colors"
          :class="
            route.path === '/nutrition'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
        >
          Food Log
        </RouterLink>
        <RouterLink
          to="/nutrition/overview"
          class="border-b-2 px-1 pb-2 text-sm font-medium transition-colors"
          :class="
            route.path === '/nutrition/overview'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
        >
          Overview
        </RouterLink>
      </div>

      <div class="mb-5">
        <p class="text-sm font-medium uppercase tracking-[0.22em] text-primary/80">
          Nutrition Analytics
        </p>
        <h1 class="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          Overview
        </h1>
        <p class="mt-2 text-sm text-muted-foreground">
          Calorie history, trends, and daily breakdown.
        </p>
      </div>

      <KcalSection />
    </div>
  </div>
</template>
