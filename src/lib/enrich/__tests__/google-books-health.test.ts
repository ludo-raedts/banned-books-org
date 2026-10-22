import { describe, it, expect, afterEach, vi } from 'vitest'

// Health-probe behaviour of the shared Google Books client under the partial
// regression (Google issue 569300353): field-restricted queries answer
// 200/totalItems 0 while free text still works. The client must quarantine
// `isbn:` (GbUnavailableError, no network call), rewrite intitle:/inauthor:
// to free text, and only latch GB off when the free-text probe fails too.
//
// Module state (latches, probe counter) is module-level, so every test gets a
// fresh module via resetModules + dynamic import.

type Handler = (q: string) => number
function mockFetch(handler: Handler) {
  const calls: string[] = []
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = new URL(String(input))
    const q = url.searchParams.get('q') ?? ''
    calls.push(q)
    const n = handler(q)
    const items = Array.from({ length: n }, (_, i) => ({ id: `v${i}`, volumeInfo: { title: q } }))
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ items }) } as Response)
  })
  return { calls, spy }
}

async function load() {
  vi.resetModules()
  process.env.GOOGLE_BOOKS_API_KEY = 'test-key'
  return import('../google-books')
}

const isField = (q: string) => /\b(intitle|inauthor|isbn):/i.test(q)

describe('google-books health probes', () => {
  afterEach(() => vi.restoreAllMocks())

  it('passes structured queries through unchanged when both probes succeed', async () => {
    const { calls } = mockFetch(() => 3)
    const gb = await load()
    const vols = await gb.gbVolumesByTitleAuthor('hatchet', 'paulsen', { delayMs: 0 })
    expect(vols).toHaveLength(3)
    expect(gb.gbFieldRestrictedBroken()).toBe(false)
    expect(gb.gbQuotaTripped()).toBe(false)
    // free-text probe, two field probes, then the real query
    expect(calls).toEqual(['brave new world huxley', 'isbn:9780061120084', 'intitle:hatchet inauthor:paulsen', 'intitle:hatchet inauthor:paulsen'])
  })

  it('enters field-restricted-broken mode: isbn: throws unavailable without a call, intitle:/inauthor: run as free text', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { calls } = mockFetch((q) => (isField(q) ? 0 : 5))
    const gb = await load()

    await expect(gb.gbVolumesByIsbn('9780061120084', { delayMs: 0 })).rejects.toBeInstanceOf(gb.GbUnavailableError)
    expect(gb.gbFieldRestrictedBroken()).toBe(true)
    expect(gb.gbQuotaTripped()).toBe(false)
    // probes only: free text OK, first field probe fails → stop probing; no isbn: call for the lookup itself
    expect(calls).toEqual(['brave new world huxley', 'isbn:9780061120084'])
    expect(warn.mock.calls.some((c) => String(c[0]).includes('569300353'))).toBe(true)

    const vols = await gb.gbVolumesByTitleAuthor('Animal Farm', 'George Orwell', { delayMs: 0 })
    expect(vols).toHaveLength(5)
    expect(calls.at(-1)).toBe('Animal Farm George Orwell')

    // GbUnavailableError is a GbQuotaError, so legacy catches still skip-without-stamping
    expect(new gb.GbUnavailableError()).toBeInstanceOf(gb.GbQuotaError)
  })

  it('latches GB off entirely when the free-text probe also returns nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { calls } = mockFetch(() => 0)
    const gb = await load()
    await expect(gb.gbVolumesByTitle('brave new world', { delayMs: 0 })).rejects.toBeInstanceOf(gb.GbQuotaError)
    expect(gb.gbQuotaTripped()).toBe(true)
    expect(calls).toEqual(['brave new world huxley'])
    // latched: no further network calls
    await expect(gb.gbVolumesByTitle('x', { delayMs: 0 })).rejects.toBeInstanceOf(gb.GbQuotaError)
    expect(calls).toHaveLength(1)
  })

  it('leaves broken mode again once the field probes recover', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let fieldBroken = true
    const { calls } = mockFetch((q) => (isField(q) && fieldBroken ? 0 : 2))
    const gb = await load()
    await expect(gb.gbVolumesByIsbn('9780061120084', { delayMs: 0 })).rejects.toBeInstanceOf(gb.GbUnavailableError)
    fieldBroken = false
    // burn through the probe interval (100 calls) so the next call re-probes
    for (let i = 0; i < 100; i++) await gb.gbVolumesByTitle(`t${i}`, { delayMs: 0 })
    const vols = await gb.gbVolumesByIsbn('9780061120084', { delayMs: 0 })
    expect(vols).toHaveLength(2)
    expect(gb.gbFieldRestrictedBroken()).toBe(false)
    expect(calls.at(-1)).toBe('isbn:9780061120084')
  })

  it('stripGbFieldOperators turns structured queries into free text', async () => {
    const gb = await load()
    expect(gb.stripGbFieldOperators('intitle:brave new world inauthor:huxley')).toBe('brave new world huxley')
    expect(gb.stripGbFieldOperators('intitle:"Das letzte Wort"')).toBe('"Das letzte Wort"')
    expect(gb.hasGbFieldOperator('hatchet paulsen')).toBe(false)
  })
})
