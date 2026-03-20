import { ref, type Ref } from 'vue'
import { useHaptics } from '@/composables/useHaptics'

const THRESHOLD = 100

interface Options {
  onPrev: () => void
  onNext: () => void
}

export function useSwipeDayNavigation(containerRef: Ref<HTMLElement | null>, options: Options) {
  const offsetX = ref(0)
  const direction = ref<'left' | 'right' | null>(null)
  const haptics = useHaptics()

  let startX = 0
  let startY = 0
  let tracking = false
  let decided = false

  function onTouchStart(e: TouchEvent) {
    // Don't intercept swipes on meal entry items
    const target = e.target as HTMLElement
    if (target.closest('[data-swipe-item]')) return

    const touch = e.touches[0]!
    startX = touch.clientX
    startY = touch.clientY
    tracking = true
    decided = false
    offsetX.value = 0
    direction.value = null
  }

  function onTouchMove(e: TouchEvent) {
    if (!tracking) return

    const touch = e.touches[0]!
    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY

    // Decide direction in first 10px of movement
    if (!decided) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
        // Vertical scroll — bail out
        tracking = false
        return
      }
      if (Math.abs(deltaX) > 10) {
        decided = true
      } else {
        return
      }
    }

    e.preventDefault()
    offsetX.value = deltaX
    direction.value = deltaX > 0 ? 'right' : 'left'
  }

  function onTouchEnd() {
    if (!tracking) return
    tracking = false

    if (offsetX.value > THRESHOLD) {
      haptics.light()
      options.onPrev()
      direction.value = 'right'
    } else if (offsetX.value < -THRESHOLD) {
      haptics.light()
      options.onNext()
      direction.value = 'left'
    }

    offsetX.value = 0
  }

  return {
    offsetX,
    direction,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}
