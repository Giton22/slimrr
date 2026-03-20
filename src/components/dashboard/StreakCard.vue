<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Card, CardContent } from '@/components/ui/card'
import { useStreaks } from '@/composables/useStreaks'

const { currentStreak, bestStreak, streakJustIncreased } = useStreaks()
</script>

<template>
  <Card
    class="animate-card-enter shadow-warm overflow-hidden"
    :class="{ 'streak-glow': streakJustIncreased }"
  >
    <CardContent class="flex items-center gap-4 py-3">
      <div
        class="flex size-10 items-center justify-center rounded-full"
        :class="currentStreak > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted'"
      >
        <Icon
          icon="lucide:flame"
          class="size-5"
          :class="
            currentStreak > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground'
          "
        />
      </div>
      <div class="flex-1">
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-black" :class="{ 'streak-bump': streakJustIncreased }">
            {{ currentStreak }}
          </span>
          <span class="text-sm font-medium text-muted-foreground">
            {{ currentStreak === 1 ? 'day' : 'days' }} streak
          </span>
        </div>
        <p
          v-if="currentStreak > 0 && bestStreak > currentStreak"
          class="text-xs text-muted-foreground"
        >
          Best: {{ bestStreak }} days
        </p>
        <p
          v-else-if="currentStreak > 0 && bestStreak === currentStreak && bestStreak > 1"
          class="text-xs text-amber-500 dark:text-amber-400 font-medium"
        >
          Personal best!
        </p>
        <p v-else-if="currentStreak === 0" class="text-xs text-muted-foreground">
          Log today to start your streak!
        </p>
      </div>
    </CardContent>
  </Card>
</template>
