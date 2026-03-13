<script setup lang="ts">
import { watch } from 'vue'
import { Toaster } from 'vue-sonner'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { useWeightStore } from '@/stores/weight'
import { useGroupsStore } from '@/stores/groups'
import { useToday } from '@/composables/useToday'

// Start the midnight-check timer so the reactive `today` ref stays current
useToday()

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
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <Toaster rich-colors close-button position="bottom-right" />
  </div>
</template>
