import { Data } from 'effect'

interface PocketBaseErrorFields {
  readonly message: string
  readonly collection?: string
  readonly status?: number
  readonly cause: unknown
}

export class NotFoundError extends Data.TaggedError('NotFoundError')<PocketBaseErrorFields> {}

export class AuthenticationError extends Data.TaggedError(
  'AuthenticationError',
)<PocketBaseErrorFields> {}

export class NetworkError extends Data.TaggedError('NetworkError')<PocketBaseErrorFields> {}

export class ValidationError extends Data.TaggedError('ValidationError')<PocketBaseErrorFields> {}

export class UnknownPbError extends Data.TaggedError('UnknownPbError')<PocketBaseErrorFields> {}

export type PocketBaseError =
  | NotFoundError
  | AuthenticationError
  | NetworkError
  | ValidationError
  | UnknownPbError
