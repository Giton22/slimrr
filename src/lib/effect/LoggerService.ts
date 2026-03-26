import { Context, Effect, Layer } from 'effect'

export interface LoggerServiceApi {
  debug: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void>
  info: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void>
  warn: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void>
  error: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void>
}

function logWith(
  method: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>,
) {
  return Effect.sync(() => {
    if (meta && Object.keys(meta).length > 0) {
      console[method](message, meta)
      return
    }

    console[method](message)
  })
}

export class LoggerService extends Context.Tag('LoggerService')<
  LoggerService,
  LoggerServiceApi
>() {}

export const LoggerLive = Layer.succeed(LoggerService, {
  debug: (message, meta) => logWith('debug', message, meta),
  info: (message, meta) => logWith('info', message, meta),
  warn: (message, meta) => logWith('warn', message, meta),
  error: (message, meta) => logWith('error', message, meta),
})

export const LoggerSilent = Layer.succeed(LoggerService, {
  debug: () => Effect.void,
  info: () => Effect.void,
  warn: () => Effect.void,
  error: () => Effect.void,
})
