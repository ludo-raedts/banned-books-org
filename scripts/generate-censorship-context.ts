/**
 * Generate censorship_context narratives from structured ban data.
 * No AI API required — derives text from DB fields only.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/generate-censorship-context.ts           # dry-run (first 3)
 *   npx tsx --env-file=.env.local scripts/generate-censorship-context.ts --apply   # write all 50
 *   npx tsx --env-file=.env.local scripts/generate-censorship-context.ts --apply --limit=10
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : (APPLY ? 50 : 3)

const supabase = adminClient()

type BanRow = {
  year_started: number | null
  year_ended: number | null
  status: string
  action_type: string
  country_code: string
  countries: { name_en: string } | null
  scopes: { label_en: string } | null
  ban_reason_links: { reasons: { slug: string; label_en: string } | null }[]
}

type BookRow = {
  id: number
  title: string
  slug: string
  first_published_year: number | null
  description_ban: string | null
  book_authors: { authors: { display_name: string } | null }[]
  bans: BanRow[]
}

// ── Reason → opening sentence fragment ──────────────────────────────────────
const REASON_OPENERS: Record<string, string> = {
  political:  'its political content and challenge to authority',
  sexual:     'sexual content deemed obscene or inappropriate',
  lgbtq:      'its LGBTQ+ themes and positive depiction of queer identity',
  violence:   'depictions of violence',
  racial:     'its treatment of race and racial language',
  religious:  'content considered offensive to religious doctrine',
  blasphemy:  'blasphemy and offence to religious belief',
  obscenity:  'obscenity under broad moral censorship provisions',
  moral:      'broad moral grounds — content deemed indecent or corrupting',
  drugs:      'depictions of drug use',
  language:   'offensive language',
  other:      'reasons documented in the ban records below',
}

// ── Pattern conclusion by primary reason ────────────────────────────────────
const REASON_CONCLUSIONS: Record<string, string> = {
  political:  'This case illustrates how governments across political systems have used censorship to shield authority from literary criticism.',
  sexual:     'This pattern reflects the broad and inconsistent application of obscenity law across different legal systems.',
  lgbtq:      'This case is part of a global pattern in which LGBTQ+ representation in literature faces disproportionate legal and institutional pressure.',
  violence:   'This reflects the recurring tension between protecting readers from disturbing content and suppressing honest accounts of human experience.',
  racial:     'This case illustrates the paradox of censoring literature that critiques racism for the very language it uses to document it.',
  religious:  'This case illustrates how religious authority and the state have historically aligned to suppress challenges to official doctrine.',
  blasphemy:  'Blasphemy prohibitions demonstrate how religious offence continues to be treated as a legal harm in much of the world.',
  obscenity:  'This reflects how broadly drawn obscenity laws have historically targeted serious literature alongside explicitly pornographic material.',
  moral:      'This illustrates how catch-all moral provisions have been used to suppress not just explicit material but any challenge to social convention.',
  drugs:      'This case reflects ongoing discomfort with literature that depicts drug use honestly rather than through a cautionary lens.',
  language:   'This illustrates how the presence of offensive language — often used to faithfully document historical or social reality — can trigger censorship of the broader work.',
  other:      'This case illustrates how censorship authorities regularly reach for novel justifications when standard categories do not apply.',
}

function listCountries(bans: BanRow[]): string {
  const names = [...new Set(bans.map(b => b.countries?.name_en ?? b.country_code))]
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function buildContext(book: BookRow): string | null {
  const bans = book.bans
  if (bans.length === 0) return null

  // Collect all reason slugs, ranked by frequency
  const reasonCounts = new Map<string, number>()
  for (const ban of bans) {
    for (const l of ban.ban_reason_links) {
      if (l.reasons) {
        reasonCounts.set(l.reasons.slug, (reasonCounts.get(l.reasons.slug) ?? 0) + 1)
      }
    }
  }
  const sortedReasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])
  const primarySlug = sortedReasons[0]?.[0] ?? 'other'
  const primaryLabel = sortedReasons[0] ? (bans.flatMap(b => b.ban_reason_links).find(l => l.reasons?.slug === primarySlug)?.reasons?.label_en ?? primarySlug) : 'unspecified reasons'

  // Secondary reasons
  const secondarySlugs = sortedReasons.slice(1, 3).map(([slug]) => slug)
  const secondaryLabels = secondarySlugs
    .map(slug => bans.flatMap(b => b.ban_reason_links).find(l => l.reasons?.slug === slug)?.reasons?.label_en)
    .filter(Boolean) as string[]

  // Earliest ban year
  const years = bans.map(b => b.year_started).filter((y): y is number => y != null)
  const earliestYear = years.length > 0 ? Math.min(...years) : null

  // Active vs historical bans
  const activeBans = bans.filter(b => b.status !== 'historical')
  const historicalBans = bans.filter(b => b.status === 'historical')

  // Scope breakdown
  const govBans = bans.filter(b => b.scopes?.label_en?.toLowerCase().includes('government') || b.scopes?.label_en?.toLowerCase().includes('national'))
  const schoolBans = bans.filter(b => b.scopes?.label_en?.toLowerCase().includes('school'))

  // Build sentences
  const sentences: string[] = []

  // Sentence 1: core reason opener
  const reasonFragment = REASON_OPENERS[primarySlug] ?? primaryLabel
  const secondaryNote = secondaryLabels.length > 0
    ? `, as well as ${secondaryLabels.join(' and ').toLowerCase()}`
    : ''
  if (bans.length === 1) {
    const country = bans[0].countries?.name_en ?? bans[0].country_code
    const yearNote = earliestYear ? ` in ${earliestYear}` : ''
    sentences.push(`${book.title} was banned or restricted in ${country}${yearNote} for ${reasonFragment}${secondaryNote}.`)
  } else {
    sentences.push(`${book.title} has been banned or restricted in multiple countries primarily for ${reasonFragment}${secondaryNote}.`)
    // Sentence 2: geographic and temporal scope (only meaningful for multi-ban)
    const countryList = listCountries(bans)
    const yearNote2 = earliestYear ? ` since at least ${earliestYear}` : ''
    sentences.push(`The book has faced formal bans or removal orders in ${countryList}${yearNote2}.`)
  }

  // Sentence 3: scope breakdown (gov vs school) if both present
  if (govBans.length > 0 && schoolBans.length > 0) {
    sentences.push(`Government-level bans have been imposed in ${listCountries(govBans)}, while school-level challenges have occurred in ${listCountries(schoolBans)}.`)
  } else if (govBans.length > 1) {
    sentences.push(`In each case the ban was imposed at the national or government level, reflecting state-level rather than institutional opposition.`)
  } else if (schoolBans.length > 1) {
    sentences.push(`The challenges have been concentrated at school and library level, reflecting the recurrent pressure to remove the book from educational settings.`)
  }

  // Sentence 4: lifted bans if any
  if (historicalBans.length > 0 && activeBans.length > 0) {
    const liftedCountries = [...new Set(historicalBans.map(b => b.countries?.name_en ?? b.country_code))]
    const liftedList = liftedCountries.length === 1 ? liftedCountries[0] : liftedCountries.join(' and ')
    sentences.push(`Bans in ${liftedList} have since been lifted or lapsed, though restrictions remain active elsewhere.`)
  } else if (historicalBans.length > 0 && activeBans.length === 0) {
    sentences.push(`The documented ban has since been lifted or lapsed; the book now circulates freely.`)
  }

  // Sentence 5: conclusion
  sentences.push(REASON_CONCLUSIONS[primarySlug] ?? REASON_CONCLUSIONS.other)

  return sentences.join(' ')
}

async function main() {
  const { data: allBooks } = await supabase
    .from('books')
    .select(`
      id, title, slug, first_published_year, description_ban,
      book_authors(authors(display_name)),
      bans(
        year_started, year_ended, status, action_type, country_code,
        countries(name_en),
        scopes(label_en),
        ban_reason_links(reasons(slug, label_en))
      )
    `)
    .eq('ai_drafted', false)
    .is('censorship_context', null)

  const books = allBooks as unknown as BookRow[]
  const qualifying = books
    .filter(b => b.bans.length >= 1)
    .sort((a, b) => b.bans.length - a.bans.length)
    .slice(0, LIMIT)

  const totalQualifying = books.filter(b => b.bans.length >= 1).length
  console.log(`Qualifying books: ${totalQualifying} total`)
  console.log(`Processing: ${qualifying.length} (limit=${LIMIT}, apply=${APPLY})\n`)

  let written = 0
  let skipped = 0

  for (const book of qualifying) {
    const context = buildContext(book)
    console.log(`[${book.slug}] (${book.bans.length} bans)`)

    if (!context) {
      console.log(`  → SKIP`)
      skipped++
      continue
    }

    console.log(`  → ${context.slice(0, 120)}…`)

    if (APPLY) {
      const { error } = await supabase
        .from('books')
        .update({ censorship_context: context })
        .eq('id', book.id)
      if (error) console.error(`  ✗ ${error.message}`)
      else { console.log(`  ✓ written`); written++ }
    }
  }

  console.log(`\nDone. Written: ${written}, Skipped: ${skipped}`)
  if (!APPLY) console.log('DRY-RUN — re-run with --apply to write.')
}

main().catch(e => { console.error(e); process.exit(1) })
