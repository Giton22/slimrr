import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Goal, Group, GroupMember } from '@/types'
import { pb, COLLECTIONS } from '@/lib/pocketbase'
import type { GoalRecord, GroupMemberRecord, GroupRecord } from '@/lib/pocketbase'

// ── Record → domain type mappers ──

function toGroup(r: GroupRecord): Group {
  return {
    id: r.id,
    name: r.name,
    description: r.description || undefined,
    inviteCode: r.invite_code,
    createdBy: r.created_by,
  }
}

function toGroupMember(r: GroupMemberRecord): GroupMember {
  const member: GroupMember = {
    id: r.id,
    group: r.group,
    user: r.user,
    role: r.role,
  }
  if ((r as any).expand?.user) {
    member.expand = { user: (r as any).expand.user }
  }
  return member
}

function toGoal(r: GoalRecord): Goal {
  return {
    id: r.id,
    user: r.user,
    title: r.title,
    description: r.description || undefined,
    targetValue: r.target_value || undefined,
    currentValue: r.current_value || 0,
    unit: r.unit || undefined,
    visibility: r.visibility,
    status: r.status,
    dueDate: r.due_date || undefined,
    updated: r.updated,
  }
}

// ── Invite code generator ──

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// ── Store ──

export const useGroupsStore = defineStore('groups', () => {
  const myGroups = ref<Group[]>([])
  const currentGroup = ref<Group | null>(null)
  const currentMembers = ref<GroupMember[]>([])
  const currentGoals = ref<Goal[]>([])
  const isLoading = ref(false)

  // Cached weight goal record ID for the current user
  let weightGoalId: string | null = null

  // ── Data loading ──

  async function loadMyGroups() {
    const userId = pb.authStore.record?.id
    if (!userId) return

    isLoading.value = true
    try {
      const memberRecords = await pb.collection<GroupMemberRecord>(COLLECTIONS.GROUP_MEMBERS).getFullList({
        filter: `user = "${userId}"`,
        expand: 'group',
      })

      myGroups.value = memberRecords
        .map((r) => {
          const expanded = (r as any).expand?.group
          return expanded ? toGroup(expanded) : null
        })
        .filter((g): g is Group => g !== null)
    } finally {
      isLoading.value = false
    }
  }

  async function loadGroupDetail(groupId: string) {
    isLoading.value = true
    try {
      // Fetch group
      const groupRec = await pb.collection<GroupRecord>(COLLECTIONS.GROUPS).getOne(groupId)
      currentGroup.value = toGroup(groupRec)

      // Fetch members with user expand
      const memberRecords = await pb.collection<GroupMemberRecord>(COLLECTIONS.GROUP_MEMBERS).getFullList({
        filter: `group = "${groupId}"`,
        expand: 'user',
      })
      currentMembers.value = memberRecords.map(toGroupMember)

      // Fetch group-visible goals for all members
      const memberIds = currentMembers.value.map((m) => m.user)
      if (memberIds.length > 0) {
        const userFilter = memberIds.map((id) => `user = "${id}"`).join(' || ')
        const goalRecords = await pb.collection<GoalRecord>(COLLECTIONS.GOALS).getFullList({
          filter: `(${userFilter}) && visibility != "private"`,
          sort: '-updated',
        })
        currentGoals.value = goalRecords.map(toGoal)
      } else {
        currentGoals.value = []
      }
    } finally {
      isLoading.value = false
    }
  }

  // ── Group actions ──

  async function createGroup(name: string, description?: string) {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const inviteCode = generateInviteCode()

    const groupRec = await pb.collection<GroupRecord>(COLLECTIONS.GROUPS).create({
      name,
      description: description ?? '',
      invite_code: inviteCode,
      created_by: userId,
    })

    await pb.collection(COLLECTIONS.GROUP_MEMBERS).create({
      group: groupRec.id,
      user: userId,
      role: 'owner',
    })

    myGroups.value.push(toGroup(groupRec))
    return toGroup(groupRec)
  }

  async function joinGroup(code: string): Promise<Group> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Not authenticated')

    const groupRec = await pb.collection<GroupRecord>(COLLECTIONS.GROUPS).getFirstListItem(
      `invite_code = "${code.toUpperCase()}"`,
    )

    // Check if already a member
    try {
      await pb.collection(COLLECTIONS.GROUP_MEMBERS).getFirstListItem(
        `group = "${groupRec.id}" && user = "${userId}"`,
      )
      throw new Error('You are already a member of this group')
    } catch (e: any) {
      if (e.message === 'You are already a member of this group') throw e
      // 404 means not a member yet — continue
    }

    await pb.collection(COLLECTIONS.GROUP_MEMBERS).create({
      group: groupRec.id,
      user: userId,
      role: 'member',
    })

    const group = toGroup(groupRec)
    myGroups.value.push(group)
    return group
  }

  async function leaveGroup(groupId: string) {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const membership = await pb.collection<GroupMemberRecord>(COLLECTIONS.GROUP_MEMBERS).getFirstListItem(
      `group = "${groupId}" && user = "${userId}"`,
    )
    await pb.collection(COLLECTIONS.GROUP_MEMBERS).delete(membership.id)
    myGroups.value = myGroups.value.filter((g) => g.id !== groupId)

    if (currentGroup.value?.id === groupId) {
      currentGroup.value = null
      currentMembers.value = []
      currentGoals.value = []
    }
  }

  async function deleteGroup(groupId: string) {
    await pb.collection(COLLECTIONS.GROUPS).delete(groupId)
    myGroups.value = myGroups.value.filter((g) => g.id !== groupId)

    if (currentGroup.value?.id === groupId) {
      currentGroup.value = null
      currentMembers.value = []
      currentGoals.value = []
    }
  }

  // ── Auto weight goal sync ──

  async function syncWeightGoal(currentWeightKg: number, goalWeightKg: number, unit: 'kg' | 'lbs', direction?: 'loss' | 'gain') {
    const userId = pb.authStore.record?.id
    if (!userId || !goalWeightKg || !currentWeightKg) return

    const toDisplay = (kg: number) =>
      unit === 'lbs' ? Math.round(kg * 2.20462 * 10) / 10 : kg

    try {
      if (!weightGoalId) {
        // Try to find existing weight goal
        try {
          const existing = await pb.collection<GoalRecord>(COLLECTIONS.GOALS).getFirstListItem(
            `user = "${userId}" && title = "Weight Goal"`,
          )
          weightGoalId = existing.id
        } catch {
          // No existing goal — will create below
        }
      }

      const payload = {
        user: userId,
        title: 'Weight Goal',
        description: direction || '', // store goal direction (loss/gain)
        target_value: toDisplay(goalWeightKg),
        current_value: toDisplay(currentWeightKg),
        unit,
        visibility: 'group',
        status: 'active' as const,
        due_date: '',
      }

      if (weightGoalId) {
        const rec = await pb.collection<GoalRecord>(COLLECTIONS.GOALS).update(weightGoalId, payload)
        const updated = toGoal(rec)
        const idx = currentGoals.value.findIndex((g) => g.id === weightGoalId)
        if (idx !== -1) currentGoals.value[idx] = updated
      } else {
        const rec = await pb.collection<GoalRecord>(COLLECTIONS.GOALS).create(payload)
        weightGoalId = rec.id
        const goal = toGoal(rec)
        if (!currentGoals.value.some((g) => g.id === goal.id)) {
          currentGoals.value.unshift(goal)
        }
      }
    } catch (e) {
      console.warn('[syncWeightGoal] Failed:', e)
    }
  }

  // ── Realtime subscriptions (for group detail view) ──

  function subscribeGroupGoals(memberIds: string[]) {
    if (memberIds.length === 0) return

    const userFilter = memberIds.map((id) => `user = "${id}"`).join(' || ')

    pb.collection<GoalRecord>(COLLECTIONS.GOALS).subscribe('*', (e) => {
      if (e.record.visibility === 'private') return

      if (e.action === 'create') {
        if (!currentGoals.value.some((g) => g.id === e.record.id)) {
          currentGoals.value.unshift(toGoal(e.record))
        }
      } else if (e.action === 'update') {
        const idx = currentGoals.value.findIndex((g) => g.id === e.record.id)
        if (idx !== -1) {
          if (e.record.visibility === 'private') {
            currentGoals.value.splice(idx, 1)
          } else {
            currentGoals.value[idx] = toGoal(e.record)
          }
        } else if (e.record.visibility !== 'private') {
          currentGoals.value.unshift(toGoal(e.record))
        }
      } else if (e.action === 'delete') {
        currentGoals.value = currentGoals.value.filter((g) => g.id !== e.record.id)
      }
    }, { filter: `(${userFilter}) && visibility != "private"` })
  }

  function unsubscribeGroupGoals() {
    pb.collection(COLLECTIONS.GOALS).unsubscribe('*')
  }

  // ── Lifecycle ──

  function reset() {
    unsubscribeGroupGoals()
    myGroups.value = []
    currentGroup.value = null
    currentMembers.value = []
    currentGoals.value = []
    weightGoalId = null
  }

  return {
    // State
    myGroups,
    currentGroup,
    currentMembers,
    currentGoals,
    isLoading,
    // Group actions
    loadMyGroups,
    loadGroupDetail,
    createGroup,
    joinGroup,
    leaveGroup,
    deleteGroup,
    // Weight goal
    syncWeightGoal,
    // Realtime
    subscribeGroupGoals,
    unsubscribeGroupGoals,
    // Lifecycle
    reset,
  }
})
