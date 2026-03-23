import { Context, Layer } from 'effect'
import type PocketBase from 'pocketbase'
import { pb } from '@/lib/pocketbase'

export class PocketBaseService extends Context.Tag('PocketBaseService')<
  PocketBaseService,
  PocketBase
>() {}

export const PocketBaseLive = Layer.succeed(PocketBaseService, pb)
