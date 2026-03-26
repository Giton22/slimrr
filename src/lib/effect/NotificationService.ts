import { Context, Effect, Layer } from 'effect'
import { toast } from 'vue-sonner'

export interface NotificationServiceApi {
  error: (message: string) => Effect.Effect<void>
  success: (message: string) => Effect.Effect<void>
  info: (message: string) => Effect.Effect<void>
}

export class NotificationService extends Context.Tag('NotificationService')<
  NotificationService,
  NotificationServiceApi
>() {}

export const NotificationLive = Layer.succeed(NotificationService, {
  error: (message) => Effect.sync(() => toast.error(message)),
  success: (message) => Effect.sync(() => toast.success(message)),
  info: (message) => Effect.sync(() => toast.info(message)),
})

export const NotificationSilent = Layer.succeed(NotificationService, {
  error: () => Effect.void,
  success: () => Effect.void,
  info: () => Effect.void,
})
