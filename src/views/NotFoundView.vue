<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { Button } from '@/components/ui/button'

const router = useRouter()
</script>

<template>
  <div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 py-6 text-center sm:py-8">
    <Icon icon="lucide:compass" class="h-16 w-16 text-muted-foreground/30" />
    <h1 class="text-4xl font-bold">404</h1>
    <p class="text-muted-foreground">This page doesn't exist.</p>
    <Button @click="router.push('/')">Go to Dashboard</Button>
  </div>
</template>
