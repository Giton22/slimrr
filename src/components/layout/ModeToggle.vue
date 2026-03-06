<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useTheme } from '@/composables/useTheme'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const { theme, setTheme } = useTheme()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="icon">
        <Icon
          icon="lucide:sun"
          class="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
        />
        <Icon
          icon="lucide:moon"
          class="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
        />
        <span class="sr-only">Toggle theme</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" :side-offset="8">
      <DropdownMenuItem
        :class="theme === 'light' ? 'bg-accent' : ''"
        @click="setTheme('light')"
      >
        <Icon icon="lucide:sun" class="mr-2 h-4 w-4" />
        Light
      </DropdownMenuItem>
      <DropdownMenuItem
        :class="theme === 'dark' ? 'bg-accent' : ''"
        @click="setTheme('dark')"
      >
        <Icon icon="lucide:moon" class="mr-2 h-4 w-4" />
        Dark
      </DropdownMenuItem>
      <DropdownMenuItem
        :class="theme === 'system' ? 'bg-accent' : ''"
        @click="setTheme('system')"
      >
        <Icon icon="lucide:monitor" class="mr-2 h-4 w-4" />
        System
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
