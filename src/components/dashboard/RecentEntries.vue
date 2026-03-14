<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { WeightEntry } from '@/types'
import { useWeightStore } from '@/stores/weight'
import { useUnits } from '@/composables/useUnits'
import { formatDateShort } from '@/lib/date'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import EditWeightDialog from '@/components/dashboard/EditWeightDialog.vue'

const store = useWeightStore()
const { format } = useUnits()

const entries = computed(() => [...store.filteredEntries].reverse())

const scrollContainerRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const containerHeight = ref(500)

const ROW_HEIGHT = 52
const OVERSCAN = 8
const VIRTUALIZATION_THRESHOLD = 120

const useVirtualRows = computed(() => entries.value.length > VIRTUALIZATION_THRESHOLD)

const visibleCount = computed(() => {
  if (!useVirtualRows.value) return entries.value.length
  return Math.ceil(containerHeight.value / ROW_HEIGHT) + OVERSCAN * 2
})

const startIndex = computed(() => {
  if (!useVirtualRows.value) return 0
  const firstVisibleIndex = Math.floor(scrollTop.value / ROW_HEIGHT)
  return Math.max(0, firstVisibleIndex - OVERSCAN)
})

const endIndex = computed(() => {
  if (!useVirtualRows.value) return entries.value.length
  return Math.min(entries.value.length, startIndex.value + visibleCount.value)
})

const visibleEntries = computed(() => {
  if (!useVirtualRows.value) return entries.value
  return entries.value.slice(startIndex.value, endIndex.value)
})

const topSpacerHeight = computed(() => {
  if (!useVirtualRows.value) return 0
  return startIndex.value * ROW_HEIGHT
})

const bottomSpacerHeight = computed(() => {
  if (!useVirtualRows.value) return 0
  return Math.max(0, (entries.value.length - endIndex.value) * ROW_HEIGHT)
})

function measureContainer() {
  const el = scrollContainerRef.value
  if (!el) return
  containerHeight.value = el.clientHeight
}

function onScroll() {
  const el = scrollContainerRef.value
  if (!el) return
  scrollTop.value = el.scrollTop
}

onMounted(() => {
  measureContainer()
  window.addEventListener('resize', measureContainer)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', measureContainer)
})

// Edit state
const editEntry = ref<WeightEntry | null>(null)
const editOpen = ref(false)

function openEdit(entry: WeightEntry) {
  editEntry.value = entry
  editOpen.value = true
}

// Delete confirmation state
const deleteTarget = ref<WeightEntry | null>(null)
const deleteOpen = ref(false)

function confirmDelete(entry: WeightEntry) {
  deleteTarget.value = entry
  deleteOpen.value = true
}

async function executeDelete() {
  if (!deleteTarget.value) return
  await store.deleteEntry(deleteTarget.value.id)
  deleteOpen.value = false
  deleteTarget.value = null
}
</script>

<template>
  <div
    ref="scrollContainerRef"
    class="max-h-[500px] overflow-auto rounded-lg border border-border"
    @scroll="onScroll"
  >
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Weight</TableHead>
          <TableHead>Note</TableHead>
          <TableHead class="w-[80px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="entries.length === 0">
          <TableCell colspan="4" class="py-12 text-center">
            <div class="flex flex-col items-center gap-2">
              <Icon
                icon="lucide:scale"
                class="h-12 w-12 text-muted-foreground/25 animate-gentle-bob"
              />
              <p class="text-sm font-medium text-foreground/70">No weight entries yet</p>
              <p class="text-xs text-muted-foreground">Log your first weight to start tracking</p>
            </div>
          </TableCell>
        </TableRow>
        <TableRow v-else-if="topSpacerHeight > 0" aria-hidden="true">
          <TableCell
            :style="{ height: `${topSpacerHeight}px`, padding: 0, border: 'none' }"
            colspan="4"
          />
        </TableRow>
        <TableRow
          v-for="entry in visibleEntries"
          :key="entry.id"
          class="transition-colors duration-150 even:bg-muted/20 hover:bg-primary/5"
        >
          <TableCell class="font-medium">{{ formatDateShort(entry.date) }}</TableCell>
          <TableCell>{{ format(entry.weightKg) }}</TableCell>
          <TableCell class="text-muted-foreground">{{ entry.note ?? '—' }}</TableCell>
          <TableCell>
            <div class="flex items-center gap-1">
              <Button variant="ghost" size="icon" class="h-8 w-8" @click="openEdit(entry)">
                <Icon icon="lucide:pencil" class="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" class="h-8 w-8" @click="confirmDelete(entry)">
                <Icon icon="lucide:trash-2" class="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        <TableRow v-if="entries.length > 0 && bottomSpacerHeight > 0" aria-hidden="true">
          <TableCell
            :style="{ height: `${bottomSpacerHeight}px`, padding: 0, border: 'none' }"
            colspan="4"
          />
        </TableRow>
      </TableBody>
    </Table>
  </div>

  <EditWeightDialog v-model:open="editOpen" :entry="editEntry" />

  <!-- Delete Confirmation Dialog -->
  <Dialog :open="deleteOpen" @update:open="deleteOpen = $event">
    <DialogContent class="sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle>Delete Entry</DialogTitle>
        <DialogDescription v-if="deleteTarget">
          Are you sure you want to delete the weight entry for
          {{ formatDateShort(deleteTarget.date) }}? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="deleteOpen = false">Cancel</Button>
        <Button variant="destructive" @click="executeDelete">Delete</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
