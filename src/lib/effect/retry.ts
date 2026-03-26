import { Effect } from 'effect'
import { LoggerService } from '@/lib/effect/LoggerService'
import type { AppError } from '@/lib/effect/errors'

const RETRY_DELAYS_MS = [200, 500] as const

function formatCause(cause: unknown) {
  if (cause == null) return ''
  if (typeof cause === 'string') return cause
  if (cause instanceof Error) return cause.message

  try {
    return JSON.stringify(cause)
  } catch {
    return ''
  }
}

function unknownErrorLooksTransient(error: Extract<AppError, { _tag: 'UnknownPbError' }>) {
  const message = [error.message, formatCause(error.cause)].join(' ')
  return /network|fetch|timed?\s*out|load failed|socket|offline/i.test(message)
}

export function isTransientNetworkError(error: AppError) {
  return (
    error._tag === 'NetworkError' ||
    (error._tag === 'UnknownPbError' && unknownErrorLooksTransient(error))
  )
}

function retryLoop<A, E extends AppError, R>(
  effect: Effect.Effect<A, E, R | LoggerService>,
  operation: string,
  attempt: number,
): Effect.Effect<A, E, R | LoggerService> {
  return effect.pipe(
    Effect.catchAll((error) => {
      if (!isTransientNetworkError(error) || attempt >= RETRY_DELAYS_MS.length) {
        return Effect.fail(error)
      }

      const delayMs = RETRY_DELAYS_MS[attempt]
      if (delayMs === undefined) {
        return Effect.fail(error)
      }

      return Effect.gen(function* () {
        const logger = yield* LoggerService
        yield* logger.warn('Retrying transient network operation', {
          operation,
          attempt: attempt + 1,
          delayMs,
          errorTag: error._tag,
        })
        yield* Effect.sleep(delayMs)
        return yield* retryLoop(effect, operation, attempt + 1)
      })
    }),
  )
}

export function transientNetworkRetry<A, E extends AppError, R>(
  operation: string,
  effect: Effect.Effect<A, E, R | LoggerService>,
) {
  return retryLoop(effect, operation, 0)
}
