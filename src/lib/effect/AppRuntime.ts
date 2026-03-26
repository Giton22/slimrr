import { Layer } from 'effect'
import { LoggerLive } from '@/lib/effect/LoggerService'
import { NotificationLive } from '@/lib/effect/NotificationService'
import { PocketBaseLive } from '@/lib/effect/PocketBaseService'

export const AppRuntimeLive = Layer.mergeAll(PocketBaseLive, LoggerLive, NotificationLive)
