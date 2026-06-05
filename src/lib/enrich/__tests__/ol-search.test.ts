import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { olSearch } from '../covers'

// Regression test for the Open Library wrong-match bug fixed 2026-05-16:
// covers.ts:265 was calling olSearch(variant.title, '') with an empty
// author, which made OL fall back to the most-popular hit for the title
// and store the wrong workId. The fix forwards the real author into the
// search query. These tests verify both branches stay correct so the
// next refactor can't silently re-introduce the bug.

const olJson = (docs: Array<{ key?: string; cover_i?: number; title?: string }>) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ docs }) } as Response)

describe('olSearch (covers.ts)', () => {
  // Loose type — vitest's MockInstance generic over fetch is awkward to
  // pin down across versions and the assertions below only need .mock.calls
  // and .mockImplementationOnce, both present on any MockInstance shape.
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      olJson([{ key: '/works/OL999W', cover_i: 12345, title: 'Ask the Passengers' }]),
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
    fetchSpy.mockImplementationOnce(() => olJson([{ key: '/works/OL999W', cover_i: 12345, title: '1984' }]))
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

  it('still returns workId (no cover) when matching doc has no cover_i', async () => {
    fetchSpy.mockImplementationOnce(() => olJson([{ key: '/works/OL42W', title: 'Some Book' }]))
    const r = await olSearch('Some Book', 'Some Author')
    expect(r.workId).toBe('OL42W')
    expect(r.coverUrl).toBeNull()
  })

  // Guard added 2026-06-03 (the "...Historic World" → "...Ancient World"
  // cover collision): reject docs whose title doesn't contain every
  // significant word of ours, even when they carry a cover_i. Otherwise the
  // most-popular sibling/namesake pins the wrong cover and workId.
  it('rejects a sibling whose title is missing a distinctive word', async () => {
    fetchSpy.mockImplementationOnce(() =>
      olJson([{ key: '/works/OLwrongW', cover_i: 777, title: 'The Seven Wonders of the Ancient World' }]),
    )
    const r = await olSearch('The Seven Wonders of the Historic World', 'Reg Cox')
    expect(r.workId).toBeNull()
    expect(r.coverUrl).toBeNull()
  })

  it('accepts a candidate that adds an extra subtitle/series suffix', async () => {
    fetchSpy.mockImplementationOnce(() =>
      olJson([{ key: '/works/OLokW', cover_i: 888, title: 'Maus I: A Survivor’s Tale' }]),
    )
    const r = await olSearch('Maus', 'Art Spiegelman')
    expect(r.workId).toBe('OLokW')
    expect(r.coverUrl).toBe('https://covers.openlibrary.org/b/id/888-L.jpg')
  })

  // Guard added 2026-06-05 (the "The Witch Doctor of Umm Suqeim" miss):
  // OL anchors title= on the catalogued title, which often omits a leading
  // article. The first query (with "The") returns nothing; the retry without
  // it finds the record.
  it('retries without a leading article when the first query is empty', async () => {
    fetchSpy
      .mockImplementationOnce(() => olJson([])) // "The Witch Doctor …" → no hit
      .mockImplementationOnce(() =>
        olJson([{ key: '/works/OL17584753W', cover_i: 7870213, title: 'Witch Doctor Of Umm Suqeim' }]),
      )
    const r = await olSearch('The Witch Doctor of Umm Suqeim', 'Craig Hawes')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    const retryUrl = String((fetchSpy.mock.calls[1] as [string])[0])
    expect(retryUrl).toContain('title=Witch+Doctor+of+Umm+Suqeim')
    expect(retryUrl).not.toContain('title=The+')
    expect(r.workId).toBe('OL17584753W')
    expect(r.coverUrl).toBe('https://covers.openlibrary.org/b/id/7870213-L.jpg')
  })

  it('does not retry when the title has no leading article', async () => {
    fetchSpy.mockImplementationOnce(() => olJson([]))
    const r = await olSearch('Persepolis', 'Marjane Satrapi')
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(r.coverUrl).toBeNull()
  })
})
