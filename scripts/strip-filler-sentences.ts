/**
 * Stage 2.6 — strips filler sentences and trailing filler clauses from
 * description_ban and censorship_context, preserving the named-case
 * facts that are usually in the first sentence(s).
 *
 * Free — no LLM calls.
 *
 * Output:
 *   data/filler-strip-backup-<timestamp>.csv   (slug + old values)
 *   data/filler-strip-log-<timestamp>.csv      (slug + new values)
 *   data/filler-strip-needs-rewrite-<timestamp>.csv  (slugs left empty/too short)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/strip-filler-sentences.ts
 *   npx tsx --env-file=.env.local scripts/strip-filler-sentences.ts --apply
 *   npx tsx --env-file=.env.local scripts/strip-filler-sentences.ts --apply --slug=defy-me
 */

import fs from 'node:fs'
import path from 'node:path'
import { adminClient } from '../src/lib/supabase'

const APPLY       = process.argv.includes('--apply')
const slugArg     = process.argv.find(a => a.startsWith('--slug='))
const slugsFileArg = process.argv.find(a => a.startsWith('--slugs-file='))
const SLUG        = slugArg?.split('=')[1] ?? null
const SLUGS_FILE  = slugsFileArg?.split('=')[1] ?? null
// --dump=<path> writes every proposed change as JSON (dry-run review)
const DUMP        = process.argv.find(a => a.startsWith('--dump='))?.split('=')[1] ?? null
const MIN_BAN_LEN = 60
const MIN_CTX_LEN = 80

// Whole-sentence filler — drop entire sentence if it matches at the start
const WHOLE_SENTENCE_FILLERS = [
  /^there are no documented (?:lawsuits|legal challenges|public statements|formal proceedings)/i,
  /^no (?:formal )?(?:lawsuits or )?formal proceedings have been documented/i,
  /^no notable legal challenges/i,
  /^no public statements? (?:from )?the author or publisher (?:have|has)? been (?:documented|recorded)/i,
  /^no (?:formal )?lawsuits or public statements/i,
  /^no lawsuits or formal proceedings/i,
  /^the official reason given (?:by the banning authority )?was/i,
  /^this case illustrates how censorship authorit/i,
  /^this pattern reflects/i,
  /^this reflects the recurring tension/i,
  /^(?:specific )?(?:details|passages|reasons|themes|scenes|complaints) (?:regarding|that led to|are not|have not been)/i,
  /^as of (?:late |mid |early )?20\d\d,? the ban remains upheld/i,
  /^as a result of these (?:challenges|complaints)/i,
  /^the (?:bans?|book) (?:was|were|has been|have been) upheld in (?:multiple|several|various|those|these)/i,
  /^the (?:ban|bans|book) remains? upheld in (?:multiple|several|various|those|these)/i,
  /^(?:in )?some districts,? the ban was upheld/i,
  /^the (?:specific )?details regarding the challengers/i,
  /^the (?:ban|bans) (?:was|were) initiated following complaints from parents/i,
  /^the (?:ban|bans) (?:was|were) primarily driven by/i,
  // Boilerplate templates from the original gpt-4o-mini fallback — pure placeholder, no real info beyond the bans table.
  /^.+ was banned or restricted in [\w\s,]+ (?:in 1?\d{3} )?for reasons documented in the ban records below/i,
  /^.+ was banned or restricted in [\w\s,]+ in 1?\d{3} for [^.]+ \/ [^.]+\.?\s*$/i,
  /^.+ (?:has been |was )?banned or (?:restricted|challenged) (?:in [\w\s,]+ )?in (?:multiple|many|several|various) countries (?:primarily )?for/i,
  /^this decision sparked formal complaints/i,
  /^the decision sparked (?:formal )?complaints/i,
  /^(?:in )?(?:these|those|the affected) districts,? the ban remains/i,
  /^the bans? (?:was|were) upheld in (?:multiple|several|various|those|these) districts,?\s/i,
  /^the bans? (?:was|were) upheld(?:,| in)/i,
  /^as of [^,]{0,30}, the ban remains?/i,
  /^discussions about (?:the )?(?:book|novel)['’]?s? (?:potential )?(?:reinstatement|appropriateness|educational value)/i,
  /^reflects? (?:the )?(?:recurring|ongoing) tension/i,
  /^reflecting (?:a )?(?:growing|ongoing|broader) (?:trend|concern|debate)/i,
  /^as a result, the book faced/i,
  /^the decision sparked formal complaints/i,
  /^community members? (?:expressed|voiced) (?:discomfort|concerns|objections)/i,
  /^local parent-teacher associations? \(ptas?\)/i,
  /^the bans? (?:was|were) (?:initiated|enacted) following/i,
  /^the bans? (?:was|were) primarily driven by local/i,
]

// Trailing dependent clauses to strip from end of sentences
// Note: \.?\s*$ at end allows the period to be present.
const TRAILING_CLAUSE_FILLERS = [
  /,\s*reflecting (?:a |an |the )?(?:ongoing|broader|growing|continuing) (?:trend|concern|debate|tension)[^.!?]*\.?\s*$/i,
  /,\s*reflecting [^.!?]+?(?:censorship|debate|trend|tension|in educational settings|in schools|of restricting access|of challenging young adult literature)[^.!?]*\.?\s*$/i,
  /,\s*with ongoing discussions [^.!?]*\.?\s*$/i,
  /,\s*reflecting (?:ongoing|broader|growing|continuing) (?:discussions|tensions|debates)[^.!?]*\.?\s*$/i,
  /\s+as of (?:late |mid |early )?20\d\d,? the ban remains? (?:upheld|in effect|in place)[^.!?]*\.?\s*$/i,
  /,\s*reflecting (?:concerns|objections|opposition) [^.!?]*\.?\s*$/i,
  /,\s*sparking (?:debates?|controversy|discussions|complaints)[^.!?]*\.?\s*$/i,
  /,\s*sparking (?:significant )?(?:debate|controversy)[^.!?]*\.?\s*$/i,
]

function splitSentences(text: string): string[] {
  // Split on . ! ? (optionally followed by a closing quote — `…as "Other." There`)
  // followed by space + capital, but keep the punctuation
  return text
    .split(/(?<=[.!?]["”’]?)\s+(?=[A-Z"'“(])/g)
    .map(s => s.trim())
    .filter(Boolean)
}

// "Nothing is documented" sentences (2026-10-26 inventory: ~5.4k rows, dozens of
// GPT phrasings — "No specific legal challenges or public statements…", "There
// are no records of a lawsuit…", "No specific reason for the ban was made
// public."). They state an absence in OUR sources as a fact about the world, and
// add nothing the bans table doesn't. Matched structurally instead of per
// phrasing: a negated opening + a documentation/legal noun. Sentences carrying a
// year are left alone — "no challenge until 2005, when…" holds a real fact.
const NEG_OPENING = /^(?:as of (?:now|today|\w+ \d{4}),\s*)?(?:there (?:is|are|was|were|have been|has been) )?no\b|^(?:the )?specific (?:scenes|passages|details|reasons?|school district|banning authority|district|content)\b[^.]*\b(?:not|never) (?:been )?(?:publicly )?(?:documented|disclosed|detailed|made public|specified|identified|reported|available)|^(?:the )?(?:details|reasons?) (?:of|for|behind) [^.]*\b(?:not|never) (?:been )?(?:publicly )?(?:documented|disclosed|detailed|made public|specified)/i
const NEG_TOPIC = /\b(?:lawsuits?|legal|statements?|responses?|proceedings?|challenges?|reasons?|records?|reinstate\w*|lifted|actions?|documented|disclosed|made public|passages|scenes|district|authority)\b/i
const HAS_YEAR = /\b(?:1[5-9]\d\d|20\d\d)\b/

function isNothingDocumented(s: string): boolean {
  return NEG_OPENING.test(s) && NEG_TOPIC.test(s) && !HAS_YEAR.test(s)
}

// "Other" is the importer's placeholder when a source records no reason (PEN
// rows default to it) — never an "official reason". Whole sentence when the
// reason is its subject; otherwise cut from the clause that introduces it to
// the end of the sentence (the tail is filler: "…without detailed explanation").
const OTHER_QUOTED = /["“]other[.,]?["”]/i
const OTHER_SUBJECT = /^(?:the |a )?(?:official |stated |specific )?(?:reasons?|ban was enacted|restriction was enacted|ban was implemented)\b/i
const OTHER_CLAUSE = /(?:,\s*|\s+)(?:with|citing|for|due to|under|labell?ed|categori[sz]ed|classified|also|and)\b[^,;]*?["“]other[.,]?["”][^.]*\.?$/i

// Ban-still-in-force claims. Unsourced for current PEN rows, and plainly false
// on historical ones (Nazi 1938 "the ban remains in effect"). Status lives in
// the bans table.
const REMAINS_SENTENCE = /^(?:the |this )?(?:ban|bans|restriction|prohibition)s? (?:remains?|is still|has remained|remain) (?:in effect|in place|active|a historical record|unchallenged|upheld)\b/i
const REMAINS_CLAUSE = /(?:,\s*|\s+)(?:and|with) (?:the )?(?:ban|restriction) (?:remains?|remaining|still) (?:in effect|in place|active)[^.]*\.?$/i

// "The administration cited these reasons…" — the reasons on PEN rows are mostly
// LLM-inferred (enrich-reasons.ts), never cited by anyone.
const CITED_THESE = /^the (?:school )?administration cited (?:these|those|the) reasons/i
// "…, but no formal lawsuit…" / "…, but there is no record…" tail on an otherwise factual sentence.
const BUT_NO_CLAUSE = /,?\s*(?:but|although|though|and) (?:there (?:is|are|was|were) )?no (?:formal |public |known |documented |specific )*(?:record|records|lawsuit|legal|public|reports?|evidence|statements?)\b[^.]*\.?$/i

function stripFiller(text: string | null): { stripped: string; removed: number } {
  if (!text) return { stripped: '', removed: 0 }
  const sentences = splitSentences(text)
  let removed = 0
  let kept = sentences.filter(s => {
    const isFiller = WHOLE_SENTENCE_FILLERS.some(re => re.test(s))
      || isNothingDocumented(s)
      || REMAINS_SENTENCE.test(s)
      || CITED_THESE.test(s)
      || (OTHER_QUOTED.test(s) && OTHER_SUBJECT.test(s))
    if (isFiller) { removed++; return false }
    return true
  })
  // Clause-level cuts on sentences that also carry real content. A cut that
  // leaves a stub (< 30 chars) drops the sentence instead.
  kept = kept.flatMap(s => {
    let r = s
    let cut = false
    for (const re of [OTHER_CLAUSE, REMAINS_CLAUSE, BUT_NO_CLAUSE]) {
      const before = r
      r = r.replace(re, '')
      if (r !== before) { removed++; cut = true; r = r.replace(/[,;:\s]+$/, '') + '.' }
    }
    return cut && r.length < 30 ? [] : [r]
  })
  // Apply trailing-clause stripping to remaining sentences
  kept = kept.map(s => {
    let result = s
    for (const re of TRAILING_CLAUSE_FILLERS) {
      const before = result
      result = result.replace(re, m => {
        // restore terminal punctuation
        return /[.!?]\s*$/.test(s) ? '.' : ''
      })
      if (result !== before) removed++
    }
    return result.trim()
  })
  // Nothing removed → return the text untouched (re-joining would collapse
  // paragraph breaks and register as a spurious change).
  if (removed === 0) return { stripped: text, removed }
  return { stripped: kept.join(' ').replace(/\s{2,}/g, ' ').trim(), removed }
}

type Book = {
  id: number
  slug: string
  title: string
  description_ban: string | null
  censorship_context: string | null
}

async function fetchAll(): Promise<Book[]> {
  const supabase = adminClient()
  const PAGE = 1000
  const all: Book[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('books')
      .select('id, slug, title, description_ban, censorship_context')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    const rows = (data ?? []) as Book[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function loadSlugsFile(p: string): Set<string> {
  if (!fs.existsSync(p)) {
    console.error(`--slugs-file not found: ${p}`)
    process.exit(1)
  }
  const slugs = fs.readFileSync(p, 'utf8')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('#'))
  if (!slugs.length) {
    console.error(`--slugs-file is empty: ${p}`)
    process.exit(1)
  }
  return new Set(slugs)
}

async function main() {
  const all = await fetchAll()
  let target = all
  if (SLUG) target = all.filter(b => b.slug === SLUG)
  if (SLUGS_FILE) {
    const slugs = loadSlugsFile(SLUGS_FILE)
    target = target.filter(b => slugs.has(b.slug))
    console.log(`  --slugs-file=${SLUGS_FILE} → ${slugs.size} slugs requested, ${target.length} matched in DB`)
  }
  console.log(`\n── strip-filler-sentences (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  console.log(`  Scanning ${target.length} books\n`)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupPath = path.resolve('data', `filler-strip-backup-${stamp}.csv`)
  const logPath    = path.resolve('data', `filler-strip-log-${stamp}.csv`)
  const needsPath  = path.resolve('data', `filler-strip-needs-rewrite-${stamp}.csv`)
  fs.mkdirSync(path.dirname(backupPath), { recursive: true })

  if (APPLY) {
    fs.writeFileSync(backupPath, ['slug','description_ban_old','censorship_context_old'].join(',') + '\n')
    fs.writeFileSync(logPath, ['slug','removed_ban_sents','removed_ctx_sents','description_ban_new','censorship_context_new'].join(',') + '\n')
    fs.writeFileSync(needsPath, ['slug','title','ban_score','ban_reason','ctx_score','ctx_reason','ban_filler_hits','ctx_filler_hits','ban_len','ctx_len'].join(',') + '\n')
  }

  const supabase = adminClient()
  let changed = 0, sampleShown = 0, needsRewrite = 0
  const dump: { slug: string; field: string; old: string; new: string | null }[] = []
  const pending: { id: number; update: Record<string, string | null> }[] = []
  let banChangedCount = 0, ctxChangedCount = 0, banEmptyAfter = 0, ctxEmptyAfter = 0

  for (const b of target) {
    const banResult = stripFiller(b.description_ban)
    const ctxResult = stripFiller(b.censorship_context)
    const banChanged = banResult.stripped !== (b.description_ban ?? '')
    const ctxChanged = ctxResult.stripped !== (b.censorship_context ?? '')
    if (!banChanged && !ctxChanged) continue
    changed++
    if (banChanged) banChangedCount++
    if (ctxChanged) ctxChangedCount++

    const newBan = banChanged ? banResult.stripped : (b.description_ban ?? '')
    const newCtx = ctxChanged ? ctxResult.stripped : (b.censorship_context ?? '')
    const banTooShort = banChanged && newBan.length < MIN_BAN_LEN
    const ctxTooShort = ctxChanged && newCtx.length < MIN_CTX_LEN
    if (banTooShort) banEmptyAfter++
    if (ctxTooShort) ctxEmptyAfter++
    const flag = banTooShort || ctxTooShort

    if (DUMP) {
      if (banChanged) dump.push({ slug: b.slug, field: 'description_ban', old: b.description_ban ?? '', new: banTooShort ? null : newBan })
      if (ctxChanged) dump.push({ slug: b.slug, field: 'censorship_context', old: b.censorship_context ?? '', new: ctxTooShort ? null : newCtx })
    }

    if (sampleShown < 5) {
      console.log('━━━', b.slug)
      if (banChanged) console.log('  ban old:', (b.description_ban ?? '').slice(0, 200))
      if (banChanged) console.log('  ban new:', newBan.slice(0, 200))
      if (ctxChanged) console.log('  ctx old:', (b.censorship_context ?? '').slice(0, 200))
      if (ctxChanged) console.log('  ctx new:', newCtx.slice(0, 200))
      console.log()
      sampleShown++
    }

    if (APPLY) {
      // Backup
      fs.appendFileSync(backupPath, [b.slug, b.description_ban ?? '', b.censorship_context ?? ''].map(csvEscape).join(',') + '\n')
      // Update DB — when stripped result is too short, NULL the field so the
      // book page hides that section entirely. Better than leaving boilerplate filler in place.
      const update: Record<string, string | null> = {}
      if (banChanged) update.description_ban = banTooShort ? null : newBan
      if (ctxChanged) update.censorship_context = ctxTooShort ? null : newCtx
      if (Object.keys(update).length) pending.push({ id: b.id, update })
      // Log new values
      fs.appendFileSync(logPath, [
        b.slug, banResult.removed, ctxResult.removed,
        banTooShort ? (b.description_ban ?? '') : newBan,
        ctxTooShort ? (b.censorship_context ?? '') : newCtx,
      ].map(csvEscape).join(',') + '\n')
      // If post-strip is too short, flag for rewrite (audit-CSV format)
      if (flag) {
        needsRewrite++
        fs.appendFileSync(needsPath, [
          b.slug, b.title,
          banTooShort ? 1 : 3, banTooShort ? 'too short after strip' : '',
          ctxTooShort ? 1 : 3, ctxTooShort ? 'too short after strip' : '',
          '', '',
          newBan.length, newCtx.length,
        ].map(csvEscape).join(',') + '\n')
      }
    }
  }

  // Flush DB writes with bounded concurrency (one row per request was ~3 rows/s
  // → ~50 min for a full-catalogue run). Backup CSV is already on disk.
  if (APPLY && pending.length) {
    const CONCURRENCY = 12
    let next = 0, done = 0, failed = 0
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (next < pending.length) {
        const { id, update } = pending[next++]
        const { error } = await supabase.from('books').update(update).eq('id', id)
        if (error) { failed++; console.error(`  ✗ DB error (id ${id}):`, error.message) }
        if (++done % 500 === 0) console.log(`  …${done}/${pending.length} written`)
      }
    }))
    console.log(`DB writes: ${done - failed} ok, ${failed} failed`)
  }
  if (DUMP) { fs.writeFileSync(DUMP, JSON.stringify(dump, null, 1)); console.log(`Dump: ${DUMP} (${dump.length} field changes)`) }
  console.log(`\nChanged: ${changed} books  (ban: ${banChangedCount}, ctx: ${ctxChangedCount})`)
  console.log(`Too short after strip: ban ${banEmptyAfter}, ctx ${ctxEmptyAfter}, distinct books ${needsRewrite}`)
  if (APPLY) {
    console.log(`Backup: ${backupPath}`)
    console.log(`Log:    ${logPath}`)
    console.log(`Needs rewrite: ${needsPath}`)
  } else {
    console.log('\nDRY-RUN — add --apply to write.')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
