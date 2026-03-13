import { ref, computed, type Ref, type ComputedRef } from 'vue'

interface NumericFieldOptions {
  min?: number
  max?: number
  required?: boolean
  allowDecimals?: boolean
}

interface NumericFieldReturn {
  displayValue: Ref<string>
  numericValue: ComputedRef<number | undefined>
  error: Ref<string>
  isInvalid: ComputedRef<boolean>
  shaking: Ref<boolean>
  validate: () => boolean
  reset: (value?: number) => void
  inputAttrs: ComputedRef<Record<string, unknown>>
}

export function useNumericField(options: NumericFieldOptions = {}): NumericFieldReturn {
  const { min, max, required = true, allowDecimals = true } = options

  const displayValue = ref('')
  const error = ref('')
  const shaking = ref(false)

  const numericValue = computed<number | undefined>(() => {
    const trimmed = displayValue.value.trim()
    if (trimmed === '') return undefined
    const n = Number(trimmed)
    if (isNaN(n)) return undefined
    return n
  })

  const isInvalid = computed(() => error.value !== '')

  const inputAttrs = computed(() => ({
    ...(isInvalid.value ? { 'aria-invalid': true } : {}),
  }))

  function triggerShake() {
    shaking.value = true
    setTimeout(() => { shaking.value = false }, 400)
  }

  function validate(): boolean {
    const trimmed = displayValue.value.trim()

    if (trimmed === '') {
      if (required) {
        error.value = 'This field is required'
        triggerShake()
        return false
      }
      error.value = ''
      return true
    }

    const n = Number(trimmed)

    if (isNaN(n)) {
      error.value = 'Please enter a valid number'
      triggerShake()
      return false
    }

    if (!allowDecimals && !Number.isInteger(n)) {
      error.value = 'Please enter a whole number'
      triggerShake()
      return false
    }

    if (min !== undefined && n < min) {
      error.value = `Must be at least ${min}`
      triggerShake()
      return false
    }

    if (max !== undefined && n > max) {
      error.value = `Must be at most ${max}`
      triggerShake()
      return false
    }

    error.value = ''
    return true
  }

  function reset(value?: number) {
    error.value = ''
    shaking.value = false
    displayValue.value = value !== undefined ? String(value) : ''
  }

  return {
    displayValue,
    numericValue,
    error,
    isInvalid,
    shaking,
    validate,
    reset,
    inputAttrs,
  }
}
