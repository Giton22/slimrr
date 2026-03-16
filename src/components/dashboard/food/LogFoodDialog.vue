<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Icon } from '@iconify/vue'
import type { FoodItem, MealType } from '@/types'
import { useFoodStore } from '@/stores/food'
import { useNumericField } from '@/composables/useNumericField'
import { todayISO } from '@/lib/date'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import BarcodeScannerDialog from './BarcodeScannerDialog.vue'
import NutritionLabelDialog from './NutritionLabelDialog.vue'
import FoodItemCard from './FoodItemCard.vue'

const props = defineProps<{
  initialDate?: string
  initialMealType?: MealType
}>()

const foodStore = useFoodStore()

const open = defineModel<boolean>('open', { default: false })
const saving = ref(false)
const date = ref(todayISO())
const mealType = ref<MealType>('lunch')
const amountField = useNumericField({ min: 1, max: 99999, required: true, allowDecimals: false })
const selectedFood = ref<FoodItem | null>(null)
const pendingOFFResult = ref<{
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
const lookingUpBarcode = ref(false)

// Step: 'search' (pick food) or 'amount' (set amount and log)
const step = ref<'search' | 'amount'>('search')

const activeFoodName = computed(
  () => selectedFood.value?.name ?? pendingOFFResult.value?.name ?? '',
)
const activeFoodBrand = computed(() => selectedFood.value?.brand ?? pendingOFFResult.value?.brand)
const activeFoodCalPer100 = computed(
  () => selectedFood.value?.caloriesPer100g ?? pendingOFFResult.value?.caloriesPer100g ?? 0,
)
const activeFoodProtPer100 = computed(
  () => selectedFood.value?.proteinPer100g ?? pendingOFFResult.value?.proteinPer100g ?? 0,
)
const activeFoodCarbsPer100 = computed(
  () => selectedFood.value?.carbsPer100g ?? pendingOFFResult.value?.carbsPer100g ?? 0,
)
const activeFoodFatPer100 = computed(
  () => selectedFood.value?.fatPer100g ?? pendingOFFResult.value?.fatPer100g ?? 0,
)

const previewCalories = computed(() => {
  const amount = amountField.numericValue.value
  if (!amount || !activeFoodCalPer100.value) return null
  return Math.round((activeFoodCalPer100.value * amount) / 100)
})

const previewProtein = computed(() => {
  const amount = amountField.numericValue.value
  if (!amount) return null
  return Math.round(((activeFoodProtPer100.value ?? 0) * amount) / 100)
})

const previewCarbs = computed(() => {
  const amount = amountField.numericValue.value
  if (!amount) return null
  return Math.round(((activeFoodCarbsPer100.value ?? 0) * amount) / 100)
})

const previewFat = computed(() => {
  const amount = amountField.numericValue.value
  if (!amount) return null
  return Math.round(((activeFoodFatPer100.value ?? 0) * amount) / 100)
})

function resetForm() {
  selectedFood.value = null
  pendingOFFResult.value = null
  step.value = 'search'
  amountField.reset(100)
  date.value = props.initialDate ?? todayISO()
  mealType.value = props.initialMealType ?? guessCurrentMeal()
  searchQuery.value = ''
  personalMatches.value = []
  foodStore.searchResults = []
}

function guessCurrentMeal(): MealType {
  const hour = new Date().getHours()
  if (hour < 10) return 'breakfast'
  if (hour < 14) return 'lunch'
  if (hour < 17) return 'snack'
  return 'dinner'
}

function onOpenChange(value: boolean) {
  open.value = value
  if (value) resetForm()
}

function selectPersonalFood(item: FoodItem) {
  selectedFood.value = item
  pendingOFFResult.value = null
  amountField.reset(item.defaultServingG || 100)
  step.value = 'amount'
}

async function selectOFFResult(result: typeof pendingOFFResult.value) {
  if (!result) return
  pendingOFFResult.value = result
  selectedFood.value = null
  amountField.reset(result.servingG || 100)
  step.value = 'amount'
}

async function onBarcodeScanned(code: string) {
  lookingUpBarcode.value = true
  try {
    const result = await foodStore.lookupBarcode(code)
    if (result) {
      pendingOFFResult.value = result
      selectedFood.value = null
      amountField.reset(result.servingG || 100)
      step.value = 'amount'
      open.value = true
    } else {
      toast.error('Product not found for this barcode')
    }
  } finally {
    lookingUpBarcode.value = false
  }
}

function onLabelScanned(result: typeof pendingOFFResult.value) {
  if (!result) return
  pendingOFFResult.value = result
  selectedFood.value = null
  amountField.reset(result.servingG || 100)
  step.value = 'amount'
  open.value = true
}

function goBackToSearch() {
  selectedFood.value = null
  pendingOFFResult.value = null
  step.value = 'search'
}

async function save(addAnother: boolean) {
  if (!amountField.validate() || saving.value) return

  saving.value = true
  try {
    let foodItem = selectedFood.value

    // If from OFF/label result and not yet in personal library, add it
    if (!foodItem && pendingOFFResult.value) {
      const isLabelScan = !pendingOFFResult.value.barcode && !pendingOFFResult.value.offId
      foodItem = await foodStore.addFoodItem({
        name: pendingOFFResult.value.name,
        brand: pendingOFFResult.value.brand || undefined,
        barcode: pendingOFFResult.value.barcode || undefined,
        caloriesPer100g: pendingOFFResult.value.caloriesPer100g,
        proteinPer100g: pendingOFFResult.value.proteinPer100g || undefined,
        carbsPer100g: pendingOFFResult.value.carbsPer100g || undefined,
        fatPer100g: pendingOFFResult.value.fatPer100g || undefined,
        defaultServingG: pendingOFFResult.value.servingG || 100,
        source: isLabelScan ? 'nutrition_label' : 'openfoodfacts',
        offId: pendingOFFResult.value.offId || undefined,
      })
    }

    await foodStore.logFood(
      date.value,
      mealType.value,
      foodItem,
      Math.round(amountField.numericValue.value!),
    )

    toast.success(`Logged ${activeFoodName.value}`)

    if (addAnother) {
      resetForm()
    } else {
      open.value = false
    }
  } catch {
    toast.error('Failed to log food')
  } finally {
    saving.value = false
  }
}

// Search logic (inlined from FoodSearchInput)
const searchQuery = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const personalMatches = ref<FoodItem[]>([])

const hasSearchResults = computed(
  () =>
    searchQuery.value.trim() &&
    (personalMatches.value.length > 0 || foodStore.searchResults.length > 0),
)

watch(searchQuery, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer)

  if (!q.trim()) {
    personalMatches.value = []
    foodStore.searchResults = []
    return
  }

  const lower = q.toLowerCase()
  personalMatches.value = foodStore.foodItems
    .filter((f) => f.name.toLowerCase().includes(lower) || f.brand?.toLowerCase().includes(lower))
    .slice(0, 5)

  debounceTimer = setTimeout(() => {
    void foodStore.searchFoods(q)
  }, 400)
})

function selectPersonalItem(item: FoodItem) {
  searchQuery.value = ''
  selectPersonalFood(item)
}

function selectSearchResult(result: (typeof foodStore.searchResults)[number]) {
  searchQuery.value = ''
  selectOFFResult(result)
}

// Pre-fill recent foods for quick access
const recentFoodsForDisplay = computed(() => foodStore.recentFoods.slice(0, 6))
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogTrigger as-child>
      <Button>
        <Icon icon="lucide:plus" class="mr-2 h-4 w-4" />
        Log Food
      </Button>
    </DialogTrigger>
    <DialogContent class="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon icon="lucide:utensils" class="h-5 w-5 text-primary" />
          Log Food
        </DialogTitle>
        <DialogDescription> Search or scan a food item to log. </DialogDescription>
      </DialogHeader>

      <!-- Step 1: Search / Select food -->
      <div v-if="step === 'search'" class="flex min-h-0 flex-1 flex-col space-y-3 py-4">
        <!-- Fixed top row: search input + scan buttons -->
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <Icon
              icon="lucide:search"
              class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input v-model="searchQuery" type="text" placeholder="Search foods..." class="pl-9" />
            <Icon
              v-if="foodStore.isSearching"
              icon="lucide:loader-circle"
              class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          </div>
          <BarcodeScannerDialog @scanned="onBarcodeScanned" />
          <NutritionLabelDialog v-if="foodStore.visionConfigured" @scanned="onLabelScanned" />
        </div>

        <!-- Scrollable content: search results OR recent foods -->
        <div class="min-h-0 flex-1 overflow-y-auto">
          <div
            v-if="lookingUpBarcode"
            class="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
          >
            <Icon icon="lucide:loader-circle" class="h-4 w-4 animate-spin" />
            Looking up barcode...
          </div>

          <!-- Search results -->
          <div v-else-if="hasSearchResults" class="space-y-3">
            <div v-if="personalMatches.length > 0">
              <p class="px-3 pt-2 text-xs font-medium text-muted-foreground">My Foods</p>
              <div class="space-y-1.5 p-1.5">
                <FoodItemCard
                  v-for="item in personalMatches"
                  :key="item.id"
                  :name="item.name"
                  :brand="item.brand"
                  :calories-per100g="item.caloriesPer100g"
                  :protein-per100g="item.proteinPer100g"
                  :carbs-per100g="item.carbsPer100g"
                  :fat-per100g="item.fatPer100g"
                  clickable
                  @select="selectPersonalItem(item)"
                />
              </div>
            </div>

            <div v-if="foodStore.searchResults.length > 0">
              <p class="px-3 pt-2 text-xs font-medium text-muted-foreground">OpenFoodFacts</p>
              <div class="space-y-1.5 p-1.5">
                <FoodItemCard
                  v-for="result in foodStore.searchResults"
                  :key="result.barcode"
                  :name="result.name"
                  :brand="result.brand"
                  :calories-per100g="result.caloriesPer100g"
                  :protein-per100g="result.proteinPer100g"
                  :carbs-per100g="result.carbsPer100g"
                  :fat-per100g="result.fatPer100g"
                  clickable
                  @select="selectSearchResult(result)"
                />
              </div>
            </div>
          </div>

          <!-- Recent foods -->
          <div v-else-if="recentFoodsForDisplay.length > 0 && !lookingUpBarcode">
            <p class="mb-2 text-xs font-medium text-muted-foreground">Recent</p>
            <div class="space-y-1.5">
              <FoodItemCard
                v-for="item in recentFoodsForDisplay"
                :key="item.id"
                :name="item.name"
                :brand="item.brand"
                :calories-per100g="item.caloriesPer100g"
                :protein-per100g="item.proteinPer100g"
                :carbs-per100g="item.carbsPer100g"
                :fat-per100g="item.fatPer100g"
                clickable
                @select="selectPersonalFood(item)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Set amount and meal type -->
      <div v-if="step === 'amount'" class="space-y-4 py-4">
        <button
          type="button"
          class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          @click="goBackToSearch"
        >
          <Icon icon="lucide:arrow-left" class="h-3.5 w-3.5" />
          Back to search
        </button>

        <!-- Selected food summary -->
        <FoodItemCard
          :name="activeFoodName"
          :brand="activeFoodBrand"
          :calories-per100g="activeFoodCalPer100"
          :protein-per100g="activeFoodProtPer100"
          :carbs-per100g="activeFoodCarbsPer100"
          :fat-per100g="activeFoodFatPer100"
        />

        <div class="grid grid-cols-2 gap-3">
          <div class="grid gap-2">
            <Label for="log-date">Date</Label>
            <Input id="log-date" v-model="date" type="date" />
          </div>
          <div class="grid gap-2">
            <Label for="log-meal">Meal</Label>
            <Select v-model="mealType">
              <SelectTrigger id="log-meal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
                <SelectItem value="snack">Snack</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="grid gap-2">
          <Label for="log-amount">Amount (g)</Label>
          <Input
            id="log-amount"
            v-model="amountField.displayValue.value"
            type="text"
            inputmode="numeric"
            placeholder="e.g. 100"
            v-bind="amountField.inputAttrs.value"
            :class="{ 'animate-shake': amountField.shaking.value }"
          />
          <p v-if="amountField.error.value" class="text-xs text-destructive">
            {{ amountField.error.value }}
          </p>
        </div>

        <!-- Live preview -->
        <div
          v-if="previewCalories !== null"
          class="rounded-lg border border-border bg-muted/30 p-3"
        >
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Total</span>
            <span class="font-semibold">{{ previewCalories }} kcal</span>
          </div>
          <div class="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
            <span>P {{ previewProtein }}g</span>
            <span>C {{ previewCarbs }}g</span>
            <span>F {{ previewFat }}g</span>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0">
          <Button type="button" variant="outline" @click="save(true)" :disabled="saving">
            Save & Add Another
          </Button>
          <Button type="button" @click="save(false)" :disabled="saving">
            <Icon v-if="saving" icon="lucide:loader-circle" class="mr-2 h-4 w-4 animate-spin" />
            Save
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>
