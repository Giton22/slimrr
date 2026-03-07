import { ClientResponseError } from 'pocketbase'
import { pb } from '@/lib/pocketbase'

export interface AppConfigResult {
  setupComplete: boolean
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
    }
  }
  catch (e: unknown) {
    if (e instanceof ClientResponseError && e.status === 404) {
      // Collection doesn't exist — this is a legacy instance with existing users.
      return { setupComplete: true, collectionMissing: true }
    }
    throw e
  }
}

/**
 * Marks setup as complete. Requires the user to be authenticated
 * (the update rule on app_config is `@request.auth.id != ""`).
 *
 * Fetches the record fresh instead of relying on a cached ID, so this is
 * safe even if the store was hydrated before the user authenticated.
 */
export async function markSetupComplete(): Promise<void> {
  const records = await pb.collection('app_config').getList(1, 1)
  const record = records.items[0]
  if (!record) {
    // No config record exists — nothing to mark, treat setup as complete.
    return
  }
  await pb.collection('app_config').update(record.id, { setup_complete: true })
}
