import { Effect } from 'effect'
import type { PocketBaseError } from '@/lib/effect/errors'
import { PocketBaseLive, PocketBaseService } from '@/lib/effect/PocketBaseService'

export function runPb<A>(effect: Effect.Effect<A, PocketBaseError, never>): Promise<A>
export function runPb<A>(effect: Effect.Effect<A, PocketBaseError, PocketBaseService>): Promise<A>
export function runPb<A>(effect: Effect.Effect<A, PocketBaseError, PocketBaseService>) {
  return Effect.runPromise(effect.pipe(Effect.provide(PocketBaseLive)))
}
