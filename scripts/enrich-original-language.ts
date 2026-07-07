/**
 * enrich-original-language.ts — conservative backfill of books.original_language
 * for rows where it is NULL. (Sprint A taak 4, 2026-07-07.)
 *
 * Why: original_language is SEO-bearing since 193f8af/6675b34 — it gates the
 * native-title pipeline (title_native in <title>/meta-description, country-card
 * native-title line) and the cover-pipeline language ladder. NULL rows are
 * invisible to both. Measured 2026-07-07: 5,043 NULL of 20,252 books, dominated
 * by the Berlin-1938 (DE, ~2,855), Portugal Estado Novo (PT, ~875), Argentina
 * APM (AR, ~425), KDN Malaysia (MY, ~307) and PEN Belarus (BY, ~261) imports.
 *
 * Design — evidence ladder, conservative by doctrine (doubt → review file,
 * never write). The central trap is TRANSLATED TITLES, in both directions:
 *   - national censorship lists carry native-language titles for foreign works
 *     (Estado Novo lists John dos Passos under his Portuguese title), so
 *     "list country → language" alone is NOT safe;
 *   - the PEN Belarus list carries ENGLISH translations of Belarusian/Russian
 *     titles, so "title looks English → en" alone is NOT safe either.
 * Every auto-write therefore needs the title's own language evidence AND a
 * non-contradicting author signal, or a strong author signal on its own.
 *
 * Signals per book:
 *   script  — detectScript() on the title (src/lib/imports/language-inference);
 *             non-Latin scripts map via inferLanguage() with the ban country.
 *             (Measured: 0 of the current NULL rows — kept for correctness.)
 *   T       — title language score: single-language stopword hit after
 *             stripping parenthetical translations ("Die Räuber (The Robbers)"),
 *             or a language-distinctive character (ß→de, ã/õ→pt, ñ/¿/¡→es)
 *             inside the matching home bucket.
 *   L_home  — expected list language of the import bucket, from ban country:
 *             DE→de, PT→pt, AR→es. (MY/BY deliberately have NO home language:
 *             KDN bans English/Malay/Chinese publications alike, PEN Belarus
 *             titles are English translations.)
 *   M       — author majority: the modal original_language over the authors'
 *             OTHER books that already have one (≥80% majority required;
 *             'MIXED' otherwise). Strong at ≥2 classified sibling books.
 *   EN-land — ban country whose book market is English-first (US/GB/NZ/AU/CA/IE):
 *             an English-scoring title there is an English original.
 *
 * Auto-write tiers (first match wins; everything else → review file):
 *   1 script       non-Latin title script + ban-country → inferLanguage()
 *   2 title+home   T == L_home  and M ∈ {L_home, ∅}
 *   3 title+author T == M       (specific, ≥2 sibling books) — covers foreign-
 *                  language originals inside any bucket, and English-titled
 *                  translations where the author's language is established
 *                  (e.g. BY rows whose author demonstrably writes in ru/be)
 *   4 title-en     T == en and ban country ∈ EN-lands and M ∈ {en, ∅}
 *   5 author-only  T inconclusive (NONE/AMBIG) and M specific with ≥2 books
 *
 * External verification (OL/Wikidata) is deliberately NOT part of v1:
 * OL edition languages describe the *edition*, not the original (a German
 * translation of Jack London has mostly-German editions — it would confirm
 * exactly the wrong answer), and Wikidata item matching at this volume needs
 * the full namesake-gating of enrich-native-titles.ts. Review-file rows can
 * go through that pipeline later.
 *
 * Writes (only with --apply): books.original_language for auto-tier rows,
 * guarded with .is('original_language', null) so the script is idempotent and
 * never overwrites a concurrent edit. All decisions (auto + review) land in
 *   data/original-language-backfill-<date>.md   (human review)
 *   data/original-language-backfill-<date>.json (machine-readable, rollback)
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/enrich-original-language.ts           # dry-run
 *   pnpm tsx --env-file=.env.local scripts/enrich-original-language.ts --apply
 */

import { writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { detectScript, inferLanguage } from '../src/lib/imports/language-inference'
import { isApply } from './lib/cli'

const sb = adminClient()
const PAGE = 1000
const APPLY = isApply()
const TODAY = new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------------------
// Title-language scoring
// ---------------------------------------------------------------------------

// Function-word markers per language. Deliberately excludes words shared
// across these languages ('a' en/pt, 'de' pt/es/fr/nl, 'no' pt/es, …) so a
// single-language hit is meaningful; titles hitting >1 language score AMBIG.
const LANG_MARKERS: Record<string, RegExp> = {
  de: /\b(der|die|das|und|ein|eine|einer|eines|im|am|zum|zur|von|vom|mit|für|über|nach|aus|bei|nicht|wie|ist|des|dem|den|ihre?|seine?|unsere?|jahre?|geschichte|deutschen?|buch|leben|welt|krieg|liebe|mensch(en)?)\b/i,
  pt: /\b(o|os|as|do|da|dos|das|um|uma|não|em|na|nos|nas|para|por|que|história|livro|vida|mundo|guerra|amor|homem|contos?|memórias|português|portuguesa)\b/i,
  es: /\b(el|los|las|del|un|una|unos|unas|y|para|por|que|historia|libro|vida|mundo|guerra|amor|hombre|cuentos?|memorias|española?)\b/i,
  fr: /\b(le|la|les|du|des|un|une|et|dans|pour|par|avec|sur|que|qui|histoire|livre|vie|monde|guerre|amour|homme|l'homme|d'un|d'une)\b/i,
  it: /\b(il|lo|gli|delle?|degli|un|una|uno|ed|non|per|che|storia|libro|vita|mondo|guerra|amore|uomo)\b/i,
  nl: /\b(het|een|van|voor|met|niet|over|naar|uit|geschiedenis|boek|leven|wereld|oorlog|liefde)\b/i,
  en: /\b(the|of|and|an|to|in|for|with|on|at|from|by|is|his|her|their|my|your|who|what|when|how|all|little|great|night|day|life|death|world|history|story|girl|boy|man|woman|things|house|book|love|war)\b/i,
  ms: /\b(yang|dan|di|ke|dari|untuk|dengan|dalam|pada|ini|itu|satu|dua|kepada|sejarah|hidup|dunia|cinta|melayu)\b/i,
}

// Language-distinctive characters, only trusted inside the matching home
// bucket (ä/ö/ü also occur in Nordic/Turkish titles, ç in French/Turkish).
const HOME_DIACRITICS: Record<string, RegExp> = {
  de: /[ßäöü]/i,
  pt: /[ãõ]/i,
  es: /[ñ¿¡]/i,
}

// Titles imported with a parenthetical translation ("Der Einzige und sein
// Eigentum (The Ego and His Own)") score AMBIG unless the translation is
// stripped; the leading segment is the source-list title we want to score.
function stripParenthetical(title: string): string {
  const stripped = title.replace(/\s*\([^)]*\)\s*$/, '').trim()
  return stripped.length >= 3 ? stripped : title
}

/** Single-language stopword hit → that language; 0 hits → NONE; >1 → AMBIG. */
function titleLang(title: string): string {
  const t = stripParenthetical(title)
  const hits = Object.entries(LANG_MARKERS).filter(([, re]) => re.test(t)).map(([l]) => l)
  if (hits.length === 1) return hits[0]
  return hits.length === 0 ? 'NONE' : 'AMBIG'
}

// ---------------------------------------------------------------------------
// Context maps
// ---------------------------------------------------------------------------

// Import buckets whose source list carries titles in one predictable language.
// MY (KDN) and BY (PEN Belarus) are intentionally absent — see header.
const HOME_BY_COUNTRY: Record<string, string> = { DE: 'de', PT: 'pt', AR: 'es' }

// Ban countries where an English-scoring title is safely an English original.
const EN_COUNTRIES = new Set(['US', 'GB', 'NZ', 'AU', 'CA', 'IE'])

// ---------------------------------------------------------------------------

type Decision =
  | { kind: 'auto'; lang: string; tier: string; note: string }
  | { kind: 'review'; reason: string; suggestion: string | null }

type BookCtx = {
  id: number
  slug: string
  title: string
  titleNative: string | null
  countries: string[]
  authorNames: string[]
  majority: string | null // specific lang, 'MIXED', or null
  majorityCount: number   // classified sibling books backing the majority
}

function decide(b: BookCtx): Decision {
  // Tier 0 — an existing title_native in a non-Latin script is the single
  // strongest signal we have: the row already carries the native string, so
  // its script + ban country resolve the language directly (and setting it
  // immediately surfaces that ready native title on the public page). These
  // rows also have romanized Latin `title`s, so tier 1 below would miss them.
  const nativeScript = detectScript(b.titleNative)
  if (nativeScript && nativeScript !== 'latin' && nativeScript !== 'mixed') {
    const lang = inferLanguage(nativeScript, b.countries[0] ?? null, null)
    if (lang) return { kind: 'auto', lang, tier: '0 title_native', note: `native=${nativeScript}` }
  }

  const script = detectScript(b.title)

  // Tier 1 — non-Latin script in the title itself.
  if (script && script !== 'latin' && script !== 'mixed') {
    const lang = inferLanguage(script, b.countries[0] ?? null, null)
    if (lang) return { kind: 'auto', lang, tier: '1 script', note: `script=${script}` }
  }

  const T = titleLang(b.title)
  const homes = Array.from(new Set(b.countries.map((c) => HOME_BY_COUNTRY[c]).filter(Boolean)))
  const home = homes.length === 1 ? homes[0] : null
  const M = b.majority
  const strongM = M && M !== 'MIXED' && b.majorityCount >= 2 ? M : null

  // Tier 2 — title scores exactly the home-list language, author not contradicting.
  if (home && T === home && (M == null || M === home)) {
    return { kind: 'auto', lang: home, tier: '2 title+home', note: `T=${T}` }
  }
  // Tier 2b — home-distinctive characters, author not contradicting.
  if (home && (T === 'NONE' || T === 'AMBIG') && HOME_DIACRITICS[home]?.test(b.title) && (M == null || M === home)) {
    return { kind: 'auto', lang: home, tier: '2 title+home', note: 'diacritics' }
  }

  // Tier 3 — title language and established author language agree.
  if (T !== 'NONE' && T !== 'AMBIG' && strongM && T === strongM) {
    return { kind: 'auto', lang: T, tier: '3 title+author', note: `T=${T}, M=${M}×${b.majorityCount}` }
  }

  // Tier 4 — English title banned in an English-first market.
  if (T === 'en' && b.countries.some((c) => EN_COUNTRIES.has(c)) && (M == null || M === 'en')) {
    return { kind: 'auto', lang: 'en', tier: '4 title-en', note: b.countries.join('+') }
  }

  // Tier 5 — inconclusive title, but the author's language is established.
  if ((T === 'NONE' || T === 'AMBIG') && strongM) {
    return { kind: 'auto', lang: strongM, tier: '5 author-only', note: `M=${M}×${b.majorityCount}` }
  }

  // Review buckets, most actionable first.
  const sig = `T=${T}, M=${M ?? '∅'}${M ? `×${b.majorityCount}` : ''}, bans=${b.countries.join('+') || '—'}`
  if (T !== 'NONE' && T !== 'AMBIG' && M && M !== 'MIXED' && T !== M) {
    return { kind: 'review', reason: `titel-taal ≠ auteur-taal (${sig})`, suggestion: M }
  }
  if (T === 'en') {
    // Translated-title lists (BY) and mixed-language gazettes (MY) land here.
    return { kind: 'review', reason: `Engelse titel buiten en-land (${sig})`, suggestion: null }
  }
  if (home) {
    return { kind: 'review', reason: `alleen bucket-prior ${home} (${sig})`, suggestion: home }
  }
  return { kind: 'review', reason: `geen signaal (${sig})`, suggestion: null }
}

// ---------------------------------------------------------------------------
// Data loading (paginated, .order('id') everywhere — Supabase range needs it)
// ---------------------------------------------------------------------------

async function loadNullBooks(): Promise<any[]> {
  const rows: any[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('books')
      .select('id, slug, title, title_native, book_authors(author_id, authors(display_name))')
      .is('original_language', null)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`books page: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

async function loadBanCountries(ids: number[]): Promise<Map<number, string[]>> {
  const map = new Map<number, Set<string>>()
  for (let i = 0; i < ids.length; i += 400) {
    const { data, error } = await sb
      .from('bans')
      .select('book_id, country_code')
      .in('book_id', ids.slice(i, i + 400))
      .order('id')
    if (error) throw new Error(`bans chunk: ${error.message}`)
    for (const r of data ?? []) {
      if (!r.country_code) continue
      const s = map.get(r.book_id) ?? new Set()
      s.add(r.country_code)
      map.set(r.book_id, s)
    }
  }
  return new Map(Array.from(map, ([k, v]) => [k, Array.from(v).sort()]))
}

/** Per author: modal original_language over their non-NULL books (≥80%). */
async function loadAuthorMajorities(authorIds: number[]): Promise<Map<number, { lang: string; count: number }>> {
  const langCounts = new Map<number, Map<string, number>>()
  for (let i = 0; i < authorIds.length; i += 300) {
    const { data, error } = await sb
      .from('book_authors')
      .select('author_id, books!inner(original_language)')
      .in('author_id', authorIds.slice(i, i + 300))
      .not('books.original_language', 'is', null)
      .order('author_id')
      .range(0, 9999)
    if (error) throw new Error(`book_authors chunk: ${error.message}`)
    for (const r of data ?? []) {
      const lang = (r as any).books.original_language as string
      const m = langCounts.get(r.author_id) ?? new Map()
      m.set(lang, (m.get(lang) ?? 0) + 1)
      langCounts.set(r.author_id, m)
    }
  }
  const out = new Map<number, { lang: string; count: number }>()
  for (const [author, m] of langCounts) {
    const total = Array.from(m.values()).reduce((a, b) => a + b, 0)
    const [top, n] = Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0]
    out.set(author, n / total >= 0.8 ? { lang: top, count: n } : { lang: 'MIXED', count: total })
  }
  return out
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`enrich-original-language — ${APPLY ? 'APPLY' : 'dry-run'}`)

  const books = await loadNullBooks()
  console.log(`NULL-rijen: ${books.length}`)
  const banMap = await loadBanCountries(books.map((b) => b.id))
  const authorIds = Array.from(new Set(books.flatMap((b) => (b.book_authors ?? []).map((ba: any) => ba.author_id))))
  const majorities = await loadAuthorMajorities(authorIds)

  const auto: Array<BookCtx & { lang: string; tier: string; note: string }> = []
  const review: Array<BookCtx & { reason: string; suggestion: string | null }> = []

  for (const b of books) {
    const bas = b.book_authors ?? []
    // Merge author majorities across co-authors; conflicting langs → MIXED.
    const langs = new Map<string, number>()
    for (const ba of bas) {
      const m = majorities.get(ba.author_id)
      if (m) langs.set(m.lang, (langs.get(m.lang) ?? 0) + m.count)
    }
    let majority: string | null = null
    let majorityCount = 0
    if (langs.size === 1) {
      const [[l, n]] = Array.from(langs.entries())
      majority = l
      majorityCount = n
    } else if (langs.size > 1) {
      majority = 'MIXED'
      majorityCount = Array.from(langs.values()).reduce((a, b) => a + b, 0)
    }
    const ctx: BookCtx = {
      id: b.id,
      slug: b.slug,
      title: b.title,
      titleNative: b.title_native ?? null,
      countries: banMap.get(b.id) ?? [],
      authorNames: bas.map((ba: any) => ba.authors?.display_name).filter(Boolean),
      majority,
      majorityCount,
    }
    const d = decide(ctx)
    if (d.kind === 'auto') auto.push({ ...ctx, lang: d.lang, tier: d.tier, note: d.note })
    else review.push({ ...ctx, reason: d.reason, suggestion: d.suggestion })
  }

  // ----- report -----
  const byTier = new Map<string, Map<string, number>>()
  for (const a of auto) {
    const m = byTier.get(a.tier) ?? new Map()
    m.set(a.lang, (m.get(a.lang) ?? 0) + 1)
    byTier.set(a.tier, m)
  }
  console.log(`\nAuto-tiers (${auto.length} totaal):`)
  for (const [tier, m] of Array.from(byTier.entries()).sort()) {
    const langs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l}:${n}`).join(' ')
    console.log(`  ${tier}: ${Array.from(m.values()).reduce((a, b) => a + b, 0)}  (${langs})`)
  }
  const byReason = new Map<string, number>()
  for (const r of review) {
    const key = r.reason.replace(/\(.*\)/, '').trim()
    byReason.set(key, (byReason.get(key) ?? 0) + 1)
  }
  console.log(`\nReview (${review.length} totaal):`)
  for (const [k, v] of Array.from(byReason.entries()).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`)

  // ----- review + rollback files -----
  const jsonPath = `data/original-language-backfill-${TODAY}.json`
  const mdPath = `data/original-language-backfill-${TODAY}.md`
  writeFileSync(jsonPath, JSON.stringify({ generated_at: TODAY, applied: APPLY, auto, review }, null, 1))
  const md: string[] = [
    `# original_language backfill — ${TODAY}`,
    '',
    `Bron: scripts/enrich-original-language.ts (${APPLY ? 'APPLIED' : 'dry-run'}).`,
    `NULL-rijen: ${books.length} · auto: ${auto.length} · review: ${review.length}`,
    '',
    '## Auto-toegekend (per tier)',
    '',
  ]
  for (const [tier] of Array.from(byTier.entries()).sort()) {
    md.push(`### ${tier}`, '')
    for (const a of auto.filter((x) => x.tier === tier)) {
      md.push(`- \`${a.lang}\` — **${a.title}** (${a.authorNames.join(', ') || 'zonder auteur'}) — bans ${a.countries.join('+') || '—'} — ${a.note} — [${a.slug}](https://www.banned-books.org/books/${a.slug})`)
    }
    md.push('')
  }
  md.push('## Review — niet geschreven', '')
  for (const [reason] of Array.from(byReason.entries()).sort((a, b) => b[1] - a[1])) {
    md.push(`### ${reason}`, '')
    for (const r of review.filter((x) => x.reason.replace(/\(.*\)/, '').trim() === reason)) {
      md.push(`- **${r.title}** (${r.authorNames.join(', ') || 'zonder auteur'}) — ${r.reason}${r.suggestion ? ` — suggestie: \`${r.suggestion}\`` : ''} — [${r.slug}](https://www.banned-books.org/books/${r.slug})`)
    }
    md.push('')
  }
  writeFileSync(mdPath, md.join('\n'))
  console.log(`\nReview-files: ${mdPath} + ${jsonPath}`)

  // ----- apply -----
  if (!APPLY) {
    console.log('\nDry-run: geen writes. Draai met --apply om de auto-tiers te schrijven.')
    return
  }
  let written = 0
  const byLang = new Map<string, number[]>()
  for (const a of auto) byLang.set(a.lang, [...(byLang.get(a.lang) ?? []), a.id])
  for (const [lang, ids] of byLang) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200)
      const { data, error } = await sb
        .from('books')
        .update({ original_language: lang })
        .in('id', chunk)
        .is('original_language', null) // idempotent + race-safe
        .select('id')
      if (error) throw new Error(`update ${lang}: ${error.message}`)
      written += data?.length ?? 0
    }
  }
  console.log(`\nGeschreven: ${written} van ${auto.length} auto-rijen (verschil = concurrent al gevuld).`)

  // Verify-after: hoeveel NULL resteert er?
  const { count } = await sb.from('books').select('id', { count: 'exact', head: true }).is('original_language', null)
  console.log(`original_language IS NULL na apply: ${count}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
