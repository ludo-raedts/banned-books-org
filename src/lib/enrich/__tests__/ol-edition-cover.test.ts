import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { olEditionCover } from '../covers'

// olEditionCover walks a stored work_id's editions for a real cover — the path
// that closes the DK Eyewitness "Insect" gap (work's primary cover_i was blank
// but a sibling edition had a real image). It is title-guarded against the
// ladder so a contaminated/namesake work_id (e.g. "The Thing" mis-linked to
// "The Things They Carried") can never pin a wrong cover in this no-vision
// pipeline. These tests pin both behaviours.

type FetchArgs = [string | URL, RequestInit?]

const workJson = (title: string) =>
  ({ ok: true, json: () => Promise.resolve({ title }) }) as Response
const editionsJson = (entries: Array<{ covers?: number[] }>) =>
  ({ ok: true, json: () => Promise.resolve({ entries }) }) as Response
// HEAD probe on a cover URL: ok + image content-type means "real image".
const imageHead = (present: boolean) =>
  ({ ok: present, headers: { get: () => (present ? 'image/jpeg' : 'text/html') } }) as unknown as Response

describe('olEditionCover (covers.ts)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>
  const route = (handler: (url: string, init?: RequestInit) => Response) =>
    vi.spyOn(globalThis, 'fetch').mockImplementation((...args: unknown[]) => {
      const [url, init] = args as FetchArgs
      return Promise.resolve(handler(String(url), init))
    }) as unknown as ReturnType<typeof vi.fn>

  afterEach(() => { fetchSpy?.mockRestore() })

  it('returns the first edition cover that HEAD-resolves to a real image', async () => {
    fetchSpy = route((url) => {
      if (url.includes('/works/OL1924736W.json')) return workJson('Insect')
      if (url.includes('/editions.json')) return editionsJson([{ covers: [111] }, { covers: [9724419] }])
      // first id 111 is missing, second resolves
      if (url.includes('/b/id/111-')) return imageHead(false)
      if (url.includes('/b/id/9724419-')) return imageHead(true)
      return imageHead(false)
    })
    const r = await olEditionCover('OL1924736W', ['Insect'])
    expect(r).toBe('https://covers.openlibrary.org/b/id/9724419-L.jpg')
  })

  it('rejects a contaminated work_id whose canonical title fails the ladder guard', async () => {
    const editionsSpy = vi.fn()
    fetchSpy = route((url) => {
      if (url.includes('/works/OL2919959W.json')) return workJson('The Things They Carried')
      if (url.includes('/editions.json')) { editionsSpy(); return editionsJson([{ covers: [42] }]) }
      return imageHead(true)
    })
    const r = await olEditionCover('OL2919959W', ['The Thing'])
    expect(r).toBeNull()
    // Must short-circuit at the title guard — never even fetch editions.
    expect(editionsSpy).not.toHaveBeenCalled()
  })

  it('matches a foreign-language work via a native title in the ladder', async () => {
    fetchSpy = route((url) => {
      if (url.includes('.json') && url.includes('/works/') && !url.includes('editions')) return workJson('Nós Matámos o Cão-Tinhoso')
      if (url.includes('/editions.json')) return editionsJson([{ covers: [12370699] }])
      return imageHead(true)
    })
    const r = await olEditionCover('OL169091W', ['We Killed Mangy-Dog and Other Stories', 'Nós Matámos o Cão-Tinhoso'])
    expect(r).toBe('https://covers.openlibrary.org/b/id/12370699-L.jpg')
  })

  it('returns null when the work has editions but none carry a real cover', async () => {
    fetchSpy = route((url) => {
      if (url.includes('.json') && url.includes('/works/') && !url.includes('editions')) return workJson('Amar meyebela')
      if (url.includes('/editions.json')) return editionsJson([{ covers: [1] }, {}])
      return imageHead(false) // every cover id is the blank default
    })
    const r = await olEditionCover('OL8453425W', ['Amar Meyebela'])
    expect(r).toBeNull()
  })
})
