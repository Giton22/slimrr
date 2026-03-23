import { Effect } from 'effect'
import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Goal, Group, GroupMember } from '@/types'
import { fromPbPromise, runPb } from '@/lib/effect'
import { pb, COLLECTIONS } from '@/lib/pocketbase'
import { kgToLbs } from '@/composables/useUnits'
import type {
  GoalRecord,
  GroupMemberRecord,
  GroupRecord,
  GroupMemberWithUserExpand,
  GroupMemberWithGroupExpand,
} from '@/lib/pocketbase'

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

function toGroupMember(r: GroupMemberWithUserExpand): GroupMember {
  const member: GroupMember = {
    id: r.id,
    group: r.group,
    user: r.user,
    role: r.role,
  }
  if (r.expand?.user) {
    member.expand = { user: r.expand.user }
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
      const memberRecords = await runPb(
        fromPbPromise(
          (pb) =>
            pb.collection<GroupMemberWithGroupExpand>(COLLECTIONS.GROUP_MEMBERS).getFullList({
              filter: pb.filter('user = {:userId}', { userId }),
              expand: 'group',
            }),
          COLLECTIONS.GROUP_MEMBERS,
        ),
      )

      myGroups.value = memberRecords
        .map((r) => {
          const expanded = r.expand?.group
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
      const [groupRec, memberRecords] = await Promise.all([
        runPb(
          fromPbPromise(
            (pb) => pb.collection<GroupRecord>(COLLECTIONS.GROUPS).getOne(groupId),
            COLLECTIONS.GROUPS,
          ),
        ),
        runPb(
          fromPbPromise(
            (pb) =>
              pb.collection<GroupMemberWithUserExpand>(COLLECTIONS.GROUP_MEMBERS).getFullList({
                filter: pb.filter('group = {:groupId}', { groupId }),
                expand: 'user',
              }),
            COLLECTIONS.GROUP_MEMBERS,
          ),
        ),
      ])
      currentGroup.value = toGroup(groupRec)
      currentMembers.value = memberRecords.map(toGroupMember)

      // Fetch group-visible goals for all members
      const memberIds = currentMembers.value.map((m) => m.user)
      if (memberIds.length > 0) {
        const conditions = memberIds.map((_, i) => `user = {:uid${i}}`)
        const params: Record<string, string> = Object.fromEntries(
          memberIds.map((id, i) => [`uid${i}`, id]),
        )
        const goalRecords = await runPb(
          fromPbPromise(
            (pb) =>
              pb.collection<GoalRecord>(COLLECTIONS.GOALS).getFullList({
                filter: pb.filter(
                  `(${conditions.join(' || ')}) && visibility != "private"`,
                  params,
                ),
                sort: '-updated',
              }),
            COLLECTIONS.GOALS,
          ),
        )
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

    const groupRec = await runPb(
      fromPbPromise(
        (pb) =>
          pb.collection<GroupRecord>(COLLECTIONS.GROUPS).create({
            name,
            description: description ?? '',
            invite_code: inviteCode,
            created_by: userId,
          }),
        COLLECTIONS.GROUPS,
      ),
    )

    await runPb(
      fromPbPromise(
        (pb) =>
          pb.collection(COLLECTIONS.GROUP_MEMBERS).create({
            group: groupRec.id,
            user: userId,
            role: 'owner',
          }),
        COLLECTIONS.GROUP_MEMBERS,
      ),
    )

    myGroups.value.push(toGroup(groupRec))
    return toGroup(groupRec)
  }

  async function joinGroup(code: string): Promise<Group> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Not authenticated')

    const groupRec = await runPb(
      fromPbPromise(
        (pb) =>
          pb
            .collection<GroupRecord>(COLLECTIONS.GROUPS)
            .getFirstListItem(pb.filter('invite_code = {:code}', { code: code.toUpperCase() })),
        COLLECTIONS.GROUPS,
      ),
    )

    // Check if already a member
    const existingMembership = await runPb(
      fromPbPromise(
        (pb) =>
          pb
            .collection(COLLECTIONS.GROUP_MEMBERS)
            .getFirstListItem(
              pb.filter('group = {:groupId} && user = {:userId}', { groupId: groupRec.id, userId }),
            ),
        COLLECTIONS.GROUP_MEMBERS,
      ).pipe(
        Effect.map(() => true),
        Effect.catchTag('NotFoundError', () => Effect.succeed(false)),
      ),
    )
    if (existingMembership) {
      throw new Error('You are already a member of this group')
    }

    await runPb(
      fromPbPromise(
        (pb) =>
          pb.collection(COLLECTIONS.GROUP_MEMBERS).create({
            group: groupRec.id,
            user: userId,
            role: 'member',
          }),
        COLLECTIONS.GROUP_MEMBERS,
      ),
    )

    const group = toGroup(groupRec)
    myGroups.value.push(group)
    return group
  }

  async function leaveGroup(groupId: string) {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const membership = await runPb(
      fromPbPromise(
        (pb) =>
          pb
            .collection<GroupMemberRecord>(COLLECTIONS.GROUP_MEMBERS)
            .getFirstListItem(
              pb.filter('group = {:groupId} && user = {:userId}', { groupId, userId }),
            ),
        COLLECTIONS.GROUP_MEMBERS,
      ),
    )
    await runPb(
      fromPbPromise(
        (pb) => pb.collection(COLLECTIONS.GROUP_MEMBERS).delete(membership.id),
        COLLECTIONS.GROUP_MEMBERS,
      ),
    )
    myGroups.value = myGroups.value.filter((g) => g.id !== groupId)

    if (currentGroup.value?.id === groupId) {
      currentGroup.value = null
      currentMembers.value = []
      currentGoals.value = []
    }
  }

  async function deleteGroup(groupId: string) {
    await runPb(
      fromPbPromise((pb) => pb.collection(COLLECTIONS.GROUPS).delete(groupId), COLLECTIONS.GROUPS),
    )
    myGroups.value = myGroups.value.filter((g) => g.id !== groupId)

    if (currentGroup.value?.id === groupId) {
      currentGroup.value = null
      currentMembers.value = []
      currentGoals.value = []
    }
  }

  // ── Auto weight goal sync ──

  async function syncWeightGoal(
    currentWeightKg: number,
    goalWeightKg: number,
    unit: 'kg' | 'lbs',
    direction?: 'loss' | 'gain',
  ) {
    const userId = pb.authStore.record?.id
    if (!userId || !goalWeightKg || !currentWeightKg) return

    const toDisplay = (kg: number) => (unit === 'lbs' ? kgToLbs(kg) : kg)

    try {
      if (!weightGoalId) {
        const existing = await runPb(
          fromPbPromise(
            (pb) =>
              pb.collection<GoalRecord>(COLLECTIONS.GOALS).getFirstListItem(
                pb.filter('user = {:userId} && title = {:title}', {
                  userId,
                  title: 'Weight Goal',
                }),
              ),
            COLLECTIONS.GOALS,
          ).pipe(Effect.catchTag('NotFoundError', () => Effect.succeed(null))),
        )
        weightGoalId = existing?.id ?? null
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
        const updatedGoal = await runPb(
          fromPbPromise(
            (pb) => pb.collection<GoalRecord>(COLLECTIONS.GOALS).update(weightGoalId!, payload),
            COLLECTIONS.GOALS,
          ).pipe(
            Effect.map((rec) => ({ kind: 'updated' as const, rec })),
            Effect.catchTag('NotFoundError', () => Effect.succeed({ kind: 'missing' as const })),
          ),
        )

        if (updatedGoal.kind === 'updated') {
          const updated = toGoal(updatedGoal.rec)
          const idx = currentGoals.value.findIndex((g) => g.id === weightGoalId)
          if (idx !== -1) currentGoals.value[idx] = updated
          return
        }

        currentGoals.value = currentGoals.value.filter((g) => g.id !== weightGoalId)
        weightGoalId = null
      }

      const rec = await runPb(
        fromPbPromise(
          (pb) => pb.collection<GoalRecord>(COLLECTIONS.GOALS).create(payload),
          COLLECTIONS.GOALS,
        ),
      )
      weightGoalId = rec.id
      const goal = toGoal(rec)
      currentGoals.value = [goal, ...currentGoals.value.filter((g) => g.id !== goal.id)]
    } catch (e) {
      console.warn('[syncWeightGoal] Failed:', e)
    }
  }

  // ── Realtime subscriptions (for group detail view) ──

  function subscribeGroupGoals(memberIds: string[]) {
    if (memberIds.length === 0) return

    const conditions = memberIds.map((_, i) => `user = {:uid${i}}`)
    const params: Record<string, string> = Object.fromEntries(
      memberIds.map((id, i) => [`uid${i}`, id]),
    )

    void pb.collection<GoalRecord>(COLLECTIONS.GOALS).subscribe(
      '*',
      (e) => {
        // The server filter excludes private goals, but visibility can change
        // in an update event — cast to string for the defensive check.
        const visibility = e.record.visibility as string
        if (visibility === 'private') return

        if (e.action === 'create') {
          if (!currentGoals.value.some((g) => g.id === e.record.id)) {
            currentGoals.value.unshift(toGoal(e.record))
          }
        } else if (e.action === 'update') {
          const idx = currentGoals.value.findIndex((g) => g.id === e.record.id)
          if (idx !== -1) {
            currentGoals.value[idx] = toGoal(e.record)
          } else {
            currentGoals.value.unshift(toGoal(e.record))
          }
        } else if (e.action === 'delete') {
          currentGoals.value = currentGoals.value.filter((g) => g.id !== e.record.id)
        }
      },
      { filter: pb.filter(`(${conditions.join(' || ')}) && visibility != "private"`, params) },
    )
  }

  function unsubscribeGroupGoals() {
    void pb.collection(COLLECTIONS.GOALS).unsubscribe('*')
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
