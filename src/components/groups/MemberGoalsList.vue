<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
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
const memberGoal = computed(() => props.goals.find((g) => g.user === props.member.user))
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <Icon icon="lucide:user" class="h-4 w-4 text-muted-foreground" />
      <span class="text-sm font-medium">{{ displayName }}</span>
    </div>

    <GoalCard v-if="memberGoal" :goal="memberGoal" />
    <p v-else class="text-sm text-muted-foreground pl-6">No weight goal set</p>
  </div>
</template>
