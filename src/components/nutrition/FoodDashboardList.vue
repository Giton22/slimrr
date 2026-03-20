<script setup lang="ts">
import type { FoodItem, FoodDashboardTab } from '@/types'
import FoodDashboardListItem from './FoodDashboardListItem.vue'

defineProps<{
  query: string
  tab: FoodDashboardTab
  tabFoods: FoodItem[]
  personalMatches: FoodItem[]
  remoteFoods: FoodItem[]
  favoriteIds: string[]
  selectedFoodId?: string
  showEmptyState?: boolean
}>()

defineEmits<{
  select: [food: FoodItem]
  toggleFavorite: [food: FoodItem]
}>()

const tabLabels: Record<FoodDashboardTab, string> = {
  frequent: 'Frequent Foods',
  recent: 'Recent Foods',
  favorites: 'Favorites',
}
</script>

<template>
  <section class="space-y-4">
    <template v-if="query">
      <div v-if="personalMatches.length > 0" class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-bold uppercase tracking-[0.2em] text-primary">My Foods</h2>
          <p class="text-xs text-muted-foreground">{{ personalMatches.length }} matches</p>
        </div>

        <FoodDashboardListItem
          v-for="food in personalMatches"
          :key="food.id"
          :food="food"
          :favorite="favoriteIds.includes(food.id)"
          :active="selectedFoodId === food.id"
          @select="$emit('select', $event)"
          @toggle-favorite="$emit('toggleFavorite', $event)"
        />
      </div>

      <div v-if="remoteFoods.length > 0" class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-bold uppercase tracking-[0.2em] text-primary">OpenFoodFacts</h2>
          <p class="text-xs text-muted-foreground">{{ remoteFoods.length }} matches</p>
        </div>

        <FoodDashboardListItem
          v-for="food in remoteFoods"
          :key="food.id"
          :food="food"
          meta="OpenFoodFacts result"
          :favorite="favoriteIds.includes(food.id)"
          :active="selectedFoodId === food.id"
          @select="$emit('select', $event)"
          @toggle-favorite="$emit('toggleFavorite', $event)"
        />
      </div>

      <div
        v-if="showEmptyState"
        class="rounded-[1.8rem] border border-dashed border-border bg-card/50 px-5 py-8 text-center"
      >
        <p class="text-lg font-bold text-foreground">No foods found</p>
        <p class="mt-2 text-sm text-muted-foreground">
          Try a broader search, scan a barcode, or use AI label scan.
        </p>
      </div>
    </template>

    <template v-else>
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold uppercase tracking-[0.2em] text-primary">
          {{ tabLabels[tab] }}
        </h2>
        <p class="text-xs text-muted-foreground">{{ tabFoods.length }} items</p>
      </div>

      <div
        v-if="tabFoods.length === 0"
        class="rounded-[1.8rem] border border-dashed border-border bg-card/50 px-5 py-8 text-center"
      >
        <p class="text-lg font-bold text-foreground">Nothing here yet</p>
        <p class="mt-2 text-sm text-muted-foreground">
          Logged foods will start filling this list automatically.
        </p>
      </div>

      <FoodDashboardListItem
        v-for="food in tabFoods"
        :key="food.id"
        :food="food"
        :favorite="favoriteIds.includes(food.id)"
        :active="selectedFoodId === food.id"
        @select="$emit('select', $event)"
        @toggle-favorite="$emit('toggleFavorite', $event)"
      />
    </template>
  </section>
</template>
