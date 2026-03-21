<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
import TopBar from './TopBar.vue'
import BottomNav from './BottomNav.vue'
</script>

<template>
  <div class="flex h-screen flex-col bg-background text-foreground">
    <AppSidebar />
    <div class="flex min-h-0 flex-1 flex-col lg:ml-64">
      <TopBar />
      <main class="relative flex-1 overflow-x-hidden overflow-y-auto pb-20 pt-safe lg:pb-0 lg:pt-0">
        <slot />
      </main>
    </div>
    <BottomNav />
  </div>
</template>
