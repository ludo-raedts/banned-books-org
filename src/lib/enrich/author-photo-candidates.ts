// On-request alternative author photos for the admin (the author counterpart of
// /api/admin/books/<slug>/cover-candidates). Unlike author-photos.ts, which
// auto-picks ONE photo, this returns several candidates WITH a label
// ("American novelist", "Irish mixed martial artist"), because the namesake
// problem is exactly what a human has to judge here. Nothing is written.
//
// Sources: Wikidata humans with an image (P18), Wikipedia search-result page
// images, and Open Library author photos. All URLs pass isAllowedImageUrl.
import { isAllowedImageUrl } from '../allowed-image-hosts'

export type PhotoCandidate = { url: string; source: string; label: string }

const UA = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) })
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}

type WdEntity = {
  descriptions?: Record<string, { value: string }>
  labels?: Record<string, { value: string }>
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>
}

async function wikidata(name: string): Promise<PhotoCandidate[]> {
  const s = await getJson<{ search?: Array<{ id: string }> }>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=8&format=json`)
  const ids = (s?.search ?? []).map(x => x.id)
  if (!ids.length) return []
  const e = await getJson<{ entities?: Record<string, WdEntity> }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=claims|descriptions|labels&languages=en&format=json`)
  const files: { file: string; label: string }[] = []
  for (const id of ids) {
    const ent = e?.entities?.[id]
    const human = (ent?.claims?.P31 ?? []).some(c => (c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id === 'Q5')
    const file = ent?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
    if (!human || typeof file !== 'string') continue
    files.push({ file, label: `${ent?.labels?.en?.value ?? name}${ent?.descriptions?.en ? ` — ${ent.descriptions.en.value}` : ''}` })
  }
  if (!files.length) return []
  // Resolve Commons file names to upload.wikimedia.org thumbnails in one call.
  const ii = await getJson<{ query?: { pages?: Record<string, { title: string; imageinfo?: Array<{ thumburl?: string }> }> } }>(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${files.map(f => encodeURIComponent(`File:${f.file}`)).join('|')}&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json`)
  const byTitle = new Map(Object.values(ii?.query?.pages ?? {}).map(p => [p.title.replace(/^File:/, '').replace(/_/g, ' '), p.imageinfo?.[0]?.thumburl]))
  return files
    .map(f => ({ url: byTitle.get(f.file.replace(/_/g, ' ')) ?? '', source: 'Wikidata', label: f.label }))
    .filter(c => c.url)
}

async function wikipedia(name: string): Promise<PhotoCandidate[]> {
  const r = await getJson<{ query?: { pages?: Record<string, { title: string; index?: number; description?: string; thumbnail?: { source: string } }> } }>(
    `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(name)}&gsrlimit=5&prop=pageimages|description&piprop=thumbnail&pithumbsize=400&format=json`)
  return Object.values(r?.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .filter(p => p.thumbnail?.source)
    .map(p => ({ url: p.thumbnail!.source, source: 'Wikipedia', label: `${p.title}${p.description ? ` — ${p.description}` : ''}` }))
}

async function openLibrary(name: string): Promise<PhotoCandidate[]> {
  const r = await getJson<{ docs?: Array<{ key: string; name: string; birth_date?: string; top_work?: string }> }>(
    `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}&limit=4`)
  const out: PhotoCandidate[] = []
  for (const d of r?.docs ?? []) {
    const url = `https://covers.openlibrary.org/a/olid/${d.key}-M.jpg?default=false`
    try {
      const h = await fetch(url, { method: 'HEAD', headers: UA, signal: AbortSignal.timeout(6000) })
      if (h.ok) out.push({ url, source: 'Open Library', label: `${d.name}${d.birth_date ? ` (b. ${d.birth_date})` : ''}${d.top_work ? ` — ${d.top_work}` : ''}` })
    } catch { /* skip */ }
  }
  return out
}

// Wikimedia appends utm_* tracking params to thumb URLs; strip them.
function clean(url: string): string {
  try {
    const u = new URL(url)
    for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_')) u.searchParams.delete(k)
    return u.toString()
  } catch { return url }
}

export async function authorPhotoCandidates(name: string): Promise<PhotoCandidate[]> {
  const lists = await Promise.all([wikidata(name), wikipedia(name), openLibrary(name)])
  const seen = new Set<string>()
  return lists.flat().map(c => ({ ...c, url: clean(c.url) })).filter(c => {
    if (seen.has(c.url) || !isAllowedImageUrl(c.url)) return false
    seen.add(c.url)
    return true
  })
}
