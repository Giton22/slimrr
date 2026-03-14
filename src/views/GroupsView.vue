<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useGroupsStore } from '@/stores/groups'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CreateGroupDialog from '@/components/groups/CreateGroupDialog.vue'
import JoinGroupDialog from '@/components/groups/JoinGroupDialog.vue'

const router = useRouter()
const store = useGroupsStore()

const showCreateDialog = ref(false)
const showJoinDialog = ref(false)
const groupsSentinelRef = ref<HTMLElement | null>(null)

const GROUPS_INITIAL_BATCH = 24
const GROUPS_BATCH_SIZE = 16
const visibleGroupCount = ref(GROUPS_INITIAL_BATCH)

const visibleGroups = computed(() => store.myGroups.slice(0, visibleGroupCount.value))
const hasMoreGroups = computed(() => visibleGroupCount.value < store.myGroups.length)

let groupsObserver: IntersectionObserver | null = null

function loadMoreGroups() {
  if (!hasMoreGroups.value) return
  visibleGroupCount.value = Math.min(
    store.myGroups.length,
    visibleGroupCount.value + GROUPS_BATCH_SIZE,
  )
}

function setupGroupsObserver() {
  groupsObserver?.disconnect()

  const el = groupsSentinelRef.value
  if (!el) return

  groupsObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        loadMoreGroups()
      }
    },
    { rootMargin: '300px 0px' },
  )

  groupsObserver.observe(el)
}

onMounted(() => {
  store.loadMyGroups()
  setupGroupsObserver()
})

watch(
  () => store.myGroups.length,
  () => {
    visibleGroupCount.value = GROUPS_INITIAL_BATCH
  },
)

watch(groupsSentinelRef, () => {
  setupGroupsObserver()
})

onBeforeUnmount(() => {
  groupsObserver?.disconnect()
  groupsObserver = null
})

function onCreated(groupId: string) {
  router.push(`/groups/${groupId}`)
}

function onJoined(groupId: string) {
  router.push(`/groups/${groupId}`)
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold tracking-tight">Groups</h2>
      <div class="flex gap-2">
        <Button variant="outline" @click="showJoinDialog = true">
          <Icon icon="lucide:log-in" class="mr-2 h-4 w-4" />
          Join Group
        </Button>
        <Button @click="showCreateDialog = true">
          <Icon icon="lucide:plus" class="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.isLoading" class="flex items-center justify-center py-12">
      <Icon icon="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <!-- Group list -->
    <div v-else-if="store.myGroups.length > 0" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <Card
          v-for="group in visibleGroups"
          :key="group.id"
          class="cursor-pointer transition-all duration-200 hover:bg-muted/50 hover:shadow-warm hover:-translate-y-0.5"
          @click="router.push(`/groups/${group.id}`)"
        >
          <CardHeader class="pb-2">
            <div class="flex items-start justify-between">
              <CardTitle class="text-base">{{ group.name }}</CardTitle>
              <Icon
                icon="lucide:chevron-right"
                class="h-4 w-4 text-muted-foreground shrink-0 mt-0.5"
              />
            </div>
          </CardHeader>
          <CardContent>
            <p v-if="group.description" class="text-sm text-muted-foreground line-clamp-2">
              {{ group.description }}
            </p>
            <p v-else class="text-sm text-muted-foreground italic">No description</p>
          </CardContent>
        </Card>
      </div>

      <div ref="groupsSentinelRef" class="h-2" aria-hidden="true" />

      <div v-if="hasMoreGroups" class="flex justify-center">
        <Button variant="outline" @click="loadMoreGroups">Load more groups</Button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="flex flex-col items-center justify-center py-16 text-center">
      <Icon icon="lucide:users" class="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 class="text-lg font-medium">No groups yet</h3>
      <p class="text-sm text-muted-foreground mt-1 mb-4">
        Create a group or join one with an invite code.
      </p>
      <div class="flex gap-2">
        <Button variant="outline" @click="showJoinDialog = true">
          <Icon icon="lucide:log-in" class="mr-2 h-4 w-4" />
          Join Group
        </Button>
        <Button @click="showCreateDialog = true">
          <Icon icon="lucide:plus" class="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </div>
    </div>

    <!-- Dialogs -->
    <CreateGroupDialog v-model:open="showCreateDialog" @created="onCreated" />
    <JoinGroupDialog v-model:open="showJoinDialog" @joined="onJoined" />
  </div>
</template>
