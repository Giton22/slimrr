<script setup lang="ts">
import { ref } from 'vue'
import { QrcodeStream } from 'vue-qrcode-reader'
import { Icon } from '@iconify/vue'
import { Button } from '@/components/ui/button'
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog'
import { DialogTrigger } from '@/components/ui/dialog'

defineProps<{
  hideTrigger?: boolean
}>()

const emit = defineEmits<{
  scanned: [code: string]
}>()

const open = defineModel<boolean>('open', { default: false })
const errorMessage = ref('')

function onDetect(detectedCodes: DetectedBarcode[]) {
  if (detectedCodes.length > 0) {
    open.value = false
    emit('scanned', detectedCodes[0].rawValue)
  }
}

function onError(error: Error) {
  errorMessage.value = error.message
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger v-if="!hideTrigger" as-child>
      <Button variant="outline" size="icon" title="Scan barcode">
        <Icon icon="lucide:scan-barcode" class="h-4 w-4" />
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon icon="lucide:scan-barcode" class="h-5 w-5 text-primary" />
          Scan Barcode
        </DialogTitle>
        <DialogDescription> Point your camera at a food product barcode. </DialogDescription>
      </DialogHeader>

      <div class="py-4">
        <QrcodeStream
          v-if="open"
          :formats="['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']"
          :constraints="{ facingMode: 'environment' }"
          @detect="onDetect"
          @error="onError"
          class="mx-auto aspect-video w-full overflow-hidden rounded-lg"
        />
        <p v-if="errorMessage" class="mt-2 text-center text-sm text-destructive">
          {{ errorMessage }}
        </p>
      </div>
    </DialogContent>
  </Dialog>
</template>
