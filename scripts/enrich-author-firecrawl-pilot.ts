#!/usr/bin/env tsx
/**
 * Firecrawl pilot — enrich Tier-2 Cyrillic authors with:
 *   • name_native      from canonical Russian Wikipedia title
 *   • name_english     from the EN langlink (interlanguage link)
 *   • bio              first paragraph of EN Wikipedia article
 *   • photo_url        first Wikimedia Commons image on EN page (RU fallback)
 *
 * Scope: authors whose display_name contains Cyrillic and who are missing at
 * least one of (name_english, bio, photo_url). The Han-script Tier-2 entries
 * are excluded — most are editorial committees, not persons, and Wikipedia
 * has nothing to add.
 *
 * Pipeline per author:
 *   1. Wikipedia opensearch on ru.wikipedia.org  (free, regular fetch)
 *   2. Wikipedia langlinks → EN title           (free, regular fetch)
 *   3. firecrawl scrape RU page → name_native + photo fallback
 *   4. firecrawl scrape EN page → name_english + bio + photo
 *   5. Filter photo through isAllowedImageUrl() before any write
 *
 * Dry-run default. --apply writes to DB. --limit caps the number of authors.
 *
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-firecrawl-pilot.ts
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-firecrawl-pilot.ts --limit=3
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-firecrawl-pilot.ts --apply
 *
 * Budget: ~2 Firecrawl credits per author (RU + EN page each).
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'

const execFileP = promisify(execFile)

const APPLY = process.argv.includes('--apply')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? Math.max(1, parseInt(LIMIT_ARG.slice(8), 10) || 12) : 12
const EXCLUDE_ARG = process.argv.find(a => a.startsWith('--exclude='))
const EXCLUDE = new Set(
  EXCLUDE_ARG
    ? EXCLUDE_ARG.slice(10)
        .split(',')
        .map(s => parseInt(s, 10))
        .filter(n => Number.isFinite(n))
    : [],
)

const BIO_MAX_CHARS = 600

// Wikipedia's API policy requires a User-Agent with contact info. Anonymous
// or generic UAs get aggressively rate-limited or returned 4xx silently.
const WIKI_UA =
  'banned-books-org-enrichment/1.0 (https://banned-books.org; ludo.raedts@voys.nl)'

// Throttle between Wikipedia API hits — well under the 1 req/sec they ask
// of anonymous clients.
const WIKI_DELAY_MS = 350

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

type Author = {
  id: number
  display_name: string
  slug: string
  bio: string | null
  photo_url: string | null
  name_native: string | null
  name_transliterated: string | null
  name_english: string | null
  original_language: string | null
}

type Resolution = {
  ru_title: string | null
  ru_url: string | null
  en_title: string | null
  en_url: string | null
}

type Extracted = {
  name_native: string | null
  name_english: string | null
  bio: string | null
  photo_url: string | null
  photo_rejected_url: string | null // for logging when isAllowedImageUrl rejects
}

type Plan = {
  author: Author
  resolution: Resolution
  extracted: Extracted
  updates: Partial<{
    name_native: string
    name_english: string
    bio: string
    photo_url: string
  }>
  notes: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────

const HAS_CYRILLIC = /\p{Script=Cyrillic}/u

// Names ending in initials ("Плохий С.Н", "Платонова О.А") are ambiguous —
// opensearch will fuzzy-match to a wholly different person who shares the
// surname. Inherently needs human review, not pilot auto-fill. NB: `\b`
// doesn't fire on Cyrillic (ECMAScript `\w` is ASCII-only), so we anchor
// only on the end-of-string and accept any leading position.
const INITIALS_SUFFIX = /\p{L}\.\s*\p{L}?\.?\s*$/u

// Title must share a non-trivial prefix with the longest input token to
// confirm we landed on the right article. Catches the "Плохий С.Н" →
// "Плохой Санта" misclassification: longest input token "Плохий" doesn't
// share 5 chars with "Плохой Санта". Russian declension (Мейсона/Мейсон)
// still passes because both start with "Мейсо".
const NAME_PREFIX_LEN = 5

function longestToken(name: string): string {
  const tokens = name.split(/[\s.,()\/]+/).filter(t => t.length >= 3)
  if (tokens.length === 0) return ''
  return tokens.sort((a, b) => b.length - a.length)[0]
}

function articleSharesNamePrefix(displayName: string, articleTitle: string): boolean {
  const longest = longestToken(displayName)
  if (longest.length < NAME_PREFIX_LEN) return false
  const prefix = longest.slice(0, NAME_PREFIX_LEN).toLowerCase()
  return articleTitle.toLowerCase().includes(prefix)
}

// ── Wikipedia API resolution (free, no Firecrawl credits) ─────────────────

async function wikiOpenSearch(
  lang: 'ru' | 'en',
  query: string,
): Promise<{ title: string | null; debug: string }> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`)
  url.searchParams.set('action', 'opensearch')
  url.searchParams.set('search', query)
  url.searchParams.set('limit', '1')
  url.searchParams.set('format', 'json')
  url.searchParams.set('namespace', '0')
  await sleep(WIKI_DELAY_MS)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': WIKI_UA } })
    if (!res.ok) {
      return { title: null, debug: `opensearch HTTP ${res.status}` }
    }
    const data = (await res.json()) as [string, string[], string[], string[]]
    const title = data[1]?.[0] ?? null
    return { title, debug: title ? '' : 'opensearch returned empty array' }
  } catch (e) {
    return { title: null, debug: `opensearch threw: ${(e as Error).message}` }
  }
}

async function wikiLangLink(
  fromLang: 'ru' | 'en',
  toLang: 'en' | 'ru',
  title: string,
): Promise<{ title: string | null; debug: string }> {
  const url = new URL(`https://${fromLang}.wikipedia.org/w/api.php`)
  url.searchParams.set('action', 'query')
  url.searchParams.set('titles', title)
  url.searchParams.set('prop', 'langlinks')
  url.searchParams.set('lllang', toLang)
  url.searchParams.set('redirects', '1') // follow redirects to canonical
  url.searchParams.set('format', 'json')
  await sleep(WIKI_DELAY_MS)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': WIKI_UA } })
    if (!res.ok) return { title: null, debug: `langlinks HTTP ${res.status}` }
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          { langlinks?: Array<{ lang: string; '*': string }> }
        >
      }
    }
    const pages = data.query?.pages ?? {}
    for (const p of Object.values(pages)) {
      const link = p.langlinks?.[0]
      if (link?.['*']) return { title: link['*'], debug: '' }
    }
    return { title: null, debug: 'no langlinks on page' }
  } catch (e) {
    return { title: null, debug: `langlinks threw: ${(e as Error).message}` }
  }
}

function wikiUrl(lang: 'ru' | 'en', title: string): string {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

// ── Firecrawl scrape (shell out to the CLI) ────────────────────────────────

async function firecrawlScrape(url: string): Promise<string> {
  // --only-main-content strips the cookie banner / sidebar / footer so the
  // first H1 + paragraph + image we see are reliably the article itself.
  // We default-format markdown; output goes to stdout (no -o).
  const { stdout } = await execFileP(
    'firecrawl',
    ['scrape', url, '--only-main-content', '--format', 'markdown'],
    { maxBuffer: 10 * 1024 * 1024 },
  )
  return stdout
}

// ── Markdown extraction ────────────────────────────────────────────────────

function extractTitle(md: string): string | null {
  // The first H1 after Firecrawl's --only-main-content trimming is the article
  // title. Wikipedia sometimes embeds a small mobile-print menu before it, so
  // we scan all lines.
  const m = md.match(/^# (.+?)$/m)
  if (!m) return null
  return m[1].replace(/\[edit\]/g, '').trim()
}

function extractFirstParagraph(md: string): string | null {
  // Find the first H1, then walk forward to the lead paragraph. Wikipedia
  // articles often have a one-line "title repeat" and short tagline BEFORE
  // the infobox table, then the real lead paragraph after the table — that
  // lead almost always starts with **Bold Name** (born …). So we accept a
  // line as "the lead" iff it starts with bold (`**`) OR is ≥80 chars. That
  // filters out the title repeat and tagline while still working on shorter
  // articles without an infobox.
  const lines = md.split('\n')
  let i = lines.findIndex(l => /^# /.test(l))
  if (i < 0) return null
  i++
  while (i < lines.length) {
    const l = lines[i]
    const trimmed = l.trim()
    // Wikipedia leads are bold-start by convention: `**Subject Name** (born …) is…`.
    // Anything else between the H1 and the lead is hatnotes ("For other people
    // named X…", "Not to be confused with…"), name-script notes ("In this
    // Chinese name, the family name is…"), or infobox-table rows. None of those
    // are usable as a bio. Requiring `**` start drops every hatnote we hit in
    // the Cyrillic pilot and matches every real lead.
    const isParagraph = trimmed.startsWith('**')
    if (isParagraph) {
      // Collect consecutive paragraph lines.
      const para: string[] = [trimmed]
      let j = i + 1
      while (j < lines.length && lines[j].trim().length > 0) {
        if (lines[j].trim().startsWith('#')) break
        para.push(lines[j].trim())
        j++
      }
      const raw = para.join(' ').replace(/\s+/g, ' ').trim()
      return stripMarkdown(raw)
    }
    i++
  }
  return null
}

function extractFirstWikimediaImage(md: string): string | null {
  // Markdown image: ![alt](url). We want the first one whose host is
  // upload.wikimedia.org and that's actually a photographed JPG/PNG of the
  // subject — not an SVG-derived maintenance template (Broom_icon,
  // Commons-emblem-scales, Padlock, Question-mark, …). The reliable
  // signal: real portraits are .jpg/.png originals, never .svg.png thumbs.
  // Skipping anything with ".svg" anywhere in the URL kills all of:
  //   • Wiki logos & disambig markers
  //   • Maintenance & flag templates (mostly Cyrillic-script articles for
  //     contested figures have these stacked at the top)
  //   • Lang & licence icons
  // Plus a thumb-size cutoff so we don't grab 16-48px favicons even if
  // someone hand-uploaded one as PNG.
  const re = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(md)) !== null) {
    const url = m[1]
    if (!/upload\.wikimedia\.org/.test(url)) continue
    if (/\.svg/i.test(url)) continue
    if (/\/(?:16|20|24|32|40|48)px-/.test(url)) continue
    return url
  }
  return null
}

// Strip every Wikipedia-markdown artifact so the stored bio is plain prose
// — matching the convention of the existing `enrich-author-bios.ts` writes
// and the author-page renderer (which does NOT interpret markdown).
//
// Order matters: IPA-link first because it's a structurally complete
// `IPA:[\[...\]](url)` that's easier to drop whole than to clean up
// post-hoc; then footnote-bracket-escapes; then markdown links → visible
// text; then bare footnote markers; then bold/italic; finally whitespace
// collapse.
function stripMarkdown(s: string): string {
  let out = s
  // 1. The full IPA-help link pattern: `IPA:[\[...\]](https://.../IPA/...)`.
  //    `[^)]*` is needed because the inner `\[…\]` contributes two `]`
  //    characters in sequence — a `]`-stopping class would quit at the
  //    first one and never see the link's `(url)`.
  out = out.replace(/IPA:\s*\[[^)]*\)/g, '')
  // 2. Escaped-bracket footnote refs that Wikipedia exports as `\[1\]`,
  //    `\[a\]`, `\[note 2\]` — these wrap the text of citation links.
  out = out.replace(/\\\[[^\]]*\\\]/g, '')
  // 3. Markdown links `[text](url)` → keep just the text.
  out = out.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  // 4. Bare footnote markers that survived: `[1]`, `[a]`, `[note 2]`.
  out = out.replace(/\[\d+\]|\[[a-z]\]|\[note \d+\]/gi, '')
  // 5. Bold and italic markers. Italic uses underscore-pairs around a
  //    single word/phrase; the lookbehind/lookahead require word
  //    boundaries so we don't eat snake_case words by accident.
  out = out.replace(/\*\*/g, '')
  out = out.replace(/(?:^|(?<=[\s(]))_([^_\n]+)_(?=[\s.,;:!?)]|$)/g, '$1')
  // 6. Clean up the orphan-comma that can land when step 1 leaves
  //    "(Russian: X, ;" or similar.
  out = out.replace(/,\s*([;)])/g, '$1')
  out = out.replace(/\(\s*;/g, '(')
  // 7. Whitespace.
  out = out.replace(/\s+/g, ' ').trim()
  return out
}

function truncateBio(s: string): string {
  if (s.length <= BIO_MAX_CHARS) return s
  // Cut at last sentence boundary within budget.
  const slice = s.slice(0, BIO_MAX_CHARS)
  const lastStop = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  )
  if (lastStop > BIO_MAX_CHARS * 0.5) return slice.slice(0, lastStop + 1)
  return slice.trimEnd() + '…'
}

// ── Plan builder ───────────────────────────────────────────────────────────

async function buildPlan(a: Author): Promise<Plan> {
  const notes: string[] = []
  const resolution: Resolution = {
    ru_title: null,
    ru_url: null,
    en_title: null,
    en_url: null,
  }
  const extracted: Extracted = {
    name_native: null,
    name_english: null,
    bio: null,
    photo_url: null,
    photo_rejected_url: null,
  }

  // Gate A — names ending in initials are inherently ambiguous (multiple
  // people share the surname). Don't even try.
  if (INITIALS_SUFFIX.test(a.display_name)) {
    notes.push(
      'name ends with initials — too ambiguous for auto-enrichment, needs manual review',
    )
    return { author: a, resolution, extracted, updates: {}, notes }
  }

  // 1. RU title from opensearch.
  const ruOs = await wikiOpenSearch('ru', a.display_name)
  resolution.ru_title = ruOs.title
  if (!resolution.ru_title) {
    notes.push(`ru opensearch: ${ruOs.debug || 'no match'} — skipping`)
    return { author: a, resolution, extracted, updates: {}, notes }
  }
  resolution.ru_url = wikiUrl('ru', resolution.ru_title)
  notes.push(`ru title: "${resolution.ru_title}"`)

  // Gate B — opensearch is fuzzy. The article title must share a 5-char
  // prefix with the longest token of the display name. Catches
  // "Плохий С.Н" → "Плохой Санта" (wholly different word, no shared prefix
  // beyond 4 chars).
  if (!articleSharesNamePrefix(a.display_name, resolution.ru_title)) {
    notes.push(
      `ru title doesn't share name prefix — likely fuzzy mismatch, skipping`,
    )
    return { author: a, resolution, extracted, updates: {}, notes }
  }

  // 2. EN title via langlinks (with redirects=1 so we follow the RU redirect
  // chain to the canonical article first). Falls back to EN opensearch with
  // the original display_name when the page genuinely lacks an interwiki.
  const ll = await wikiLangLink('ru', 'en', resolution.ru_title)
  if (ll.title) {
    resolution.en_title = ll.title
    resolution.en_url = wikiUrl('en', ll.title)
    notes.push(`en title (via langlink): "${ll.title}"`)
  } else {
    const enOs = await wikiOpenSearch('en', a.display_name)
    if (enOs.title) {
      resolution.en_title = enOs.title
      resolution.en_url = wikiUrl('en', enOs.title)
      notes.push(`en title (via opensearch fallback): "${enOs.title}"`)
    } else {
      notes.push(
        `no en page — langlink: ${ll.debug || 'none'}; opensearch: ${enOs.debug || 'none'}`,
      )
    }
  }

  // 3. Firecrawl RU page.
  try {
    const ruMd = await firecrawlScrape(resolution.ru_url)
    const ruTitle = extractTitle(ruMd)
    extracted.name_native = ruTitle ?? resolution.ru_title
    const ruPhoto = extractFirstWikimediaImage(ruMd)
    if (ruPhoto) {
      if (isAllowedImageUrl(ruPhoto)) {
        extracted.photo_url = ruPhoto
        notes.push(`ru photo: ${ruPhoto}`)
      } else {
        extracted.photo_rejected_url = ruPhoto
        notes.push(`ru photo REJECTED by allowed-hosts: ${ruPhoto}`)
      }
    }
  } catch (e) {
    notes.push(`firecrawl RU failed: ${(e as Error).message}`)
  }

  // 4. Firecrawl EN page (if exists).
  if (resolution.en_url) {
    try {
      const enMd = await firecrawlScrape(resolution.en_url)
      const enTitle = extractTitle(enMd)
      extracted.name_english = enTitle ?? resolution.en_title
      const para = extractFirstParagraph(enMd)
      if (para) extracted.bio = truncateBio(para)
      // EN photo takes precedence over RU photo (usually better quality).
      const enPhoto = extractFirstWikimediaImage(enMd)
      if (enPhoto && isAllowedImageUrl(enPhoto)) {
        extracted.photo_url = enPhoto
        notes.push(`en photo (overrides ru): ${enPhoto}`)
      }
    } catch (e) {
      notes.push(`firecrawl EN failed: ${(e as Error).message}`)
    }
  }

  // 5. Compose update set — only fill gaps, never overwrite existing data.
  const updates: Plan['updates'] = {}
  if (!a.name_native && extracted.name_native) updates.name_native = extracted.name_native
  if (!a.name_english && extracted.name_english) updates.name_english = extracted.name_english
  if (!a.bio && extracted.bio) updates.bio = extracted.bio
  if (!a.photo_url && extracted.photo_url) updates.photo_url = extracted.photo_url

  return { author: a, resolution, extracted, updates, notes }
}

// ── Data fetch ─────────────────────────────────────────────────────────────

async function fetchCyrillicTier2(
  sb: ReturnType<typeof adminClient>,
): Promise<Author[]> {
  const PAGE = 1000
  const out: Author[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('authors')
      .select(
        'id, display_name, slug, bio, photo_url, name_native, name_transliterated, name_english, original_language',
      )
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data as Author[]) {
      if (!HAS_CYRILLIC.test(r.display_name)) continue
      const missingScaffolding =
        !r.name_english || !r.bio || !r.photo_url
      if (!missingScaffolding) continue
      out.push(r)
    }
    if (data.length < PAGE) break
  }
  return out
}

// ── Apply ─────────────────────────────────────────────────────────────────

async function applyUpdates(
  sb: ReturnType<typeof adminClient>,
  plan: Plan,
): Promise<void> {
  if (Object.keys(plan.updates).length === 0) return
  const { error } = await sb
    .from('authors')
    .update(plan.updates)
    .eq('id', plan.author.id)
  if (error) throw error
}

// ── Logging ───────────────────────────────────────────────────────────────

function csvEscape(v: string | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n'))
    return `"${s.replace(/"/g, '""')}"`
  return s
}

function writeCsvLog(plans: Plan[]): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const csvPath = join(process.cwd(), 'data', `firecrawl-pilot-${ts}.csv`)
  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  const rows = [
    'id,display_name,ru_title,en_title,fills,name_english,bio_chars,photo_url,photo_rejected,notes',
  ]
  for (const p of plans) {
    rows.push(
      [
        p.author.id,
        csvEscape(p.author.display_name),
        csvEscape(p.resolution.ru_title),
        csvEscape(p.resolution.en_title),
        csvEscape(Object.keys(p.updates).join('+')),
        csvEscape(p.extracted.name_english),
        p.extracted.bio?.length ?? 0,
        csvEscape(p.extracted.photo_url),
        csvEscape(p.extracted.photo_rejected_url),
        csvEscape(p.notes.join('; ')),
      ].join(','),
    )
  }
  writeFileSync(csvPath, rows.join('\n') + '\n', 'utf8')
  return csvPath
}

function printPlan(p: Plan): void {
  const a = p.author
  console.log(`\n── id=${a.id} "${a.display_name}" (slug: ${a.slug})`)
  for (const n of p.notes) console.log(`   • ${n}`)
  const fills = Object.keys(p.updates)
  if (fills.length === 0) {
    console.log('   → no updates (all fields already set or no data found)')
    return
  }
  console.log(`   → will fill: ${fills.join(', ')}`)
  for (const [k, v] of Object.entries(p.updates)) {
    const preview = String(v).slice(0, 120)
    console.log(`     ${k}: ${preview}${String(v).length > 120 ? '…' : ''}`)
  }
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  const sb = adminClient()

  console.log(`── enrich-author-firecrawl-pilot (${APPLY ? 'APPLY' : 'DRY-RUN'}, limit=${LIMIT}) ──`)

  console.log('Fetching Cyrillic Tier-2 candidates…')
  const all = await fetchCyrillicTier2(sb)
  console.log(`  ${all.length} candidate(s) found`)

  const filtered = all.filter(a => !EXCLUDE.has(a.id))
  const targets = filtered.slice(0, LIMIT)
  if (EXCLUDE.size > 0) {
    console.log(`  Excluding ids: ${[...EXCLUDE].join(', ')}`)
  }
  console.log(`  Processing first ${targets.length}\n`)

  const plans: Plan[] = []
  let filled = 0
  let withPhoto = 0
  for (const a of targets) {
    const plan = await buildPlan(a)
    plans.push(plan)
    printPlan(plan)
    if (Object.keys(plan.updates).length > 0) filled++
    if (plan.updates.photo_url) withPhoto++

    if (APPLY) {
      try {
        await applyUpdates(sb, plan)
      } catch (e) {
        console.log(`   ✗ apply failed: ${(e as Error).message}`)
      }
    }
  }

  const csvPath = writeCsvLog(plans)

  console.log('\n── Summary ──')
  console.log(`  Authors processed   : ${plans.length}`)
  console.log(`  With ≥1 field filled: ${filled}`)
  console.log(`  With photo_url      : ${withPhoto}`)
  console.log(`  CSV log             : ${csvPath}`)
  if (!APPLY) console.log('\nDry-run. Re-run with --apply to write to DB.')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
