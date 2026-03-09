import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AuthRecord } from 'pocketbase'
import { pb } from '@/lib/pocketbase'
import { checkSetupComplete, markSetupComplete } from '@/lib/appConfig'
import { useWeightStore } from '@/stores/weight'

export const useAuthStore = defineStore('auth', () => {
  // PocketBase persists auth state in localStorage automatically via authStore
  const currentUser = ref<AuthRecord | null>(pb.authStore.record)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Setup/first-run state
  // null = not yet checked, true = setup done, false = first launch
  const setupComplete = ref<boolean | null>(null)

  const isAuthenticated = computed(() => currentUser.value !== null && pb.authStore.isValid)

  // Keep local ref in sync when PocketBase auth state changes (e.g. token refresh)
  pb.authStore.onChange((token, record) => {
    currentUser.value = record
  })

  async function login(email: string, password: string) {
    isLoading.value = true
    error.value = null
    try {
      const auth = await pb.collection('users').authWithPassword(email, password)
      currentUser.value = auth.record
    }
    catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Login failed'
      throw e
    }
    finally {
      isLoading.value = false
    }
  }

  async function register(email: string, password: string, name?: string) {
    isLoading.value = true
    error.value = null
    try {
      await pb.collection('users').create({
        email,
        password,
        passwordConfirm: password,
        ...(name ? { name } : {}),
      })
      // Auto-login after successful registration
      await login(email, password)
    }
    catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Registration failed'
      throw e
    }
    finally {
      isLoading.value = false
    }
  }

  async function updateName(name: string) {
    const userId = pb.authStore.record?.id
    if (!userId) return
    await pb.collection('users').update(userId, { name })
    currentUser.value = pb.authStore.record
  }

  function logout() {
    // Unsubscribe while token is still valid to avoid 403
    useWeightStore().unsubscribeRealtime()
    pb.authStore.clear()
    currentUser.value = null
  }

  function clearError() {
    error.value = null
  }

  // In-flight promise to deduplicate concurrent checkSetup() calls
  let _checkSetupPromise: Promise<boolean> | null = null

  /**
   * Check whether first-run setup has been completed.
   * Safe to call multiple times — uses cached result after first fetch.
   * Deduplicates concurrent calls so only one HTTP request is made.
   */
  async function checkSetup(): Promise<boolean> {
    // Already resolved — return cached value
    if (setupComplete.value !== null) return setupComplete.value

    // Deduplicate: if a fetch is in flight, wait for it
    if (_checkSetupPromise) return _checkSetupPromise

    _checkSetupPromise = (async () => {
      try {
        const result = await checkSetupComplete()
        setupComplete.value = result.setupComplete
        if (result.collectionMissing) {
          console.info('[checkSetup] app_config collection not found — treating as legacy instance (setup complete)')
        }
      }
      catch (e: unknown) {
        // Network error or unexpected failure — fall back to login page so
        // users aren't permanently locked out.
        setupComplete.value = true
        console.warn('[checkSetup] Unexpected error fetching app_config, assuming setup complete:', e)
      }
      finally {
        _checkSetupPromise = null
      }
      return setupComplete.value!
    })()

    return _checkSetupPromise
  }

  /**
   * Mark setup as complete. Must be called after the user is authenticated
   * (app_config updateRule requires a valid auth token).
   */
  async function completeSetup(): Promise<void> {
    await markSetupComplete()
    setupComplete.value = true
  }

  return {
    currentUser,
    isLoading,
    error,
    isAuthenticated,
    setupComplete,
    login,
    register,
    updateName,
    logout,
    clearError,
    checkSetup,
    completeSetup,
  }
})
