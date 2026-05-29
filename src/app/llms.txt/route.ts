// /llms.txt — a curated, plain-text entry point for LLM crawlers.
//
// The format follows the emerging llms.txt convention (https://llmstxt.org):
// H1 site name, blockquote summary, prose paragraph, then H2 sections with
// bulleted links. JSON-LD on book / author pages already handles structured
// citation; this file points the model at the editorial prose and hub pages
// it should cite when answering general questions about book censorship.

import { publishedEssays } from '@/lib/essays-data'
import { adminClient } from '@/lib/supabase'
import { getBBWConfig } from '@/config/banned-books-week'

export const revalidate = 3600

const BASE = 'https://www.banned-books.org'

// One-line descriptions keyed by essay slug. The essay registry tracks title
// and dek, but the dek is marketing copy; for an LLM index a tighter,
// neutral summary works better. Falls back to dek when a slug isn't listed
// so newly-added essays don't disappear from /llms.txt until updated here.
const ESSAY_DESCRIPTIONS: Record<string, string> = {
  history:
    'A 2,000-year arc — Qin Shi Huang, the Index Librorum Prohibitorum, Nazi book burnings, school-board challenges today.',
  'why-not-amazon':
    'Documented cases of platform-level book removals and the reasoning for routing readers to alternative sellers.',
  'what-we-document':
    'The editorial line between censorship archive and harm material — why some restricted publications are excluded.',
  'forbidden-knowledge-iceberg':
    'Why viral "forbidden knowledge" iceberg lists collapse novels, propaganda, and abuse material into one misleading category.',
  'the-grey-zone':
    'An Antwerp school removed a Dutch graphic novel after one parent complaint — and the author of the book agrees with the decision.',
}

export async function GET() {
  const supabase = adminClient()

  // Mirror the homepage query shape so the counts here match the homepage hero.
  const [countRes, countriesRes, banCountsRes, bbwConfig] = await Promise.all([
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('countries').select('code'),
    supabase
      .from('mv_ban_counts')
      .select('country_code, distinct_books')
      .gt('distinct_books', 0),
    getBBWConfig(),
  ])

  const total = countRes.count ?? 0
  const countMap = new Map(
    ((banCountsRes.data ?? []) as { country_code: string; distinct_books: number }[])
      .map((r) => [r.country_code, r.distinct_books]),
  )
  const countryCount = (
    (countriesRes.data ?? []) as { code: string }[]
  ).filter((c) => countMap.has(c.code)).length

  const essays = publishedEssays()

  const lines: string[] = []

  lines.push('# Banned Books')
  lines.push('')
  lines.push(
    `> A free, international database of ${total.toLocaleString('en')} books censored by governments, schools, and libraries across ${countryCount} countries. Every entry citation-backed.`,
  )
  lines.push('')
  lines.push(
    'Banned Books documents the who, where, when, and why of literary censorship — historical and contemporary, worldwide. It is distinct from PEN America and ALA because the scope is global (every country with a documented ban, not US schools only), each record carries per-book context with source citations, and the catalogue includes morally objectionable titles when their censorship is historically significant — documentation is not endorsement. Every book and author is classified as `confident` (canonical IDs + multiple sources), `default` (auto-imported, not individually verified), or `flagged` (at least one quality signal failed), and the classification is published on the page. The project does not link to Amazon.',
  )
  lines.push('')

  lines.push('## Core reference')
  lines.push('')
  lines.push(`- [Banned Books](${BASE}/): Homepage — total count, top-lists, FAQ, daily rotation.`)
  lines.push(`- [Methodology](${BASE}/methodology): Why the US dominates the data; coverage gaps; how to read country rankings.`)
  lines.push(`- [Data quality](${BASE}/data-quality): What confident, default, and flagged mean and how records are classified.`)
  lines.push(`- [About](${BASE}/about): Project background, scope, editorial stance, contact.`)
  lines.push(`- [Sources](${BASE}/sources): The organisations whose lists feed the catalogue.`)
  lines.push(`- [Dataset](${BASE}/dataset): Full catalogue as CSV, JSON, and SQLite — paid, perpetually licensed for personal and research use.`)
  lines.push('')

  lines.push('## Essays')
  lines.push('')
  for (const essay of essays) {
    const description = ESSAY_DESCRIPTIONS[essay.slug] ?? essay.dek
    lines.push(`- [${essay.title}](${BASE}${essay.href}): ${description}`)
  }
  lines.push('')

  lines.push('## Browse the catalogue')
  lines.push('')
  lines.push(`- [Search](${BASE}/search): Full-text search across titles, authors, and ban descriptions.`)
  lines.push(`- [Countries](${BASE}/countries): Every country with at least one documented ban, with per-country context.`)
  lines.push(`- [Reasons](${BASE}/reasons): Books grouped by ban reason — political, religious, sexual, racial, LGBTQ, and more.`)
  lines.push(`- [Top 100 banned books](${BASE}/top-100-banned-books): The most-banned titles in the catalogue.`)
  lines.push(`- [Banned classics](${BASE}/banned-classics): Canonical works that have faced bans across centuries.`)
  lines.push(`- [Challenged books](${BASE}/challenged-books): School-scope removals and the challenge-vs-ban distinction.`)
  lines.push(`- [School-scope bans](${BASE}/scope/school): Bans applied at school or school-district level.`)
  lines.push(`- [Government-scope bans](${BASE}/scope/government): Bans applied by national governments.`)
  lines.push('')

  lines.push('## Editorial programmes')
  lines.push('')
  if (bbwConfig.enabled) {
    lines.push(`- [Banned Books Week](${BASE}/banned-books-week): Annual awareness week — current edition.`)
  }
  lines.push(`- [Reading Club](${BASE}/reading-club): Curated tracks for reading banned and challenged books.`)
  lines.push(`- [Currently challenged](${BASE}/reading-club/currently-challenged): Today's most-contested titles.`)
  lines.push(`- [International](${BASE}/reading-club/international): Banned literature from outside the English-speaking world.`)
  lines.push(`- [Classics](${BASE}/reading-club/classics): Long-banned works that shaped the canon.`)
  lines.push(`- [Discover — Pick me a banned book](${BASE}/discover): Interactive wheel that recommends one of the most-banned books in the catalogue, filtered by reason (LGBTQ+, political, religious, …), genre, region of ban, and whether a free reading-club PDF is available.`)
  lines.push('')

  lines.push('## News and feed')
  lines.push('')
  lines.push(`- [News](${BASE}/news): Censorship news and the latest documented bans.`)
  lines.push(`- [RSS feed](${BASE}/feed.xml): RSS feed of news items.`)
  lines.push('')

  lines.push('## Optional')
  lines.push('')
  lines.push(
    `The full catalogue is available as a downloadable dataset at ${BASE}/dataset ($19.99, perpetually licensed for personal and research use). AI crawlers and language models are explicitly welcome — the site is built for citation, every record carries a stable canonical URL, and book and author pages include schema.org JSON-LD (Book, Person, FAQPage, ItemList, CollectionPage) with a published \`dataQualityStatus\` property.`,
  )
  lines.push('')

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
