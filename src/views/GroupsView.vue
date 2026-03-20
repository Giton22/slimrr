<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useGroupsStore } from '@/stores/groups'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import CreateGroupDialog from '@/components/groups/CreateGroupDialog.vue'

const router = useRouter()
const store = useGroupsStore()

const showCreateDialog = ref(false)
const inviteCode = ref('')
const isJoining = ref(false)
const joinError = ref('')
const groupsSentinelRef = ref<HTMLElement | null>(null)

const GROUPS_INITIAL_BATCH = 24
const GROUPS_BATCH_SIZE = 16
const visibleGroupCount = ref(GROUPS_INITIAL_BATCH)

const visibleGroups = computed(() => store.myGroups.slice(0, visibleGroupCount.value))
const hasMoreGroups = computed(() => visibleGroupCount.value < store.myGroups.length)
const normalizedInviteCode = computed(() => normalizeInviteCode(inviteCode.value))
const canSubmitInviteCode = computed(
  () => normalizedInviteCode.value.length === 8 && !isJoining.value,
)

let groupsObserver: IntersectionObserver | null = null

function normalizeInviteCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
}

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
      if (entries[0]?.isIntersecting) loadMoreGroups()
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

watch(groupsSentinelRef, () => setupGroupsObserver())

onBeforeUnmount(() => {
  groupsObserver?.disconnect()
  groupsObserver = null
})

function onCreated(groupId: string) {
  router.push(`/groups/${groupId}`)
}

function onInviteCodeInput(event: Event) {
  const target = event.target as HTMLInputElement
  inviteCode.value = normalizeInviteCode(target.value)
  if (joinError.value) joinError.value = ''
}

async function submitInviteCode() {
  if (!canSubmitInviteCode.value) return

  isJoining.value = true
  joinError.value = ''
  inviteCode.value = normalizedInviteCode.value

  try {
    const group = await store.joinGroup(normalizedInviteCode.value)
    joinError.value = ''
    inviteCode.value = ''
    await router.push(`/groups/${group.id}`)
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    if (err.status === 404 || err.message?.includes('not found')) {
      joinError.value = 'Invalid invite code. Please check and try again.'
    } else {
      joinError.value = err.message || 'Failed to join group'
    }
  } finally {
    isJoining.value = false
  }
}

// Group card colors based on index
const cardColors = [
  'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
  'bg-green-100 dark:bg-green-900/30 text-green-600',
  'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
  'bg-purple-100 dark:bg-purple-900/30 text-purple-600',
  'bg-rose-100 dark:bg-rose-900/30 text-rose-600',
  'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600',
]
</script>

<template>
  <div class="min-h-full px-3 pb-20 pt-3 sm:px-4 sm:pt-4 lg:px-8 lg:pb-8 lg:pt-8">
    <div class="mx-auto max-w-[1200px]">
      <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-sm font-medium uppercase tracking-[0.22em] text-primary/80">
            Social Progress
          </p>
          <h1 class="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            Groups
          </h1>
          <p class="mt-2 text-sm text-muted-foreground">
            Manage your teams and participate in group challenges.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <!-- Inline invite code (desktop) -->
          <form
            class="hidden items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm lg:flex"
            @submit.prevent="submitInviteCode"
          >
            <Input
              :model-value="inviteCode"
              placeholder="Enter invite code"
              class="w-32 border-none bg-transparent text-sm focus:ring-0"
              maxlength="8"
              @input="onInviteCodeInput"
              @keydown.enter.prevent="submitInviteCode"
            />
            <Button type="submit" variant="secondary" size="sm" :disabled="!canSubmitInviteCode">
              {{ isJoining ? 'Joining...' : 'Join Group' }}
            </Button>
          </form>
          <Button class="gap-2 font-bold" @click="showCreateDialog = true">
            <Icon icon="lucide:plus-circle" class="size-5" />
            Create Group
          </Button>
        </div>
        <p v-if="joinError" class="text-sm text-destructive lg:ml-auto lg:w-[240px]">
          {{ joinError }}
        </p>
      </div>

      <!-- Mobile: invite code input -->
      <Card class="mb-6 rounded-[1.8rem] border-primary/20 shadow-warm-lg lg:hidden">
        <CardContent class="space-y-3 pt-4">
          <p class="text-sm font-medium text-muted-foreground">Enter 8-character invite code</p>
          <form class="space-y-3" @submit.prevent="submitInviteCode">
            <div class="flex gap-2">
              <Input
                :model-value="inviteCode"
                placeholder="XJ9-42-LK"
                class="flex-1 text-center font-mono uppercase tracking-widest"
                maxlength="8"
                @input="onInviteCodeInput"
                @keydown.enter.prevent="submitInviteCode"
              />
              <Button type="submit" :disabled="!canSubmitInviteCode">
                {{ isJoining ? 'Joining...' : 'Enter' }}
              </Button>
            </div>
            <p v-if="joinError" class="text-sm text-destructive">{{ joinError }}</p>
          </form>
        </CardContent>
      </Card>

      <!-- Loading skeleton -->
      <div v-if="store.isLoading" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card v-for="i in 6" :key="i" class="rounded-2xl">
          <CardContent class="pt-6">
            <Skeleton class="mb-6 size-14 rounded-xl" />
            <Skeleton class="mb-1 h-5 w-32" />
            <Skeleton class="mb-6 h-4 w-48" />
          </CardContent>
        </Card>
      </div>

      <!-- Group grid -->
      <div v-else-if="store.myGroups.length > 0">
        <h3 class="mb-5 text-sm font-bold uppercase tracking-[0.2em] text-primary">Your Groups</h3>
        <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="(group, i) in visibleGroups"
            :key="group.id"
            class="cursor-pointer rounded-[1.8rem] border shadow-warm-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50"
            @click="router.push(`/groups/${group.id}`)"
          >
            <CardContent class="pt-6">
              <div class="mb-6 flex items-start justify-between">
                <div
                  class="flex size-14 items-center justify-center rounded-xl"
                  :class="cardColors[i % cardColors.length]"
                >
                  <Icon icon="lucide:users" class="size-7" />
                </div>
              </div>
              <h3 class="mb-1 text-lg font-bold transition-colors group-hover:text-primary">
                {{ group.name }}
              </h3>
              <p v-if="group.description" class="mb-6 line-clamp-2 text-sm text-muted-foreground">
                {{ group.description }}
              </p>
              <p v-else class="mb-6 text-sm italic text-muted-foreground">No description</p>
            </CardContent>
          </Card>
        </div>

        <div ref="groupsSentinelRef" class="h-2" aria-hidden="true" />

        <div v-if="hasMoreGroups" class="mt-6 flex justify-center">
          <Button variant="outline" @click="loadMoreGroups">Load more groups</Button>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else
        class="flex flex-col items-center justify-center rounded-[1.8rem] border border-dashed border-border bg-card/50 py-16 text-center"
      >
        <Icon icon="lucide:users" class="mb-4 size-12 text-muted-foreground/50" />
        <h3 class="text-lg font-medium">No groups yet</h3>
        <p class="mb-4 mt-1 text-sm text-muted-foreground">
          Create a group or join one with an invite code.
        </p>
        <div class="flex gap-2">
          <Button @click="showCreateDialog = true">
            <Icon icon="lucide:plus" class="mr-2 size-4" />
            Create Group
          </Button>
        </div>
      </div>

      <!-- Dialogs -->
      <CreateGroupDialog v-model:open="showCreateDialog" @created="onCreated" />
    </div>
  </div>
</template>
