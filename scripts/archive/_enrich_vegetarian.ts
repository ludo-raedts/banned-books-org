// One-off: enrich the freshly-imported "The Vegetarian" (book 23408) via the
// shared Google Books client + OpenLibrary. Fills isbn13, cover_url (placeholder-
// safe + host-allowlisted), description_book, original_language, first_published_year,
// openlibrary_work_id, title_native. Dry-run unless --apply.
import { adminClient } from '../src/lib/supabase'
import {
  gbVolumesByTitleAuthor, gbIsbn13, GB_FIELDS_FULL,
} from '../src/lib/enrich/google-books'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { isApply } from './lib/cli'

const SLUG = 'the-vegetarian'
const TITLE = 'The Vegetarian'
const AUTHOR = 'Han Kang'

async function ol(): Promise<{ workId: string | null; year: number | null; coverId: number | null; isbn13: string | null; description: string | null }> {
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(TITLE)}&author=${encodeURIComponent(AUTHOR)}&limit=5&fields=key,title,author_name,first_publish_year,cover_i,isbn`
  const r = await fetch(url)
  const j = await r.json() as { docs?: Array<{ key?: string; first_publish_year?: number; cover_i?: number; author_name?: string[]; isbn?: string[] }> }
  const doc = (j.docs ?? []).find(d => (d.author_name ?? []).some(a => a.toLowerCase().includes('han kang')))
  if (!doc) return { workId: null, year: null, coverId: null, isbn13: null, description: null }
  const workId = doc.key ? doc.key.replace('/works/', '') : null
  const isbn13 = (doc.isbn ?? []).find(i => i.length === 13 && i.startsWith('978')) ?? null
  // work-level description
  let description: string | null = null
  if (workId) {
    try {
      const wr = await fetch(`https://openlibrary.org/works/${workId}.json`)
      const wj = await wr.json() as { description?: string | { value?: string } }
      const d = typeof wj.description === 'string' ? wj.description : wj.description?.value
      if (d) description = d.replace(/\r\n/g, '\n').split('\n\n----')[0].trim() || null
    } catch { /* ignore */ }
  }
  return { workId, year: doc.first_publish_year ?? null, coverId: doc.cover_i ?? null, isbn13, description }
}

async function main() {
  const apply = isApply()
  const sb = adminClient()

  // Google Books (metadata only — cover comes from OL to avoid GB strip issues)
  let isbn13: string | null = null
  let description: string | null = null
  let language: string | null = null
  try {
    const vols = await gbVolumesByTitleAuthor(TITLE, AUTHOR, { fields: GB_FIELDS_FULL })
    const v = vols.find(x => (x.volumeInfo.authors ?? []).some(a => a.toLowerCase().includes('han kang'))) ?? vols[0]
    if (v) {
      isbn13 = gbIsbn13(v.volumeInfo)
      language = v.volumeInfo.language ?? null
    }
  } catch (e) { console.log('  GB skipped:', (e as Error).message) }
  let cover: string | null = null

  const { workId, year, coverId, isbn13: olIsbn, description: olDesc } = await ol()
  if (!isbn13 && olIsbn) isbn13 = olIsbn
  if (!description && olDesc) description = olDesc
  // OL cover fallback
  if (!cover && coverId) {
    const c = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    if (isAllowedImageUrl(c)) cover = c
  }
  if (cover && !isAllowedImageUrl(cover)) {
    console.log(`  cover host not allowed, dropping: ${cover}`)
    cover = null
  }

  // The Vegetarian original: Korean (채식주의자), 2007. GB 'language' for an English
  // edition reads 'en' — the WORK's original language is Korean, so pin 'ko'.
  const patch: Record<string, unknown> = {
    original_language: 'ko',
    title_native: '채식주의자',
    title_native_script: 'hangul',
  }
  if (isbn13) patch.isbn13 = isbn13
  if (cover) patch.cover_url = cover
  // Grounded editorial blurb (widely documented facts) when no source description exists.
  const GROUNDED = "Han Kang's The Vegetarian follows Yeong-hye, a Korean woman who, after a disturbing dream, suddenly refuses to eat meat. Her quiet act of resistance is told in three parts — through her husband, her brother-in-law and her sister — as it escalates into a crisis of family, desire, control and bodily autonomy. First published in Korean in 2007, it won the 2016 International Booker Prize in Deborah Smith's translation; Han Kang was awarded the Nobel Prize in Literature in 2024."
  patch.description_book = description ?? GROUNDED
  if (workId) patch.openlibrary_work_id = workId
  // first_published_year: Korean original 2007 (well-established); prefer OL if it agrees.
  patch.first_published_year = year && year <= 2015 ? year : 2007

  console.log('language (GB edition):', language)
  console.log('PATCH:', JSON.stringify(patch, null, 1))

  if (!apply) { console.log('\n-- dry-run, re-run with --apply --'); return }

  const { error } = await sb.from('books').update(patch).eq('slug', SLUG)
  if (error) throw error
  console.log('\nApplied.')
}
main().catch(e => { console.error(e); process.exit(1) })
