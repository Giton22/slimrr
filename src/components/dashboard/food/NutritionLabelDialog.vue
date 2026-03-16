<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Icon } from '@iconify/vue'
import { useFoodStore } from '@/stores/food'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import FoodItemCard from './FoodItemCard.vue'

const emit = defineEmits<{
  scanned: [
    result: {
      barcode: string
      name: string
      brand: string
      caloriesPer100g: number
      proteinPer100g: number
      carbsPer100g: number
      fatPer100g: number
      servingG: number
      offId: string
    },
  ]
}>()

const foodStore = useFoodStore()

const open = ref(false)
const imagePreview = ref<string | null>(null)
const selectedFile = ref<File | null>(null)
const analyzing = ref(false)
const parsedResult = ref<{
  barcode: string
  name: string
  brand: string
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  servingG: number
  offId: string
} | null>(null)
const errorMessage = ref('')
const fileInputCamera = ref<HTMLInputElement | null>(null)
const fileInputUpload = ref<HTMLInputElement | null>(null)

function onOpenChange(value: boolean) {
  open.value = value
  if (!value) {
    resetState()
  }
}

function resetState() {
  imagePreview.value = null
  selectedFile.value = null
  analyzing.value = false
  parsedResult.value = null
  errorMessage.value = ''
}

function triggerCameraInput() {
  fileInputCamera.value?.click()
}

function triggerUploadInput() {
  fileInputUpload.value?.click()
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  selectedFile.value = file
  parsedResult.value = null
  errorMessage.value = ''

  const reader = new FileReader()
  reader.onload = (e) => {
    imagePreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file)

  // Reset input so the same file can be re-selected
  input.value = ''
}

async function analyze() {
  if (!selectedFile.value || analyzing.value) return

  analyzing.value = true
  errorMessage.value = ''

  try {
    const result = await foodStore.parseNutritionLabel(selectedFile.value)
    if (result) {
      parsedResult.value = result
    } else {
      errorMessage.value = 'Failed to extract nutrition data. Try a clearer photo.'
    }
  } catch {
    errorMessage.value = 'Failed to analyze the label. Please try again.'
  } finally {
    analyzing.value = false
  }
}

function useResult() {
  if (!parsedResult.value) return
  emit('scanned', parsedResult.value)
  open.value = false
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogTrigger as-child>
      <Button variant="outline" size="icon" title="Scan nutrition label">
        <Icon icon="lucide:camera" class="h-4 w-4" />
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon icon="lucide:camera" class="h-5 w-5 text-primary" />
          Scan Nutrition Label
        </DialogTitle>
        <DialogDescription>
          Take a photo or upload an image of a nutrition facts label.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <input
          ref="fileInputCamera"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          @change="onFileSelected"
        />
        <input
          ref="fileInputUpload"
          type="file"
          accept="image/*"
          class="hidden"
          @change="onFileSelected"
        />

        <!-- No image yet -->
        <div v-if="!imagePreview" class="flex gap-3">
          <button
            type="button"
            class="flex h-32 flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50"
            @click="triggerCameraInput"
          >
            <Icon icon="lucide:camera" class="h-7 w-7" />
            <span class="text-sm font-medium">Take Photo</span>
          </button>
          <button
            type="button"
            class="flex h-32 flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50"
            @click="triggerUploadInput"
          >
            <Icon icon="lucide:image" class="h-7 w-7" />
            <span class="text-sm font-medium">Upload Image</span>
          </button>
        </div>

        <!-- Image preview -->
        <div v-else class="space-y-3">
          <div class="relative">
            <img
              :src="imagePreview"
              alt="Nutrition label"
              class="w-full rounded-lg border border-border object-contain"
              style="max-height: 240px"
            />
            <button
              type="button"
              class="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground"
              @click="resetState"
            >
              <Icon icon="lucide:x" class="h-4 w-4" />
            </button>
          </div>

          <!-- Analyze button (before result) -->
          <div v-if="!parsedResult && !analyzing">
            <div class="flex gap-2">
              <Button variant="outline" size="sm" class="flex-1" @click="triggerUploadInput">
                <Icon icon="lucide:refresh-cw" class="mr-2 h-4 w-4" />
                Retake
              </Button>
              <Button size="sm" class="flex-1" @click="analyze">
                <Icon icon="lucide:sparkles" class="mr-2 h-4 w-4" />
                Analyze
              </Button>
            </div>
          </div>

          <!-- Loading state -->
          <div
            v-if="analyzing"
            class="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground"
          >
            <Icon icon="lucide:loader-circle" class="h-4 w-4 animate-spin" />
            Analyzing nutrition label...
          </div>

          <!-- Error state -->
          <p v-if="errorMessage" class="text-center text-sm text-destructive">
            {{ errorMessage }}
          </p>

          <!-- Parsed result -->
          <div v-if="parsedResult" class="space-y-3">
            <p class="text-xs font-medium text-muted-foreground">Extracted data</p>
            <FoodItemCard
              :name="parsedResult.name"
              :brand="parsedResult.brand || undefined"
              :calories-per100g="parsedResult.caloriesPer100g"
              :protein-per100g="parsedResult.proteinPer100g"
              :carbs-per100g="parsedResult.carbsPer100g"
              :fat-per100g="parsedResult.fatPer100g"
            />
            <DialogFooter class="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" @click="triggerUploadInput"> Retake </Button>
              <Button size="sm" @click="useResult">
                <Icon icon="lucide:check" class="mr-2 h-4 w-4" />
                Use This
              </Button>
            </DialogFooter>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
