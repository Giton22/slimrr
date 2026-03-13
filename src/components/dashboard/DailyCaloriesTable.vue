<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { DailyCalorieRow } from '@/types'
import { useWeightStore } from '@/stores/weight'
import { formatDateShort } from '@/lib/date'
import { getCalorieStatus } from '@/lib/calorieStatus'
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

function getStatus(row: DailyCalorieRow) {
  return getCalorieStatus(row.consumedKcal, row.goalKcal, store.settings.goalDirection)
}

function isStatusAlignedWithGoal(row: DailyCalorieRow): boolean {
  const status = getStatus(row)
  if (!status) return false
  if (status.side === 'target') return true

  const direction = store.settings.goalDirection ?? 'loss'
  return direction === 'loss' ? status.side === 'under' : status.side === 'over'
}

function getRowHighlightClass(row: DailyCalorieRow): string {
  const status = getStatus(row)
  if (!status) return ''
  if (isStatusAlignedWithGoal(row)) return 'bg-emerald-500/5 hover:bg-emerald-500/10'
  return 'bg-red-500/5 hover:bg-red-500/10'
}

function getConsumedClass(row: DailyCalorieRow): string {
  if (!getStatus(row)) return ''
  return isStatusAlignedWithGoal(row) ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'font-semibold text-red-600 dark:text-red-400'
}

function openRow(row: DailyCalorieRow) {
  selectedRow.value = row
  dialogOpen.value = true
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
          <TableRow v-if="rows.length === 0">
            <TableCell colspan="5" class="py-12 text-center">
              <div class="flex flex-col items-center gap-2">
                <Icon icon="lucide:utensils" class="h-12 w-12 text-muted-foreground/25 animate-gentle-bob" />
                <p class="text-sm font-medium text-foreground/70">No calorie entries yet</p>
                <p class="text-xs text-muted-foreground">Log your first meal to start tracking</p>
              </div>
            </TableCell>
          </TableRow>
          <TableRow
            v-for="row in rows"
            :key="row.date"
            class="cursor-pointer transition-colors duration-150 even:bg-muted/20 hover:bg-primary/5"
            :class="getRowHighlightClass(row)"
            @click="openRow(row)"
          >
            <TableCell class="font-medium">{{ formatDateShort(row.date) }}</TableCell>
            <TableCell>
              <span v-if="row.consumedKcal !== null" :class="getConsumedClass(row)">
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
                <Badge
                  v-if="getStatus(row)"
                  class="text-xs"
                  :class="getStatus(row)?.badgeClass"
                >
                  {{ getStatus(row)?.label }}
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
