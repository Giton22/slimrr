<script setup lang="ts">
import { computed } from 'vue'
import type { Goal, GroupMember } from '@/types'
import GoalCard from './GoalCard.vue'

const props = defineProps<{
  member: GroupMember
  goals: Goal[]
}>()

const displayName = computed(() => {
  const u = props.member.expand?.user
  return u?.name || u?.username || 'Unknown user'
})

const initials = computed(() => {
  const name = displayName.value
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
})

const memberGoal = computed(() => props.goals.find((g) => g.user === props.member.user))
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2.5">
      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {{ initials }}
      </div>
      <span class="text-sm font-medium">{{ displayName }}</span>
    </div>

    <GoalCard v-if="memberGoal" :goal="memberGoal" />
    <p v-else class="text-sm text-muted-foreground pl-10">No weight goal set</p>
  </div>
</template>
