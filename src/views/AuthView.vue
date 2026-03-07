<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ref } from 'vue'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')

async function submit() {
  try {
    await auth.login(email.value, password.value)
    router.push('/')
  }
  catch {
    // error is displayed via auth.error
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background p-4">
    <Card class="w-full max-w-sm">
      <CardHeader class="text-center">
        <div class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Icon icon="lucide:scale" class="h-6 w-6 text-primary" />
        </div>
        <CardTitle class="text-xl">
          Welcome back
        </CardTitle>
        <CardDescription>
          Sign in to your bodyweight tracker
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" @submit.prevent="submit">
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
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
          </div>

          <p v-if="auth.error" class="text-sm text-destructive">
            {{ auth.error }}
          </p>

          <Button type="submit" class="w-full" :disabled="auth.isLoading">
            <Icon v-if="auth.isLoading" icon="lucide:loader-circle" class="animate-spin" />
            Sign in
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
