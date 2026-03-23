import { describe, expect, it, vi } from 'vite-plus/test'
import { Effect } from 'effect'

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}))

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    authStore: {
      token: 'session-token',
    },
    send: sendMock,
  },
  pocketbaseUrl: 'https://example.test/',
}))

import { PocketBaseService } from '@/lib/effect'
import { exportCsvData, extractFilenameFromDisposition, importCsvData } from '@/lib/weight/csv'

const mockPb = {
  send: sendMock,
}

function runWithPb<A>(effect: Effect.Effect<A, unknown, PocketBaseService>) {
  return Effect.runPromise(effect.pipe(Effect.provideService(PocketBaseService, mockPb as never)))
}

describe('weight csv helpers', () => {
  it('parses utf-8 filenames from content disposition', () => {
    expect(
      extractFilenameFromDisposition("attachment; filename*=UTF-8''weight%20entries.csv"),
    ).toBe('weight entries.csv')
  })

  it('falls back to the simple filename token', () => {
    expect(extractFilenameFromDisposition('attachment; filename="weights.csv"')).toBe('weights.csv')
  })

  it('posts import CSV payloads through PocketBase', async () => {
    const expectedResult = {
      type: 'weight' as const,
      totalRows: 4,
      created: 3,
      updated: 1,
      skipped: 0,
      errors: [],
    }
    sendMock.mockResolvedValueOnce(expectedResult)

    const file = new File(['date,weight\n2026-03-21,80'], 'weight.csv', { type: 'text/csv' })
    const result = await runWithPb(importCsvData('weight', file))

    expect(result).toEqual(expectedResult)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith('/api/data/import/csv', {
      method: 'POST',
      body: expect.any(FormData),
    })
  })

  it('exports csv data with auth and parsed filename', async () => {
    const blob = new Blob(['csv-data'], { type: 'text/csv' })
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(blob),
      headers: {
        get: vi.fn().mockReturnValue('attachment; filename="export.csv"'),
      },
    } as unknown as Response)

    const result = await Effect.runPromise(exportCsvData('calories', 'abc123', fetchMock))

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/api/data/export/csv?type=calories',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer abc123',
        },
      },
    )
    expect(result).toEqual({ filename: 'export.csv', blob })
  })
})
