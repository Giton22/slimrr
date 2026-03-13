<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useWeightStore } from '@/stores/weight'
import { useAuthStore } from '@/stores/auth'
import { useUnits } from '@/composables/useUnits'
import { BMI_CATEGORIES } from '@/composables/useBmi'
import BmiGauge from '@/components/settings/BmiGauge.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

const router = useRouter()
const store = useWeightStore()
const auth = useAuthStore()
const { isKg, convert, toKg, format, formatDelta } = useUnits()

// ── Form state (local draft — only saved on submit) ──

const displayName = ref(auth.currentUser?.name ?? '')
const heightCm = ref(store.settings.heightCm ? String(store.settings.heightCm) : '')
const goalWeightInput = ref('')
const dateOfBirth = ref(store.settings.dateOfBirth ?? '')
const sexValue = ref<string>(store.settings.sex ?? '')
const goalDirectionValue = ref<string>(store.settings.goalDirection ?? '')

// Saving state
const isSaving = ref(false)
const saveSuccess = ref(false)

// Convert stored kg goal to display unit string
function kgToDisplayStr(kg: number): string {
  return String(convert(kg))
}

function parseDisplayToKg(val: string): number {
  const n = Number.parseFloat(val)
  if (Number.isNaN(n)) return 0
  return toKg(n)
}

// Sync goal weight input when unit changes or settings load
watch(
  [() => store.settings.goalWeightKg, isKg],
  ([kg]) => {
    goalWeightInput.value = kg ? kgToDisplayStr(kg) : ''
  },
  { immediate: true },
)

// Also keep height in sync if settings load after mount
watch(
  () => store.settings.heightCm,
  (cm) => {
    if (cm && !heightCm.value) heightCm.value = String(cm)
  },
)

watch(
  () => store.settings.dateOfBirth,
  (dob) => {
    if (dob && !dateOfBirth.value) dateOfBirth.value = dob
  },
)

watch(
  () => store.settings.sex,
  (s) => {
    if (s && !sexValue.value) sexValue.value = s
  },
)

watch(
  () => store.settings.goalDirection,
  (d) => {
    if (d) goalDirectionValue.value = d
  },
  { immediate: true },
)

async function saveSettings() {
  isSaving.value = true
  saveSuccess.value = false

  const trimmedName = displayName.value.trim()
  if (trimmedName !== (auth.currentUser?.name ?? '')) {
    await auth.updateName(trimmedName)
  }

  const heightParsed = Number.parseFloat(heightCm.value)
  const goalKg = parseDisplayToKg(goalWeightInput.value)

  await store.persistSettings({
    heightCm: Number.isNaN(heightParsed) ? store.settings.heightCm : heightParsed,
    goalWeightKg: goalKg > 0 ? goalKg : store.settings.goalWeightKg,
    dateOfBirth: dateOfBirth.value || undefined,
    sex: (sexValue.value as 'male' | 'female') || undefined,
    goalDirection: (goalDirectionValue.value as 'loss' | 'gain') || undefined,
  })

  isSaving.value = false
  saveSuccess.value = true
  setTimeout(() => { saveSuccess.value = false }, 2000)
}

// ── BMI display helpers ──

const bmiColorClass = computed(() => {
  const cat = store.bmiCategory
  if (!cat) return 'text-muted-foreground'
  return cat.textColorClass
})

const bmiBadgeVariant = computed((): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const cat = store.bmiCategory
  if (!cat) return 'secondary'
  if (cat.color === 'green') return 'default'
  if (cat.color === 'red' || cat.color === 'orange') return 'destructive'
  return 'outline'
})

const weightDifferenceText = computed(() => {
  const diff = store.weightToHealthyBmi
  if (diff === null) return null
  if (diff === 0) return 'You are in the healthy BMI range.'
  const absKg = Math.abs(diff)
  const direction = diff < 0 ? 'lose' : 'gain'
  if (isKg.value) {
    return `To reach a healthy BMI, you need to ${direction} ${absKg} kg.`
  }
  const absLbs = convert(absKg)
  return `To reach a healthy BMI, you need to ${direction} ${absLbs} lbs (${absKg} kg).`
})

const healthyRangeText = computed(() => {
  const range = store.healthyWeightRange
  if (!range) return null
  if (isKg.value) {
    return `Healthy weight at your height: ${range.minKg}–${range.maxKg} kg`
  }
  const minLbs = convert(range.minKg)
  const maxLbs = convert(range.maxKg)
  return `Healthy weight at your height: ${minLbs}–${maxLbs} lbs (${range.minKg}–${range.maxKg} kg)`
})

const weightUnitLabel = computed(() => isKg.value ? 'kg' : 'lbs')
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
    <!-- Back button -->
    <div class="mb-6 flex items-center gap-2">
      <Button variant="ghost" size="icon" @click="router.push('/')">
        <Icon icon="lucide:arrow-left" class="h-4 w-4" />
      </Button>
      <h2 class="text-xl font-semibold">Settings</h2>
    </div>

    <!-- New user profile setup banner -->
    <div
      v-if="store.isSynced && !store.settingsRecordId"
      class="mb-6 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
    >
      <Icon icon="lucide:info" class="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div>
        <p class="font-medium text-foreground">Complete your profile</p>
        <p class="text-sm text-muted-foreground">
          Fill in your details below and save to get the most out of your tracker.
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-6">
      <!-- ── Profile Settings Card ── -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Icon icon="lucide:user" class="h-5 w-5 text-primary" />
            Profile
          </CardTitle>
          <CardDescription>
            Personal details used to calculate your BMI and health recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form class="grid gap-5" @submit.prevent="saveSettings">
            <!-- Display Name -->
            <div class="grid gap-1.5">
              <Label for="display-name">Display Name</Label>
              <Input
                id="display-name"
                v-model="displayName"
                type="text"
                placeholder="How others will see you in groups"
                class="max-w-[280px]"
              />
              <p class="text-xs text-muted-foreground">
                Visible to other group members.
              </p>
            </div>

            <Separator />

            <!-- Height -->
            <div class="grid gap-1.5">
              <Label for="height">Height (cm)</Label>
              <div class="flex items-center gap-2">
                <Input
                  id="height"
                  v-model="heightCm"
                  type="number"
                  min="50"
                  max="300"
                  step="0.1"
                  placeholder="e.g. 178"
                  class="max-w-[160px]"
                />
                <span class="text-sm text-muted-foreground">cm</span>
              </div>
              <p class="text-xs text-muted-foreground">
                Always stored in centimetres regardless of unit setting.
              </p>
            </div>

            <Separator />

            <!-- Goal Weight -->
            <div class="grid gap-1.5">
              <Label for="goal-weight">Goal Weight</Label>
              <div class="flex items-center gap-2">
                <Input
                  id="goal-weight"
                  v-model="goalWeightInput"
                  type="number"
                  min="20"
                  max="500"
                  step="0.1"
                  :placeholder="`e.g. ${isKg ? '75' : '165'}`"
                  class="max-w-[160px]"
                />
                <span class="text-sm text-muted-foreground">{{ weightUnitLabel }}</span>
              </div>
            </div>

            <Separator />

            <!-- Goal Direction -->
            <div class="grid gap-1.5">
              <Label>Goal Direction</Label>
              <div class="flex gap-2">
                <Button
                  type="button"
                  :variant="goalDirectionValue === 'loss' ? 'default' : 'outline'"
                  size="sm"
                  @click="goalDirectionValue = 'loss'"
                >
                  Weight Loss
                </Button>
                <Button
                  type="button"
                  :variant="goalDirectionValue === 'gain' ? 'default' : 'outline'"
                  size="sm"
                  @click="goalDirectionValue = 'gain'"
                >
                  Weight Gain
                </Button>
              </div>
              <p class="text-xs text-muted-foreground">
                Used to calculate progress in group goals.
              </p>
            </div>

            <Separator />

            <!-- Date of Birth -->
            <div class="grid gap-1.5">
              <Label for="dob">Date of Birth</Label>
              <Input
                id="dob"
                v-model="dateOfBirth"
                type="date"
                class="max-w-[200px]"
              />
              <p class="text-xs text-muted-foreground">
                Used to calculate your current age for context.
              </p>
            </div>

            <Separator />

            <!-- Sex -->
            <div class="grid gap-1.5">
              <Label for="sex">Biological Sex</Label>
              <Select v-model="sexValue">
                <SelectTrigger id="sex" class="max-w-[200px]">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground">
                Optional — used for body composition context.
              </p>
            </div>

            <Separator />

            <!-- Unit Preference -->
            <div class="grid gap-1.5">
              <Label>Weight Unit</Label>
              <div class="flex gap-2">
                <Button
                  type="button"
                  :variant="isKg ? 'default' : 'outline'"
                  size="sm"
                  @click="store.setUnit('kg')"
                >
                  kg
                </Button>
                <Button
                  type="button"
                  :variant="!isKg ? 'default' : 'outline'"
                  size="sm"
                  @click="store.setUnit('lbs')"
                >
                  lbs
                </Button>
              </div>
            </div>

            <!-- Save button -->
            <div class="flex items-center gap-3 pt-2">
              <Button type="submit" :disabled="isSaving">
                <Icon v-if="isSaving" icon="lucide:loader-circle" class="mr-2 h-4 w-4 animate-spin" />
                <Icon v-else icon="lucide:save" class="mr-2 h-4 w-4" />
                {{ isSaving ? 'Saving...' : 'Save Settings' }}
              </Button>
              <Transition name="fade">
                <span v-if="saveSuccess" class="flex items-center gap-1 text-sm text-success">
                  <Icon icon="lucide:check" class="h-4 w-4" />
                  Saved
                </span>
              </Transition>
            </div>
          </form>
        </CardContent>
      </Card>

      <!-- ── BMI Overview Card ── -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Icon icon="lucide:activity" class="h-5 w-5 text-primary" />
            BMI Overview
          </CardTitle>
          <CardDescription>
            Based on your latest logged weight and height. BMI = weight (kg) ÷ height (m)².
          </CardDescription>
        </CardHeader>
        <CardContent>
          <!-- No weight logged yet -->
          <div
            v-if="store.currentWeight === null"
            class="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground"
          >
            <Icon icon="lucide:scale" class="h-10 w-10 opacity-30" />
            <p class="text-sm">No weight entries yet.</p>
            <p class="text-xs">Log your first weight on the dashboard to see your BMI.</p>
          </div>

          <!-- No height set -->
          <div
            v-else-if="!store.settings.heightCm"
            class="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground"
          >
            <Icon icon="lucide:ruler" class="h-10 w-10 opacity-30" />
            <p class="text-sm">Height not set.</p>
            <p class="text-xs">Enter your height above to calculate your BMI.</p>
          </div>

          <!-- BMI calculated -->
          <div v-else class="flex flex-col gap-5">
            <!-- Current weight + BMI value -->
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="text-xs uppercase tracking-wide text-muted-foreground">Current Weight</p>
                <p class="text-2xl font-semibold">{{ format(store.currentWeight!) }}</p>
                <p class="text-xs text-muted-foreground">
                  Latest entry: {{ store.latestEntry?.date }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-xs uppercase tracking-wide text-muted-foreground">BMI</p>
                <p class="text-4xl font-bold" :class="bmiColorClass">
                  {{ store.bmi }}
                </p>
                <Badge :variant="bmiBadgeVariant" class="mt-1">
                  {{ store.bmiCategory?.label }}
                </Badge>
              </div>
            </div>

            <!-- Description -->
            <p v-if="store.bmiCategory" class="text-sm text-muted-foreground">
              {{ store.bmiCategory.description }}
            </p>

            <!-- Age + sex context line -->
            <p v-if="store.age !== null || store.settings.sex" class="text-xs text-muted-foreground">
              <span v-if="store.age !== null">Age: {{ store.age }}</span>
              <span v-if="store.age !== null && store.settings.sex"> · </span>
              <span v-if="store.settings.sex" class="capitalize">{{ store.settings.sex }}</span>
            </p>

            <Separator />

            <!-- Color gauge -->
            <div>
              <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                BMI Scale
              </p>
              <BmiGauge :bmi="store.bmi" />
            </div>

            <Separator />

            <!-- Healthy range & difference -->
            <div class="flex flex-col gap-2">
              <!-- Difference to healthy BMI -->
              <div
                v-if="weightDifferenceText"
                class="flex items-start gap-2 rounded-lg p-3"
                :class="store.weightToHealthyBmi === 0
                  ? 'bg-success/10 text-success'
                  : 'bg-muted'"
              >
                <Icon
                  :icon="store.weightToHealthyBmi === 0
                    ? 'lucide:circle-check'
                    : store.weightToHealthyBmi! < 0
                      ? 'lucide:trending-down'
                      : 'lucide:trending-up'"
                  class="mt-0.5 h-4 w-4 shrink-0"
                  :class="store.weightToHealthyBmi === 0 ? 'text-success' : 'text-muted-foreground'"
                />
                <span class="text-sm">{{ weightDifferenceText }}</span>
              </div>

              <!-- Healthy weight range for user's height -->
              <div v-if="healthyRangeText" class="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon icon="lucide:info" class="h-4 w-4 shrink-0" />
                {{ healthyRangeText }}
              </div>
            </div>

            <Separator />

            <!-- WHO Category reference table -->
            <div>
              <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                WHO BMI Categories
              </p>
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="border-b bg-muted/50">
                      <th class="px-3 py-2 text-left font-medium">Category</th>
                      <th class="px-3 py-2 text-left font-medium">BMI (kg/m²)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="cat in BMI_CATEGORIES"
                      :key="cat.label"
                      class="border-b last:border-0"
                      :class="store.bmiCategory?.label === cat.label ? 'bg-primary/5 font-semibold' : ''"
                    >
                      <td class="px-3 py-1.5">
                        <span class="flex items-center gap-1.5">
                          <span
                            class="inline-block h-2 w-2 rounded-full"
                            :class="cat.bgColorClass"
                          />
                          {{ cat.label }}
                          <Badge
                            v-if="store.bmiCategory?.label === cat.label"
                            variant="outline"
                            class="ml-1 px-1 py-0 text-[10px]"
                          >
                            You
                          </Badge>
                        </span>
                      </td>
                      <td :class="['px-3 py-1.5', cat.textColorClass]">{{ cat.range }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
