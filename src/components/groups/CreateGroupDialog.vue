<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGroupsStore } from '@/stores/groups'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [groupId: string] }>()

const store = useGroupsStore()

const name = ref('')
const description = ref('')
const isSubmitting = ref(false)
const error = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    name.value = ''
    description.value = ''
    error.value = ''
  }
})

async function submit() {
  if (!name.value.trim()) return

  isSubmitting.value = true
  error.value = ''
  try {
    const group = await store.createGroup(name.value.trim(), description.value.trim() || undefined)
    open.value = false
    if (group) emit('created', group.id)
  } catch (e: any) {
    error.value = e.message || 'Failed to create group'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Create Group</DialogTitle>
        <DialogDescription>Create a new group and invite others with a code.</DialogDescription>
      </DialogHeader>
      <form class="grid gap-4 py-4" @submit.prevent="submit">
        <div class="grid gap-2">
          <Label for="group-name">Group Name</Label>
          <Input id="group-name" v-model="name" placeholder="e.g. Fitness Buddies" />
        </div>
        <div class="grid gap-2">
          <Label for="group-desc">Description (optional)</Label>
          <Input id="group-desc" v-model="description" placeholder="What's this group about?" />
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <DialogFooter>
          <Button type="submit" :disabled="!name.trim() || isSubmitting">
            {{ isSubmitting ? 'Creating...' : 'Create Group' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
