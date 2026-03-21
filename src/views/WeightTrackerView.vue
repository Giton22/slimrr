<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useWeightStore } from '@/stores/weight'
import { useUnits } from '@/composables/useUnits'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import GoalProgressBar from '@/components/dashboard/GoalProgressBar.vue'
import WeightChart from '@/components/dashboard/WeightChart.vue'
import TimeRangeSelect from '@/components/dashboard/TimeRangeSelect.vue'
import AverageModeToggle from '@/components/dashboard/AverageModeToggle.vue'
import LogWeightDialog from '@/components/dashboard/LogWeightDialog.vue'
import EditWeightDialog from '@/components/dashboard/EditWeightDialog.vue'
import type { WeightEntry } from '@/types'
import WeightTrackerSkeleton from '@/components/dashboard/skeletons/WeightTrackerSkeleton.vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  formatRecentLogDisplayDiff,
  getDeleteWeightEntryDescription,
  getRecentLogChangeClass,
  getRecentLogDisplayDiff,
} from '@/views/weightTrackerRecentLogs'

const store = useWeightStore()
const { format, convert, isKg } = useUnits()

const logDialogOpen = ref(false)
const editDialogOpen = ref(false)
const editingEntry = ref<WeightEntry | null>(null)
const deleteDialogOpen = ref(false)
const deleteTarget = ref<WeightEntry | null>(null)
const isDeleting = ref(false)
const feedbackMessage = ref('')
let feedbackTimeout: ReturnType<typeof setTimeout> | null = null

function openEdit(entry: WeightEntry) {
  editingEntry.value = entry
  editDialogOpen.value = true
}

function setFeedbackMessage(message: string) {
  feedbackMessage.value = message
  if (feedbackTimeout) clearTimeout(feedbackTimeout)
  feedbackTimeout = setTimeout(() => {
    feedbackMessage.value = ''
  }, 3000)
}

const trendText = computed(() => {
  if (store.weightTrend === null) return null
  const sign = store.weightTrend > 0 ? '+' : ''
  return `${sign}${convert(store.weightTrend)} ${store.settings.unit}`
})

const recentEntries = computed(() => store.filteredEntries.slice(-10).reverse())

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getChange(index: number): string | null {
  const entries = recentEntries.value
  if (index >= entries.length - 1) return null
  const diff = getRecentLogDisplayDiff(
    entries[index]!.weightKg,
    entries[index + 1]!.weightKg,
    isKg.value ? 'kg' : 'lbs',
  )
  return formatRecentLogDisplayDiff(diff, isKg.value ? 'kg' : 'lbs')
}

function getChangeClass(index: number): string {
  const entries = recentEntries.value
  if (index >= entries.length - 1) return ''
  const diff = getRecentLogDisplayDiff(
    entries[index]!.weightKg,
    entries[index + 1]!.weightKg,
    isKg.value ? 'kg' : 'lbs',
  )
  const direction = store.settings.goalDirection ?? 'loss'
  return getRecentLogChangeClass(diff, direction)
}

function confirmDelete(entry: WeightEntry) {
  deleteTarget.value = entry
  deleteDialogOpen.value = true
}

async function executeDelete() {
  if (!deleteTarget.value || isDeleting.value) return

  isDeleting.value = true
  try {
    const deletedDate = formatDate(deleteTarget.value.date)
    await store.deleteEntry(deleteTarget.value.id)
    setFeedbackMessage(`Deleted the entry for ${deletedDate}.`)
    deleteDialogOpen.value = false
    deleteTarget.value = null
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="min-h-full px-3 pb-20 pt-3 sm:px-4 sm:pt-4 lg:px-8 lg:pb-8 lg:pt-8">
    <div class="mx-auto max-w-7xl space-y-5 lg:space-y-7">
      <div>
        <p class="text-sm font-medium uppercase tracking-[0.22em] text-primary/80">
          Progress Tracking
        </p>
        <h1 class="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">Weight</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          Consistent tracking is the key to achieving your fitness goals.
        </p>
      </div>

      <!-- Skeleton loading state -->
      <WeightTrackerSkeleton v-if="!store.isSynced" />

      <!-- Hero: current weight + log button -->
      <Card v-if="store.isSynced" class="animate-card-enter rounded-[1.8rem] shadow-warm-lg">
        <CardContent
          class="flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p class="text-sm font-medium text-muted-foreground">Current Weight</p>
            <p class="mt-1 text-4xl font-bold tracking-tight">
              {{ store.currentWeight !== null ? format(store.currentWeight) : '—' }}
            </p>
            <div
              v-if="trendText"
              class="mt-2 flex items-center gap-1 text-sm font-semibold text-primary"
            >
              <Icon icon="lucide:trending-down" class="size-4" />
              {{ trendText }} this week
            </div>
            <div v-if="store.settings.goalWeightKg" class="mt-2">
              <div class="h-1 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full bg-primary"
                  :style="{
                    width:
                      store.currentWeight && store.settings.goalWeightKg
                        ? `${Math.min(100, Math.max(5, 100 - ((store.currentWeight - store.settings.goalWeightKg) / store.currentWeight) * 100))}%`
                        : '0%',
                  }"
                />
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                Goal: {{ format(store.settings.goalWeightKg) }}
                <span v-if="store.currentWeight">
                  ({{ format(Math.abs(store.currentWeight - store.settings.goalWeightKg)) }} to go)
                </span>
              </p>
            </div>
            <p v-else class="mt-2 text-xs text-muted-foreground">
              Set a goal weight in Profile to unlock progress coaching.
            </p>
          </div>
          <Button size="lg" class="gap-2 text-base font-bold" @click="logDialogOpen = true">
            <Icon icon="lucide:plus" class="size-5" />
            Log New Weight
          </Button>
        </CardContent>
      </Card>

      <div
        v-if="feedbackMessage"
        class="rounded-[1.4rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300"
      >
        {{ feedbackMessage }}
      </div>

      <!-- Grid: Goal Progress + Chart -->
      <div v-if="store.isSynced" class="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <!-- Goal Progress (desktop sidebar) -->
        <Card
          class="animate-card-enter rounded-[1.8rem] shadow-warm-lg lg:col-span-1"
          style="animation-delay: 50ms"
        >
          <CardContent class="pt-6">
            <h3 class="mb-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Current Goal Progress
            </h3>
            <div class="mb-2 flex items-baseline gap-2">
              <span class="text-5xl font-black">
                {{ store.currentWeight !== null ? convert(store.currentWeight) : '—' }}
              </span>
              <span class="text-xl font-medium text-muted-foreground">{{
                store.settings.unit
              }}</span>
            </div>
            <GoalProgressBar v-if="store.settings.goalWeightKg" class="mt-6" />
            <p v-else class="mt-6 text-sm text-muted-foreground">
              Add a goal weight in Profile to see how far you have left to go.
            </p>
          </CardContent>
        </Card>

        <!-- Weight Chart -->
        <Card
          class="animate-card-enter rounded-[1.8rem] shadow-warm-lg lg:col-span-2"
          style="animation-delay: 100ms"
        >
          <CardContent class="pt-6">
            <div class="mb-6 flex flex-wrap items-center justify-between gap-2">
              <h3 class="font-bold">Weight Progress</h3>
              <div class="flex flex-wrap items-center gap-2">
                <AverageModeToggle />
                <TimeRangeSelect target="weight" />
              </div>
            </div>
            <WeightChart />
          </CardContent>
        </Card>
      </div>

      <!-- Recent Logs Table -->
      <Card
        v-if="store.isSynced"
        class="animate-card-enter rounded-[1.8rem] shadow-warm-lg"
        style="animation-delay: 150ms"
      >
        <CardContent class="pt-6">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="font-bold">Recent Logs</h3>
          </div>

          <div
            v-if="recentEntries.length === 0"
            class="py-12 text-center text-sm text-muted-foreground"
          >
            <Icon icon="lucide:scale" class="mx-auto mb-2 size-10 opacity-30" />
            <p class="font-semibold text-foreground">No weight entries yet.</p>
            <p class="mt-2">Log your first weight to start seeing trends and goal progress.</p>
            <Button class="mt-4 gap-2" @click="logDialogOpen = true">
              <Icon icon="lucide:plus" class="size-4" />
              Log First Weight
            </Button>
          </div>

          <!-- Mobile: card list -->
          <div class="space-y-2 lg:hidden">
            <div
              v-for="(entry, i) in recentEntries"
              :key="entry.id"
              class="flex items-center justify-between rounded-xl border border-border/50 bg-card p-4"
            >
              <div class="flex items-center gap-3">
                <div
                  class="flex size-10 items-center justify-center rounded-full"
                  :class="i === 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
                >
                  <Icon icon="lucide:scale" class="size-5" />
                </div>
                <div>
                  <p class="text-sm font-bold">{{ format(entry.weightKg) }}</p>
                  <p class="text-xs text-muted-foreground">{{ formatDate(entry.date) }}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Icon
                  v-if="entry.note"
                  icon="lucide:sticky-note"
                  class="size-3.5 text-muted-foreground"
                />
                <Button variant="ghost" size="icon" class="size-8" @click="openEdit(entry)">
                  <Icon icon="lucide:pencil" class="size-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>

          <!-- Desktop: table -->
          <div class="hidden overflow-x-auto lg:block">
            <table class="w-full text-left">
              <thead>
                <tr
                  class="border-b bg-muted/30 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  <th class="px-6 py-4">Date</th>
                  <th class="px-6 py-4">Weight</th>
                  <th class="px-6 py-4">Change</th>
                  <th class="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr
                  v-for="(entry, i) in recentEntries"
                  :key="entry.id"
                  class="transition-colors hover:bg-muted/30"
                >
                  <td class="px-6 py-4">
                    <span class="text-sm font-bold">{{ formatDate(entry.date) }}</span>
                  </td>
                  <td class="px-6 py-4 text-sm font-medium">{{ format(entry.weightKg) }}</td>
                  <td class="px-6 py-4">
                    <span
                      v-if="getChange(i)"
                      class="rounded px-2 py-1 text-xs font-bold"
                      :class="getChangeClass(i)"
                    >
                      {{ getChange(i) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" class="size-8" @click="openEdit(entry)">
                        <Icon
                          icon="lucide:pencil"
                          class="size-4 text-muted-foreground hover:text-primary"
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="size-8"
                        @click="confirmDelete(entry)"
                      >
                        <Icon
                          icon="lucide:trash-2"
                          class="size-4 text-muted-foreground hover:text-destructive"
                        />
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>

    <LogWeightDialog v-model:open="logDialogOpen" hide-trigger />
    <EditWeightDialog v-model:open="editDialogOpen" :entry="editingEntry" />
    <Dialog :open="deleteDialogOpen" @update:open="deleteDialogOpen = $event">
      <DialogContent class="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Delete Entry</DialogTitle>
          <DialogDescription v-if="deleteTarget">
            {{ getDeleteWeightEntryDescription(formatDate(deleteTarget.date)) }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="isDeleting" @click="deleteDialogOpen = false">
            Cancel
          </Button>
          <Button variant="destructive" :disabled="isDeleting" @click="executeDelete">
            <Icon v-if="isDeleting" icon="lucide:loader-circle" class="mr-2 size-4 animate-spin" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
