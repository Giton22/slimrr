<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useHaptics } from '@/composables/useHaptics'

const props = defineProps<{
  items: (string | number)[]
  modelValue: number | string
  itemHeight?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | string]
}>()

const ITEM_H = props.itemHeight ?? 40
const VISIBLE_ITEMS = 5
const CENTER_INDEX = Math.floor(VISIBLE_ITEMS / 2)

const haptics = useHaptics()
const containerRef = ref<HTMLElement | null>(null)
const currentIndex = ref(0)
const offset = ref(0)
const isAnimating = ref(false)

// Touch tracking
let touchStartY = 0
let touchStartTime = 0
let lastTouchY = 0
let lastTouchTime = 0

const containerHeight = computed(() => ITEM_H * VISIBLE_ITEMS)

function getIndexForValue(value: number | string): number {
  const idx = props.items.indexOf(value)
  return idx >= 0 ? idx : 0
}

function scrollToIndex(idx: number, animate = true) {
  const clamped = Math.max(0, Math.min(props.items.length - 1, idx))
  if (clamped !== currentIndex.value) {
    haptics.light()
  }
  currentIndex.value = clamped
  isAnimating.value = animate
  offset.value = -clamped * ITEM_H
  emit('update:modelValue', props.items[clamped]!)

  if (animate) {
    setTimeout(() => {
      isAnimating.value = false
    }, 150)
  }
}

function onTouchStart(e: TouchEvent) {
  e.stopPropagation()
  isAnimating.value = false
  const touch = e.touches[0]!
  touchStartY = touch.clientY
  touchStartTime = Date.now()
  lastTouchY = touch.clientY
  lastTouchTime = Date.now()
}

function onTouchMove(e: TouchEvent) {
  e.stopPropagation()
  e.preventDefault()
  const touch = e.touches[0]!
  const deltaY = touch.clientY - touchStartY
  lastTouchY = touch.clientY
  lastTouchTime = Date.now()
  offset.value = -currentIndex.value * ITEM_H + deltaY
}

function onTouchEnd(e: TouchEvent) {
  e.stopPropagation()
  const deltaTime = Date.now() - lastTouchTime
  const velocity = deltaTime > 0 ? (lastTouchY - touchStartY) / (Date.now() - touchStartTime) : 0

  // Apply momentum
  const momentum = velocity * 150
  const targetOffset = offset.value + momentum
  const targetIndex = Math.round(-targetOffset / ITEM_H)

  scrollToIndex(targetIndex)
}

// Sync from external value changes
watch(
  () => props.modelValue,
  (val) => {
    const idx = getIndexForValue(val)
    if (idx !== currentIndex.value) {
      scrollToIndex(idx, true)
    }
  },
)

onMounted(() => {
  nextTick(() => {
    const idx = getIndexForValue(props.modelValue)
    currentIndex.value = idx
    offset.value = -idx * ITEM_H
  })
})

function getItemStyle(index: number) {
  const itemOffset = offset.value + index * ITEM_H
  const centerY = CENTER_INDEX * ITEM_H
  const distance = (itemOffset - centerY) / ITEM_H
  const absDistance = Math.abs(distance)

  const opacity = Math.max(0.2, 1 - absDistance * 0.3)
  const scale = Math.max(0.8, 1 - absDistance * 0.08)
  const rotateX = distance * -18

  return {
    transform: `perspective(300px) rotateX(${rotateX}deg) scale(${scale})`,
    opacity,
  }
}
</script>

<template>
  <div
    ref="containerRef"
    data-vaul-no-drag
    class="relative select-none overflow-hidden"
    :style="{ height: `${containerHeight}px`, touchAction: 'none' }"
    @touchstart.passive="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- Gradient masks -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 z-10"
      :style="{
        height: `${ITEM_H * 1.5}px`,
        background: 'linear-gradient(to bottom, var(--background), transparent)',
      }"
    />
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 z-10"
      :style="{
        height: `${ITEM_H * 1.5}px`,
        background: 'linear-gradient(to top, var(--background), transparent)',
      }"
    />

    <!-- Center highlight -->
    <div
      class="pointer-events-none absolute inset-x-2 z-[5] rounded-lg border border-primary/20 bg-primary/5"
      :style="{
        top: `${CENTER_INDEX * ITEM_H}px`,
        height: `${ITEM_H}px`,
      }"
    />

    <!-- Items -->
    <div
      :style="{
        transform: `translateY(${offset + CENTER_INDEX * ITEM_H}px)`,
        transition: isAnimating ? 'transform 0.15s ease-out' : 'none',
      }"
    >
      <div
        v-for="(item, i) in items"
        :key="i"
        class="flex items-center justify-center text-lg font-bold"
        :style="{ height: `${ITEM_H}px`, ...getItemStyle(i) }"
      >
        {{ item }}
      </div>
    </div>
  </div>
</template>
