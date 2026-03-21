<script setup lang="ts">
import { computed } from 'vue'
import MacroProgressBars from '@/components/dashboard/MacroProgressBars.vue'

const props = defineProps<{
  consumed: number
  goal: number
  hasCalorieGoal: boolean
  protein: number
  proteinGoal: number
  carbs: number
  carbsGoal: number
  fat: number
  fatGoal: number
}>()

defineEmits<{
  openGoals: []
}>()

const remaining = computed(() => Math.max(0, props.goal - props.consumed))
const roundedConsumed = computed(() => Math.round(props.consumed))
const roundedGoal = computed(() => Math.round(props.goal))
const roundedRemaining = computed(() => Math.round(remaining.value))
const progress = computed(() => {
  if (!props.hasCalorieGoal || props.goal <= 0) return 0
  return Math.min(100, Math.round((props.consumed / props.goal) * 100))
})

const ringOffset = computed(() => {
  const circumference = 2 * Math.PI * 42
  return circumference * (1 - progress.value / 100)
})

const summaryStats = computed(() => [
  { label: 'Eaten', value: roundedConsumed.value.toLocaleString() },
  {
    label: props.hasCalorieGoal ? 'Remaining' : 'Status',
    value: props.hasCalorieGoal ? roundedRemaining.value.toLocaleString() : 'Set goal',
    accent: true,
  },
  { label: 'Goal', value: props.hasCalorieGoal ? roundedGoal.value.toLocaleString() : '—' },
])
</script>

<template>
  <div
    class="overflow-hidden rounded-[2rem] border border-border bg-card p-5 text-card-foreground shadow-warm-lg lg:p-6"
  >
    <div class="space-y-5">
      <button
        v-if="!hasCalorieGoal"
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 transition-colors hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
        @click="$emit('openGoals')"
      >
        Set a daily calorie goal to unlock more useful coaching.
      </button>

      <div class="flex flex-col items-center text-center">
        <div v-if="hasCalorieGoal" class="relative size-32 shrink-0 sm:size-36">
          <svg class="size-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              stroke-width="8"
              class="text-muted"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              stroke-width="8"
              class="text-primary transition-all duration-700"
              :stroke-dasharray="2 * Math.PI * 42"
              :stroke-dashoffset="ringOffset"
              stroke-linecap="round"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center px-4">
            <span class="text-xl font-bold tracking-tight text-card-foreground sm:text-2xl">
              {{ roundedRemaining.toLocaleString() }}
            </span>
            <span class="mt-1 text-[11px] font-medium text-muted-foreground">Remaining</span>
            <span class="mt-1 text-[11px] font-medium text-muted-foreground">
              {{ `${progress}% of goal` }}
            </span>
          </div>
        </div>

        <button
          v-else
          type="button"
          class="w-full max-w-[20rem] rounded-[1.5rem] border border-dashed border-border bg-background/60 px-5 py-5 text-left transition-colors hover:border-primary/35 hover:bg-primary/5"
          @click="$emit('openGoals')"
        >
          <p class="text-sm font-bold uppercase tracking-[0.18em] text-primary/80">Daily target</p>
          <p class="mt-2 text-2xl font-black tracking-tight text-card-foreground">Set your goal</p>
          <p class="mt-2 text-sm text-muted-foreground">
            Add calories in Profile to personalize this summary.
          </p>
        </button>

        <div class="mt-4 grid w-full grid-cols-3 gap-2.5 sm:gap-3">
          <div
            v-for="item in summaryStats"
            :key="item.label"
            class="rounded-[1.25rem] border px-3 py-3 text-center"
            :class="
              item.accent ? 'border-primary/25 bg-primary/8' : 'border-border bg-background/60'
            "
          >
            <p class="text-[11px] font-medium text-muted-foreground">
              {{ item.label }}
            </p>
            <p
              class="mt-1 text-lg font-bold tracking-tight sm:text-xl"
              :class="item.accent ? 'text-primary' : 'text-card-foreground'"
            >
              {{ item.value }}
            </p>
            <p class="text-[11px] text-muted-foreground">kcal</p>
          </div>
        </div>
      </div>

      <div class="rounded-[1.5rem] border border-border bg-background/60 p-4 sm:p-5">
        <div class="mb-4">
          <p class="text-sm font-bold text-card-foreground">Macros</p>
          <p class="mt-1 text-sm text-muted-foreground">Today’s intake against your targets</p>
        </div>
        <MacroProgressBars
          variant="diary"
          :protein="protein"
          :protein-goal="proteinGoal"
          :carbs="carbs"
          :carbs-goal="carbsGoal"
          :fat="fat"
          :fat-goal="fatGoal"
        />
      </div>
    </div>
  </div>
</template>
