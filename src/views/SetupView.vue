<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAuthStore } from '@/stores/auth'
import { useWeightStore } from '@/stores/weight'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const router = useRouter()
const auth = useAuthStore()
const weightStore = useWeightStore()

// ── Steps ──
// 1: Welcome  2: Account  3: Profile  4: Done
const step = ref(1)
const TOTAL_STEPS = 3 // progress bar denominator (steps 1–3, step 4 is completion)

// ── Step 2: Account fields ──
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const accountError = ref<string | null>(null)

// ── Step 3: Profile fields ──
const unit = ref<'kg' | 'lbs'>('kg')
const heightCm = ref('')
const goalWeightInput = ref('')
const dateOfBirth = ref('')
const sex = ref('')

const isLoading = ref(false)

// Convert display weight to kg for storage
function displayToKg(val: string): number | undefined {
  const n = Number.parseFloat(val)
  if (Number.isNaN(n) || n <= 0) return undefined
  return unit.value === 'kg' ? n : Math.round((n / 2.20462) * 10) / 10
}

// ── Step validation ──
const step2Valid = computed(() =>
  email.value.trim().length > 0
  && password.value.length >= 8
  && password.value === passwordConfirm.value,
)

const passwordMismatch = computed(() =>
  passwordConfirm.value.length > 0 && password.value !== passwordConfirm.value,
)

// ── Navigation ──
function nextStep() {
  if (step.value === 2) {
    accountError.value = null
    if (!step2Valid.value) return
  }
  step.value++
}

function prevStep() {
  if (step.value > 1) step.value--
}

// ── Final submission ──
async function finish() {
  isLoading.value = true
  accountError.value = null
  try {
    // 1. Register + auto-login
    await auth.register(email.value.trim(), password.value)

    // 2. Load user data so persistSettings knows whether to create or update
    //    the settings record. App.vue's isAuthenticated watcher also calls loadAll(),
    //    but may not have resolved yet — we need it synchronous here.
    await weightStore.loadAll()

    // 3. Persist all profile settings collected in step 3
    const heightParsed = Number.parseFloat(heightCm.value)
    const goalKg = displayToKg(goalWeightInput.value)
    await weightStore.persistSettings({
      unit: unit.value,
      heightCm: !Number.isNaN(heightParsed) && heightParsed > 0 ? heightParsed : undefined,
      goalWeightKg: goalKg,
      dateOfBirth: dateOfBirth.value || undefined,
      sex: (sex.value as 'male' | 'female') || undefined,
    })

    // 4. Mark setup complete in app_config (requires auth, which we now have)
    await auth.completeSetup()

    // 5. Show completion screen
    step.value = 4
  }
  catch (e: unknown) {
    accountError.value = e instanceof Error ? e.message : 'Setup failed. Please try again.'
    // If registration failed, go back to account step
    step.value = 2
  }
  finally {
    isLoading.value = false
  }
}

function goToDashboard() {
  router.push('/')
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background p-4">
    <div class="w-full max-w-md">

      <!-- Progress bar (steps 1–3) -->
      <div v-if="step < 4" class="mb-6">
        <div class="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Setup</span>
          <span>Step {{ step }} of {{ TOTAL_STEPS }}</span>
        </div>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            class="h-full rounded-full bg-primary transition-all duration-300"
            :style="{ width: `${(step / TOTAL_STEPS) * 100}%` }"
          />
        </div>
      </div>

      <!-- ── Step 1: Welcome ── -->
      <Card v-if="step === 1">
        <CardHeader class="text-center">
          <div class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Icon icon="lucide:scale" class="h-7 w-7 text-primary" />
          </div>
          <CardTitle class="text-2xl">Welcome</CardTitle>
          <CardDescription class="text-base">
            Let's get your Bodyweight Tracker set up. This only takes a minute.
          </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <div class="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p class="mb-2 font-medium text-foreground">What you'll configure:</p>
            <ul class="space-y-1.5">
              <li class="flex items-center gap-2">
                <Icon icon="lucide:lock" class="h-3.5 w-3.5 shrink-0 text-primary" />
                Your account (email &amp; password)
              </li>
              <li class="flex items-center gap-2">
                <Icon icon="lucide:user" class="h-3.5 w-3.5 shrink-0 text-primary" />
                Body metrics for BMI &amp; tracking
              </li>
            </ul>
          </div>
          <Button class="w-full" @click="nextStep">
            Get Started
            <Icon icon="lucide:arrow-right" class="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <!-- ── Step 2: Account ── -->
      <Card v-else-if="step === 2">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Icon icon="lucide:lock" class="h-5 w-5 text-primary" />
            Create your account
          </CardTitle>
          <CardDescription>
            These credentials are stored in your self-hosted PocketBase instance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form class="flex flex-col gap-4" @submit.prevent="nextStep">
            <div class="flex flex-col gap-1.5">
              <Label for="setup-email">Email</Label>
              <Input
                id="setup-email"
                v-model="email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                required
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="setup-password">Password</Label>
              <Input
                id="setup-password"
                v-model="password"
                type="password"
                placeholder="At least 8 characters"
                autocomplete="new-password"
                required
                minlength="8"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="setup-password-confirm">Confirm Password</Label>
              <Input
                id="setup-password-confirm"
                v-model="passwordConfirm"
                type="password"
                placeholder="Repeat your password"
                autocomplete="new-password"
                required
              />
              <p v-if="passwordMismatch" class="text-xs text-destructive">
                Passwords do not match.
              </p>
            </div>

            <p v-if="accountError" class="text-sm text-destructive">
              {{ accountError }}
            </p>

            <div class="flex gap-2 pt-1">
              <Button type="button" variant="outline" class="flex-1" @click="prevStep">
                <Icon icon="lucide:arrow-left" class="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button type="submit" class="flex-1" :disabled="!step2Valid">
                Next
                <Icon icon="lucide:arrow-right" class="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <!-- ── Step 3: Profile ── -->
      <Card v-else-if="step === 3">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Icon icon="lucide:user" class="h-5 w-5 text-primary" />
            Your profile
          </CardTitle>
          <CardDescription>
            Optional details for BMI calculation and health context. You can update these later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form class="flex flex-col gap-5" @submit.prevent="finish">
            <!-- Weight Unit -->
            <div class="flex flex-col gap-1.5">
              <Label>Weight Unit</Label>
              <div class="flex gap-2">
                <Button
                  type="button"
                  :variant="unit === 'kg' ? 'default' : 'outline'"
                  size="sm"
                  @click="unit = 'kg'"
                >
                  kg
                </Button>
                <Button
                  type="button"
                  :variant="unit === 'lbs' ? 'default' : 'outline'"
                  size="sm"
                  @click="unit = 'lbs'"
                >
                  lbs
                </Button>
              </div>
            </div>

            <!-- Height -->
            <div class="flex flex-col gap-1.5">
              <Label for="setup-height">Height (cm)</Label>
              <div class="flex items-center gap-2">
                <Input
                  id="setup-height"
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
              <p class="text-xs text-muted-foreground">Always stored in centimetres.</p>
            </div>

            <!-- Goal Weight -->
            <div class="flex flex-col gap-1.5">
              <Label for="setup-goal">Goal Weight</Label>
              <div class="flex items-center gap-2">
                <Input
                  id="setup-goal"
                  v-model="goalWeightInput"
                  type="number"
                  min="20"
                  max="500"
                  step="0.1"
                  :placeholder="unit === 'kg' ? 'e.g. 75' : 'e.g. 165'"
                  class="max-w-[160px]"
                />
                <span class="text-sm text-muted-foreground">{{ unit }}</span>
              </div>
            </div>

            <!-- Date of Birth -->
            <div class="flex flex-col gap-1.5">
              <Label for="setup-dob">Date of Birth</Label>
              <Input
                id="setup-dob"
                v-model="dateOfBirth"
                type="date"
                class="max-w-[200px]"
              />
            </div>

            <!-- Biological Sex -->
            <div class="flex flex-col gap-1.5">
              <Label for="setup-sex">Biological Sex</Label>
              <Select v-model="sex">
                <SelectTrigger id="setup-sex" class="max-w-[200px]">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground">Optional — used for body composition context.</p>
            </div>

            <p v-if="accountError" class="text-sm text-destructive">
              {{ accountError }}
            </p>

            <div class="flex gap-2 pt-1">
              <Button type="button" variant="outline" class="flex-1" :disabled="isLoading" @click="prevStep">
                <Icon icon="lucide:arrow-left" class="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button type="submit" class="flex-1" :disabled="isLoading">
                <Icon v-if="isLoading" icon="lucide:loader-circle" class="mr-2 h-4 w-4 animate-spin" />
                <span v-else>Finish Setup</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <!-- ── Step 4: Done ── -->
      <Card v-else-if="step === 4">
        <CardHeader class="text-center">
          <div class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
            <Icon icon="lucide:circle-check" class="h-7 w-7 text-green-600" />
          </div>
          <CardTitle class="text-2xl">You're all set!</CardTitle>
          <CardDescription class="text-base">
            Your account is created and your tracker is ready to go.
          </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <div class="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p>
              Start by logging your first weight on the dashboard. You can update your profile
              settings at any time from the menu.
            </p>
          </div>
          <Button class="w-full" @click="goToDashboard">
            Go to Dashboard
            <Icon icon="lucide:arrow-right" class="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

    </div>
  </div>
</template>
