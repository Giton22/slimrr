<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { toast } from 'vue-sonner'
import { Icon } from '@iconify/vue'
import { useWeightStore } from '@/stores/weight'
import { useUnits } from '@/composables/useUnits'
import { useNumericField } from '@/composables/useNumericField'
import { todayISO } from '@/lib/date'
import { useToday } from '@/composables/useToday'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const store = useWeightStore()
const { convert, isKg, format, toKg } = useUnits()
const todayRef = useToday()

const todayEntry = computed(() =>
  store.sortedEntries.find(e => e.date === todayRef.value),
)

const editing = ref(false)
const saving = ref(false)
const weightField = useNumericField({ min: 0, required: true })
const inputRef = ref<InstanceType<typeof Input> | null>(null)

function startEditing() {
  weightField.reset(todayEntry.value ? convert(todayEntry.value.weightKg) : undefined)
  editing.value = true
  nextTick(() => {
    const el = inputRef.value?.$el?.querySelector('input') ?? inputRef.value?.$el
    el?.focus()
  })
}

async function save() {
  if (!weightField.validate() || saving.value) return

  saving.value = true
  try {
    await store.addEntry({
      date: todayISO(),
      weightKg: toKg(weightField.numericValue.value!),
    })

    editing.value = false
    weightField.reset()
  } catch {
    toast.error('Failed to save weight entry')
  } finally {
    saving.value = false
  }
}

function cancel() {
  editing.value = false
  weightField.reset()
}
</script>

<template>
  <Card class="bg-primary/5 border-primary/20">
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle class="text-sm font-medium text-muted-foreground">
        Today's Weight
      </CardTitle>
    </CardHeader>
    <CardContent>
      <template v-if="!editing">
        <div class="text-2xl font-bold">
          {{ todayEntry ? format(todayEntry.weightKg) : '—' }}
        </div>
        <button
          type="button"
          class="mt-1 flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          @click="startEditing"
        >
          <Icon :icon="todayEntry ? 'lucide:pencil' : 'lucide:plus'" class="h-3 w-3" />
          {{ todayEntry ? 'Update' : 'Log weight' }}
        </button>
      </template>
      <template v-else>
        <form class="flex flex-col gap-1" @submit.prevent="save">
          <div class="flex items-center gap-2">
            <Input
              ref="inputRef"
              v-model="weightField.displayValue.value"
              type="text"
              inputmode="decimal"
              :placeholder="isKg ? 'kg' : 'lbs'"
              class="h-8 w-24"
              v-bind="weightField.inputAttrs.value"
              :class="{ 'animate-shake': weightField.shaking.value }"
            />
            <Button type="submit" size="sm" class="h-8" :disabled="!weightField.numericValue.value || saving">
            <Icon :icon="saving ? 'lucide:loader-circle' : 'lucide:check'" class="h-4 w-4" :class="saving && 'animate-spin'" />
          </Button>
          <Button type="button" variant="ghost" size="sm" class="h-8" @click="cancel">
            <Icon icon="lucide:x" class="h-4 w-4" />
          </Button>
          </div>
          <p v-if="weightField.error.value" class="text-xs text-destructive">
            {{ weightField.error.value }}
          </p>
        </form>
      </template>
    </CardContent>
  </Card>
</template>
