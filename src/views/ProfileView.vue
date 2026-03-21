<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue-sonner'
import { useWeightStore } from '@/stores/weight'
import type { CsvDataType } from '@/stores/weight'
import { useAuthStore } from '@/stores/auth'
import { useUnits } from '@/composables/useUnits'
import { useTheme, type ColorTheme } from '@/composables/useTheme'
import { usePwaUpdate } from '@/composables/usePwaUpdate'
import { useNumericField } from '@/composables/useNumericField'
import BmiHalfCircleGauge from '@/components/dashboard/BmiHalfCircleGauge.vue'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const router = useRouter()
const route = useRoute()
const store = useWeightStore()
const auth = useAuthStore()
const { isKg, convert, toKg, format } = useUnits()
const { theme, setTheme, colorTheme, setColorTheme, colorThemes } = useTheme()
const { needRefresh, updateServiceWorker } = usePwaUpdate()
const isCheckingUpdate = ref(false)

async function checkForAppUpdate() {
  isCheckingUpdate.value = true
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      await registration.update()
      if (!needRefresh.value) {
        toast.info('You are on the latest version.')
      }
    }
  } catch {
    toast.error('Could not check for updates.')
  } finally {
    isCheckingUpdate.value = false
  }
}

function setColorThemeByValue(value: unknown) {
  if (typeof value !== 'string') return
  if (['classic', 'darcula', 'nord', 'solarized', 'gruvbox'].includes(value)) {
    setColorTheme(value as ColorTheme)
  }
}

// ── Form state ──
const displayName = ref(auth.currentUser?.name ?? '')
const heightField = useNumericField({ min: 50, max: 300, required: false })
const goalWeightField = useNumericField({ min: 20, max: 500, required: false })
const proteinGoalField = useNumericField({
  min: 1,
  max: 999,
  required: false,
  allowDecimals: false,
})
const carbsGoalField = useNumericField({ min: 1, max: 999, required: false, allowDecimals: false })
const fatGoalField = useNumericField({ min: 1, max: 999, required: false, allowDecimals: false })
const calorieGoalField = useNumericField({
  min: 1,
  max: 99999,
  required: false,
  allowDecimals: false,
})
const dateOfBirth = ref(store.settings.dateOfBirth ?? '')

if (store.settings.heightCm) heightField.reset(store.settings.heightCm)
if (store.settings.proteinGoalG) proteinGoalField.reset(store.settings.proteinGoalG)
if (store.settings.carbsGoalG) carbsGoalField.reset(store.settings.carbsGoalG)
if (store.settings.fatGoalG) fatGoalField.reset(store.settings.fatGoalG)
if (store.currentGlobalKcalGoal) calorieGoalField.reset(store.currentGlobalKcalGoal)
const sexValue = ref<string>(store.settings.sex ?? '')
const goalDirectionValue = ref<string>(store.settings.goalDirection ?? '')

const isSaving = ref(false)
const saveSuccess = ref(false)
const resetDialogOpen = ref(false)
const isResettingData = ref(false)
const importType = ref<CsvDataType>('weight')
const importFile = ref<File | null>(null)
const importInputRef = ref<HTMLInputElement | null>(null)
const isImporting = ref(false)
const isExportingWeight = ref(false)
const isExportingCalories = ref(false)

const weightUnitLabel = computed(() => (isKg.value ? 'kg' : 'lbs'))

function parseDisplayToKg(val: string): number {
  const n = Number.parseFloat(val)
  if (Number.isNaN(n)) return 0
  return toKg(n)
}

watch(
  [() => store.settings.goalWeightKg, isKg],
  ([kg]) => {
    goalWeightField.reset(kg ? convert(kg) : undefined)
  },
  { immediate: true },
)

watch(
  () => store.settings.heightCm,
  (cm) => {
    if (cm && !heightField.displayValue.value) heightField.reset(cm)
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
  () => store.currentGlobalKcalGoal,
  (goal) => {
    if (goal && !calorieGoalField.displayValue.value) calorieGoalField.reset(goal)
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
  const heightValid = heightField.validate()
  const goalValid = goalWeightField.validate()
  const proteinValid = proteinGoalField.validate()
  const carbsValid = carbsGoalField.validate()
  const fatValid = fatGoalField.validate()
  const calorieValid = calorieGoalField.validate()
  if (!heightValid || !goalValid || !proteinValid || !carbsValid || !fatValid || !calorieValid)
    return

  isSaving.value = true
  saveSuccess.value = false

  const trimmedName = displayName.value.trim()
  if (trimmedName !== (auth.currentUser?.name ?? '')) {
    await auth.updateName(trimmedName)
  }

  const heightParsed = heightField.numericValue.value
  const goalKg = goalWeightField.numericValue.value
    ? parseDisplayToKg(goalWeightField.displayValue.value)
    : 0

  await store.persistSettings({
    heightCm: heightParsed ?? store.settings.heightCm,
    goalWeightKg: goalKg > 0 ? goalKg : null,
    dateOfBirth: dateOfBirth.value || undefined,
    sex: (sexValue.value as 'male' | 'female') || undefined,
    goalDirection: (goalDirectionValue.value as 'loss' | 'gain') || undefined,
    proteinGoalG: proteinGoalField.numericValue.value ?? undefined,
    carbsGoalG: carbsGoalField.numericValue.value ?? undefined,
    fatGoalG: fatGoalField.numericValue.value ?? undefined,
  })

  if (calorieGoalField.numericValue.value) {
    await store.setGlobalKcalGoal(Math.round(calorieGoalField.numericValue.value))
  }

  isSaving.value = false
  saveSuccess.value = true
  setTimeout(() => {
    saveSuccess.value = false
  }, 2000)
}

async function resetUserData() {
  if (isResettingData.value) return
  isResettingData.value = true
  try {
    await store.resetUserData()
    resetDialogOpen.value = false
    toast.success('Your tracking data has been fully reset.')
    router.push('/')
  } catch {
    toast.error('Failed to reset your data. Please try again.')
  } finally {
    isResettingData.value = false
  }
}

function onImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  importFile.value = input.files?.[0] ?? null
}

const importExpectedHeaders = computed(() =>
  importType.value === 'weight' ? 'date,weight_kg,note' : 'date,calories,goal_override_kcal,note',
)

function setImportType(value: string) {
  if (value === 'weight' || value === 'calories') importType.value = value
}

async function exportData(type: CsvDataType) {
  const loading = type === 'weight' ? isExportingWeight : isExportingCalories
  if (loading.value) return
  loading.value = true
  try {
    const { filename, blob } = await store.exportCsv(type)
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
    toast.success(`${type === 'weight' ? 'Weight' : 'Calories'} CSV downloaded.`)
  } catch {
    toast.error(`Failed to export ${type} CSV. Please try again.`)
  } finally {
    loading.value = false
  }
}

async function importData() {
  if (!importFile.value || isImporting.value) return
  isImporting.value = true
  try {
    const result = await store.importCsv(importType.value, importFile.value)
    const errorCount = result.errors.length
    const message = `Created ${result.created}, updated ${result.updated}, skipped ${result.skipped}${errorCount ? `, ${errorCount} errors` : ''}.`
    if (errorCount > 0) {
      const firstError = result.errors[0]
      toast.warning(
        `Import finished with issues. ${message} First error (row ${firstError?.row}): ${firstError?.message}`,
      )
    } else {
      toast.success(`Import completed. ${message}`)
    }
    importFile.value = null
    if (importInputRef.value) importInputRef.value.value = ''
  } catch {
    toast.error('Import failed. Please check your CSV and try again.')
  } finally {
    isImporting.value = false
  }
}

function logout() {
  auth.logout()
  router.push('/auth')
}

// Desktop sub-nav sections
const sections = [
  { id: 'profile', label: 'Profile', icon: 'lucide:user' },
  { id: 'body-info', label: 'Body Info', icon: 'lucide:activity' },
  { id: 'nutrition-goals', label: 'Nutrition Goals', icon: 'lucide:utensils-crossed' },
  { id: 'preferences', label: 'Preferences', icon: 'lucide:sliders-horizontal' },
  { id: 'data', label: 'Data Management', icon: 'lucide:database' },
]

const activeSection = ref('profile')

function scrollToSection(id: string) {
  activeSection.value = id
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

watch(
  () => route.hash,
  async (hash) => {
    if (!hash) return
    const id = hash.slice(1)
    activeSection.value = id
    await nextTick()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  },
  { immediate: true },
)
</script>

<template>
  <div class="min-h-full px-3 pb-20 pt-3 sm:px-4 sm:pt-4 lg:px-8 lg:pb-8 lg:pt-8">
    <div class="mx-auto flex max-w-6xl flex-col gap-6 lg:min-h-full lg:flex-row">
      <!-- Desktop sub-nav sidebar -->
      <aside
        class="hidden w-72 shrink-0 flex-col rounded-[1.8rem] border border-border bg-card/70 p-6 shadow-warm-lg lg:flex"
      >
        <div class="mb-6 flex items-center gap-3">
          <div class="flex size-12 items-center justify-center rounded-full bg-muted">
            <Icon icon="lucide:user" class="size-6 text-muted-foreground" />
          </div>
          <div>
            <h1 class="text-base font-bold">{{ auth.currentUser?.name || 'User' }}</h1>
            <p class="text-xs text-muted-foreground">
              {{ store.settings.goalDirection === 'gain' ? 'Goal: Gain' : 'Goal: Lose' }}
              {{ store.settings.goalWeightKg ? format(store.settings.goalWeightKg) : 'Not set' }}
            </p>
          </div>
        </div>

        <nav class="flex flex-1 flex-col gap-1">
          <button
            v-for="section in sections"
            :key="section.id"
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
            :class="
              activeSection === section.id
                ? 'bg-primary/10 font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted'
            "
            @click="scrollToSection(section.id)"
          >
            <Icon :icon="section.icon" class="size-5" />
            {{ section.label }}
          </button>
        </nav>

        <div class="border-t border-border pt-6">
          <Button variant="secondary" class="w-full gap-2" @click="logout">
            <Icon icon="lucide:log-out" class="size-4" />
            Logout
          </Button>
        </div>
      </aside>

      <!-- Main content -->
      <main class="flex-1 lg:px-2">
        <div class="max-w-2xl space-y-8">
          <header>
            <p class="text-sm font-medium uppercase tracking-[0.22em] text-primary/80">
              Account Settings
            </p>
            <h1 class="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              Profile
            </h1>
            <p class="mt-2 text-sm text-muted-foreground">
              Manage your body information, app preferences, and data.
            </p>
          </header>

          <!-- Profile Section -->
          <section id="profile">
            <!-- Mobile: avatar + name -->
            <div class="flex flex-col items-center gap-4 py-4 lg:hidden">
              <div
                class="flex size-32 items-center justify-center rounded-full border-4 border-primary bg-muted"
              >
                <Icon icon="lucide:user" class="size-16 text-muted-foreground" />
              </div>
              <div class="text-center">
                <p class="text-2xl font-bold">{{ auth.currentUser?.name || 'User' }}</p>
                <p class="text-sm text-muted-foreground">
                  Goal:
                  {{ store.settings.goalWeightKg ? format(store.settings.goalWeightKg) : '—' }}
                </p>
              </div>
            </div>

            <!-- Desktop: profile card -->
            <Card class="hidden rounded-[1.8rem] shadow-warm-lg lg:block">
              <CardContent class="flex items-center justify-between gap-6 pt-6">
                <div class="flex items-center gap-6">
                  <div
                    class="flex size-24 items-center justify-center rounded-full bg-muted ring-4 ring-primary/10"
                  >
                    <Icon icon="lucide:user" class="size-12 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 class="text-2xl font-bold">{{ auth.currentUser?.name || 'User' }}</h3>
                    <p class="text-muted-foreground">
                      Current Goal:
                      {{ store.settings.goalDirection === 'gain' ? 'Weight Gain' : 'Weight Loss' }}
                    </p>
                    <p class="text-sm text-muted-foreground/60">{{ auth.currentUser?.email }}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <!-- BMI Gauge -->
          <Card class="rounded-[1.8rem] shadow-warm-lg">
            <CardContent class="flex flex-col items-center pt-6">
              <h3
                class="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground"
              >
                BMI Visualization
              </h3>
              <BmiHalfCircleGauge :bmi="store.bmi" :category="store.bmiCategory?.shortLabel" />
            </CardContent>
          </Card>

          <!-- Body Information -->
          <section id="body-info">
            <h3 class="mb-4 flex items-center gap-2 text-xl font-bold">
              <Icon icon="lucide:activity" class="size-5 text-primary" />
              Body Information
            </h3>
            <Card class="rounded-[1.8rem] shadow-warm-lg">
              <CardContent class="pt-6">
                <form class="grid gap-5" @submit.prevent="saveSettings">
                  <div class="grid gap-1.5">
                    <Label for="display-name">Display Name</Label>
                    <Input
                      id="display-name"
                      v-model="displayName"
                      type="text"
                      placeholder="How others see you"
                      class="max-w-[280px]"
                    />
                  </div>

                  <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div class="grid gap-1.5">
                      <Label for="height">Height (cm)</Label>
                      <Input
                        id="height"
                        v-model="heightField.displayValue.value"
                        type="text"
                        inputmode="decimal"
                        placeholder="e.g. 178"
                        v-bind="heightField.inputAttrs.value"
                        :class="{ 'animate-shake': heightField.shaking.value }"
                      />
                      <p v-if="heightField.error.value" class="text-xs text-destructive">
                        {{ heightField.error.value }}
                      </p>
                    </div>

                    <div class="grid gap-1.5">
                      <Label for="goal-weight">Goal Weight ({{ weightUnitLabel }})</Label>
                      <Input
                        id="goal-weight"
                        v-model="goalWeightField.displayValue.value"
                        type="text"
                        inputmode="decimal"
                        :placeholder="`e.g. ${isKg ? '75' : '165'}`"
                        v-bind="goalWeightField.inputAttrs.value"
                        :class="{ 'animate-shake': goalWeightField.shaking.value }"
                      />
                      <p v-if="goalWeightField.error.value" class="text-xs text-destructive">
                        {{ goalWeightField.error.value }}
                      </p>
                    </div>

                    <div class="grid gap-1.5">
                      <Label for="dob">Date of Birth</Label>
                      <Input id="dob" v-model="dateOfBirth" type="date" />
                    </div>

                    <div class="grid gap-1.5">
                      <Label for="sex">Biological Sex</Label>
                      <Select v-model="sexValue">
                        <SelectTrigger id="sex">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

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
                  </div>

                  <div class="flex items-center gap-3 pt-2">
                    <Button type="submit" :disabled="isSaving">
                      <Icon
                        v-if="isSaving"
                        icon="lucide:loader-circle"
                        class="mr-2 size-4 animate-spin"
                      />
                      <Icon v-else icon="lucide:save" class="mr-2 size-4" />
                      {{ isSaving ? 'Saving...' : 'Save Settings' }}
                    </Button>
                    <Transition name="fade">
                      <span v-if="saveSuccess" class="flex items-center gap-1 text-sm text-success">
                        <Icon icon="lucide:check" class="size-4" />
                        Saved
                      </span>
                    </Transition>
                  </div>
                </form>
              </CardContent>
            </Card>
          </section>

          <!-- Nutrition Goals -->
          <section id="nutrition-goals">
            <h3 class="mb-4 flex items-center gap-2 text-xl font-bold">
              <Icon icon="lucide:utensils-crossed" class="size-5 text-primary" />
              Nutrition Goals
            </h3>
            <Card class="rounded-[1.8rem] shadow-warm-lg">
              <CardContent class="pt-6">
                <div class="mb-5">
                  <p class="font-bold">Daily Macro Targets</p>
                  <p class="text-sm text-muted-foreground">
                    These goals power the coach card, dashboard progress bars, and nutrition views.
                  </p>
                </div>

                <div class="mb-5 grid gap-1.5">
                  <Label for="calorie-goal">Daily Calories (kcal)</Label>
                  <Input
                    id="calorie-goal"
                    v-model="calorieGoalField.displayValue.value"
                    type="text"
                    inputmode="numeric"
                    placeholder="e.g. 2200"
                    class="max-w-[240px]"
                    v-bind="calorieGoalField.inputAttrs.value"
                    :class="{ 'animate-shake': calorieGoalField.shaking.value }"
                  />
                  <p v-if="calorieGoalField.error.value" class="text-xs text-destructive">
                    {{ calorieGoalField.error.value }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Used for the dashboard summary and daily calorie coaching.
                  </p>
                </div>

                <div class="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <div class="grid gap-1.5">
                    <Label for="protein-goal">Protein (g)</Label>
                    <Input
                      id="protein-goal"
                      v-model="proteinGoalField.displayValue.value"
                      type="text"
                      inputmode="numeric"
                      placeholder="e.g. 150"
                      v-bind="proteinGoalField.inputAttrs.value"
                      :class="{ 'animate-shake': proteinGoalField.shaking.value }"
                    />
                    <p v-if="proteinGoalField.error.value" class="text-xs text-destructive">
                      {{ proteinGoalField.error.value }}
                    </p>
                  </div>

                  <div class="grid gap-1.5">
                    <Label for="carbs-goal">Carbs (g)</Label>
                    <Input
                      id="carbs-goal"
                      v-model="carbsGoalField.displayValue.value"
                      type="text"
                      inputmode="numeric"
                      placeholder="e.g. 250"
                      v-bind="carbsGoalField.inputAttrs.value"
                      :class="{ 'animate-shake': carbsGoalField.shaking.value }"
                    />
                    <p v-if="carbsGoalField.error.value" class="text-xs text-destructive">
                      {{ carbsGoalField.error.value }}
                    </p>
                  </div>

                  <div class="grid gap-1.5">
                    <Label for="fat-goal">Fat (g)</Label>
                    <Input
                      id="fat-goal"
                      v-model="fatGoalField.displayValue.value"
                      type="text"
                      inputmode="numeric"
                      placeholder="e.g. 65"
                      v-bind="fatGoalField.inputAttrs.value"
                      :class="{ 'animate-shake': fatGoalField.shaking.value }"
                    />
                    <p v-if="fatGoalField.error.value" class="text-xs text-destructive">
                      {{ fatGoalField.error.value }}
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-3 pt-5">
                  <Button type="button" :disabled="isSaving" @click="saveSettings">
                    <Icon
                      v-if="isSaving"
                      icon="lucide:loader-circle"
                      class="mr-2 size-4 animate-spin"
                    />
                    <Icon v-else icon="lucide:save" class="mr-2 size-4" />
                    {{ isSaving ? 'Saving...' : 'Save Nutrition Goals' }}
                  </Button>
                  <Transition name="fade">
                    <span v-if="saveSuccess" class="flex items-center gap-1 text-sm text-success">
                      <Icon icon="lucide:check" class="size-4" />
                      Saved
                    </span>
                  </Transition>
                </div>
              </CardContent>
            </Card>
          </section>

          <!-- Preferences -->
          <section id="preferences">
            <h3 class="mb-4 flex items-center gap-2 text-xl font-bold">
              <Icon icon="lucide:sliders-horizontal" class="size-5 text-primary" />
              Preferences
            </h3>
            <Card class="rounded-[1.8rem] shadow-warm-lg">
              <CardContent class="space-y-6 pt-6">
                <!-- Unit system -->
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-bold">Unit System</p>
                    <p class="text-sm text-muted-foreground">Metric or imperial</p>
                  </div>
                  <div class="flex rounded-lg bg-muted p-1">
                    <button
                      class="rounded-md px-4 py-1.5 text-sm font-bold transition-all"
                      :class="isKg ? 'bg-card shadow-sm' : 'text-muted-foreground'"
                      @click="store.setUnit('kg')"
                    >
                      KG
                    </button>
                    <button
                      class="rounded-md px-4 py-1.5 text-sm font-bold transition-all"
                      :class="!isKg ? 'bg-card shadow-sm' : 'text-muted-foreground'"
                      @click="store.setUnit('lbs')"
                    >
                      LBS
                    </button>
                  </div>
                </div>

                <!-- Theme -->
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-bold">Theme</p>
                    <p class="text-sm text-muted-foreground">Light or dark mode</p>
                  </div>
                  <div class="flex gap-2">
                    <button
                      class="flex size-10 items-center justify-center rounded-full border-2 transition-colors"
                      :class="
                        theme === 'light' ? 'border-primary bg-card' : 'border-transparent bg-muted'
                      "
                      @click="setTheme('light')"
                    >
                      <Icon icon="lucide:sun" class="size-5" />
                    </button>
                    <button
                      class="flex size-10 items-center justify-center rounded-full border-2 transition-colors"
                      :class="
                        theme === 'dark' ? 'border-primary bg-card' : 'border-transparent bg-muted'
                      "
                      @click="setTheme('dark')"
                    >
                      <Icon icon="lucide:moon" class="size-5" />
                    </button>
                  </div>
                </div>

                <!-- Color theme -->
                <div>
                  <p class="mb-2 font-bold">Color Theme</p>
                  <Select :model-value="colorTheme" @update:model-value="setColorThemeByValue">
                    <SelectTrigger class="max-w-[240px]">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="option in colorThemes"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- App update -->
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-bold">App Update</p>
                    <p class="text-sm text-muted-foreground">
                      <template v-if="needRefresh">A new version is available!</template>
                      <template v-else>Check for the latest version</template>
                    </p>
                  </div>
                  <Button v-if="needRefresh" size="sm" class="gap-2" @click="updateServiceWorker()">
                    <Icon icon="lucide:refresh-cw" class="size-4" />
                    Update Now
                  </Button>
                  <Button
                    v-else
                    variant="outline"
                    size="sm"
                    class="gap-2"
                    :disabled="isCheckingUpdate"
                    @click="checkForAppUpdate"
                  >
                    <Icon
                      icon="lucide:refresh-cw"
                      class="size-4"
                      :class="{ 'animate-spin': isCheckingUpdate }"
                    />
                    {{ isCheckingUpdate ? 'Checking...' : 'Check for Update' }}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          <!-- Data Management -->
          <section id="data">
            <h3 class="mb-4 flex items-center gap-2 text-xl font-bold">
              <Icon icon="lucide:database" class="size-5 text-primary" />
              Data Management
            </h3>

            <!-- Export -->
            <Card class="mb-4 shadow-warm">
              <CardContent class="flex flex-col gap-4 pt-6 md:flex-row">
                <Button
                  variant="outline"
                  class="flex-1 gap-2 py-4"
                  :disabled="isExportingWeight"
                  @click="exportData('weight')"
                >
                  <Icon icon="lucide:upload" class="size-4 text-primary" />
                  Export Weight CSV
                </Button>
                <Button
                  variant="outline"
                  class="flex-1 gap-2 py-4"
                  :disabled="isExportingCalories"
                  @click="exportData('calories')"
                >
                  <Icon icon="lucide:upload" class="size-4 text-primary" />
                  Export Calories CSV
                </Button>
              </CardContent>
            </Card>

            <!-- Import -->
            <Card class="mb-4 shadow-warm">
              <CardContent class="space-y-3 pt-6">
                <p class="text-sm font-medium">Import CSV</p>
                <p class="text-xs text-muted-foreground">
                  Headers: <code>{{ importExpectedHeaders }}</code>
                </p>
                <div class="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-end">
                  <div class="grid gap-1.5">
                    <Label>Data Type</Label>
                    <Select :model-value="importType" @update:model-value="setImportType">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weight">Weight</SelectItem>
                        <SelectItem value="calories">Calories</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="grid gap-1.5">
                    <Label for="csv-upload">CSV File</Label>
                    <Input
                      id="csv-upload"
                      ref="importInputRef"
                      type="file"
                      accept=".csv,text/csv"
                      @change="onImportFileChange"
                    />
                  </div>
                </div>
                <Button :disabled="!importFile || isImporting" @click="importData">
                  <Icon
                    v-if="isImporting"
                    icon="lucide:loader-circle"
                    class="mr-2 size-4 animate-spin"
                  />
                  <Icon v-else icon="lucide:download" class="mr-2 size-4" />
                  {{ isImporting ? 'Importing...' : 'Import CSV' }}
                </Button>
              </CardContent>
            </Card>

            <!-- Danger Zone -->
            <div class="rounded-xl border border-destructive/20 bg-destructive/5 p-6 lg:p-8">
              <h3 class="mb-2 text-xl font-bold text-destructive">Danger Zone</h3>
              <p class="mb-6 text-sm text-destructive/60">
                Once you reset your account, there is no going back. Please be certain.
              </p>
              <Button variant="destructive" class="gap-2" @click="resetDialogOpen = true">
                <Icon icon="lucide:trash-2" class="size-4" />
                Account Reset
              </Button>
            </div>
          </section>

          <!-- Mobile: logout button -->
          <div class="pb-8 lg:hidden">
            <Button variant="secondary" class="w-full gap-2" @click="logout">
              <Icon icon="lucide:log-out" class="size-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </main>
    </div>

    <!-- Reset dialog -->
    <Dialog :open="resetDialogOpen" @update:open="resetDialogOpen = $event">
      <DialogContent class="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Reset all your tracking data?</DialogTitle>
          <DialogDescription>
            This permanently deletes your weight entries, calorie entries, calorie goal history, and
            goals. Your account, settings, and group memberships will stay unchanged.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="isResettingData" @click="resetDialogOpen = false">
            Cancel
          </Button>
          <Button variant="destructive" :disabled="isResettingData" @click="resetUserData">
            <Icon
              v-if="isResettingData"
              icon="lucide:loader-circle"
              class="mr-2 size-4 animate-spin"
            />
            <Icon v-else icon="lucide:trash-2" class="mr-2 size-4" />
            {{ isResettingData ? 'Resetting...' : 'Yes, reset data' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
