/**
 * Flags `description_ban` texts that only restate the book's own ban rows.
 *
 * The GPT ban-description pass (enrich-ban-descriptions-gpt.ts) wrote prose for
 * every book, including the ~10k whose ban rows carry nothing but a district,
 * a year and a placeholder reason. After strip-filler-sentences.ts removed the
 * "nothing documented" padding, what is left on those pages is one sentence
 * repeating the bans table below it ("In 2023, X by Y was restricted at the
 * school level by the Clay County School District in Florida") — often with a
 * motive ("due to its LGBTQ+ content") that no source for the ban states.
 *
 * Test: a text is a RESTATEMENT when it contains no concrete anchor beyond the
 * ban rows — no proper noun, number or year that is not already in the title,
 * author, ban institution/region/country/actor/note, scope or reason labels.
 * Restatements get description_ban_status = 'auto_rejected_low_quality'; the
 * book page then renders the deterministic, source-attributed ban summary
 * (src/lib/ban-summary.ts) instead. The text itself is kept (reversible: the
 * backup CSV holds the previous status).
 *
 * human_curated rows are never touched.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/flag-restatement-ban-descriptions.ts
 *     → dry-run: counts + samples per class
 *   … --dump=<path>      write every verdict as JSON for review
 *   … --apply            write statuses (backup CSV in data/)
 *   … --slug=<slug>      one book (debugging)
 */

import fs from 'node:fs'
import path from 'node:path'
import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const SLUG = process.argv.find(a => a.startsWith('--slug='))?.split('=')[1] ?? null
const DUMP = process.argv.find(a => a.startsWith('--dump='))?.split('=')[1] ?? null
const REJECTED = 'auto_rejected_low_quality'
const EVENT_TEMPLATE = /^(?:in|during|by|between) (?:(?:early|late|mid)[- ])?(?:\w+ )?(?:\d{1,2},? )?\d{4}(?:[–-]\d{2,4})?,/i

// Capitalised words that carry no information of their own in this prose:
// sentence openers, connectives, generic institution vocabulary, reason and
// scope labels, months. Anything capitalised outside this list (and outside
// the ban rows) counts as an anchor.
const GENERIC = new Set(`
in the a an at by on of for to and or with from under during after before as also both all its it this that these those
was were is are has had have be been being which who whom whose where when while
school schools district districts county counties public independent community consolidated area city unified parish
board education department library libraries level national state statewide government ministry authorities authority
united states u.s us america american nation
administration administrative formal informal challenge challenges challenged restricted restriction banned ban bans removed
lgbtq lgbtq+ sexual sex content violence violent political religious racial race colonialism moral immorality language drugs drug substance use obscenity obscene other
january february march april may june july august september october november december
book books novel title author publisher
s u additionally specific following no there earlier similar despite although however furthermore subsequently
`.split(/\s+/).filter(Boolean))

type Ban = {
  year_started: number | null
  year_ended: number | null
  region: string | null
  institution: string | null
  actor: string | null
  description: string | null
  country_code: string
  countries: { name_en: string } | null
  scopes: { label_en: string } | null
  ban_reason_links: { reasons: { slug: string; label_en: string | null } | null }[]
}
type Book = {
  id: number
  slug: string
  title: string
  description_ban: string | null
  description_ban_status: string | null
  book_authors: { authors: { display_name: string } | null }[]
  bans: Ban[]
}

function norm(w: string): string {
  return w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']s$/, '').replace(/[^a-z0-9+]/g, '')
}
function words(s: string | null | undefined): string[] {
  return (s ?? '').split(/[\s,.;:()"“”'‘’!?/\-–—]+/).map(norm).filter(Boolean)
}

/** Concrete anchors in `text` that the ban rows do not already account for. */
export function extraAnchors(book: Book): string[] {
  const known = new Set<string>(GENERIC)
  const add = (s: string | null | undefined) => words(s).forEach(w => known.add(w))
  add(book.title)
  for (const ba of book.book_authors) add(ba.authors?.display_name)
  for (const b of book.bans) {
    add(b.region); add(b.institution); add(b.actor); add(b.description)
    add(b.countries?.name_en); add(b.country_code); add(b.scopes?.label_en)
    if (b.year_started) known.add(String(b.year_started))
    if (b.year_ended) known.add(String(b.year_ended))
    for (const l of b.ban_reason_links) { add(l.reasons?.slug); add(l.reasons?.label_en) }
  }
  const text = book.description_ban ?? ''
  const anchors: string[] = []
  // Capitalised tokens and any token with a digit.
  for (const raw of text.split(/[\s,.;:()"“”!?/–—]+/)) {
    if (!raw) continue
    const isCap = /^[A-Z]/.test(raw.replace(/^['‘]/, ''))
    const hasDigit = /\d/.test(raw)
    if (!isCap && !hasDigit) continue
    for (const part of raw.split(/[-'’]/)) {
      const n = norm(part)
      if (!n || known.has(n)) continue
      // "2023–24" school-year style and "2020s" decades reduce to a known year.
      const y = n.match(/^(\d{4})/)?.[1]
      if (y && known.has(y) && /^\d{4}(s|\d{2})?$/.test(n)) continue
      anchors.push(part)
    }
  }
  return [...new Set(anchors)]
}

async function fetchAll(): Promise<Book[]> {
  const supabase = adminClient()
  const PAGE = 500
  const all: Book[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from('books')
      .select(`id, slug, title, description_ban, description_ban_status,
        book_authors(authors(display_name)),
        bans(year_started, year_ended, region, institution, actor, description, country_code,
          countries(name_en), scopes(label_en), ban_reason_links(reasons(slug, label_en)))`)
      .not('description_ban', 'is', null)
      .order('id')
      .range(from, from + PAGE - 1)
    if (SLUG) q = q.eq('slug', SLUG)
    const { data, error } = await q
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    const rows = (data ?? []) as unknown as Book[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  const books = await fetchAll()
  console.log(`\n── flag-restatement-ban-descriptions (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  console.log(`  ${books.length} books with a description_ban\n`)

  const verdicts: { id: number; slug: string; status: string | null; restatement: boolean; anchors: string[]; text: string }[] = []
  for (const b of books) {
    if (b.description_ban_status === 'human_curated') continue
    if (b.bans.length === 0) continue
    const anchors = extraAnchors(b)
    const text = b.description_ban ?? ''
    // Only the GPT per-event template ("In 2023, "X" by Y was restricted…") is
    // eligible. Hand-written canon summaries ("Beloved has been challenged for
    // … infanticide, and its unflinching depiction of slavery") carry their
    // substance in lower-case words the anchor test cannot see.
    const restatement = anchors.length === 0 && EVENT_TEMPLATE.test(text)
    verdicts.push({ id: b.id, slug: b.slug, status: b.description_ban_status, restatement, anchors, text })
  }
  const toFlag = verdicts.filter(v => v.restatement && v.status !== REJECTED)
  console.log(`  restatement: ${verdicts.filter(v => v.restatement).length}  (to flag: ${toFlag.length})`)
  console.log(`  additive:    ${verdicts.filter(v => !v.restatement).length}\n`)
  for (const v of toFlag.slice(0, 4)) console.log(`  ✗ ${v.slug}: ${v.text.slice(0, 180)}`)
  for (const v of verdicts.filter(v => !v.restatement).slice(0, 4)) console.log(`  ✓ ${v.slug} [${v.anchors.slice(0, 5).join(', ')}]: ${v.text.slice(0, 140)}`)

  if (DUMP) { fs.writeFileSync(DUMP, JSON.stringify(verdicts, null, 1)); console.log(`\nDump: ${DUMP}`) }

  if (!APPLY) { console.log('\nDRY-RUN — add --apply to write.'); return }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupPath = path.resolve('data', `restatement-flag-backup-${stamp}.csv`)
  fs.writeFileSync(backupPath, 'id,slug,description_ban_status_old\n' +
    toFlag.map(v => [v.id, v.slug, v.status ?? ''].map(csvEscape).join(',')).join('\n') + '\n')

  const supabase = adminClient()
  let failed = 0
  for (let i = 0; i < toFlag.length; i += 200) {
    const ids = toFlag.slice(i, i + 200).map(v => v.id)
    const { error } = await supabase.from('books').update({ description_ban_status: REJECTED }).in('id', ids)
    if (error) { failed += ids.length; console.error('  ✗ DB error:', error.message) }
  }
  console.log(`\nFlagged ${toFlag.length - failed} (failed ${failed}). Backup: ${backupPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
