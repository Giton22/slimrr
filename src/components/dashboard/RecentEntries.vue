<script setup lang="ts">
import { computed, ref } from 'vue'
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

const recentEntries = computed(() =>
  [...store.sortedEntries].reverse().slice(0, 10),
)

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
      <TableRow v-if="recentEntries.length === 0">
        <TableCell colspan="4" class="py-8 text-center">
          <div class="flex flex-col items-center gap-1">
            <Icon icon="lucide:scale" class="h-8 w-8 text-muted-foreground/30" />
            <p class="text-sm text-muted-foreground">No weight entries yet</p>
          </div>
        </TableCell>
      </TableRow>
      <TableRow v-for="entry in recentEntries" :key="entry.id" class="transition-colors hover:bg-muted/50">
        <TableCell class="font-medium">{{ formatDateShort(entry.date) }}</TableCell>
        <TableCell>{{ format(entry.weightKg) }}</TableCell>
        <TableCell class="text-muted-foreground">{{ entry.note ?? '—' }}</TableCell>
        <TableCell>
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              @click="openEdit(entry)"
            >
              <Icon icon="lucide:pencil" class="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              @click="confirmDelete(entry)"
            >
              <Icon icon="lucide:trash-2" class="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>

  <EditWeightDialog v-model:open="editOpen" :entry="editEntry" />

  <!-- Delete Confirmation Dialog -->
  <Dialog :open="deleteOpen" @update:open="deleteOpen = $event">
    <DialogContent class="sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle>Delete Entry</DialogTitle>
        <DialogDescription v-if="deleteTarget">
          Are you sure you want to delete the weight entry for {{ formatDateShort(deleteTarget.date) }}? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="deleteOpen = false">Cancel</Button>
        <Button variant="destructive" @click="executeDelete">Delete</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
