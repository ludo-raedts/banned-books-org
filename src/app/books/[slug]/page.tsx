// ISR: regenerate book detail pages every hour. Detail pages were
// previously force-dynamic because they did server-side pageview tracking;
// that's now a fire-and-forget POST to /api/pageview from the client
// (<PageviewTracker> below), so the page itself can be cached statically.
// Drops TTFB on cached hits from ~500ms to ~50ms (CWV ranking signal).
export const revalidate = 3600

import React from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import PageviewTracker from '@/components/pageview-tracker'
import Breadcrumb from '@/components/breadcrumb'
import ReasonBadge, { reasonLabel } from '@/components/reason-badge'
import BanActionBadge from '@/components/ban-action-badge'
import GenreBadge from '@/components/genre-badge'
import AwardBadge from '@/components/award-badge'
import { parseAwards, awardSchemaText, awardName } from '@/lib/awards'
import ShareButtons from '@/components/share-buttons'
import BanTimeline, { type TimelineRow } from '@/components/ban-timeline'
import { countryFlag } from '@/lib/country-flag'
import { getBookshopUrl, getBookshopLinkType, BOOKSHOP_REL } from '@/lib/bookshop'
import { getKoboUrl, KOBO_REL } from '@/lib/kobo'
import TrackedOutboundLink from '@/components/tracked-outbound-link'
import CitationBlock from '@/components/citation-block'
import DescriptionSourceAttribution from '@/components/description-source-attribution'
import { buildCitationMeta } from '@/lib/citation-meta'
import { coverAlt } from '@/lib/cover-alt'
import {
  QualityCheck,
  QualityFlaggedNotice,
  QualityFooterLine,
  type DataQualityStatus,
} from '@/components/data-quality'
import { BOOK_REASON_PHRASE } from '@/lib/reason-phrases'
import { getReadingClubLinkForBook } from '@/lib/reading-club-data'
import GateOverlay from '@/components/gate-overlay'

// Programmatically-generated direct-answer summary + FAQ Q&As, used to
// surface the "why was X banned" answer in the first 200 words of the page
// (the window AI Overview and Featured Snippet ranking cares about) and
// to emit FAQPage JSON-LD for rich-result eligibility.
//
// All inputs come from already-loaded book + bans data; no extra DB calls.
type Ban_ = {
  year_started: number | null
  status: string
  description: string | null
  country_code: string
  countries: { name_en: string } | null
  ban_reason_links: { reasons: { id: number; slug: string } | null }[]
}
type FaqItem = { q: string; a: string }
function buildBanSummary(
  bookTitle: string,
  authorStr: string,
  sortedBans: Ban_[],
): { topic: string; complement: string; faqItems: FaqItem[] } | null {
  if (sortedBans.length === 0) return null

  const baseTitle = authorStr ? `${bookTitle} by ${authorStr}` : bookTitle

  const countryNames = new Map<string, string>()
  for (const b of sortedBans) {
    if (b.countries?.name_en && !countryNames.has(b.country_code)) {
      countryNames.set(b.country_code, b.countries.name_en)
    }
  }
  const countries = [...countryNames.values()]

  const reasonCount = new Map<string, number>()
  for (const b of sortedBans) {
    for (const link of b.ban_reason_links) {
      const slug = link.reasons?.slug
      if (slug) reasonCount.set(slug, (reasonCount.get(slug) ?? 0) + 1)
    }
  }
  // Tie-break by slug so the headline reason is deterministic. Without it,
  // a book whose top reasons are level-pegged (e.g. 1 sexual + 1 political)
  // resolves differently here than in generateMetadata — the two iterate the
  // bans in different orders (sorted-by-year vs. raw query order) — so the page
  // renders a <title> ("…for sexual content") that contradicts the H1 subtitle
  // ("…for political content").
  const topReasonSlug = [...reasonCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
  const topReasonPhrase = topReasonSlug ? BOOK_REASON_PHRASE[topReasonSlug] : null

  const datedBans = sortedBans.filter(b => b.year_started != null)
  const earliestYear = datedBans.length > 0 ? Math.min(...datedBans.map(b => b.year_started!)) : null
  const activeBanCount = sortedBans.filter(b => b.status === 'active').length

  // `topic` = the short headline phrase rendered as a subtitle in the H1
  // zone. Carries the country+reason match for the "why was X banned" query.
  // `complement` = the longer red-quote sentence below the hero, carrying
  // facts the subtitle deliberately omits (year, multi-country roll-up,
  // mixed active/historical status). The two MUST NOT repeat each other's
  // headline — see [[reference-gsc-scripts]] and the gsc-ops doc for why
  // duplication suppresses CTR.
  let topic: string
  if (countries.length === 1 && topReasonPhrase) {
    topic = `Banned in ${countries[0]} for ${topReasonPhrase}`
  } else if (countries.length === 1) {
    topic = `Banned in ${countries[0]}`
  } else if (topReasonPhrase) {
    topic = `Banned in ${countries.length} countries for ${topReasonPhrase}`
  } else {
    topic = `Banned in ${countries.length} countries`
  }

  const complementParts: string[] = []
  if (earliestYear) {
    complementParts.push(
      countries.length === 1
        ? `First documented in ${earliestYear}.`
        : `Earliest documented ban: ${earliestYear}.`,
    )
  }
  if (countries.length >= 3) {
    complementParts.push(`Documented bans include ${countries.slice(0, 3).join(', ')}, among others.`)
  }
  if (activeBanCount > 0 && sortedBans.length > activeBanCount) {
    complementParts.push(
      `${activeBanCount} ${activeBanCount === 1 ? 'ban remains' : 'bans remain'} active today.`,
    )
  }
  const complement = complementParts.join(' ')

  // FAQ items: prioritise unique-country Q&As (Google ignores duplicate
  // questions across the same FAQPage). Capped at 5 to stay under the
  // Search Console "FAQPage with too many entries" advisory.
  const items: FaqItem[] = []
  const seenCountries = new Set<string>()
  for (const ban of sortedBans) {
    const country = ban.countries?.name_en
    if (!country || seenCountries.has(country)) continue
    seenCountries.add(country)
    const reasonsForBan = ban.ban_reason_links
      .map(l => l.reasons?.slug)
      .filter((s): s is string => !!s)
      .map(s => BOOK_REASON_PHRASE[s] ?? s)
    const yearPart = ban.year_started ? ` in ${ban.year_started}` : ''
    const reasonPart = reasonsForBan.length > 0 ? ` for ${reasonsForBan.join(' and ')}` : ''
    const descPart = ban.description?.trim() ? ` ${ban.description.trim()}` : ''
    const q = `Why was ${bookTitle} banned in ${country}?`
    let a = `${bookTitle} was banned in ${country}${yearPart}${reasonPart}.${descPart}`
    if (a.length > 600) a = a.slice(0, 597) + '…'
    items.push({ q, a })
    if (items.length >= 5) break
  }
  if (earliestYear && items.length < 5) {
    const firstCountry = sortedBans.find(b => b.year_started === earliestYear)?.countries?.name_en
    if (firstCountry) {
      const more = countries.length - 1
      items.push({
        q: `When was ${bookTitle} first banned?`,
        a: `${bookTitle} was first banned in ${firstCountry} in ${earliestYear}.${
          more > 0 ? ` It has since been banned in ${more} more ${more === 1 ? 'country' : 'countries'}.` : ''
        }`,
      })
    }
  }

  return { topic, complement, faqItems: items }
}

// Bucket A blocklist (CSAM-adjacent policy §5b / §6). Read server-side via
// adminClient() because blocked_works has RLS with no public policy — the
// public page only ever learns *that* a slug is blocked, never title/reason.
async function isBlockedSlug(slug: string): Promise<boolean> {
  const { data } = await adminClient()
    .from('blocked_works')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle()
  return !!data
}

// Content-free tombstone (policy §5b). No title-specific detail, no ISBN, no
// alternative titles, no external links — nothing that helps locate the work.
function TombstoneNotice() {
  return (
    <main className="max-w-2xl mx-auto px-5 py-20">
      <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 mb-6">
        This edition is not included in the archive.
      </h1>
      <div className="space-y-4 text-[15px] leading-relaxed text-gray-700">
        <p>
          We do not catalogue works for which it is established that their
          production, or their purpose, is to cause harm to people who cannot
          protect themselves. This is a deliberate editorial decision, consistent
          with our inclusion criterion.
        </p>
        <p>We document censorship; we do not provide a record of, or a path to, this material.</p>
      </div>
    </main>
  )
}

// Prebuild the 100 most-banned books at build time; the long tail is
// generated + ISR-cached on first visit (dynamicParams defaults to true).
// Without any generateStaticParams the route renders fully dynamically
// (no-store, MISS on every request) and revalidate=3600 never engages.
export async function generateStaticParams() {
  const sb = adminClient()
  const { data: top } = await sb
    .from('v_top_banned_books')
    .select('entity_id')
    .order('total_bans', { ascending: false })
    .limit(100)
  const ids = ((top ?? []) as { entity_id: number }[]).map((r) => r.entity_id)
  if (ids.length === 0) return []
  const { data } = await sb.from('books').select('slug').in('id', ids)
  return ((data ?? []) as { slug: string }[]).map((b) => ({ slug: b.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params

  // Bucket A (blocklist): a blocked slug is not a catalogue entry. Neutral,
  // non-identifying metadata + noindex, before any books lookup.
  if (await isBlockedSlug(slug)) {
    return {
      title: 'Not included',
      robots: { index: false, follow: false },
      alternates: { canonical: `/books/${slug}` },
    }
  }

  const { data } = await adminClient()
    .from('books')
    .select(`
      title, cover_url, first_published_year, is_gated,
      book_authors(authors(display_name)),
      bans(country_code, countries(name_en), ban_reason_links(reasons(slug)))
    `)
    .eq('slug', slug)
    .single()

  if (!data) return {}

  // Bucket B (gated): exclude from indexing entirely. Title is kept neutral
  // (the work's title is not the harmful content) but no rich OG/snippet hooks.
  if (data.is_gated) {
    return {
      title: data.title,
      robots: { index: false, follow: false },
      alternates: { canonical: `/books/${slug}` },
    }
  }

  type MetaBan = {
    country_code: string
    countries: { name_en: string } | null
    ban_reason_links: { reasons: { slug: string } | null }[]
  }
  const bans = (data.bans as unknown as MetaBan[]) ?? []
  const authorList = (data.book_authors as unknown as { authors: { display_name: string } | null }[])
    .map((ba) => ba.authors?.display_name).filter((s): s is string => !!s)
  const author = authorList.join(', ')
  const baseTitle = `${data.title}${author ? ` by ${author}` : ''}`

  const countryByCode = new Map<string, string>()
  for (const b of bans) {
    if (!countryByCode.has(b.country_code)) {
      countryByCode.set(b.country_code, b.countries?.name_en ?? b.country_code)
    }
  }
  const uniqueCountries = [...countryByCode.values()]

  const reasonCounts = new Map<string, number>()
  for (const b of bans) {
    for (const l of b.ban_reason_links) {
      const s = l.reasons?.slug
      if (s) reasonCounts.set(s, (reasonCounts.get(s) ?? 0) + 1)
    }
  }
  // Same deterministic tie-break as buildBanSummary (see note there): keeps the
  // <title> reason phrase in lock-step with the H1 subtitle on tied books.
  const topReasonSlug = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
  const topReasonPhrase = topReasonSlug ? BOOK_REASON_PHRASE[topReasonSlug] : null

  // Title-candidate ladder — pick the first that fits the 70-char visible cap.
  // Strategy: keep the most concrete value-add (the "for {reason}" token,
  // which the snippet hook relies on) for as long as possible by dropping
  // author or country first. Vague "Why it was banned" is the last-resort
  // suffix because GSC data (2026-05-23) shows it correlates with ~0%
  // CTR even at position 4 (cf. /books/you-don-t-know-everything-jilly-p:
  // 936 impr @ pos 4 → 0 clicks with the vague suffix).
  //
  // Order:
  //   1. {title} by {author} – Banned in {country} for {reason}     ← richest
  //   2. {title} by {author} – Banned in {N} countries for {reason} (multi-country)
  //   3. {title} – Banned in {country} for {reason}                 ← drop author
  //   4. {title} – Banned in {N} countries for {reason}             (drop author, multi)
  //   5. {title} by {author} – Banned for {reason}                  ← drop country
  //   6. {title} – Banned for {reason}                              ← drop both, keep reason (key hook)
  //   7. {title} by {author} – Banned in {country}                  ← drop reason, single
  //   8. {title} – Banned in {country}                              ← drop author + reason
  //   9. {title} by {author} – Why it was banned                    ← vague (fallback)
  //  10. {title} – Why it was banned
  //  11. {title} – banned book                                       ← shortest value-add
  //  12. {title}                                                     ← bare
  const single = uniqueCountries.length === 1
  const multi = uniqueCountries.length >= 2
  const country = single ? uniqueCountries[0] : null
  const titleCandidates: string[] = []
  if (single && country && topReasonPhrase) {
    titleCandidates.push(`${baseTitle} – Banned in ${country} for ${topReasonPhrase}`)
    titleCandidates.push(`${data.title} – Banned in ${country} for ${topReasonPhrase}`)
  }
  if (multi && topReasonPhrase) {
    titleCandidates.push(`${baseTitle} – Banned in ${uniqueCountries.length} countries for ${topReasonPhrase}`)
    titleCandidates.push(`${data.title} – Banned in ${uniqueCountries.length} countries for ${topReasonPhrase}`)
  }
  if (topReasonPhrase) {
    titleCandidates.push(`${baseTitle} – Banned for ${topReasonPhrase}`)
    titleCandidates.push(`${data.title} – Banned for ${topReasonPhrase}`)
  }
  if (single && country) {
    titleCandidates.push(`${baseTitle} – Banned in ${country}`)
    titleCandidates.push(`${data.title} – Banned in ${country}`)
  }
  if (multi) {
    titleCandidates.push(`${baseTitle} – Banned in ${uniqueCountries.length} countries`)
    titleCandidates.push(`${data.title} – Banned in ${uniqueCountries.length} countries`)
  }
  titleCandidates.push(`${baseTitle} – Why it was banned`)
  titleCandidates.push(`${data.title} – Why it was banned`)
  titleCandidates.push(`${baseTitle} – banned book`)
  titleCandidates.push(`${data.title} – banned book`)
  titleCandidates.push(baseTitle)
  titleCandidates.push(data.title)

  let title = titleCandidates.find(c => c.length <= 70) ?? data.title
  if (title.length > 70) title = title.slice(0, 67) + '…'

  let description: string
  if (bans.length === 0) {
    description = `${baseTitle} on Banned Books — censorship history, country-by-country entries, and source citations on this page.`
  } else if (uniqueCountries.length === 1 && topReasonPhrase) {
    description = `${baseTitle} was banned in ${uniqueCountries[0]} for ${topReasonPhrase}. See the year, the scope, and the full source citations on this page.`
  } else if (uniqueCountries.length === 1) {
    description = `${baseTitle} was banned in ${uniqueCountries[0]}. See the year, the scope, and the full source citations behind every entry on this page.`
  } else if (topReasonPhrase) {
    description = `${baseTitle} has been banned in ${uniqueCountries.length} countries, often for ${topReasonPhrase}. See where, when, why — and the full source citations on this page.`
  } else {
    description = `${baseTitle} has been banned or challenged in ${uniqueCountries.length} countries. See where, when, why — and the full source citations behind every entry.`
  }
  if (description.length > 160) description = description.slice(0, 157) + '…'

  const canonicalUrl = `https://www.banned-books.org/books/${slug}`
  const citationOther = buildCitationMeta({
    entityType: 'book',
    title: data.title,
    authors: authorList,
    url: canonicalUrl,
    onlineDate: data.first_published_year ? String(data.first_published_year) : undefined,
  })

  return {
    title,
    description,
    alternates: { canonical: `/books/${slug}` },
    openGraph: {
      title,
      description,
      // Image is provided by ./opengraph-image.tsx — a branded 1200×630
      // card (cover + title + author + ban summary) generated per book.
      // Setting images here would override the file-based convention.
    },
    twitter: {
      // Always summary_large_image: the per-book OG card is always 1200×630
      // regardless of whether the book has its own cover.
      card: 'summary_large_image',
    },
    other: citationOther,
  }
}

type Ban = {
  id: number
  year_started: number | null
  year_ended: number | null
  action_type: string
  status: string
  country_code: string
  region: string | null
  institution: string | null
  description: string | null
  countries: { name_en: string } | null
  scopes: { label_en: string } | null
  ban_reason_links: { reasons: { id: number; slug: string } | null }[]
  ban_source_links: { ban_sources: { source_name: string; source_url: string } | null }[]
}

// A cluster groups bans that share (country, year, scope, source). Action
// type is NOT part of the key — a 2024-25 PEN cluster may contain a mix of
// 'banned', 'restricted', and 'challenged' actions, surfaced as a per-type
// count in the Where cell. PEN America's per-district data produces one ban
// row per (book, district) in the same school year — without clustering, a
// heavily-banned book renders 80+ visually-identical table rows. The cluster
// carries each member's region/institution so the sub-row can list them
// grouped by state.
type BanCluster = {
  key: string
  country_code: string
  country_name: string
  year_started: number | null
  year_ended: number | null
  status: string
  scope_label: string | null
  // All distinct sources cited across the cluster's member bans (deduped by URL),
  // not just the first — so secondary citations are not hidden.
  sources: { source_name: string; source_url: string }[]
  reason_slugs: Set<string>
  description: string | null
  bans: Ban[]
  // action_type → count of bans of that type within the cluster.
  action_counts: Map<string, number>
  // Locations: bans with region === 'Nation' (federal/system-wide) accumulate
  // into nation_count; everything else groups by region (state) and lists
  // institutions (districts) within.
  nation_count: number
  // Institution names of the region='Nation' bans (e.g. DoDEA). When present we
  // label by the institution rather than the generic "Nationwide / statewide".
  nation_institutions: string[]
  by_state: Map<string, string[]>  // state → [district names]
}

type WarningLevel = 'none' | 'context' | 'extended'

type BookDetail = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  description: string | null
  description_book: string | null
  description_ban: string | null
  description_source_url: string | null
  description_source_type:
    | 'wikipedia' | 'wikipedia_translated' | 'openlibrary' | 'google_books'
    | 'llm_grounded_multi' | 'llm_grounded_single' | 'ai_consensus' | 'manual'
    | null
  censorship_context: string | null
  first_published_year: number | null
  genres: string[]
  gutenberg_id: number | null
  isbn13: string | null
  bookshop_status: 'valid' | 'not_found' | null
  bookshop_isbn13: string | null
  archive_org_id: string | null
  archive_org_status: 'valid' | 'not_found' | null
  warning_level: WarningLevel | null
  inclusion_rationale: string | null
  extended_context: string | null
  is_gated: boolean
  gating_country: string | null
  is_blanket_works: boolean
  original_language: string | null
  title_native: string | null
  title_transliterated: string | null
  title_english_meaningful: string | null
  created_at: string | null
  updated_at: string | null
  data_quality_status: DataQualityStatus
  data_quality_evaluated_at: string | null
  awards: unknown
  book_authors: { authors: { display_name: string; slug: string | null; awards: unknown } | null }[]
  bans: Ban[]
}

function authorName(book: BookDetail): string {
  return book.book_authors
    .map((ba) => ba.authors?.display_name)
    .filter(Boolean)
    .join(', ')
}

// A region='Nation' ban is system-wide rather than tied to a state. DoDEA (the
// Department of Defense Education Activity) is a single federal school system
// spanning U.S. military bases worldwide — not a state, and not a sovereign
// national ban — so it gets a descriptive label instead of the generic
// "Nationwide / statewide".
function nationInstitutionLabel(institution: string): string {
  if (institution === 'Department of Defense Education Activity') {
    return 'U.S. Department of Defense schools (worldwide)'
  }
  return institution
}

// Group bans into clusters keyed on (country, year, action, scope, source).
// Members of a cluster share everything except their (region, institution),
// which the sub-row will list. Returns clusters sorted by year_started for
// stable display order (matches the previous sortedBans ordering).
function clusterBans(bans: Ban[]): BanCluster[] {
  const map = new Map<string, BanCluster>()
  for (const ban of bans) {
    const sourceUrl = ban.ban_source_links[0]?.ban_sources?.source_url ?? ''
    const key = `${ban.country_code}|${ban.year_started ?? ''}|${ban.scopes?.label_en ?? ''}|${sourceUrl}`
    let c = map.get(key)
    if (!c) {
      c = {
        key,
        country_code: ban.country_code,
        country_name: ban.countries?.name_en ?? ban.country_code,
        year_started: ban.year_started,
        year_ended: ban.year_ended,
        status: ban.status,
        scope_label: ban.scopes?.label_en ?? null,
        sources: [],
        reason_slugs: new Set<string>(),
        description: ban.description,
        bans: [],
        action_counts: new Map<string, number>(),
        nation_count: 0,
        nation_institutions: [],
        by_state: new Map<string, string[]>(),
      }
      map.set(key, c)
    }
    c.bans.push(ban)
    c.action_counts.set(ban.action_type, (c.action_counts.get(ban.action_type) ?? 0) + 1)
    for (const l of ban.ban_reason_links) if (l.reasons) c.reason_slugs.add(l.reasons.slug)
    for (const l of ban.ban_source_links) {
      const s = l.ban_sources
      if (s && !c.sources.some((x) => x.source_url === s.source_url)) c.sources.push(s)
    }
    if (c.description == null && ban.description) c.description = ban.description
    // 'historical' wins over 'active' for cluster status if any member is lifted —
    // surfaces the "some bans rescinded" signal without losing it in the aggregate.
    if (ban.status === 'historical' && c.status !== 'historical') c.status = 'historical'

    if (ban.region === 'Nation') {
      c.nation_count++
      if (ban.institution) c.nation_institutions.push(ban.institution)
    } else if (ban.region) {
      const list = c.by_state.get(ban.region) ?? []
      if (ban.institution) list.push(ban.institution)
      c.by_state.set(ban.region, list)
    }
  }
  return [...map.values()].sort((a, b) => (a.year_started ?? 9999) - (b.year_started ?? 9999))
}

// Stable action ordering so a mixed cluster lists its action badges in a
// consistent order regardless of Map insertion order.
const ACTION_ORDER = ['banned', 'restricted', 'challenged', 'removed', 'blocked'] as const

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = adminClient()

  // Bucket A: a blocked slug renders the content-free tombstone and nothing
  // else — no catalogue fetch, no ban data, no cover, no CTA. Comes before the
  // books lookup and before notFound(), so a blocked slug is never a 404.
  if (await isBlockedSlug(slug)) {
    return <TombstoneNotice />
  }

  const { data, error } = await supabase
    .from('books')
    .select(`
      id, title, slug, cover_url, description, description_book, description_ban,
      description_source_url, description_source_type,
      censorship_context, first_published_year, genres, gutenberg_id, isbn13,
      bookshop_status, bookshop_isbn13, archive_org_id, archive_org_status,
      warning_level, inclusion_rationale, extended_context,
      is_gated, gating_country, is_blanket_works,
      original_language,
      title_native, title_transliterated, title_english_meaningful,
      created_at, updated_at,
      data_quality_status, data_quality_evaluated_at,
      awards,
      book_authors(authors(display_name, slug, awards)),
      bans(
        id, year_started, year_ended, action_type, status, country_code, region, institution, description,
        countries(name_en),
        scopes(label_en),
        ban_reason_links(reasons(id, slug)),
        ban_source_links(ban_sources(source_name, source_url))
      )
    `)
    .eq('slug', slug)
    .single()

  if (error || !data) {
    // Alias fallback: maybe this slug points to a book via book_slug_aliases.
    // If so, 308 permanent-redirect to the canonical /books/<canonical_slug>.
    // Search engines and link-juice consolidate on the canonical URL.
    const { data: alias } = await supabase
      .from('book_slug_aliases')
      .select('books(slug)')
      .eq('slug', slug)
      .maybeSingle()
    type AliasRow = { books: { slug: string } | null } | null
    const canonicalSlug = (alias as AliasRow)?.books?.slug ?? null
    if (canonicalSlug && canonicalSlug !== slug) {
      permanentRedirect(`/books/${canonicalSlug}`)
    }
    notFound()
  }

  const book = data as unknown as BookDetail

  // Blanket-works ban ("Toutes ses œuvres", Liste Otto): this is not a real
  // title but a pseudo-book standing in for an author-level ban (bans.book_id
  // is NOT NULL, so the whole-oeuvre ban needs a book to hang on). It has no
  // cover/description/genre and never will, so there is no book page to show —
  // 308 to the author, where the ban surfaces as a "complete works" fact.
  if (book.is_blanket_works) {
    const blanketAuthorSlug = book.book_authors.find(ba => ba.authors?.slug)?.authors?.slug
    if (blanketAuthorSlug) permanentRedirect(`/authors/${blanketAuthorSlug}`)
    notFound()
  }

  const author = authorName(book)

  // Literary awards: Pulitzer is book-level (book.awards); the Nobel Prize is
  // author-level, so a banned book by a laureate surfaces its author's award
  // too. Both render as gold badges in the header and feed schema.org `award`.
  const bookAwards = parseAwards(book.awards)
  const authorAwards = book.book_authors
    .map((ba) => ba.authors)
    .filter((a): a is NonNullable<typeof a> => !!a)
    .flatMap((a) => parseAwards(a.awards))

  // Bucket B (gated): an opaque interstitial covers the record until the reader
  // continues, and every commercial/free path + the cover is suppressed at
  // render level (the DB values are kept). noindex + list-exclusion live in
  // generateMetadata and the sitemap/IndexNow/search/widget queries.
  const gated = book.is_gated

  // Reading-Club badge: rendered next to the title when this book has a
  // published entry in any track (international / classics / by-theme /
  // currently-challenged). One small extra round-trip; ISR (1h) absorbs it.
  const readingClubLink = await getReadingClubLinkForBook(book.id, book.slug)

  const sortedBans = [...book.bans].sort((a, b) =>
    (a.year_started ?? 9999) - (b.year_started ?? 9999)
  )
  const banClusters = clusterBans(sortedBans)

  // Distinct country count across all bans (includes bans with NULL year_started,
  // unlike timelineRows which filters those). Used for the headline label and
  // share-text so the displayed "country" count is always semantically correct.
  const distinctCountries = new Set(book.bans.map(b => b.country_code)).size

  // Flagged works banned in France link to the Loi Gayssot explainer — the
  // statute under which Holocaust-denial titles were banned/prosecuted.
  const bannedInFrance = book.bans.some(b => b.country_code === 'FR')

  // ── Timeline rows: one per country, sorted by earliest ban year ─────────────
  const timelineRows: TimelineRow[] = (() => {
    const byCountry = new Map<string, { name: string; bans: Ban[] }>()
    for (const ban of book.bans) {
      if (ban.year_started == null) continue
      const existing = byCountry.get(ban.country_code)
      const name = ban.countries?.name_en ?? ban.country_code
      if (existing) existing.bans.push(ban)
      else byCountry.set(ban.country_code, { name, bans: [ban] })
    }
    return [...byCountry.entries()]
      .map(([code, { name, bans }]) => ({
        key: code,
        label: name,
        sublabel: code,
        flag: countryFlag(code),
        href: `/countries/${code.toLowerCase()}`,
        bans: bans.map((b) => ({
          id: b.id,
          year_started: b.year_started!,
          year_ended: b.year_ended,
          status: b.status,
          action_type: b.action_type,
        })),
        earliest: Math.min(...bans.map((b) => b.year_started!)),
      }))
      .sort((a, b) => a.earliest - b.earliest)
      .map(({ earliest: _, ...row }) => row)
  })()

  // Countries whose bans carry no start year can't be placed on the time axis,
  // so they're absent from the timeline above. Surface them as a footnote so the
  // chart's country count doesn't silently disagree with the table below.
  const undatedTimelineLabels: string[] = (() => {
    const plotted = new Set(timelineRows.map((r) => r.key))
    const undated = new Map<string, string>()
    for (const ban of book.bans) {
      if (ban.year_started != null || plotted.has(ban.country_code)) continue
      undated.set(ban.country_code, ban.countries?.name_en ?? ban.country_code)
    }
    return [...undated.values()]
  })()

  // ── Pick primary country & reason for contextual link sections ───────────────
  const countryFreqInBook = new Map<string, { count: number; name: string }>()
  for (const b of book.bans) {
    const existing = countryFreqInBook.get(b.country_code)
    countryFreqInBook.set(b.country_code, {
      count: (existing?.count ?? 0) + 1,
      name: b.countries?.name_en ?? b.country_code,
    })
  }
  const primaryCountry = [...countryFreqInBook.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([code, v]) => ({ code, name: v.name }))[0] ?? null

  const reasonFreqInBook = new Map<number, { count: number; slug: string }>()
  for (const b of book.bans) {
    for (const link of b.ban_reason_links) {
      const r = link.reasons
      if (!r) continue
      const existing = reasonFreqInBook.get(r.id)
      reasonFreqInBook.set(r.id, { count: (existing?.count ?? 0) + 1, slug: r.slug })
    }
  }
  const primaryReason = [...reasonFreqInBook.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([id, v]) => ({ id, slug: v.slug }))[0] ?? null

  const bookReasonIds = [...reasonFreqInBook.keys()]
  // Build a set of news-search title variants. For non-English books the
  // English meaning often matches news headlines better than the canonical
  // (transliterated) title. We OR ilike across all eligible variants ≥ 4
  // chars; PostgREST single-quotes are doubled so they don't break the or()
  // grammar.
  const escape = (s: string) => s.replace(/'/g, "''")
  const newsTitleVariants = [
    book.title,
    book.title_english_meaningful,
    book.title_native,
    book.title_transliterated,
  ]
    .filter((t): t is string => !!t && t.trim().length >= 4)
    .map(t => escape(t.trim()))
  const newsOrClause = [
    ...newsTitleVariants.map(t => `title.ilike.%${t}%`),
    ...newsTitleVariants.map(t => `summary.ilike.%${t}%`),
  ].join(',')

  // ── Run all relation lookups in parallel ─────────────────────────────────────
  const [similarMatchesRes, newsRes, countryBansRes, reasonLinksRes] = await Promise.all([
    bookReasonIds.length >= 1
      ? supabase
          .from('ban_reason_links')
          .select('reason_id, bans!inner(book_id)')
          .in('reason_id', bookReasonIds)
      : Promise.resolve({ data: null }),
    newsTitleVariants.length > 0
      ? supabase
          .from('news_items')
          .select('id, title, source_url, source_name, published_at, summary')
          .eq('status', 'published')
          .or(newsOrClause)
          .order('published_at', { ascending: false })
          .limit(3)
      : Promise.resolve({ data: null }),
    primaryCountry
      ? supabase
          .from('bans')
          .select('book_id, year_started, ban_reason_links(reasons(slug))')
          .eq('country_code', primaryCountry.code)
          .neq('book_id', book.id)
          .limit(50)
      : Promise.resolve({ data: null }),
    primaryReason
      ? supabase
          .from('ban_reason_links')
          .select('bans!inner(book_id, year_started, country_code, countries(name_en))')
          .eq('reason_id', primaryReason.id)
          .limit(100)
      : Promise.resolve({ data: null }),
  ])

  // ── Process similar books (≥2 reason overlap) ────────────────────────────────
  let similarTopIds: number[] = []
  if (similarMatchesRes.data) {
    const bookReasonCounts = new Map<number, Set<number>>()
    for (const m of similarMatchesRes.data as unknown as { reason_id: number; bans: { book_id: number } }[]) {
      const bookId = m.bans.book_id
      if (bookId === book.id) continue
      if (!bookReasonCounts.has(bookId)) bookReasonCounts.set(bookId, new Set())
      bookReasonCounts.get(bookId)!.add(m.reason_id)
    }
    similarTopIds = [...bookReasonCounts.entries()]
      .filter(([, reasons]) => reasons.size >= 2)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 4)
      .map(([id]) => id)
  }

  // ── Process country related books ────────────────────────────────────────────
  const countryBookInfo = new Map<number, { year: number | null; reasons: string[] }>()
  for (const r of (countryBansRes.data ?? []) as unknown as {
    book_id: number; year_started: number | null
    ban_reason_links: { reasons: { slug: string } | null }[]
  }[]) {
    const reasons = r.ban_reason_links.map(l => l.reasons?.slug).filter((s): s is string => !!s)
    const existing = countryBookInfo.get(r.book_id)
    if (!existing) {
      countryBookInfo.set(r.book_id, { year: r.year_started, reasons: [...new Set(reasons)] })
    } else {
      const merged = [...new Set([...existing.reasons, ...reasons])]
      const earliest = (r.year_started != null && (existing.year == null || r.year_started < existing.year))
        ? r.year_started : existing.year
      countryBookInfo.set(r.book_id, { year: earliest, reasons: merged })
    }
  }
  const countryRelatedIds = [...countryBookInfo.keys()].slice(0, 5)

  // ── Process reason related books ─────────────────────────────────────────────
  const reasonBookInfo = new Map<number, { year: number | null; countryCode: string; countryName: string }>()
  for (const r of (reasonLinksRes.data ?? []) as unknown as {
    bans: { book_id: number; year_started: number | null; country_code: string; countries: { name_en: string } | null } | null
  }[]) {
    const ban = r.bans
    if (!ban) continue
    const bookId = ban.book_id
    if (bookId === book.id) continue
    const existing = reasonBookInfo.get(bookId)
    if (!existing || (ban.year_started != null && (existing.year == null || ban.year_started < existing.year))) {
      reasonBookInfo.set(bookId, {
        year: ban.year_started,
        countryCode: ban.country_code,
        countryName: ban.countries?.name_en ?? ban.country_code,
      })
    }
  }
  const reasonRelatedIds = [...reasonBookInfo.keys()].slice(0, 5)

  // ── Single consolidated fetch for all related book details ───────────────────
  const allRelatedIds = [...new Set([...similarTopIds, ...countryRelatedIds, ...reasonRelatedIds])]
  type RelatedBookDetail = { id: number; slug: string; title: string; cover_url: string | null; authorName: string }
  const bookDetailMap = new Map<number, RelatedBookDetail>()
  if (allRelatedIds.length > 0) {
    const { data: details } = await supabase
      .from('books')
      .select('id, slug, title, cover_url, book_authors(authors(display_name))')
      .eq('is_gated', false)
      .in('id', allRelatedIds)
    for (const d of (details ?? []) as unknown as {
      id: number; slug: string; title: string; cover_url: string | null
      book_authors: { authors: { display_name: string } | null }[]
    }[]) {
      bookDetailMap.set(d.id, {
        id: d.id, slug: d.slug, title: d.title, cover_url: d.cover_url,
        authorName: d.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', '),
      })
    }
  }

  const similarBooks = similarTopIds
    .map(id => bookDetailMap.get(id))
    .filter((b): b is RelatedBookDetail => !!b)

  const booksInCountry = countryRelatedIds
    .map(id => {
      const detail = bookDetailMap.get(id)
      if (!detail) return null
      const meta = countryBookInfo.get(id)!
      return { ...detail, year: meta.year, reasons: meta.reasons }
    })
    .filter((b): b is RelatedBookDetail & { year: number | null; reasons: string[] } => !!b)

  const booksForReason = reasonRelatedIds
    .map(id => {
      const detail = bookDetailMap.get(id)
      if (!detail) return null
      const meta = reasonBookInfo.get(id)!
      return { ...detail, year: meta.year, countryCode: meta.countryCode, countryName: meta.countryName }
    })
    .filter((b): b is RelatedBookDetail & { year: number | null; countryCode: string; countryName: string } => !!b)

  const recentNews = (newsRes.data ?? []) as {
    id: number; title: string; source_name: string; source_url: string
    published_at: string | null; summary: string
  }[]

  // ── Deduplicated metadata for Related section ────────────────────────────────
  const uniqueCountries = [...new Map(
    book.bans
      .filter(b => b.countries)
      .map(b => [b.country_code, { code: b.country_code, name: b.countries!.name_en }])
  ).values()]

  const uniqueReasonSlugs = [...new Set(
    book.bans.flatMap(b => b.ban_reason_links.map(l => l.reasons?.slug).filter(Boolean) as string[])
  )]

  const primaryAuthor = book.book_authors[0]?.authors

  const bookshopHref = getBookshopUrl({ isbn13: book.isbn13, bookshopIsbn13: book.bookshop_isbn13, bookshopStatus: book.bookshop_status })
  const koboHref = getKoboUrl(primaryAuthor ? `${book.title} ${primaryAuthor.display_name}` : book.title, `book-${book.slug}`)

  // ── Schema.org JSON-LD ─────────────────────────────────────────────────────
  // Book + BreadcrumbList, emitted as <script type="application/ld+json">.
  // Sits alongside the existing Google-Scholar citation_* meta tags (built via
  // buildCitationMeta in generateMetadata above) — those target academic
  // indexers; this targets Google's Knowledge Panel and rich-result eligibility.
  //
  // Only fields with real values are emitted; null/empty fields are dropped so
  // we never expose placeholder strings to crawlers. The canonical URL is the
  // same one used in generateMetadata's alternates.canonical.
  const canonicalUrl = `https://www.banned-books.org/books/${book.slug}`
  const authorList = book.book_authors
    .map(ba => ba.authors)
    .filter((a): a is { display_name: string; slug: string | null; awards: unknown } => !!a)
  const alternateNames = [book.title_native, book.title_english_meaningful, book.title_transliterated]
    .filter((t): t is string => !!t && t.trim() !== '' && t.trim().toLowerCase() !== book.title.trim().toLowerCase())
  const bookJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    '@id': `${canonicalUrl}#book`,
    name: book.title,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
  }
  if (alternateNames.length > 0) {
    bookJsonLd.alternateName = alternateNames.length === 1 ? alternateNames[0] : alternateNames
  }
  if (authorList.length > 0) {
    bookJsonLd.author = authorList.map(a => {
      const personAwards = parseAwards(
        book.book_authors.find(ba => ba.authors?.display_name === a.display_name)?.authors?.awards,
      )
      return {
        '@type': 'Person',
        name: a.display_name,
        ...(a.slug ? { url: `https://www.banned-books.org/authors/${a.slug}` } : {}),
        ...(personAwards.length > 0 ? { award: personAwards.map(awardSchemaText) } : {}),
      }
    })
  }
  if (book.original_language) bookJsonLd.inLanguage = book.original_language
  if (book.first_published_year) bookJsonLd.datePublished = String(book.first_published_year)
  if (book.description_book) bookJsonLd.description = book.description_book
  if (book.cover_url && !gated) bookJsonLd.image = book.cover_url
  if (book.isbn13) bookJsonLd.isbn = book.isbn13
  if (book.genres && book.genres.length > 0) bookJsonLd.genre = book.genres
  // Pulitzer is book-level → schema.org `award` on the Book; Nobel is
  // author-level → `award` on the author Person above.
  if (bookAwards.length > 0) {
    const aw = bookAwards.map(awardSchemaText)
    bookJsonLd.award = aw.length === 1 ? aw[0] : aw
  }
  // dateModified bumps on every UPDATE via the public.set_updated_at trigger
  // installed in migration 20260515143605. Crawlers (especially Bing &
  // AI-Overview reranking) use this as a freshness signal — without it our
  // enrichment passes were invisible to indexers.
  if (book.updated_at) bookJsonLd.dateModified = book.updated_at
  // Data-quality signal for AI-citation surfaces. additionalProperty is the
  // schema.org escape hatch for fields that don't map to a built-in property;
  // we expose the classification level + an explainer URL so crawlers can
  // pick up the provenance signal without it taking up visual real estate.
  bookJsonLd.additionalProperty = {
    '@type': 'PropertyValue',
    propertyID: 'dataQualityStatus',
    name: 'Data quality',
    value: book.data_quality_status,
    url: 'https://www.banned-books.org/data-quality',
  }

  // Direct-answer + FAQPage. The lead paragraph renders right after the
  // hero (visible to users); the FAQ JSON-LD targets Google's Featured
  // Snippet / People-Also-Ask / AI Overview surfaces.
  const banSummary = buildBanSummary(book.title, author, sortedBans)
  const faqJsonLd = banSummary && banSummary.faqItems.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: banSummary.faqItems.map(it => ({
          '@type': 'Question',
          name: it.q,
          acceptedAnswer: { '@type': 'Answer', text: it.a },
        })),
      }
    : null

  // Breadcrumb mirrors the visible <Breadcrumb> rendered above the hero.
  // The "Books" intermediate points at /search — the real catalogue-browse
  // page (filters by country, reason, scope). No /books index route exists.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',  item: 'https://www.banned-books.org/' },
      { '@type': 'ListItem', position: 2, name: 'Books', item: 'https://www.banned-books.org/search' },
      { '@type': 'ListItem', position: 3, name: book.title, item: canonicalUrl },
    ],
  }

  // WebPage JSON-LD — names Banned Books as the page author/publisher so
  // citation tools (MyBib, ZoteroBib, Cite This For Me) can attribute the
  // catalogue page itself to us, instead of falling back to "Anon." The
  // Book LD above already carries the work's real author (Nabokov, etc.);
  // this LD is about the *page*, not the book. datePublished/dateModified
  // come from the books row so generators stop guessing the crawl year.
  const webPageJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url: canonicalUrl,
    name: `${book.title} — Banned Books`,
    author: { '@type': 'Organization', name: 'Banned Books', url: 'https://www.banned-books.org' },
    publisher: { '@type': 'Organization', name: 'Banned Books', url: 'https://www.banned-books.org' },
    about: { '@id': `${canonicalUrl}#book` },
  }
  if (book.created_at) webPageJsonLd.datePublished = book.created_at
  if (book.updated_at) webPageJsonLd.dateModified = book.updated_at

  // Escape `<` to prevent a malicious title from closing the script tag early.
  // JSON.stringify already escapes `&`, `'`, `"` inside string values.
  const ldHtml = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {gated && <GateOverlay country={book.gating_country} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldHtml(bookJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldHtml(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldHtml(breadcrumbJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldHtml(faqJsonLd) }}
        />
      )}
      <PageviewTracker entityType="book" entityId={book.id} />
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Books', href: '/search' },
          { label: book.title },
        ]}
      />


      {/* Hero */}
      <div className="flex flex-row gap-4 sm:gap-8 mb-8 sm:mb-10 items-start">
        <div className="shrink-0 w-[110px] sm:w-[200px]">
          {book.cover_url && !gated ? (
            <Image
              src={book.cover_url}
              alt={coverAlt(book.title, author, book.first_published_year)}
              width={240}
              height={360}
              className="rounded-lg shadow-md object-cover w-full h-auto"
              priority
              sizes="(max-width: 640px) 110px, 200px"
            />
          ) : (
            <BookCoverPlaceholder
              title={book.title}
              author={authorName(book)}
              slug={book.slug}
            />
          )}
        </div>
        <div className="flex flex-col justify-center gap-2 min-w-0">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-oxblood">
            Book {book.first_published_year ? `· ${book.first_published_year}` : ''}
          </p>
          <h1
            className="font-serif text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1] text-gray-900"
            lang={book.original_language && book.original_language !== 'en' ? book.original_language : undefined}
          >
            {book.title}
            <QualityCheck status={book.data_quality_status} />
          </h1>
          {banSummary && (
            <p className="text-base sm:text-lg font-medium text-oxblood/90 leading-snug">
              {banSummary.topic}
            </p>
          )}
          {/* Secondary title: English meaning (for transliterated/non-English titles)
              OR native-script form (for English canonical titles whose original is non-Latin).
              Suppressed when the alt-title equals the canonical title to avoid
              duplicating the H1 (cf. legacy backfill that set title_native = title for
              en/fr books — see migration 20260512092437). */}
          {(() => {
            const norm = (s: string) => s.trim().toLowerCase()
            const canonical = norm(book.title)
            const english =
              book.title_english_meaningful &&
              norm(book.title_english_meaningful) !== canonical
                ? book.title_english_meaningful
                : null
            const native =
              !english &&
              book.title_native &&
              norm(book.title_native) !== canonical
                ? book.title_native
                : null
            const subtitle = english ?? native
            if (!subtitle) return null
            return (
              <h2
                className="text-lg font-medium text-gray-700 leading-snug"
                lang={english ? 'en' : book.original_language ?? undefined}
              >
                {subtitle}
              </h2>
            )
          })()}
          {/* Transliteration annotation — small italic line under H1/H2, only
              shown when distinct from both. Pronunciation aid for non-Latin
              titles where the canonical is in Latin script + an English
              meaning is also present (i.e. all three differ). */}
          {book.title_transliterated &&
            book.title_transliterated.trim().toLowerCase() !== book.title.trim().toLowerCase() &&
            (!book.title_english_meaningful ||
              book.title_transliterated.trim().toLowerCase() !==
                book.title_english_meaningful.trim().toLowerCase()) && (
              <p className="text-sm italic text-gray-500">
                {book.title_transliterated}
              </p>
            )}
          <p className="text-gray-600">
            {book.book_authors.map((ba, i) => {
              if (!ba.authors) return null
              const { display_name, slug: authorSlug } = ba.authors
              return (
                <span key={i}>
                  {i > 0 && ', '}
                  {authorSlug ? (
                    <Link href={`/authors/${authorSlug}`} className="hover:underline">
                      {display_name}
                    </Link>
                  ) : (
                    display_name
                  )}
                </span>
              )
            })}
            {book.first_published_year && (
              <span className="text-gray-400"> · {book.first_published_year}</span>
            )}
          </p>
          {(bookAwards.length > 0 || authorAwards.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {bookAwards.map((a, i) => (
                <AwardBadge key={`b${i}`} award={a} />
              ))}
              {authorAwards.map((a, i) => (
                <AwardBadge key={`a${i}`} award={a} />
              ))}
            </div>
          )}
          {bookAwards
            .filter((a) => a.motivation)
            .map((a, i) => (
              <p key={i} className="text-sm italic text-gray-600 leading-snug max-w-2xl">
                &ldquo;{a.motivation}&rdquo;{' '}
                <span className="not-italic text-gray-400">— {awardName(a)}, {a.year}</span>
              </p>
            ))}
          {book.isbn13 && (
            <p className="text-xs text-gray-400">ISBN {book.isbn13}</p>
          )}
          {book.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {book.genres.map((slug) => (
                <GenreBadge key={slug} slug={slug} />
              ))}
            </div>
          )}
          <p className="text-sm font-medium text-red-500">
            {book.bans.length} ban{book.bans.length === 1 ? '' : 's'}
            {' across '}
            {distinctCountries}{' '}
            {distinctCountries === 1 ? 'country' : 'countries'}
          </p>
          {readingClubLink && (
            <Link
              href={readingClubLink.href}
              className="group mt-0.5 inline-flex items-center gap-2 self-start rounded-full border border-oxblood/40 bg-oxblood/5 pl-3 pr-3.5 py-1 text-xs font-medium text-oxblood hover:bg-oxblood hover:text-white transition-colors"
              aria-label={`Open the Reading Club guide for ${book.title}`}
            >
              <span aria-hidden="true">★</span>
              <span>
                <span className="font-semibold">Reading Club</span>
                <span className="text-oxblood/70 group-hover:text-white/80"> · {readingClubLink.trackLabel}</span>
              </span>
              <span aria-hidden="true" className="opacity-70 group-hover:opacity-100">→</span>
            </Link>
          )}
          <ShareButtons
            url={`https://www.banned-books.org/books/${book.slug}`}
            title={book.title}
            banCount={book.bans.length}
            countryCount={distinctCountries}
          />
        </div>
      </div>

      <QualityFlaggedNotice
        status={book.data_quality_status}
        entityLabel="book"
      />

      {/* Complement paragraph — facts the H1-zone subtitle (`topic`) leaves
          out: year of first documented ban, multi-country roll-up, and
          mixed active/historical status. Skipped entirely when there's
          nothing to add beyond what `topic` already states, to avoid the
          duplication that suppresses CTR. */}
      {banSummary && banSummary.complement && (
        <p className="mb-8 text-base text-gray-800 leading-relaxed border-l-4 border-red-300 pl-4">
          {banSummary.complement}
        </p>
      )}

      {/* About the book */}
      {(book.description_book ?? book.description) && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">About this book</h2>
          <p className="text-gray-700 leading-relaxed">
            {book.description_book ?? book.description}
          </p>
          {/* Source attribution — only when v2 enrichment recorded a source.
              Legacy `description`-fallback rows have description_source_url = NULL
              and render no attribution. */}
          {book.description_book && book.description_source_url && book.description_source_type && (
            <DescriptionSourceAttribution
              url={book.description_source_url}
              type={book.description_source_type}
            />
          )}
          {/* Consensus tier has no single source URL — label it plainly as AI-generated. */}
          {book.description_book && !book.description_source_url && book.description_source_type === 'ai_consensus' && (
            <p className="mt-2 text-xs text-gray-500">
              AI-generated summary — independently cross-checked by two models; not from a single cited source.
            </p>
          )}
        </section>
      )}

      {/* Why it was banned */}
      {book.description_ban && (
        <section className="mb-8 rounded-xl bg-red-50 border border-red-100 px-5 py-4">
          <h2 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Why it was banned</h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{book.description_ban}</p>
        </section>
      )}

      {/* Censorship history (AI-generated context) */}
      {book.censorship_context && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Censorship history</h2>
          <p className="text-gray-700 leading-relaxed">{book.censorship_context}</p>
        </section>
      )}

      {/* Bans table */}
      {sortedBans.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">
            {distinctCountries === 1
              ? `Ban history in ${sortedBans[0].countries?.name_en ?? sortedBans[0].country_code}`
              : `Where ${book.title} has been banned`}
          </h2>
          <BanTimeline
            rows={timelineRows}
            firstPublishedYear={book.first_published_year}
            firstPublishedLabel="Published"
            caption={`${book.title}: ${book.bans.length} bans across ${timelineRows.length} ${timelineRows.length === 1 ? 'country' : 'countries'}.`}
            undatedLabels={undatedTimelineLabels}
          />
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap">Country</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap">Year</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap hidden sm:table-cell">Where</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap">Reasons</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap hidden sm:table-cell">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {banClusters.map((c) => {
                    const districtCount = [...c.by_state.values()].reduce((n, list) => n + list.length, 0)
                    const stateCount = c.by_state.size
                    const hasLocations = c.nation_count > 0 || stateCount > 0
                    const sortedStates = [...c.by_state.entries()].sort((a, b) => a[0].localeCompare(b[0]))
                    return (
                      <React.Fragment key={c.key}>
                        <tr className="align-top">
                          <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap text-xs sm:text-sm">
                            <Link
                              href={`/countries/${c.country_code.toLowerCase()}`}
                              className="hover:underline"
                            >
                              {c.country_name}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs sm:text-sm">
                            {c.year_started ?? '—'}
                            {c.status === 'historical' && (
                              <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                                lifted
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 hidden sm:table-cell">
                            <div className="flex flex-wrap items-center gap-1">
                              {ACTION_ORDER.filter((a) => c.action_counts.has(a)).map((a) => (
                                <BanActionBadge
                                  key={a}
                                  action={a}
                                  count={c.bans.length > 1 ? c.action_counts.get(a) : undefined}
                                />
                              ))}
                              {c.scope_label && <span className="text-xs text-gray-500">{c.scope_label}</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {[...c.reason_slugs].map((slug) => (
                                <ReasonBadge key={slug} slug={slug} />
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 hidden sm:table-cell">
                            {c.sources.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                {c.sources.map((s) => (
                                  <a
                                    key={s.source_url}
                                    href={s.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline text-xs"
                                  >
                                    {s.source_name}
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                        {hasLocations && (
                          <tr className="bg-gray-50/60">
                            <td colSpan={5} className="px-3 pb-2.5 pt-0 text-xs text-gray-600 leading-relaxed">
                              {c.nation_count > 0 && (() => {
                                const labels = [...new Set(c.nation_institutions.map(nationInstitutionLabel))]
                                const heading = labels.length > 0 ? labels.join(', ') : 'Nationwide / statewide'
                                return (
                                  <div>
                                    <span className="font-medium text-gray-700">{heading}</span>
                                    {c.nation_count > 1 && (
                                      <span className="ml-1 text-gray-500">({c.nation_count} actions)</span>
                                    )}
                                  </div>
                                )
                              })()}
                              {sortedStates.map(([state, districts]) => (
                                <div key={state}>
                                  <span className="font-medium text-gray-700">{state}</span>
                                  {districts.length > 0 && (
                                    <span> — {districts.join(', ')}</span>
                                  )}
                                </div>
                              ))}
                              {!c.nation_count && stateCount > 0 && districtCount > 0 && (
                                <div className="mt-1 text-[11px] text-gray-500">
                                  {districtCount} district{districtCount === 1 ? '' : 's'} across {stateCount} state{stateCount === 1 ? '' : 's'}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                        {c.description && (
                          <tr className="bg-amber-50/50">
                            <td colSpan={5} className="px-3 pb-2.5 pt-0 text-xs text-gray-600 italic leading-relaxed">
                              {c.description}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend — the canonical meaning of each action type, shown right
              where the actions appear (and consistent with /about + /challenged-books). */}
          <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <BanActionBadge action="banned" /> <span>legal prohibition</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BanActionBadge action="restricted" /> <span>institutional removal (school, library, prison)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BanActionBadge action="challenged" /> <span>formal complaint that led to removal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">lifted</span>
              <span>ban since rescinded</span>
            </div>
            <Link href="/challenged-books" className="text-blue-600 hover:underline">More on these terms →</Link>
          </dl>
        </section>
      )}

      {/* Editorial note — context/extended tier only; placed after bans so the
          factual record comes first and editorial framing follows.
          inclusion_rationale is INTERNAL (admin only) and is intentionally not
          rendered here. extended_context is the public essay slot. */}
      {book.warning_level && book.warning_level !== 'none' && (
        <section className="mb-10 border-t border-gray-200 pt-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Editorial note
          </h2>
          {book.warning_level === 'extended' && book.extended_context && (
            <div className="prose prose-sm max-w-none text-gray-600 mb-2 whitespace-pre-line">
              {book.extended_context}
            </div>
          )}
          {bannedInFrance && (
            <p className="text-xs text-gray-500 leading-relaxed mb-2">
              Banned in France. On the statute behind it, see{' '}
              <Link href="/laws/loi-gayssot" className="underline hover:no-underline">
                The Loi Gayssot — France’s Holocaust-denial law
              </Link>
              .
            </p>
          )}
          <p className="text-xs text-gray-500 leading-relaxed">
            On why we include works like this — see{' '}
            <Link href="/essays/what-we-document" className="underline hover:no-underline">
              What we document — and why that is a choice
            </Link>{' '}
            and{' '}
            <Link href="/essays/forbidden-knowledge-iceberg" className="underline hover:no-underline">
              Why &ldquo;forbidden knowledge&rdquo; iceberg lists collapse important distinctions
            </Link>
            .
          </p>
        </section>
      )}

      {/* Find this book — affiliate CTAs are suppressed for editorially-flagged
          tiers (context / extended). We don't want to earn affiliate revenue
          from works like Mein Kampf or The Turner Diaries even though we
          archive them. Free sources (Gutenberg / Internet Archive) still show.
          If neither free source is available AND affiliates are suppressed,
          the whole section is omitted so we don't render an empty amber card. */}
      {(() => {
        // Bucket B: no commercial path and no free-reading path, ever. The whole
        // section is omitted — affiliate, Gutenberg, and Internet Archive alike.
        if (gated) return null
        const affiliatesSuppressed = book.warning_level === 'context' || book.warning_level === 'extended'
        const hasGutenberg = !!book.gutenberg_id
        const hasArchive = book.archive_org_status === 'valid' && !!book.archive_org_id
        if (affiliatesSuppressed && !hasGutenberg && !hasArchive) return null
        return (
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-amber-600">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          Find this book
        </h2>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 flex flex-col gap-3">
          {book.gutenberg_id && (
            <a
              href={`https://www.gutenberg.org/ebooks/${book.gutenberg_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-100 border border-emerald-300 hover:bg-emerald-200 text-sm font-semibold text-emerald-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              Read free on Project Gutenberg
            </a>
          )}
          {book.archive_org_status === 'valid' && book.archive_org_id && (
            <a
              href={`https://archive.org/details/${book.archive_org_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-100 border border-emerald-300 hover:bg-emerald-200 text-sm font-semibold text-emerald-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              Read free on the Internet Archive
            </a>
          )}
          {!affiliatesSuppressed && (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
                <TrackedOutboundLink
                  eventName="Bookshop Click"
                  eventProperties={{ source: 'book', bookSlug: slug, isbn13: book.isbn13 ?? null, linkType: getBookshopLinkType(bookshopHref) }}
                  href={bookshopHref}
                  target="_blank"
                  rel={BOOKSHOP_REL}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-sm font-semibold text-white transition-colors shadow-sm"
                >
                  Find on Bookshop.org
                </TrackedOutboundLink>
                <TrackedOutboundLink
                  eventName="Kobo Click"
                  eventProperties={{ source: 'book', bookSlug: slug, isbn13: book.isbn13 ?? null }}
                  href={koboHref}
                  target="_blank"
                  rel={KOBO_REL}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-amber-300 hover:border-amber-500 text-sm font-medium text-gray-700 transition-colors"
                >
                  Find on Kobo
                </TrackedOutboundLink>
              </div>
              <p className="text-xs text-amber-800/70 text-center leading-relaxed">
                Bookshop.org and Kobo links are affiliate links — they support independent bookstores and this project at no extra cost to you.{' '}
                <Link href="/why-not-amazon" className="underline hover:no-underline">
                  Why we don&apos;t link to Amazon
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
        )
      })()}

      <CitationBlock
        entityType="book"
        entity={{
          title: book.title,
          authors: book.book_authors.map(ba => ba.authors?.display_name).filter((s): s is string => !!s),
          slug: book.slug,
        }}
        url={`https://www.banned-books.org/books/${book.slug}`}
      />

      {/* Last verified — feeds Book.dateModified in JSON-LD (above) and gives
          users + Google an explicit freshness signal that this catalogue
          entry is actively maintained. Uses the updated_at column added in
          migration 20260515143605, which bumps on every UPDATE via trigger. */}
      <div className="mt-6 mb-10">
        {book.updated_at && (
          <p className="text-xs text-gray-400">
            Last verified:{' '}
            <time dateTime={book.updated_at}>
              {new Date(book.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </time>
          </p>
        )}
        <QualityFooterLine
          status={book.data_quality_status}
          evaluatedAt={book.data_quality_evaluated_at}
        />
      </div>

      {/* Related */}
      {(primaryAuthor?.slug || uniqueCountries.length > 0 || uniqueReasonSlugs.length > 0 || similarBooks.length > 0 || booksInCountry.length > 0 || booksForReason.length > 0) && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">Related</h2>
          <div className="flex flex-col gap-5">

            {/* Author + countries + reasons chips */}
            <div className="flex flex-wrap gap-2">
              {primaryAuthor?.slug && (
                <Link
                  href={`/authors/${primaryAuthor.slug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  ✍️ More books by {primaryAuthor.display_name}
                </Link>
              )}
              {uniqueCountries.map(c => (
                <Link
                  key={c.code}
                  href={`/countries/${c.code.toLowerCase()}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  🌍 Books banned in {c.name}
                </Link>
              ))}
              {uniqueReasonSlugs.map(rSlug => (
                <Link
                  key={rSlug}
                  href={`/reasons/${rSlug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  More {reasonLabel(rSlug)} bans
                </Link>
              ))}
            </div>

            {/* Similar books */}
            {similarBooks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Books banned for similar reasons
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {similarBooks.map(sim => (
                    <Link
                      key={sim.slug}
                      href={`/books/${sim.slug}`}
                      className="group flex flex-col gap-2"
                    >
                      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-100">
                        {sim.cover_url ? (
                          <Image
                            src={sim.cover_url}
                            alt={coverAlt(sim.title, sim.authorName)}
                            width={160}
                            height={240}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <BookCoverPlaceholder title={sim.title} slug={sim.slug} className="h-full" />
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-800 leading-snug line-clamp-2 group-hover:underline">
                        {sim.title}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Two-up: more books banned in [Country] / for [Reason] */}
            {((primaryCountry && booksInCountry.length > 0) || (primaryReason && booksForReason.length > 0)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
                {primaryCountry && booksInCountry.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-3 leading-snug">
                      More books banned in{' '}
                      <Link
                        href={`/countries/${primaryCountry.code.toLowerCase()}`}
                        className="text-red-600 hover:underline"
                      >
                        {primaryCountry.name}
                      </Link>
                    </h3>
                    <div className="flex flex-col gap-3">
                      {booksInCountry.map(b => (
                        <Link
                          key={b.id}
                          href={`/books/${b.slug}`}
                          className="group flex gap-3 items-start"
                        >
                          <div className="shrink-0 w-12 h-[72px] relative overflow-hidden rounded shadow-sm">
                            {b.cover_url ? (
                              <Image
                                src={b.cover_url}
                                alt={coverAlt(b.title, b.authorName)}
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            ) : (
                              <BookCoverPlaceholder title={b.title} author={b.authorName} slug={b.slug} className="absolute inset-0 w-full h-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 leading-snug group-hover:underline line-clamp-2">
                              {b.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                              {b.authorName}
                              {b.year != null && (
                                <span className="text-gray-400"> · banned {b.year}</span>
                              )}
                            </p>
                            {b.reasons.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {b.reasons.slice(0, 3).map(r => <ReasonBadge key={r} slug={r} />)}
                              </div>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {primaryReason && booksForReason.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-3 leading-snug">
                      More books banned for{' '}
                      <Link
                        href={`/reasons/${primaryReason.slug}`}
                        className="text-red-600 hover:underline"
                      >
                        {reasonLabel(primaryReason.slug)}
                      </Link>{' '}
                      content
                    </h3>
                    <div className="flex flex-col gap-3">
                      {booksForReason.map(b => (
                        <Link
                          key={b.id}
                          href={`/books/${b.slug}`}
                          className="group flex gap-3 items-start"
                        >
                          <div className="shrink-0 w-12 h-[72px] relative overflow-hidden rounded shadow-sm">
                            {b.cover_url ? (
                              <Image
                                src={b.cover_url}
                                alt={coverAlt(b.title, b.authorName)}
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            ) : (
                              <BookCoverPlaceholder title={b.title} author={b.authorName} slug={b.slug} className="absolute inset-0 w-full h-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 leading-snug group-hover:underline line-clamp-2">
                              {b.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                              {b.authorName}
                              {b.year != null && (
                                <span className="text-gray-400"> · banned {b.year}</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Banned in {b.countryName}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Recent news */}
      {recentNews.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Recent news</h2>
            <Link href="/news" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
              All news →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {recentNews.map((item) => (
              <a
                key={item.id}
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-400 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900 group-hover:underline leading-snug mb-1">
                  {item.title}
                </p>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-1.5">
                  {item.summary}
                </p>
                <p className="text-xs text-gray-400">
                  {item.source_name}
                  {item.published_at && (
                    <> · {new Date(item.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                  )}
                </p>
              </a>
            ))}
          </div>
        </section>
      )}

    </main>
  )
}
