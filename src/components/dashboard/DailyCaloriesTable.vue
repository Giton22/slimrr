<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { DailyCalorieRow } from '@/types'
import { useWeightStore } from '@/stores/weight'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import EditCaloriesDayDialog from '@/components/dashboard/EditCaloriesDayDialog.vue'

const store = useWeightStore()

const selectedRow = ref<DailyCalorieRow | null>(null)
const dialogOpen = ref(false)

const rows = computed(() => store.dailyCalorieRows)

function openRow(row: DailyCalorieRow) {
  selectedRow.value = row
  dialogOpen.value = true
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="space-y-3">
    <div class="max-h-[500px] overflow-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Consumed (kcal)</TableHead>
            <TableHead>Goal (kcal)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead class="text-right">Edit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="row in rows"
            :key="row.date"
            class="cursor-pointer transition-colors hover:bg-muted/40"
            :class="{ 'bg-destructive/5 hover:bg-destructive/10': row.isExceeded }"
            @click="openRow(row)"
          >
            <TableCell class="font-medium">{{ formatDate(row.date) }}</TableCell>
            <TableCell>
              <span v-if="row.consumedKcal !== null" :class="{ 'font-semibold text-destructive': row.isExceeded }">
                {{ row.consumedKcal }}
              </span>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-1.5">
                <span v-if="row.goalKcal !== null">{{ row.goalKcal }}</span>
                <span v-else class="text-muted-foreground">—</span>
                <Badge
                  v-if="row.goalSource === 'override'"
                  variant="secondary"
                  class="px-1.5 py-0 text-[10px]"
                >
                  custom
                </Badge>
              </div>
            </TableCell>
            <TableCell>
              <template v-if="row.consumedKcal !== null && row.goalKcal !== null">
                <Badge v-if="row.isExceeded" variant="destructive" class="text-xs">
                  +{{ row.deltaKcal }} over
                </Badge>
                <Badge v-else-if="row.deltaKcal !== null && row.deltaKcal < 0" variant="secondary" class="text-xs">
                  {{ Math.abs(row.deltaKcal) }} under
                </Badge>
                <Badge v-else variant="outline" class="text-xs">
                  On target
                </Badge>
              </template>
              <span v-else class="text-xs text-muted-foreground">—</span>
            </TableCell>
            <TableCell class="text-right">
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground"
                @click.stop="openRow(row)"
              >
                <Icon icon="lucide:pencil" class="h-4 w-4" />
              </button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <EditCaloriesDayDialog v-model:open="dialogOpen" :row="selectedRow" />
  </div>
</template>
