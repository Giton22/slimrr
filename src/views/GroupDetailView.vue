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
import MemberGoalsList from '@/components/groups/MemberGoalsList.vue'

const route = useRoute()
const router = useRouter()
const store = useGroupsStore()

const groupId = computed(() => route.params.id as string)
const copied = ref(false)
const showLeaveConfirm = ref(false)

const isOwner = computed(() => {
  const userId = pb.authStore.record?.id
  return store.currentGroup?.createdBy === userId
})

onMounted(async () => {
  await store.loadGroupDetail(groupId.value)

  // Subscribe to real-time goal updates
  const memberIds = store.currentMembers.map((m) => m.user)
  store.subscribeGroupGoals(memberIds)
})

onUnmounted(() => {
  store.unsubscribeGroupGoals()
})

// Re-load if route params change
watch(groupId, async (newId) => {
  store.unsubscribeGroupGoals()
  await store.loadGroupDetail(newId)
  const memberIds = store.currentMembers.map((m) => m.user)
  store.subscribeGroupGoals(memberIds)
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
  <div class="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">
    <!-- Loading -->
    <div v-if="store.isLoading && !store.currentGroup" class="flex items-center justify-center py-12">
      <Icon icon="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
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
            <h2 class="text-2xl font-bold tracking-tight">{{ store.currentGroup.name }}</h2>
            <p v-if="store.currentGroup.description" class="text-sm text-muted-foreground">
              {{ store.currentGroup.description }}
            </p>
          </div>
          <Badge variant="secondary" class="shrink-0">
            {{ store.currentMembers.length }} member{{ store.currentMembers.length !== 1 ? 's' : '' }}
          </Badge>
        </div>

        <!-- Invite code -->
        <Card>
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

      <Separator />

      <!-- Members section -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Members</h3>
        <div class="space-y-6">
          <MemberGoalsList
            v-for="member in store.currentMembers"
            :key="member.id"
            :member="member"
            :goals="store.currentGoals"
          />
        </div>
      </div>

      <Separator />

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
    <div v-else class="flex flex-col items-center justify-center py-16 text-center">
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
