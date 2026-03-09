<script setup lang="ts">
import { watch } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { useWeightStore } from '@/stores/weight'
import { useGroupsStore } from '@/stores/groups'

const auth = useAuthStore()
const weightStore = useWeightStore()
const groupsStore = useGroupsStore()

// When user logs in: load data + subscribe realtime
// When user logs out: reset store + unsubscribe
watch(
  () => auth.isAuthenticated,
  async (authenticated) => {
    if (authenticated) {
      await weightStore.loadAll()
      weightStore.subscribeRealtime()
      await groupsStore.loadMyGroups()
    }
    else {
      weightStore.reset()
      groupsStore.reset()
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <AppHeader />
    <main>
      <RouterView />
    </main>
  </div>
</template>
