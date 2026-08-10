// withDbRetry is the deploy insurance around build-time DB scans
// (generateStaticParams, sitemaps): it retries PG 57014 statement timeouts
// with 2/4/8s backoff. Fake timers keep the suite fast.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { withDbRetry } from '../db-retry'

type Res = { data: unknown; error: { code?: string; message?: string } | null }

const ok: Res = { data: [1, 2, 3], error: null }
const timeout: Res = { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }
const fatal: Res = { data: null, error: { code: '42703', message: 'column does not exist' } }

function flaky(failures: number, final: Res = ok) {
  let calls = 0
  const run = vi.fn(async () => (calls++ < failures ? timeout : final))
  return { run, calls: () => calls }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function withFakeTimers<T>(p: () => Promise<T>): Promise<T> {
  vi.useFakeTimers()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const promise = p()
  await vi.runAllTimersAsync()
  return promise
}

describe('withDbRetry', () => {
  it('passes a clean result straight through', async () => {
    const { run } = flaky(0)
    expect(await withDbRetry(run)).toEqual(ok)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('retries transient 57014 and succeeds', async () => {
    const { run } = flaky(2)
    const res = await withFakeTimers(() => withDbRetry(run, 'test'))
    expect(res).toEqual(ok)
    expect(run).toHaveBeenCalledTimes(3)
  })

  it('gives up after maxAttempts and returns the last error', async () => {
    const { run } = flaky(99)
    const res = await withFakeTimers(() => withDbRetry(run, 'test', 4))
    expect(res.error?.code).toBe('57014')
    expect(run).toHaveBeenCalledTimes(4)
  })

  it('does not retry non-transient errors', async () => {
    const run = vi.fn(async () => fatal)
    expect(await withDbRetry(run)).toEqual(fatal)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('treats message-level timeouts and fetch failures as transient', async () => {
    for (const message of ['upstream timeout', 'TypeError: fetch failed']) {
      let first = true
      const run = vi.fn(async () => {
        if (first) { first = false; return { data: null, error: { message } } }
        return ok
      })
      const res = await withFakeTimers(() => withDbRetry(run, 'test'))
      expect(res).toEqual(ok)
      expect(run).toHaveBeenCalledTimes(2)
    }
  })
})
