import { Effect } from 'effect'
import { LoggerService } from '@/lib/effect/LoggerService'
import { NotificationService } from '@/lib/effect/NotificationService'
import type { AppError } from '@/lib/effect/errors'

type ErrorTag = AppError['_tag']

export interface StoreErrorHandlingOptions<A> {
  readonly operation: string
  readonly defaultMessage?: string | null
  readonly messages?: Partial<Record<ErrorTag, string | null>>
  readonly fallback?: A | ((error: AppError) => A)
}

export function handleStoreError(
  error: AppError,
  options: Omit<StoreErrorHandlingOptions<never>, 'fallback'>,
) {
  return Effect.gen(function* () {
    const logger = yield* LoggerService
    const notification = yield* NotificationService

    yield* logger.error(`Store operation failed: ${options.operation}`, {
      operation: options.operation,
      errorTag: error._tag,
      message: 'message' in error ? error.message : undefined,
      collection: 'collection' in error ? error.collection : undefined,
    })

    const message = options.messages?.[error._tag] ?? options.defaultMessage ?? null
    if (message) {
      yield* notification.error(message)
    }
  })
}

export function recoverStoreEffect<A, E extends AppError, R>(
  effect: Effect.Effect<A, E, R | LoggerService | NotificationService>,
  options: StoreErrorHandlingOptions<A>,
) {
  return effect.pipe(
    Effect.catchAll((error) =>
      handleStoreError(error, options).pipe(
        Effect.flatMap(() => {
          if (options.fallback === undefined) {
            return Effect.fail(error)
          }

          return Effect.succeed(
            typeof options.fallback === 'function'
              ? (options.fallback as (err: AppError) => A)(error)
              : options.fallback,
          )
        }),
      ),
    ),
  )
}
