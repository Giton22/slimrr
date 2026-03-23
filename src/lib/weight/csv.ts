import { Effect } from 'effect'
import { fromPbPromise } from '@/lib/effect'
import { NetworkError, UnknownPbError } from '@/lib/effect/errors'
import { pb, pocketbaseUrl } from '@/lib/pocketbase'

export type CsvDataType = 'weight' | 'calories' | 'food_log'

export interface CsvImportError {
  row: number
  message: string
}

export interface CsvImportResult {
  type: CsvDataType
  totalRows: number
  created: number
  updated: number
  skipped: number
  errors: CsvImportError[]
}

export function importCsvData(type: CsvDataType, file: File) {
  const formData = new FormData()
  formData.append('type', type)
  formData.append('file', file)

  return fromPbPromise(
    (pb) =>
      pb.send<CsvImportResult>('/api/data/import/csv', {
        method: 'POST',
        body: formData,
      }),
    'csv_import',
  )
}

export function exportCsvData(
  type: CsvDataType,
  authToken = pb.authStore.token,
  fetchFn: typeof fetch = fetch,
) {
  const url = new URL('/api/data/export/csv', pocketbaseUrl)
  url.searchParams.set('type', type)

  const headers: HeadersInit = {}
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  return Effect.tryPromise({
    try: () =>
      fetchFn(url.toString(), {
        method: 'GET',
        headers,
      }),
    catch: (cause) =>
      new NetworkError({
        message: 'Export failed',
        collection: 'csv_export',
        cause,
      }),
  }).pipe(
    Effect.flatMap((response) => {
      if (!response.ok) {
        return Effect.fail(
          new UnknownPbError({
            message: `Export failed (${response.status})`,
            collection: 'csv_export',
            status: response.status,
            cause: response,
          }),
        )
      }

      return Effect.tryPromise({
        try: async () => {
          const blob = await response.blob()
          const disposition = response.headers.get('content-disposition')
          const filename = extractFilenameFromDisposition(disposition) ?? `${type}.csv`

          return { filename, blob }
        },
        catch: (cause) =>
          new UnknownPbError({
            message: 'Failed to read export response',
            collection: 'csv_export',
            cause,
          }),
      })
    }),
  )
}

export function extractFilenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const simpleMatch = disposition.match(/filename="?([^";]+)"?/i)
  if (simpleMatch?.[1]) {
    return simpleMatch[1]
  }

  return null
}
