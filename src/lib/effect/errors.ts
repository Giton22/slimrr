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

export class NotAuthenticatedError extends Data.TaggedError('NotAuthenticatedError')<{
  readonly message: string
}> {}

export class DuplicateGroupMembershipError extends Data.TaggedError(
  'DuplicateGroupMembershipError',
)<{
  readonly groupId: string
  readonly message: string
}> {}

export class InvalidGoalStateError extends Data.TaggedError('InvalidGoalStateError')<{
  readonly message: string
}> {}

export class DetachedFoodItemError extends Data.TaggedError('DetachedFoodItemError')<{
  readonly foodItemId: string
  readonly message: string
}> {}

export class OptimisticUpdateRollbackError extends Data.TaggedError(
  'OptimisticUpdateRollbackError',
)<{
  readonly message: string
  readonly cause: unknown
  readonly rollbackCause: unknown
}> {}

export type DomainError =
  | NotAuthenticatedError
  | DuplicateGroupMembershipError
  | InvalidGoalStateError
  | DetachedFoodItemError
  | OptimisticUpdateRollbackError

export type AppError = PocketBaseError | DomainError
