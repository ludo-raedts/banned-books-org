#!/usr/bin/env tsx
// READ-ONLY standing audit: books whose original_language is a NON-English
// language, yet whose stored title is evidently ENGLISH and whose bans give
// no reason to expect that language. This is the "Gone with the Wind" class
// (fixed by hand 2026-07-07): a cross-language merge leaked a foreign
// original_language (+ foreign title_native) onto an English work, which then
// bleeds a wrong native title into the SERP <title>/meta (native-title.ts
// gates on original_language != 'en'). See memory project_cross_language_dupes
// for the merge doctrine that causes this leak.
//
// It NEVER touches the DB. It writes a review worklist; confirmed rows are
// corrected by apply-original-language-fixes.ts (source stamped per row).
//
// Signals (a row is FLAGGED only when all hold):
//   1. original_language != 'en' and not NULL.
//   2. Title scores clearly ENGLISH: pure ASCII/Latin (no diacritics that
//      would point elsewhere) AND >=2 distinct English function-word hits,
//      AND scores NO other language's function words.
//   3. No ban from a country where the claimed language is a plausible
//      original-publication language (LANG_COUNTRIES). A German original
//      banned only in the US is suspicious; one also banned in DE is not.
//
// Buckets (→ data/original-language-misclass-<date>.md):
//   STRONG  — flag + title_native is empty OR itself English/Latin. The claim
//             rests on nothing; almost certainly should be 'en'.
//   NATIVE  — flag + title_native present in a script/looks matching the
//             claimed language. The language may be RIGHT and the *title* row
//             wrong (stored under an English translation). Do NOT blindly flip
//             to 'en' — check whether title should hold the native title.
//
//   pnpm tsx --env-file=.env.local scripts/_audit_original_language_english.ts

import { writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { detectScript } from '../src/lib/imports/language-inference'

const sb = adminClient()
const PAGE = 1000
const TODAY = new Date().toISOString().slice(0, 10)

// English function words. A clearly-English title hits >=2 DISTINCT of these.
const EN_WORDS = /\b(the|of|and|a|an|to|in|for|with|on|at|from|by|is|are|was|were|be|it|this|that|his|her|their|our|my|your|who|what|when|where|why|how|not|no|all|little|big|great|last|first|new|old|good|bad|night|day|life|death|world|history|story|girl|boy|man|woman|men|women|things|house|book|love|war|blood|dark|light|about|into|out|up|down|over|under|between|against|without|through|american|english|british)\b/gi

// Function words that betray a NON-English title. If any of these fire, the
// title is not "clearly English" — bail out (avoids false positives on
// cognate-heavy titles like "El partido comunista").
const NON_EN_WORDS =
  /\b(der|die|das|und|ein|eine|einer|eines|im|zum|zur|von|vom|mit|für|über|nicht|des|dem|den|el|los|las|del|un|una|unos|unas|y|para|por|que|le|la|les|du|des|et|dans|pour|par|avec|sur|qui|il|lo|gli|delle|degli|uno|ed|non|per|het|een|van|voor|met|niet|over|naar|uit|não|os|do|da|dos|das|em|na|nos|nas)\b/i

// A title with these characters is not plain-English ASCII.
const NON_EN_CHARS = /[À-ÿĀ-ſ]/

// Claimed language -> ban countries where that language is a plausible
// ORIGINAL-publication language. Mirrors the backfill script's map, PLUS the
// historical/aggregate ban codes this corpus actually uses — omitting them was
// the detector's dominant false-positive source (Master & Margarita is ru but
// banned under SU, Kundera is cs but banned under CS, Djilas is sh but banned
// under YU). SU→all Soviet languages, YU→all Yugoslav languages, CS→cs/sk.
const LANG_COUNTRIES: Record<string, string[]> = {
  pt: ['PT', 'BR', 'AO', 'MZ', 'GW', 'CV', 'ST', 'TL'],
  fr: ['FR', 'BE', 'CH', 'CA', 'DZ', 'MA', 'TN', 'HT', 'SN', 'CD', 'CI', 'LU', 'MC'],
  es: ['ES', 'MX', 'AR', 'CL', 'CO', 'PE', 'CU', 'VE', 'UY', 'PY', 'BO', 'EC', 'GT', 'DO', 'HN', 'NI', 'CR', 'PA', 'SV'],
  de: ['DE', 'AT', 'CH', 'LI', 'LU'],
  ru: ['RU', 'BY', 'KZ', 'UA', 'MD', 'KG', 'UZ', 'TJ', 'LV', 'EE', 'LT', 'SU'],
  it: ['IT', 'CH', 'SM', 'VA'],
  nl: ['NL', 'BE', 'SR'],
  zh: ['CN', 'HK', 'TW', 'SG', 'MY', 'MO'],
  ja: ['JP'], ko: ['KR', 'KP'],
  ar: ['SA', 'EG', 'AE', 'IQ', 'SY', 'LB', 'JO', 'MA', 'DZ', 'TN', 'LY', 'KW', 'QA', 'BH', 'OM', 'YE', 'SD', 'PS'],
  fa: ['IR', 'AF', 'TJ'], tr: ['TR', 'CY'], el: ['GR', 'CY'], he: ['IL'], pl: ['PL'],
  cs: ['CZ', 'CS'], sk: ['SK', 'CS'],
  hu: ['HU', 'RO'], ro: ['RO', 'MD'], bg: ['BG'],
  sr: ['RS', 'ME', 'BA', 'YU'], sh: ['RS', 'HR', 'BA', 'ME', 'YU', 'SI', 'MK'],
  hr: ['HR', 'BA', 'YU'], sl: ['SI', 'YU'], mk: ['MK', 'YU'],
  uk: ['UA', 'SU'], be: ['BY', 'SU'], da: ['DK'], sv: ['SE', 'FI'], no: ['NO'],
  fi: ['FI'], is: ['IS'], hi: ['IN'], ur: ['PK', 'IN'], bn: ['BD', 'IN'], ta: ['IN', 'LK', 'MY', 'SG'],
  ms: ['MY', 'SG', 'BN'], id: ['ID', 'MY'], th: ['TH'], vi: ['VN'], my: ['MM'], km: ['KH'], ne: ['NP'],
  si: ['LK'], sw: ['TZ', 'KE', 'UG'], af: ['ZA', 'NA'], sq: ['AL', 'XK', 'MK'], az: ['AZ', 'SU'],
  uz: ['UZ', 'SU'], kk: ['KZ', 'SU'], tg: ['TJ', 'SU'], am: ['ET'], ps: ['AF', 'PK'], tl: ['PH'],
  la: ['VA'], sa: ['IN'],
}

function looksEnglish(title: string): boolean {
  if (NON_EN_CHARS.test(title)) return false
  if (NON_EN_WORDS.test(title)) return false
  const hits = new Set((title.match(EN_WORDS) ?? []).map((w) => w.toLowerCase()))
  return hits.size >= 2
}

// title_native that is itself English/Latin (not a real native title) counts
// as "empty" evidence for the STRONG bucket.
function nativeIsWeak(tn: string | null): boolean {
  if (!tn) return true
  const s = detectScript(tn)
  return s === 'latin' || s === null
}

type Book = {
  id: number
  slug: string
  title: string
  title_native: string | null
  original_language: string
}

async function main() {
  const books: Book[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('books')
      .select('id, slug, title, title_native, original_language')
      .not('original_language', 'is', null)
      .neq('original_language', 'en')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    books.push(...((data ?? []) as Book[]))
    if (!data || data.length < PAGE) break
  }
  console.log(`Niet-en, niet-NULL books: ${books.length}`)

  const suspects = books.filter((b) => looksEnglish(b.title))
  console.log(`Engels-scorende titels: ${suspects.length}`)

  // Ban countries per suspect.
  const banC = new Map<number, string[]>()
  const ids = suspects.map((b) => b.id)
  for (let i = 0; i < ids.length; i += 400) {
    const { data, error } = await sb.from('bans').select('book_id, country_code').in('book_id', ids.slice(i, i + 400)).order('id')
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      if (!r.country_code) continue
      banC.set(r.book_id, [...(banC.get(r.book_id) ?? []), r.country_code])
    }
  }

  const strong: Array<Book & { countries: string[] }> = []
  const native: Array<Book & { countries: string[] }> = []
  for (const b of suspects) {
    const countries = Array.from(new Set(banC.get(b.id) ?? []))
    const home = LANG_COUNTRIES[b.original_language]
    const hasHomeBan = home ? countries.some((c) => home.includes(c)) : false
    if (hasHomeBan) continue // plausible original-language market → not suspect
    if (nativeIsWeak(b.title_native)) strong.push({ ...b, countries })
    else native.push({ ...b, countries })
  }
  console.log(`\nGEFLAGD: STRONG=${strong.length}  NATIVE=${native.length}`)

  const byLang = (rows: Book[]) => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.original_language, (m.get(r.original_language) ?? 0) + 1)
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l}:${n}`).join(' ')
  }
  console.log(`  STRONG per taal: ${byLang(strong)}`)
  console.log(`  NATIVE per taal: ${byLang(native)}`)

  const md: string[] = [
    `# original_language misclassificatie-audit (GWTW-klasse) — ${TODAY}`,
    '',
    'READ-ONLY. Rijen met `original_language != en` maar een evident Engelse titel',
    'en geen ban uit een taal-passend land. Fixes via apply-original-language-fixes.ts.',
    '',
    `Kandidaten: ${books.length} niet-en · ${suspects.length} Engels-scorend · **${strong.length + native.length} geflagd**.`,
    '',
    '## STRONG — title_native leeg/Latijns; claim rust op niets → vrijwel zeker `en`',
    '',
  ]
  for (const b of strong.sort((a, b) => a.original_language.localeCompare(b.original_language))) {
    md.push(`- \`${b.original_language}\` **${b.title}** — bans ${b.countries.join('+') || '—'} — native=${b.title_native ? `"${b.title_native}"` : '∅'} — [${b.slug}](https://www.banned-books.org/books/${b.slug})`)
  }
  md.push('', '## NATIVE — title_native is échte niet-Latijnse titel; taal kán kloppen, controleer titel-veld', '')
  for (const b of native.sort((a, b) => a.original_language.localeCompare(b.original_language))) {
    md.push(`- \`${b.original_language}\` **${b.title}** — bans ${b.countries.join('+') || '—'} — native="${b.title_native}" — [${b.slug}](https://www.banned-books.org/books/${b.slug})`)
  }
  const mdPath = `data/original-language-misclass-${TODAY}.md`
  const jsonPath = `data/original-language-misclass-${TODAY}.json`
  writeFileSync(mdPath, md.join('\n'))
  writeFileSync(jsonPath, JSON.stringify({ generated_at: TODAY, strong, native }, null, 1))
  console.log(`\nWorklist: ${mdPath} + ${jsonPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
