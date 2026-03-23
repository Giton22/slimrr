import { Effect } from 'effect'
import { fromPbPromise } from '@/lib/effect'

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
export function checkSetupComplete() {
  return fromPbPromise((pb) => pb.collection('app_config').getList(1, 1), 'app_config').pipe(
    Effect.map(
      (records): AppConfigResult => ({
        setupComplete: records.items[0]?.setup_complete === true,
      }),
    ),
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed<AppConfigResult>({ setupComplete: true, collectionMissing: true }),
    ),
  )
}

/**
 * Marks setup as complete. Requires the user to be authenticated
 * (the update rule on app_config is `@request.auth.id != ""`).
 *
 * Fetches the record fresh instead of relying on a cached ID, so this is
 * safe even if the store was hydrated before the user authenticated.
 */
export function markSetupComplete() {
  return fromPbPromise((pb) => pb.collection('app_config').getList(1, 1), 'app_config').pipe(
    Effect.flatMap((records) => {
      const record = records.items[0]
      if (!record) {
        return Effect.void
      }

      return fromPbPromise(
        (pb) => pb.collection('app_config').update(record.id, { setup_complete: true }),
        'app_config',
      ).pipe(Effect.asVoid)
    }),
  )
}
