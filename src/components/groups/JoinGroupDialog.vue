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
const emit = defineEmits<{ joined: [groupId: string] }>()

const store = useGroupsStore()

const code = ref('')
const isSubmitting = ref(false)
const error = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    code.value = ''
    error.value = ''
  }
})

function onCodeInput(e: Event) {
  const target = e.target as HTMLInputElement
  code.value = target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

async function submit() {
  if (code.value.length !== 8) return

  isSubmitting.value = true
  error.value = ''
  try {
    const group = await store.joinGroup(code.value)
    open.value = false
    emit('joined', group.id)
  } catch (e: any) {
    if (e.status === 404 || e.message?.includes('not found')) {
      error.value = 'Invalid invite code. Please check and try again.'
    } else {
      error.value = e.message || 'Failed to join group'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Join Group</DialogTitle>
        <DialogDescription>Enter the 8-character invite code to join a group.</DialogDescription>
      </DialogHeader>
      <form class="grid gap-4 py-4" @submit.prevent="submit">
        <div class="grid gap-2">
          <Label for="invite-code">Invite Code</Label>
          <Input
            id="invite-code"
            :value="code"
            placeholder="e.g. ABCD1234"
            class="font-mono text-center text-lg tracking-widest"
            maxlength="8"
            @input="onCodeInput"
          />
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <DialogFooter>
          <Button type="submit" :disabled="code.length !== 8 || isSubmitting">
            {{ isSubmitting ? 'Joining...' : 'Join Group' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
