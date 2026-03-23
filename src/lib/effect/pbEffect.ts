import { Effect } from 'effect'
import { ClientResponseError } from 'pocketbase'
import type PocketBase from 'pocketbase'
import { PocketBaseService } from '@/lib/effect/PocketBaseService'
import {
  AuthenticationError,
  NetworkError,
  NotFoundError,
  type PocketBaseError,
  UnknownPbError,
  ValidationError,
} from '@/lib/effect/errors'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return 'PocketBase request failed'
}

export function mapPbError(error: unknown, collection?: string): PocketBaseError {
  if (error instanceof ClientResponseError) {
    const fields = {
      message: getErrorMessage(error),
      collection,
      status: error.status,
      cause: error,
    }

    switch (error.status) {
      case 0:
        return new NetworkError(fields)
      case 400:
        return new ValidationError(fields)
      case 401:
      case 403:
        return new AuthenticationError(fields)
      case 404:
        return new NotFoundError(fields)
      default:
        return new UnknownPbError(fields)
    }
  }

  return new UnknownPbError({
    message: getErrorMessage(error),
    collection,
    cause: error,
  })
}

export function pbTry<A>(f: () => Promise<A>, collection?: string) {
  return Effect.tryPromise({
    try: f,
    catch: (error) => mapPbError(error, collection),
  })
}

export function fromPbPromise<A>(f: (pb: PocketBase) => Promise<A>, collection?: string) {
  return Effect.flatMap(PocketBaseService, (pb) => pbTry(() => f(pb), collection))
}
