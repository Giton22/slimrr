<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { pb } from '@/lib/pocketbase'
import { useGroupsStore } from '@/stores/groups'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import MemberGoalsList from '@/components/groups/MemberGoalsList.vue'

const route = useRoute()
const router = useRouter()
const store = useGroupsStore()

const groupId = computed(() => route.params.id as string)
const copied = ref(false)
const showLeaveConfirm = ref(false)
const membersSentinelRef = ref<HTMLElement | null>(null)

const MEMBERS_INITIAL_BATCH = 40
const MEMBERS_BATCH_SIZE = 25
const visibleMemberCount = ref(MEMBERS_INITIAL_BATCH)

const visibleMembers = computed(() => store.currentMembers.slice(0, visibleMemberCount.value))
const hasMoreMembers = computed(() => visibleMemberCount.value < store.currentMembers.length)

let membersObserver: IntersectionObserver | null = null

function loadMoreMembers() {
  if (!hasMoreMembers.value) return
  visibleMemberCount.value = Math.min(
    store.currentMembers.length,
    visibleMemberCount.value + MEMBERS_BATCH_SIZE,
  )
}

function setupMembersObserver() {
  membersObserver?.disconnect()

  const el = membersSentinelRef.value
  if (!el) return

  membersObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        loadMoreMembers()
      }
    },
    { rootMargin: '300px 0px' },
  )

  membersObserver.observe(el)
}

const isOwner = computed(() => {
  const userId = pb.authStore.record?.id
  return store.currentGroup?.createdBy === userId
})

onMounted(async () => {
  await store.loadGroupDetail(groupId.value)

  // Subscribe to real-time goal updates
  const memberIds = store.currentMembers.map((m) => m.user)
  store.subscribeGroupGoals(memberIds)
  setupMembersObserver()
})

onUnmounted(() => {
  store.unsubscribeGroupGoals()
  membersObserver?.disconnect()
  membersObserver = null
})

// Re-load if route params change
watch(groupId, async (newId) => {
  store.unsubscribeGroupGoals()
  await store.loadGroupDetail(newId)
  visibleMemberCount.value = MEMBERS_INITIAL_BATCH
  const memberIds = store.currentMembers.map((m) => m.user)
  store.subscribeGroupGoals(memberIds)
  setupMembersObserver()
})

watch(
  () => store.currentMembers.length,
  () => {
    visibleMemberCount.value = MEMBERS_INITIAL_BATCH
  },
)

watch(membersSentinelRef, () => {
  setupMembersObserver()
})

async function copyInviteCode() {
  if (!store.currentGroup) return
  await navigator.clipboard.writeText(store.currentGroup.inviteCode)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

async function handleLeave() {
  if (!store.currentGroup) return
  if (isOwner.value) {
    await store.deleteGroup(store.currentGroup.id)
  } else {
    await store.leaveGroup(store.currentGroup.id)
  }
  router.push('/groups')
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6 px-3 pb-20 pt-3 sm:px-4 sm:pt-4 lg:px-8 lg:pb-8 lg:pt-8">
    <!-- Loading skeleton -->
    <div v-if="store.isLoading && !store.currentGroup" class="space-y-6">
      <Skeleton class="h-8 w-24" />
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-2">
          <Skeleton class="h-7 w-48" />
          <Skeleton class="h-4 w-64" />
        </div>
        <Skeleton class="h-6 w-20 rounded-full" />
      </div>
      <Card class="shadow-warm">
        <CardContent class="flex items-center justify-between py-3">
          <div class="space-y-1">
            <Skeleton class="h-3 w-16" />
            <Skeleton class="h-6 w-28" />
          </div>
          <Skeleton class="h-8 w-16 rounded-md" />
        </CardContent>
      </Card>
      <Separator />
      <div class="space-y-4">
        <Skeleton class="h-5 w-20" />
        <div
          v-for="i in 3"
          :key="i"
          class="flex items-center gap-3 rounded-lg border border-border p-4"
        >
          <Skeleton class="size-10 rounded-full" />
          <div class="space-y-1">
            <Skeleton class="h-4 w-24" />
            <Skeleton class="h-3 w-32" />
          </div>
        </div>
      </div>
    </div>

    <template v-else-if="store.currentGroup">
      <!-- Back + Header -->
      <div class="space-y-4">
        <Button variant="ghost" size="sm" class="-ml-2" @click="router.push('/groups')">
          <Icon icon="lucide:arrow-left" class="mr-1 h-4 w-4" />
          Back to Groups
        </Button>

        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <p class="text-sm font-medium uppercase tracking-[0.22em] text-primary/80">
              Group Space
            </p>
            <h1 class="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              {{ store.currentGroup.name }}
            </h1>
            <p v-if="store.currentGroup.description" class="text-sm text-muted-foreground">
              {{ store.currentGroup.description }}
            </p>
          </div>
          <Badge variant="secondary" class="shrink-0">
            {{ store.currentMembers.length }} member{{
              store.currentMembers.length !== 1 ? 's' : ''
            }}
          </Badge>
        </div>

        <!-- Invite code -->
        <Card class="rounded-[1.8rem] shadow-warm-lg">
          <CardContent class="flex items-center justify-between py-3">
            <div class="space-y-0.5">
              <p class="text-xs text-muted-foreground">Invite Code</p>
              <p class="font-mono text-lg tracking-widest font-medium">
                {{ store.currentGroup.inviteCode }}
              </p>
            </div>
            <Button variant="outline" size="sm" @click="copyInviteCode">
              <Icon :icon="copied ? 'lucide:check' : 'lucide:copy'" class="mr-1 h-3.5 w-3.5" />
              {{ copied ? 'Copied' : 'Copy' }}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator class="opacity-50" />

      <!-- Members section -->
      <div class="space-y-4">
        <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Members</h3>
        <div class="space-y-6">
          <MemberGoalsList
            v-for="member in visibleMembers"
            :key="member.id"
            :member="member"
            :goals="store.currentGoals"
          />

          <div ref="membersSentinelRef" class="h-2" aria-hidden="true" />

          <div v-if="hasMoreMembers" class="flex justify-center">
            <Button variant="outline" @click="loadMoreMembers">Load more members</Button>
          </div>
        </div>
      </div>

      <Separator class="opacity-50" />

      <!-- Leave / Delete -->
      <div class="flex justify-end">
        <template v-if="!showLeaveConfirm">
          <Button variant="outline" class="text-destructive" @click="showLeaveConfirm = true">
            <Icon :icon="isOwner ? 'lucide:trash-2' : 'lucide:log-out'" class="mr-1 h-3.5 w-3.5" />
            {{ isOwner ? 'Delete Group' : 'Leave Group' }}
          </Button>
        </template>
        <div v-else class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">Are you sure?</span>
          <Button variant="outline" size="sm" @click="showLeaveConfirm = false">Cancel</Button>
          <Button variant="destructive" size="sm" @click="handleLeave">
            {{ isOwner ? 'Delete' : 'Leave' }}
          </Button>
        </div>
      </div>
    </template>

    <!-- Not found -->
    <div
      v-else
      class="flex flex-col items-center justify-center rounded-[1.8rem] border border-dashed border-border bg-card/50 py-16 text-center"
    >
      <Icon icon="lucide:alert-circle" class="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 class="text-lg font-medium">Group not found</h3>
      <p class="text-sm text-muted-foreground mt-1 mb-4">
        This group may have been deleted or you don't have access.
      </p>
      <Button variant="outline" @click="router.push('/groups')">
        <Icon icon="lucide:arrow-left" class="mr-2 h-4 w-4" />
        Back to Groups
      </Button>
    </div>
  </div>
</template>
