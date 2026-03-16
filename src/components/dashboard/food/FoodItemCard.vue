<script setup lang="ts">
defineProps<{
  name: string
  brand?: string
  caloriesPer100g: number
  proteinPer100g?: number
  carbsPer100g?: number
  fatPer100g?: number
  servingG?: number
  clickable?: boolean
}>()

defineEmits<{
  select: []
}>()
</script>

<template>
  <div
    class="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm transition-colors"
    :class="clickable ? 'cursor-pointer hover:bg-muted/50' : ''"
    @click="clickable && $emit('select')"
  >
    <p class="font-medium">{{ name }}</p>
    <div class="flex items-center justify-between text-xs text-muted-foreground">
      <span v-if="brand" class="mr-3 truncate">{{ brand }}</span>
      <div class="flex shrink-0 items-center gap-3">
        <span class="font-semibold text-foreground">{{ caloriesPer100g }} kcal</span>
        <span v-if="proteinPer100g">P {{ proteinPer100g }}g</span>
        <span v-if="carbsPer100g">C {{ carbsPer100g }}g</span>
        <span v-if="fatPer100g">F {{ fatPer100g }}g</span>
      </div>
    </div>
  </div>
</template>
