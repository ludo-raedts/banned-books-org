import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { olSearch } from '../covers'

// Regression test for the Open Library wrong-match bug fixed 2026-05-16:
// covers.ts:265 was calling olSearch(variant.title, '') with an empty
// author, which made OL fall back to the most-popular hit for the title
// and store the wrong workId. The fix forwards the real author into the
// search query. These tests verify both branches stay correct so the
// next refactor can't silently re-introduce the bug.

const olJson = (docs: Array<{ key?: string; cover_i?: number }>) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ docs }) } as Response)

describe('olSearch (covers.ts)', () => {
  // Loose type — vitest's MockInstance generic over fetch is awkward to
  // pin down across versions and the assertions below only need .mock.calls
  // and .mockImplementationOnce, both present on any MockInstance shape.
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      olJson([{ key: '/works/OL999W', cover_i: 12345 }]),
    ) as unknown as ReturnType<typeof vi.fn>
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('forwards a non-empty author into the OL search URL', async () => {
    await olSearch('Ask the Passengers', 'A.S. King')
    expect(fetchSpy).toHaveBeenCalledOnce()
    const url = String((fetchSpy.mock.calls[0] as [string])[0])
    expect(url).toContain('title=Ask+the+Passengers')
    expect(url).toContain('author=A.S.+King')
  })

  it('omits the author parameter entirely when caller passes an empty string', async () => {
    // Author='' is a code smell — the title-only branch in covers.ts now
    // always passes a real author; this test pins the URL shape so we
    // notice if a caller starts passing '' again.
    await olSearch('Ask the Passengers', '')
    const url = String((fetchSpy.mock.calls[0] as [string])[0])
    expect(url).toContain('title=Ask+the+Passengers')
    expect(url).not.toContain('author=')
  })

  it('returns the workId stripped of the /works/ prefix', async () => {
    const r = await olSearch('1984', 'George Orwell')
    expect(r.workId).toBe('OL999W')
    expect(r.coverUrl).toBe('https://covers.openlibrary.org/b/id/12345-L.jpg')
  })

  it('returns null workId + null coverUrl on empty OL response', async () => {
    fetchSpy.mockImplementationOnce(() => olJson([]))
    const r = await olSearch('Nonexistent Book', 'Some Author')
    expect(r.workId).toBeNull()
    expect(r.coverUrl).toBeNull()
  })

  it('still returns workId (no cover) when first doc has no cover_i', async () => {
    fetchSpy.mockImplementationOnce(() => olJson([{ key: '/works/OL42W' }]))
    const r = await olSearch('Some Book', 'Some Author')
    expect(r.workId).toBe('OL42W')
    expect(r.coverUrl).toBeNull()
  })
})
