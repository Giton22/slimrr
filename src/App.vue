<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { Toaster } from 'vue-sonner'
import AppShell from '@/components/layout/AppShell.vue'
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt.vue'
import { useAuthStore } from '@/stores/auth'
import { useWeightStore } from '@/stores/weight'
import { useFoodStore } from '@/stores/food'
import { useGroupsStore } from '@/stores/groups'
import { useToday } from '@/composables/useToday'
import { createSessionBootstrap } from '@/lib/sessionBootstrap'
import { navDirection } from '@/router'

// Start the midnight-check timer so the reactive `today` ref stays current
useToday()

const route = useRoute()
const auth = useAuthStore()
const weightStore = useWeightStore()
const foodStore = useFoodStore()
const groupsStore = useGroupsStore()
const sessionBootstrap = createSessionBootstrap({
  weight: weightStore,
  food: foodStore,
  groups: groupsStore,
})

// Pages that use a minimal layout (no sidebar/bottom nav)
const minimalPages = new Set(['auth', 'setup', 'not-found'])
const useShell = computed(() => auth.isAuthenticated && !minimalPages.has(route.name as string))

const isMobile = useMediaQuery('(max-width: 1023px)')
const transitionName = computed(() => {
  if (!isMobile.value) return 'page'
  return navDirection.value === 'back' ? 'page-back' : 'page-forward'
})

// When user logs in: load data + subscribe realtime
// When user logs out: reset store + unsubscribe
watch(
  () => auth.isAuthenticated,
  async (authenticated) => {
    await sessionBootstrap.sync(authenticated)
  },
  { immediate: true },
)
</script>

<template>
  <!-- Authenticated layout with sidebar + bottom nav -->
  <AppShell v-if="useShell">
    <RouterView v-slot="{ Component }">
      <Transition :name="transitionName">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
  </AppShell>

  <!-- Minimal layout for auth/setup/404 -->
  <div v-else class="min-h-screen bg-background text-foreground">
    <main>
      <RouterView v-slot="{ Component }">
        <Transition :name="transitionName" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>

  <Teleport to="body">
    <Toaster rich-colors close-button position="bottom-right" />
    <PwaUpdatePrompt />
  </Teleport>
</template>
