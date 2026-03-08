<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import ModeToggle from './ModeToggle.vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

function logout() {
  auth.logout()
  router.push('/auth')
}
</script>

<template>
  <header class="border-b bg-background">
    <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
      <RouterLink to="/" class="flex items-center gap-2 cursor-pointer">
        <Icon icon="lucide:scale" class="h-6 w-6 text-primary" />
        <h1 class="text-lg font-semibold">Bodyweight Tracker</h1>
      </RouterLink>
      <div class="flex items-center gap-2">
        <ModeToggle />

        <DropdownMenu v-if="auth.isAuthenticated">
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon">
              <Icon icon="lucide:user-circle" class="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel class="font-normal">
              <p class="text-xs text-muted-foreground">Signed in as</p>
              <p class="truncate text-sm font-medium">{{ auth.currentUser?.email }}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="router.push('/settings')">
              <Icon icon="lucide:settings" class="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="text-destructive focus:text-destructive" @click="logout">
              <Icon icon="lucide:log-out" class="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
</template>
