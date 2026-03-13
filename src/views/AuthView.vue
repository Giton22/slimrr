<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ref, computed } from 'vue'

const router = useRouter()
const auth = useAuthStore()

const mode = ref<'login' | 'register'>('login')
const displayName = ref('')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')

const passwordMismatch = computed(() =>
  mode.value === 'register'
  && passwordConfirm.value.length > 0
  && password.value !== passwordConfirm.value,
)

const registerValid = computed(() =>
  email.value.trim().length > 0
  && password.value.length >= 8
  && password.value === passwordConfirm.value,
)

function switchMode() {
  auth.clearError()
  mode.value = mode.value === 'login' ? 'register' : 'login'
}

async function submit() {
  try {
    if (mode.value === 'login') {
      await auth.login(email.value, password.value)
      router.push('/')
    }
    else {
      await auth.register(email.value.trim(), password.value, displayName.value.trim() || undefined)
      router.push('/settings')
    }
  }
  catch {
    // error is displayed via auth.error
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
    <Card class="w-full max-w-sm shadow-warm-lg">
      <CardHeader class="text-center">
        <div class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Icon icon="lucide:scale" class="h-6 w-6 text-primary" />
        </div>
        <CardTitle class="text-xl">
          {{ mode === 'login' ? 'Welcome back' : 'Create account' }}
        </CardTitle>
        <CardDescription>
          {{ mode === 'login' ? 'Sign in to your bodyweight tracker' : 'Set up a new account' }}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" @submit.prevent="submit">
          <div v-if="mode === 'register'" class="flex flex-col gap-1.5">
            <Label for="display-name">Display Name</Label>
            <Input
              id="display-name"
              v-model="displayName"
              type="text"
              placeholder="How others will see you"
              autocomplete="name"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="email">Email</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              :placeholder="mode === 'register' ? 'At least 8 characters' : '••••••••'"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              required
              :minlength="mode === 'register' ? 8 : undefined"
            />
          </div>

          <div v-if="mode === 'register'" class="flex flex-col gap-1.5">
            <Label for="password-confirm">Confirm Password</Label>
            <Input
              id="password-confirm"
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

          <p v-if="auth.error" class="text-sm text-destructive">
            {{ auth.error }}
          </p>

          <Button
            type="submit"
            class="w-full"
            :disabled="auth.isLoading || (mode === 'register' && !registerValid)"
          >
            <Icon v-if="auth.isLoading" icon="lucide:loader-circle" class="animate-spin" />
            {{ mode === 'login' ? 'Sign in' : 'Create account' }}
          </Button>
        </form>

        <p class="mt-4 text-center text-sm text-muted-foreground">
          {{ mode === 'login' ? "Don't have an account?" : 'Already have an account?' }}
          <button
            type="button"
            class="ml-1 font-medium text-primary underline-offset-4 hover:underline"
            @click="switchMode"
          >
            {{ mode === 'login' ? 'Create one' : 'Sign in' }}
          </button>
        </p>
      </CardContent>
    </Card>
  </div>
</template>
