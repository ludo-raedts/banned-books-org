/**
 * Re-verify queued author photos with the STRICT photo rule of
 * enrich-author-bios.ts (2026-10-20 fix). Many queued photos were picked by the
 * old leaky photos-only logic (first search hit that was "a person"), so the
 * reviewer kept seeing obvious namesakes (Lisa McCune for Jean McBee Knox,
 * Denis O'Hare for Phillip Steele).
 *
 * Per pending item in the photo-review queue with a Wikimedia photo, re-run the
 * strict selection (bio's own page, or a search hit whose TITLE names the author
 * with the surname last + writer category + intro subject check) and compare:
 *   verified  strict selection lands on the SAME image file → photo is right
 *   other     strict selection finds a DIFFERENT image on the author's own page
 *   none      no page passes the strict rule → the photo has no verified source
 * Plus the file-name hint from audit-author-identity (file names another person).
 *
 * Read-only by default. With --apply, through the photo-review API:
 *   verified                                      → Good
 *   other                                         → Replace with the verified image
 *   none + (file names someone else OR vision doubt) → Wrong
 * Everything else stays for a human.
 *
 * Usage: npx tsx --env-file=.env.local scripts/verify-author-photos.ts [--limit=N] [--apply]
 */
import { writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { authorLadder } from '../src/lib/enrich/_author-ladder'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { readReview } from '../src/lib/photo-review'
import { createSessionToken, SESSION_COOKIE } from '../src/lib/admin-session'
import {
  searchWikipedia, fetchPageDetails, pageIdForUrl, titleNamesAuthor, subjectNamesAuthor,
  hasWriterCategory, isCjkAuthor, isDisambigExtract, hasDisambigCategory,
} from './enrich-author-bios'
import { flagValue, intFlag, isApply } from './lib/cli'
import { existsSync, readFileSync } from 'node:fs'

const APPLY = isApply()
const LIMIT = intFlag('limit', 100000)
// --from=<results.json>: reuse a previous run's verdicts instead of searching again
const FROM = flagValue('from')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// "…/thumb/a/ab/Some_File.jpg/500px-Some_File.jpg?utm…" → "some_file.jpg"
function fileKey(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const i = parts.indexOf('thumb')
    const file = i >= 0 ? parts[i + 3] : parts[parts.length - 1]
    return file ? decodeURIComponent(file).toLowerCase() : null
  } catch { return null }
}

type Author = { id: number; display_name: string; slug: string; name_native: string | null; name_transliterated: string | null; name_english: string | null; original_language: string | null; bio_source_url: string | null }

async function strictPick(a: Author): Promise<{ title: string; photo: string } | null> {
  const cjk = isCjkAuthor(a)
  const bioPage = await pageIdForUrl(a.bio_source_url)
  let candidates: number[] = bioPage ? [bioPage] : []
  if (!bioPage) for (const v of authorLadder(a)) {
    candidates = await searchWikipedia(v.name)
    await sleep(250)
    if (candidates.length) break
  }
  for (const pid of candidates) {
    const d = await fetchPageDetails(pid)
    await sleep(250)
    if (!d.photo || (d.extract && (isDisambigExtract(d.extract) || hasDisambigCategory(d.categories)))) continue
    const named = titleNamesAuthor(d.title, a.display_name, cjk) && (!d.extract || subjectNamesAuthor(d.extract, a.display_name, cjk))
    if (named && hasWriterCategory(d.categories) && isAllowedImageUrl(d.photo)) return { title: d.title, photo: d.photo }
  }
  return null
}

async function main() {
  const queue = await readReview()
  const pending = queue.items.filter(i => !i.decision && /wikimedia\.org/.test(i.photo_url)).slice(0, LIMIT)
  const { data } = await adminClient().from('authors')
    .select('id, display_name, slug, name_native, name_transliterated, name_english, original_language, bio_source_url')
    .in('id', pending.map(i => i.author_id))
  const authors = new Map((data ?? []).map(a => [Number(a.id), a as Author]))
  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'}: ${pending.length} pending Wikimedia photos`)

  type Res = { author_id: number; name: string; verdict: string; outcome: string; current: string; strict?: string; page?: string; hint?: string }
  let results: Res[] = []
  const stillPending = new Set(pending.map(i => i.author_id))
  if (FROM && existsSync(FROM)) results = (JSON.parse(readFileSync(FROM, 'utf8')) as Res[]).filter(r => stillPending.has(r.author_id))
  else for (const it of pending) {
    const a = authors.get(it.author_id)
    if (!a) continue
    const pick = await strictPick(a)
    const same = pick && fileKey(pick.photo) === fileKey(it.photo_url)
    const outcome = same ? 'verified' : pick ? 'other' : 'none'
    results.push({ author_id: it.author_id, name: a.display_name, verdict: it.verdict, outcome, current: it.photo_url,
      strict: pick?.photo, page: pick?.title, hint: it.identity_note })
  }
  if (!FROM) writeFileSync('data/author-photo-verify-2026-10-21.json', JSON.stringify(results, null, 1))

  // A file name that spells the author's own full name ("Justin_Spring.jpg") is
  // left for a human even without a verified page; otherwise an unverifiable
  // photo of a queued (doubtful) item is Wrong.
  const fileNamesAuthor = (r: (typeof results)[number]) => {
    const f = (fileKey(r.current) ?? '').replace(/[_\-.]+/g, ' ')
    const toks = r.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z]+/).filter(t => t.length >= 2)
    const ff = f.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // mononyms (Plato, Germanicus): the single name in the file name is enough
    if (toks.length === 1) return ff.includes(toks[0])
    return toks.length >= 2 && ff.includes(toks[0]) && ff.includes(toks[toks.length - 1])
  }
  // Replace only when the verified page is plainly THIS author: title equals the
  // name, or its disambiguator says writer ("John Freeman (author)"), not
  // "Tom Robbins (journalist)" / "Paul Harris (Rotary)".
  const safePage = (r: Res) => {
    const t = (r.page ?? '').trim()
    const m = t.match(/^(.*?)\s*\(([^)]*)\)$/)
    return m ? /author|writer|novelist|poet|historian|essayist|playwright/i.test(m[2]) : true
  }
  const act = (r: (typeof results)[number]) =>
    r.outcome === 'verified' ? 'good'
    : r.outcome === 'other' ? (safePage(r) ? 'replace' : 'human')
    : fileNamesAuthor(r) ? 'human' : 'wrong'
  const by: Record<string, number> = {}
  for (const r of results) by[`${r.outcome} → ${act(r)}`] = (by[`${r.outcome} → ${act(r)}`] ?? 0) + 1
  console.log(by)

  if (!APPLY) return
  const cookie = `${SESSION_COOKIE}=${await createSessionToken(process.env.ADMIN_SECRET!)}`
  const post = (body: object) => fetch('https://www.banned-books.org/api/admin/photo-review', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const done: Record<string, number> = {}
  for (const r of results) {
    const a = act(r)
    if (a === 'human') continue
    const res = await post(a === 'good' ? { author_id: r.author_id, action: 'ok' }
      : a === 'replace' ? { author_id: r.author_id, action: 'replace', photo_url: r.strict }
      : { author_id: r.author_id, action: 'wrong' })
    done[res.ok ? a : `${a} failed`] = (done[res.ok ? a : `${a} failed`] ?? 0) + 1
  }
  console.log('applied', done)
}

main().catch(e => { console.error(e); process.exit(1) })
