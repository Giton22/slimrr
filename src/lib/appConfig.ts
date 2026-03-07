import { ClientResponseError } from 'pocketbase'
import { pb } from '@/lib/pocketbase'

export interface AppConfigResult {
  setupComplete: boolean
  recordId: string
  /** true when app_config collection doesn't exist (legacy instance) */
  collectionMissing?: boolean
}

/**
 * Fetches the single app_config record.
 * This collection is publicly readable (no auth required), so it works
 * before any user has registered — perfect for first-launch detection.
 *
 * Returns { setupComplete: true, collectionMissing: true } when the collection
 * doesn't exist yet (old instance without this migration), so callers can
 * distinguish a missing collection from an explicit setup_complete: false.
 */
export async function checkSetupComplete(): Promise<AppConfigResult> {
  try {
    const records = await pb.collection('app_config').getList(1, 1)
    const record = records.items[0]
    return {
      setupComplete: record?.setup_complete === true,
      recordId: record?.id ?? '',
    }
  }
  catch (e: unknown) {
    if (e instanceof ClientResponseError && e.status === 404) {
      // Collection doesn't exist — this is a legacy instance with existing users.
      return { setupComplete: true, recordId: '', collectionMissing: true }
    }
    throw e
  }
}

/**
 * Marks setup as complete. Requires the user to be authenticated
 * (the update rule on app_config is `@request.auth.id != ""`).
 */
export async function markSetupComplete(recordId: string): Promise<void> {
  await pb.collection('app_config').update(recordId, { setup_complete: true })
}
