// ISR: regenerate author detail pages daily. Pageview-tracking moved
// client-side (see <PageviewTracker> below) so the page itself can cache.
// Daily (not hourly) keeps ISR Writes — the largest Vercel infra line — low;
// author data changes slowly, and POST /api/admin/revalidate busts a single
// page on demand when needed. Same cadence as book detail pages.
export const revalidate = 86400

import type { Metadata } from 'next'
import Image from 'next/image'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import PageviewTracker from '@/components/pageview-tracker'
import DescriptionSourceAttribution from '@/components/description-source-attribution'
import Breadcrumb from '@/components/breadcrumb'
import ReasonBadge from '@/components/reason-badge'
import GenreBadge from '@/components/genre-badge'
import { getBookshopAuthorUrl, BOOKSHOP_REL } from '@/lib/bookshop'
import { getKoboUrl, KOBO_REL } from '@/lib/kobo'
import TrackedOutboundLink from '@/components/tracked-outbound-link'
import BanTimeline, { type TimelineRow } from '@/components/ban-timeline'
import { countryFlag as countryFlagShared } from '@/lib/country-flag'
import CitationBlock from '@/components/citation-block'
import { buildCitationMeta } from '@/lib/citation-meta'
import { coverAlt } from '@/lib/cover-alt'
import { reasonPhrase, BOOK_REASON_PHRASE } from '@/lib/reason-phrases'
import {
  QualityCheck,
  QualityFlaggedNotice,
  QualityFooterLine,
  type DataQualityStatus,
} from '@/components/data-quality'
import AwardBadge from '@/components/award-badge'
import { parseAwards, awardSchemaText, awardName } from '@/lib/awards'
import { videoForAuthor } from '@/lib/featured-videos'
import YouTubeEmbed from '@/components/youtube-embed'
import AuthorLinks from '@/components/author-links'
import { isOrganizationAuthor } from '@/lib/organization-authors'

type Author = {
  id: number
  display_name: string
  slug: string
  bio: string | null
  bio_source_type: string | null
  bio_source_url: string | null
  birth_year: number | null
  death_year: number | null
  birth_country: string | null
  photo_url: string | null
  name_native: string | null
  name_transliterated: string | null
  name_english: string | null
  original_language: string | null
  created_at: string | null
  updated_at: string | null
  is_placeholder: boolean | null
  data_quality_status: DataQualityStatus
  data_quality_evaluated_at: string | null
  awards: unknown
  wikidata_id: string | null
  website_url: string | null
  social_links: Record<string, string> | null
}

type Ban = {
  id: number
  status: string
  country_code: string
  year_started: number | null
  year_ended: number | null
  action_type: string
  countries: { name_en: string } | null
  ban_reason_links: { reasons: { slug: string } | null }[]
}

type Book = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  first_published_year: number | null
  genres: string[]
  is_blanket_works: boolean
  bans: Ban[]
}

const countryFlag = countryFlagShared

function getReasons(bans: Ban[]): string[] {
  return [...new Set(bans.flatMap(b =>
    b.ban_reason_links.map(l => l.reasons?.slug).filter((s): s is string => !!s)
  ))]
}

// Prebuild the 100 most-banned authors at build time; the long tail is
// generated + ISR-cached on first visit (dynamicParams defaults to true).
// Without any generateStaticParams the route renders fully dynamically
// (no-store, MISS on every request) and revalidate=3600 never engages.
export async function generateStaticParams() {
  const sb = adminClient()
  const { data: top } = await sb
    .from('v_top_banned_authors')
    .select('entity_id')
    .order('total_bans', { ascending: false })
    .limit(100)
  const ids = ((top ?? []) as { entity_id: number }[]).map((r) => r.entity_id)
  if (ids.length === 0) return []
  const { data } = await sb.from('authors').select('slug').in('id', ids)
  return ((data ?? []) as { slug: string }[]).map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const supabase = adminClient()
  const { data: author } = await supabase.from('authors').select('id, display_name').eq('slug', slug).single()
  if (!author) return {}

  const { data: bookLinks } = await supabase
    .from('book_authors')
    .select('book_id')
    .eq('author_id', (author as unknown as { id: number }).id)

  const bookIds = (bookLinks ?? []).map((bl: { book_id: number }) => bl.book_id)
  let bannedBookCount = 0
  let countryCount = 0
  let earliestYear: number | null = null
  let topReasonSlug: string | null = null
  if (bookIds.length > 0) {
    const { data: bans } = await supabase
      .from('bans')
      .select('book_id, country_code, year_started, ban_reason_links(reasons(slug))')
      .in('book_id', bookIds)
    const banRows = (bans ?? []) as unknown as {
      book_id: number
      country_code: string
      year_started: number | null
      ban_reason_links: { reasons: { slug: string } | null }[]
    }[]
    bannedBookCount = new Set(banRows.map(b => b.book_id)).size
    countryCount = new Set(banRows.map(b => b.country_code)).size
    const years = banRows.map(b => b.year_started).filter((y): y is number => y != null)
    if (years.length > 0) earliestYear = Math.min(...years)
    const reasonCounts = new Map<string, number>()
    for (const b of banRows) {
      for (const link of b.ban_reason_links) {
        const s = link.reasons?.slug
        if (s) reasonCounts.set(s, (reasonCounts.get(s) ?? 0) + 1)
      }
    }
    topReasonSlug = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }
  const topReasonPhrase = topReasonSlug ? BOOK_REASON_PHRASE[topReasonSlug] : null

  // Title — pick the most specific candidate that fits the 70-char visible
  // cap (Google desktop truncates around 70; mobile around 55). Suffix
  // " | Banned Books" (~16 chars) is appended by the root layout, so leave
  // ~54 chars of headroom here.
  const candidateA = `Banned books by ${author.display_name} — censorship history`
  const candidateB = `Banned books by ${author.display_name}`
  const candidateC = `${author.display_name} — banned books`
  const candidateD = author.display_name
  let title: string
  if (candidateA.length <= 54) title = candidateA
  else if (candidateB.length <= 54) title = candidateB
  else if (candidateC.length <= 54) title = candidateC
  else title = candidateD

  // Description — concrete stats over boilerplate. Carries the "for {reason}"
  // and "since {year}" tokens that informational queries like
  // "books by X banned" match against.
  let description: string
  if (bannedBookCount === 0) {
    description = `${author.display_name} on Banned Books — bio, bibliography, and the censorship history of this author's work.`
  } else if (earliestYear && topReasonPhrase) {
    description = `${bannedBookCount} ${bannedBookCount === 1 ? 'book' : 'books'} by ${author.display_name} ${bannedBookCount === 1 ? 'has' : 'have'} been banned in ${countryCount} ${countryCount === 1 ? 'country' : 'countries'} since ${earliestYear}, most often for ${topReasonPhrase}.`
  } else if (topReasonPhrase) {
    description = `${bannedBookCount} ${bannedBookCount === 1 ? 'book' : 'books'} by ${author.display_name} ${bannedBookCount === 1 ? 'has' : 'have'} been banned in ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}, most often for ${topReasonPhrase}.`
  } else if (earliestYear) {
    description = `${bannedBookCount} ${bannedBookCount === 1 ? 'book' : 'books'} by ${author.display_name} ${bannedBookCount === 1 ? 'has' : 'have'} been banned in ${countryCount} ${countryCount === 1 ? 'country' : 'countries'} since ${earliestYear}.`
  } else {
    description = `${bannedBookCount} ${bannedBookCount === 1 ? 'book' : 'books'} by ${author.display_name} ${bannedBookCount === 1 ? 'has' : 'have'} been banned in ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}.`
  }
  if (description.length > 160) description = description.slice(0, 157) + '…'

  const canonicalUrl = `https://www.banned-books.org/authors/${slug}`
  return {
    title,
    description,
    alternates: { canonical: `/authors/${slug}` },
    openGraph: { title, description },
    twitter: { card: 'summary' },
    other: buildCitationMeta({
      entityType: 'author',
      title: author.display_name,
      authors: [author.display_name],
      url: canonicalUrl,
    }),
  }
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = adminClient()

  const { data: author } = await supabase
    .from('authors')
    .select('id, display_name, slug, bio, bio_source_type, bio_source_url, birth_year, death_year, birth_country, photo_url, name_native, name_transliterated, name_english, original_language, created_at, updated_at, is_placeholder, data_quality_status, data_quality_evaluated_at, awards, wikidata_id, website_url, social_links')
    .eq('slug', slug)
    .single()

  if (!author) {
    // Alias fallback: maybe this slug points to an author via
    // author_slug_aliases (e.g. a slug merged away into a canonical author).
    // If so, 308 permanent-redirect to the canonical /authors/<canonical_slug>
    // so search engines and link-juice consolidate on the survivor's URL.
    const { data: alias } = await supabase
      .from('author_slug_aliases')
      .select('authors(slug)')
      .eq('slug', slug)
      .maybeSingle()
    type AliasRow = { authors: { slug: string } | null } | null
    const canonicalSlug = (alias as AliasRow)?.authors?.slug ?? null
    if (canonicalSlug && canonicalSlug !== slug) {
      permanentRedirect(`/authors/${canonicalSlug}`)
    }
    notFound()
  }
  const a = author as unknown as Author

  const { data: bookLinks } = await supabase
    .from('book_authors')
    .select('book_id')
    .eq('author_id', author.id)

  const bookIds = (bookLinks ?? []).map((bl: any) => bl.book_id).filter(Boolean)

  let books: Book[] = []
  if (bookIds.length > 0) {
    const { data } = await supabase
      .from('books')
      .select(`
        id, title, slug, cover_url, first_published_year, genres, is_blanket_works,
        bans(id, status, country_code, year_started, year_ended, action_type, countries(name_en), ban_reason_links(reasons(slug)))
      `)
      .in('id', bookIds)
      .order('title')
    books = (data as unknown as Book[]) ?? []
  }

  // Blanket-works pseudo-books ("Toutes ses œuvres", Liste Otto) stand in for
  // a ban on the author's ENTIRE oeuvre — they are not catalogued titles. Keep
  // their bans in the totals (the author genuinely was banned) but exclude them
  // from the book grid/count; they render as a dedicated "complete works" note.
  const realBooks = books.filter(b => !b.is_blanket_works)
  const blanketWorks = books.filter(b => b.is_blanket_works)

  const totalBans = books.reduce((sum, b) => sum + b.bans.length, 0)
  const countryCodes = [...new Set(books.flatMap(b => b.bans.map(bn => bn.country_code)))]
  const countryCount = countryCodes.length
  const activeBanCount = books.reduce((sum, b) => sum + b.bans.filter(bn => bn.status === 'active').length, 0)
  // When the author is only banned in one country, expose the code+name so
  // the H1-zone subtitle can render it as an inline Link to /countries/[code]
  // (the pattern proven on /books/[slug] to add above-the-fold dwell-time
  // pathways for bouncing visitors).
  const singleCountry: { code: string; name: string } | null = countryCount === 1
    ? (() => {
        for (const b of books) {
          for (const bn of b.bans) {
            if (bn.country_code === countryCodes[0]) {
              return { code: countryCodes[0], name: bn.countries?.name_en ?? countryCodes[0] }
            }
          }
        }
        return null
      })()
    : null

  // Representative book for the no-bio placeholder: the work this author is
  // most banned for. Used only when `a.bio` is NULL — see the bio render
  // below. Tiebreaker is the existing title-asc ordering from the books
  // query, so output is deterministic.
  const representativeBook = realBooks.length > 0
    ? [...realBooks].sort((x, y) => y.bans.length - x.bans.length)[0]
    : null

  // Placeholder-author explanation. Six rows in `authors` exist as catalogue
  // aggregators (Anonymous, Unknown, No Further Information, Various Authors)
  // and their DB `bio` field is mostly corrupt — populated by Wikipedia
  // enrichment before the disambig/person-signal guards landed (see the
  // 2026-05-23 incident note in scripts/enrich-author-bios.ts). For these
  // we render an intentional, hand-written explanation of what the bucket
  // represents instead of the DB bio. The function returns null for
  // non-placeholder slugs and for placeholder slugs we don't recognize, so
  // unrecognized placeholders fall back to the regular `a.bio` path.
  function placeholderExplanation(displayName: string, bookCount: number, isFlagged: boolean): React.ReactNode | null {
    const lower = displayName.toLowerCase()
    const works = bookCount === 1 ? 'work' : 'works'
    const are = bookCount === 1 ? 'is' : 'are'
    // Editorial-collective branch runs regardless of the is_placeholder flag
    // (those rows aren't flagged in the DB). It's also tighter — anchored
    // patterns, not loose substring match — so false-positive risk on real
    // author names is minimal.
    if (/^(editors of|editorial staff)\b/.test(lower) || /\beditorial staff\b/.test(lower)) {
      return (
        <>
          This is a collective credit, not an individual author — the {works} {are}
          attributed to an editorial body of a known publication rather than to a single
          person. Biographies aren&rsquo;t available for editorial collectives, but the
          works themselves are catalogued below alongside their bans.
        </>
      )
    }
    // Generic-placeholder branches (Anonymous, Various, No Further Info,
    // Unknown) use loose substring match, so they're gated on the explicit
    // is_placeholder flag to avoid catching a real author whose name happens
    // to contain one of these tokens.
    if (!isFlagged) return null
    if (lower.includes('anonymous')) {
      return (
        <>
          &ldquo;Anonymous&rdquo; is a catalogue placeholder for works without identifiable
          authorship. The {bookCount} {works} listed here {are} not by a single person —
          they include genuinely anonymous publications (often political tracts, samizdat,
          or erotic literature published to evade prosecution), works credited only to
          editorial collectives or magazine staff, and historical texts whose authors are
          simply lost. If you can attribute a specific work below to a known author,
          please <Link href="/about#get-in-touch" className="underline hover:text-gray-900">get in touch</Link>.
        </>
      )
    }
    if (lower.includes('various')) {
      return (
        <>
          &ldquo;Various Authors&rdquo; is a catalogue placeholder for compilations,
          anthologies, and other collaborative works where no single primary author is
          recorded. If a specific work below should be linked to an individual author,
          please <Link href="/about#get-in-touch" className="underline hover:text-gray-900">get in touch</Link>.
        </>
      )
    }
    if (lower.includes('no further information')) {
      return (
        <>
          This entry is a catalogue placeholder for works imported from upstream sources
          where the author field was missing, unparseable, or explicitly recorded as
          unavailable. We have not yet matched the {bookCount} {works} listed here to
          identifiable authors. If you can attribute one, please{' '}
          <Link href="/about#get-in-touch" className="underline hover:text-gray-900">get in touch</Link>.
        </>
      )
    }
    if (lower.includes('unknown')) {
      return (
        <>
          &ldquo;Unknown&rdquo; is a catalogue placeholder for works whose author we have
          not been able to identify. Unlike &ldquo;Anonymous&rdquo;, which usually means a
          work was published without an author by intent, these are cases where authorship
          may exist but has been lost or never recorded in the sources we use. If you know
          who wrote one of the {works} below, please{' '}
          <Link href="/about#get-in-touch" className="underline hover:text-gray-900">get in touch</Link>.
        </>
      )
    }
    return null
  }
  // Placeholder explanation runs for ALL authors, not just is_placeholder=true.
  // Some catalogue-aggregator rows (editorial-staff credits) aren't flagged in
  // the DB but should still get a dedicated explanation rather than the
  // no-bio fallback. The helper itself enforces the right gates per branch.
  const placeholderText = placeholderExplanation(a.display_name, books.length, a.is_placeholder === true)

  // ── Timeline rows: one per book that has dated bans, sorted by earliest ban year ──
  const authorTimelineRows: TimelineRow[] = books
    .map((b) => {
      const datedBans = b.bans.filter((ban) => ban.year_started != null)
      if (datedBans.length === 0) return null
      const earliest = Math.min(...datedBans.map((ban) => ban.year_started!))
      const countries = [...new Set(datedBans.map((bn) => bn.country_code))]
      const flag = countries.length === 1 ? countryFlag(countries[0]) : '🌍'
      return {
        key: b.slug,
        label: b.title,
        flag,
        sublabel:
          datedBans.length === 1
            ? `1 ban`
            : `${datedBans.length} bans · ${countries.length} ${countries.length === 1 ? 'country' : 'countries'}`,
        href: `/books/${b.slug}`,
        bans: datedBans.map((ban) => ({
          id: ban.id,
          year_started: ban.year_started!,
          year_ended: ban.year_ended,
          status: ban.status,
          action_type: ban.action_type,
        })),
        earliest,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.earliest - b.earliest)
    .map(({ earliest: _e, ...row }) => row)

  const earliestBookYear = books
    .map((b) => b.first_published_year)
    .filter((y): y is number => y != null)
    .reduce<number | null>((acc, y) => (acc == null || y < acc ? y : acc), null)

  const lifespan = a.birth_year
    ? `${a.birth_year}${a.birth_country ? `, ${a.birth_country}` : ''} — ${a.death_year ?? 'present'}`
    : null

  // ── Other frequently banned authors (top 5 by ban count, excluding this one) ──
  type RelatedAuthor = { id: number; display_name: string; slug: string; banCount: number }
  let relatedAuthors: RelatedAuthor[] = []
  try {
    // Global top-banned authors come straight from v_top_banned_authors
    // (entity_id, total_bans — pre-ranked, top 100). The previous approach
    // embedded books(bans(id)) for 2000 book_author links on EVERY author-page
    // render just to count — the #2 query site-wide (mean ~80ms, max 7.6s) —
    // and only ever summed an arbitrary 2000 links, so it wasn't even the true
    // global top. Pull a small buffer (placeholders / slug-less authors are
    // filtered out below), then keep the top 5 real authors.
    const { data: topRanked } = await supabase
      .from('v_top_banned_authors')
      .select('entity_id, total_bans')
      .neq('entity_id', author.id)
      .order('total_bans', { ascending: false })
      .limit(20)

    if (topRanked?.length) {
      const countById = new Map(topRanked.map(r => [Number(r.entity_id), Number(r.total_bans)]))
      const { data: authorDetails } = await supabase
        .from('authors')
        .select('id, display_name, slug')
        .in('id', [...countById.keys()])
        .not('slug', 'is', null)
        .eq('is_placeholder', false)
      relatedAuthors = (authorDetails ?? [])
        .map(d => ({
          id: d.id as number,
          display_name: d.display_name as string,
          slug: d.slug as string,
          banCount: countById.get(d.id as number) ?? 0,
        }))
        .sort((x, y) => y.banCount - x.banCount)
        .slice(0, 5)
    }
  } catch {
    // Non-fatal
  }

  // Placeholder authors ("Anonymous", "Unknown", "Various") aggregate
  // unrelated books. They are real catalogue navigation points but NOT
  // entities — emitting Person JSON-LD or a "23 of Anonymous's books..."
  // lead would misrepresent the data and undermine SEO trust on /
  // authors/anonymous. Switch the whole SEO surface to a no-promotion
  // mode for these records.
  const isPlaceholder = a.is_placeholder === true

  // Corporate / organizational credits (studios, publishers, editorial bodies)
  // are real catalogue authors but not people — emit Organization JSON-LD, not
  // Person, and an organizational-credit explanation instead of the person
  // no-bio note. Curated registry (see lib/organization-authors.ts). The ban
  // counts, lead, and FAQ stay — they read correctly for an organization too.
  const isOrg = !isPlaceholder && isOrganizationAuthor(a.slug)

  // Author-level literary awards (Nobel Prize in Literature). Rendered as a
  // gold badge in the header and emitted as schema.org `award` on the Person.
  const authorAwards = parseAwards(a.awards)

  // ── Schema.org Person + BreadcrumbList JSON-LD ──────────────────────────────
  // Sits alongside the citation_* meta tags built in generateMetadata above.
  // The Person type lets Google build entity-graph relations between this
  // author and the Book JSON-LD on each book detail page (where author.url
  // points back here).
  const canonicalUrlLd = `https://www.banned-books.org/authors/${a.slug}`
  const personAlternateNames = [a.name_native, a.name_english, a.name_transliterated]
    .filter((n): n is string => !!n && n.trim() !== '' && n.trim().toLowerCase() !== a.display_name.trim().toLowerCase())
  // Entity fragment id: organizations anchor at #organization, people at
  // #person. webPageJsonLd.about points at whichever exists below.
  const entityFragment = isOrg ? 'organization' : 'person'
  const personJsonLd: Record<string, unknown> | null = isPlaceholder ? null : {
    '@context': 'https://schema.org',
    '@type': isOrg ? 'Organization' : 'Person',
    '@id': `${canonicalUrlLd}#${entityFragment}`,
    name: a.display_name,
    url: canonicalUrlLd,
    mainEntityOfPage: canonicalUrlLd,
  }
  if (personJsonLd && personAlternateNames.length > 0) {
    personJsonLd.alternateName = personAlternateNames.length === 1 ? personAlternateNames[0] : personAlternateNames
  }
  if (personJsonLd) {
    if (a.photo_url)      personJsonLd.image = a.photo_url
    if (a.bio)            personJsonLd.description = a.bio
    if (authorAwards.length > 0) {
      const aw = authorAwards.map(awardSchemaText)
      personJsonLd.award = aw.length === 1 ? aw[0] : aw
    }
    // Person-only properties. `workExample`, `birthDate`/`deathDate`,
    // `birthPlace`, and `knowsLanguage` aren't valid on schema.org Organization,
    // so they're suppressed for corporate-author records (those fields are NULL
    // for orgs anyway, but emitting them would still be invalid markup).
    if (!isOrg) {
      if (a.birth_year)     personJsonLd.birthDate = String(a.birth_year)
      if (a.death_year)     personJsonLd.deathDate = String(a.death_year)
      if (a.birth_country)  personJsonLd.birthPlace = a.birth_country
      if (a.original_language) personJsonLd.knowsLanguage = a.original_language
      if (realBooks.length > 0) {
        personJsonLd.workExample = realBooks.slice(0, 50).map(b => ({
          '@type': 'Book',
          name: b.title,
          url: `https://www.banned-books.org/books/${b.slug}`,
          ...(b.first_published_year ? { datePublished: String(b.first_published_year) } : {}),
        }))
      }
    }
    // dateModified — trigger-bumped freshness signal, parallel to the
    // Book.dateModified emitted on book detail pages.
    if (a.updated_at) personJsonLd.dateModified = a.updated_at
    // Data-quality signal — same shape as Book.additionalProperty on book
    // detail pages, so AI-citation crawlers see a uniform provenance field
    // across both entity types.
    personJsonLd.additionalProperty = {
      '@type': 'PropertyValue',
      propertyID: 'dataQualityStatus',
      name: 'Data quality',
      value: a.data_quality_status,
      url: 'https://www.banned-books.org/data-quality',
    }
    // sameAs — fuse this page with the author's canonical entity elsewhere
    // (Wikidata, VIAF authority file, official site, social profiles). This is
    // the primary payoff of the author-links enrichment: it lets Google/AI
    // crawlers resolve this Person to a known entity rather than treating the
    // page as an unanchored name. Sourced from Wikidata (CC-0), namesake-gated
    // — see scripts/enrich-author-links.ts.
    const sameAs = [
      a.wikidata_id ? `https://www.wikidata.org/wiki/${a.wikidata_id}` : null,
      a.website_url,
      ...(a.social_links ? Object.values(a.social_links) : []),
    ].filter((u): u is string => !!u)
    if (sameAs.length > 0) personJsonLd.sameAs = sameAs.length === 1 ? sameAs[0] : sameAs
  }

  // ── Direct-answer lead + FAQPage JSON-LD ──────────────────────────────────
  // Same SEO surface as book/country/reason: a prose summary in the first
  // viewport plus 3-4 query-shaped Q&As targeting "is [author] banned?",
  // "how many of [author]'s books are banned?", "why are [author]'s books
  // banned?". Computed from already-loaded books + bans data.
  type AuthorBan = Author['display_name'] extends never ? never : Book['bans'][number]
  let authorLead: string | null = null
  let authorFaqJsonLd: object | null = null
  // Placeholder authors get a special editorial lead instead of the
  // counts-driven one — see below — and no FAQ schema (no real entity
  // to answer questions about).
  if (!isPlaceholder && realBooks.length > 0 && totalBans > 0) {
    const reasonSlugCounts = new Map<string, number>()
    for (const b of books) {
      for (const ban of b.bans) {
        for (const link of ban.ban_reason_links) {
          const slug = link.reasons?.slug
          if (slug) reasonSlugCounts.set(slug, (reasonSlugCounts.get(slug) ?? 0) + 1)
        }
      }
    }
    const topReasonSlug = [...reasonSlugCounts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0]
    const topReasonPhrase = topReasonSlug ? reasonPhrase(topReasonSlug) : null

    const datedBans = books.flatMap(b => b.bans.filter((ban: AuthorBan) => ban.year_started != null))
    const earliestYear = datedBans.length > 0 ? Math.min(...datedBans.map((b: AuthorBan) => b.year_started!)) : null

    const bannedBookCount = realBooks.filter(b => b.bans.length > 0).length

    let head = `${a.display_name} has ${bannedBookCount} ${bannedBookCount === 1 ? 'book' : 'books'} that ${bannedBookCount === 1 ? 'has' : 'have'} been banned or challenged in ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`
    if (earliestYear) head += ` since ${earliestYear}`
    if (topReasonPhrase) head += `, most often for ${topReasonPhrase}`
    authorLead = head + '.'
    if (activeBanCount > 0 && totalBans > activeBanCount) {
      authorLead += ` ${activeBanCount} of the ${totalBans} bans ${activeBanCount === 1 ? 'remains' : 'remain'} active today.`
    } else if (activeBanCount === totalBans && totalBans > 1) {
      authorLead += ` All ${totalBans} bans remain active.`
    }

    const items: { q: string; a: string }[] = []
    items.push({
      q: `How many of ${a.display_name}'s books have been banned?`,
      a: `${bannedBookCount} ${bannedBookCount === 1 ? 'book' : 'books'} by ${a.display_name} ${bannedBookCount === 1 ? 'has' : 'have'} been banned or challenged, with ${totalBans} documented ${totalBans === 1 ? 'ban' : 'bans'} across ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}.`,
    })
    if (topReasonPhrase) {
      items.push({
        q: `Why have ${a.display_name}'s books been banned?`,
        a: `The most frequently cited reason for banning ${a.display_name}'s work is ${topReasonPhrase}, with ${reasonSlugCounts.get(topReasonSlug!)} ${reasonSlugCounts.get(topReasonSlug!) === 1 ? 'documented ban' : 'documented bans'} citing this reason.`,
      })
    }
    if (earliestYear) {
      const firstBookBan = realBooks
        .map(b => ({ title: b.title, slug: b.slug, earliest: Math.min(...b.bans.filter(bn => bn.year_started != null).map(bn => bn.year_started!), Infinity) }))
        .filter(x => Number.isFinite(x.earliest))
        .sort((x, y) => x.earliest - y.earliest)[0]
      if (firstBookBan && firstBookBan.earliest === earliestYear) {
        items.push({
          q: `When was the first ban of a ${a.display_name} book?`,
          a: `${firstBookBan.title} by ${a.display_name} was first banned in ${earliestYear} — the earliest documented ban of any of ${a.display_name}'s works in this catalogue.`,
        })
      } else {
        items.push({
          q: `When was the first ban of a ${a.display_name} book?`,
          a: `The earliest documented ban of a book by ${a.display_name} dates to ${earliestYear}.`,
        })
      }
    }
    if (realBooks.length >= 3) {
      const titles = realBooks.slice(0, 5).map(b => b.title).join(', ')
      items.push({
        q: `Which books by ${a.display_name} have been banned?`,
        a: `Banned or challenged books by ${a.display_name} include ${titles}.`,
      })
    }
    authorFaqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map(it => ({
        '@type': 'Question',
        name: it.q,
        acceptedAnswer: { '@type': 'Answer', text: it.a },
      })),
    }
  }

  // Placeholder lead — single sentence noting this is a catalogue bucket
  // for anonymously-authored books rather than a person's oeuvre.
  if (isPlaceholder && books.length > 0) {
    authorLead = `This page collects ${books.length} ${books.length === 1 ? 'book' : 'books'} in our catalogue without an attributed author. These are separate works by different (unknown or anonymous) writers, grouped here for catalogue navigation only.`
  }

  // Hand-curated primary-source clip for this author, if any (e.g. the author
  // discussing their banned work). Privacy-safe facade embed. See
  // lib/featured-videos.ts.
  const featuredVideo = videoForAuthor(slug)

  // Breadcrumb mirrors the visible <Breadcrumb> rendered above the hero.
  // "Authors" points at /most-banned-authors — the real author directory
  // (no /authors index route exists).
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',    item: 'https://www.banned-books.org/' },
      { '@type': 'ListItem', position: 2, name: 'Authors', item: 'https://www.banned-books.org/most-banned-authors' },
      { '@type': 'ListItem', position: 3, name: a.display_name, item: canonicalUrlLd },
    ],
  }

  // WebPage JSON-LD — same role as on book detail pages: name Banned Books
  // as the page author/publisher for citation-tool attribution. Person LD
  // above carries the real person. Placeholder records (Anonymous/Unknown)
  // get the WebPage without an `about` ref because no Person entity exists
  // to point at.
  const webPageJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url: canonicalUrlLd,
    name: `${a.display_name} — Banned Books`,
    author: { '@type': 'Organization', name: 'Banned Books', url: 'https://www.banned-books.org' },
    publisher: { '@type': 'Organization', name: 'Banned Books', url: 'https://www.banned-books.org' },
  }
  if (!isPlaceholder) webPageJsonLd.about = { '@id': `${canonicalUrlLd}#${entityFragment}` }
  if (a.created_at) webPageJsonLd.datePublished = a.created_at
  if (a.updated_at) webPageJsonLd.dateModified = a.updated_at

  const ldHtml = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      {personJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldHtml(personJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldHtml(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldHtml(breadcrumbJsonLd) }}
      />
      {authorFaqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldHtml(authorFaqJsonLd) }}
        />
      )}
      <PageviewTracker entityType="author" entityId={a.id} />
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Authors', href: '/most-banned-authors' },
          { label: a.display_name },
        ]}
      />

      {/* Hero */}
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 mb-10 pb-8 border-b border-neutral-200">
        {a.photo_url && (
          <div className="shrink-0 flex justify-center sm:block">
            <Image
              src={a.photo_url}
              alt={a.display_name}
              width={160}
              height={200}
              className="rounded-lg shadow-md object-cover object-top w-[120px] h-[150px] sm:w-[160px] sm:h-[200px]"
              sizes="160px"
            />
          </div>
        )}
        <div className="flex flex-col justify-center gap-2 min-w-0">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-oxblood">
            {isOrg ? 'Organization' : 'Author'}
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            {a.display_name}
            <QualityCheck status={a.data_quality_status} />
          </h1>
          {/* Topical subtitle — same pattern as the book-detail page. Carries
              the `[N] banned books in [M] countries` token the H1 omits, so
              author-name queries combined with "banned books" or country
              names have something concrete to rank against. Suppressed for
              authors with no documented bans (e.g. placeholder/anonymous
              buckets) where the phrase would mislead. */}
          {realBooks.length > 0 && countryCount > 0 ? (
            <p className="text-base sm:text-lg font-medium text-oxblood/90 leading-snug">
              {realBooks.length} banned {realBooks.length === 1 ? 'book' : 'books'} in{' '}
              {singleCountry ? (
                <Link
                  href={`/countries/${singleCountry.code.toLowerCase()}`}
                  className="underline underline-offset-4 decoration-2 decoration-oxblood/40 hover:decoration-oxblood"
                >
                  {singleCountry.name}
                </Link>
              ) : (
                <>{countryCount} countries</>
              )}
            </p>
          ) : blanketWorks.length > 0 && countryCount > 0 ? (
            <p className="text-base sm:text-lg font-medium text-oxblood/90 leading-snug">
              Complete works banned in{' '}
              {singleCountry ? (
                <Link
                  href={`/countries/${singleCountry.code.toLowerCase()}`}
                  className="underline underline-offset-4 decoration-2 decoration-oxblood/40 hover:decoration-oxblood"
                >
                  {singleCountry.name}
                </Link>
              ) : (
                <>{countryCount} countries</>
              )}
            </p>
          ) : null}
          {/* Secondary name: native-script form (for authors whose original
              writing language is non-English) OR a known English pen name
              when it differs from the canonical display_name. Suppressed
              when the alt-name equals display_name to avoid duplicating
              the H1. */}
          {(() => {
            const norm = (s: string) => s.trim().toLowerCase()
            const canonical = norm(a.display_name)
            const native =
              a.name_native && norm(a.name_native) !== canonical
                ? a.name_native
                : null
            const english =
              !native && a.name_english && norm(a.name_english) !== canonical
                ? a.name_english
                : null
            const subtitle = native ?? english
            if (!subtitle) return null
            return (
              <h2
                className="text-xl font-medium text-gray-700 leading-snug"
                lang={native ? a.original_language ?? undefined : 'en'}
              >
                {subtitle}
              </h2>
            )
          })()}
          {/* Transliteration annotation — small italic line, only when it
              adds information (distinct from both H1 and the H2 subtitle
              above). Pronunciation aid for non-Latin authors where the
              canonical display_name is one transliteration scheme and we
              have a more standard BGN/PCGN form. */}
          {a.name_transliterated &&
            a.name_transliterated.trim().toLowerCase() !== a.display_name.trim().toLowerCase() &&
            (!a.name_native ||
              a.name_transliterated.trim().toLowerCase() !==
                a.name_native.trim().toLowerCase()) && (
              <p className="text-sm italic text-gray-500">
                {a.name_transliterated}
              </p>
            )}
          {lifespan && (
            <p className="text-sm text-gray-500">{lifespan}</p>
          )}
          {authorAwards.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {authorAwards.map((aw, i) => (
                <AwardBadge key={i} award={aw} />
              ))}
            </div>
          )}
          {authorAwards
            .filter((aw) => aw.motivation)
            .map((aw, i) => (
              <p key={i} className="text-sm italic text-gray-600 leading-snug mt-1 max-w-2xl">
                &ldquo;{aw.motivation}&rdquo;{' '}
                <span className="not-italic text-gray-400">— {awardName(aw)}, {aw.year}</span>
              </p>
            ))}
          {/* Supporting stats — distinct-book count already lives in the
              topical subtitle above (per ban-metric doctrine: rank on
              distinct books, not raw events). What's surfaced here is the
              raw-event count and active-vs-historical split, which the
              subtitle deliberately omits to stay headline-clean. */}
          {totalBans > 0 && (
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
              <span>{totalBans} documented {totalBans === 1 ? 'ban event' : 'ban events'}</span>
              {activeBanCount > 0 && activeBanCount < totalBans && (
                <span>{activeBanCount} currently active</span>
              )}
            </div>
          )}
          {placeholderText ? (
            // Placeholder-bucket explanation (Anonymous, Unknown, Various
            // Authors, No Further Information). Rendered in place of the DB
            // `bio` field, which is mostly corrupt for these rows.
            <p className="text-sm text-gray-700 leading-relaxed mt-1 max-w-2xl">{placeholderText}</p>
          ) : isOrg ? (
            // Organizational credit (studio, publisher, imprint). These rows
            // are real catalogue authors but not people, so the person no-bio
            // note below would mislead. Editorial collectives ("Editors of…")
            // are handled by placeholderText above and never reach here.
            <p className="text-sm text-gray-700 leading-relaxed mt-1 max-w-2xl">
              This is an organizational credit, not an individual author. These works are
              attributed to {a.display_name} as a corporate author rather than to a single
              person, so a personal biography doesn&rsquo;t apply. The works themselves are
              catalogued below alongside their bans.
            </p>
          ) : a.bio ? (
            <div className="mt-1 max-w-2xl">
              <p className="text-sm text-gray-700 leading-relaxed">{a.bio}</p>
              {/* Bio provenance — same component as description_book on the
                  book page. Legacy bios (bio_source_type NULL) show nothing. */}
              {a.bio_source_type && (
                <DescriptionSourceAttribution url={a.bio_source_url} type={a.bio_source_type} />
              )}
            </div>
          ) : !isPlaceholder ? (
            // No-bio placeholder. Surfaces an explicit "we couldn't find a
            // bio" note + a route to the contact form, rather than silently
            // dropping the paragraph. Deliberately NOT written into the
            // Person JSON-LD `description` (see the `if (a.bio) …` gate
            // above), so this stays editorial-only and doesn't mislead
            // crawlers. Contact link points at the `#get-in-touch` section
            // on /about (no scrapeable mailto on the page).
            <p className="text-sm text-gray-500 leading-relaxed mt-1 max-w-2xl italic">
              We could not find biographical information about {a.display_name}
              {representativeBook ? (
                <>, author of <em className="not-italic">{representativeBook.title}</em>,</>
              ) : ''}{' '}in reliable public sources. If you can help fill this gap, please{' '}
              <Link
                href="/about#get-in-touch"
                className="not-italic underline hover:text-gray-700"
              >
                get in touch
              </Link>.
            </p>
          ) : null}
          {/* Official website + social profiles (Wikidata-sourced). Hidden for
              placeholder buckets; the component self-hides when there's nothing
              to show. VIAF/Wikidata live in the Person JSON-LD sameAs, not here. */}
          {!isPlaceholder && (
            <AuthorLinks websiteUrl={a.website_url} socialLinks={a.social_links} />
          )}
        </div>
      </div>

      <QualityFlaggedNotice
        status={a.data_quality_status}
        entityLabel="author"
      />

      {/* Direct-answer lead — AI-Overview/Featured-Snippet-eligible TL;DR.
          Bio above is editorial about the person; this lead is data-driven
          about the bans, the angle that drives author-name searches. */}
      {authorLead && (
        <p className="mb-8 text-base text-gray-800 leading-relaxed border-l-4 border-red-300 pl-4">
          {authorLead}
        </p>
      )}

      {/* In their own words — hand-curated primary-source clip (see
          lib/featured-videos.ts). Privacy-safe facade embed: no YouTube
          cookies/JS until the viewer clicks play. */}
      {featuredVideo && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">In their own words</h2>
          <div className={featuredVideo.maxWidth ?? 'max-w-2xl'}>
            <YouTubeEmbed videoId={featuredVideo.videoId} title={featuredVideo.title} start={featuredVideo.start} />
            <p className="mt-2 text-xs text-gray-500">{featuredVideo.credit}</p>
            {featuredVideo.note && (
              <p className="mt-1 text-xs italic text-gray-400">{featuredVideo.note}</p>
            )}
          </div>
        </section>
      )}

      {/* Find books */}
      {(() => {
        const koboHref = getKoboUrl(a.display_name, `author-${a.slug}`)
        return (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-amber-600">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              Find books by {a.display_name}
            </h2>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <TrackedOutboundLink
                  eventName="Bookshop Click"
                  eventProperties={{ source: 'author', authorSlug: a.slug, linkType: 'storefront' }}
                  href={getBookshopAuthorUrl()}
                  target="_blank"
                  rel={BOOKSHOP_REL}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-sm font-semibold text-white transition-colors shadow-sm"
                >
                  Find on Bookshop.org
                </TrackedOutboundLink>
                <TrackedOutboundLink
                  eventName="Kobo Click"
                  eventProperties={{ source: 'author', authorSlug: a.slug }}
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
            </div>
          </section>
        )
      })()}

      {/* Ban timeline — one row per book, only when this author's record has 3+ dated bans across multiple books */}
      {authorTimelineRows.length >= 2 && authorTimelineRows.reduce((s, r) => s + r.bans.length, 0) >= 3 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Ban timeline</h2>
          <BanTimeline
            rows={authorTimelineRows}
            firstPublishedYear={earliestBookYear}
            firstPublishedLabel="First book published"
            caption={`${a.display_name}'s books — ${totalBans} bans across ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}.`}
          />
        </section>
      )}

      {blanketWorks.length > 0 && (
        <section className="mb-8 rounded-lg border border-oxblood/20 bg-oxblood/5 p-4">
          <h2 className="text-base font-semibold text-oxblood/90 mb-1">
            Complete works banned
          </h2>
          <p className="text-sm text-gray-700">
            Rather than a single title, the entire body of work by {a.display_name} was
            banned{(() => {
              const cc = [...new Set(blanketWorks.flatMap(b => b.bans.map(bn => bn.country_code)))]
              const names = cc.map(c => blanketWorks.flatMap(b => b.bans).find(bn => bn.country_code === c)?.countries?.name_en ?? c)
              return names.length > 0 ? ` in ${names.join(', ')}` : ''
            })()}. This is recorded as an author-level ban; no individual titles are
            catalogued for it.
          </p>
        </section>
      )}

      {realBooks.length === 0 ? (
        blanketWorks.length === 0 && (
          <p className="text-gray-500">No books recorded for this author yet.</p>
        )
      ) : (
        <>
        <h2 className="text-lg font-semibold mb-4">
          Banned books by {a.display_name}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {realBooks.map(book => {
            const reasons = getReasons(book.bans)
            const activeBans = book.bans.filter(b => b.status === 'active')
            const displayBans = activeBans.length > 0 ? activeBans : book.bans.slice(0, 4)
            return (
              <Link key={book.id} href={`/books/${book.slug}`} className="group flex flex-col">
                <div className="mb-2">
                  {book.cover_url ? (
                    <Image
                      src={book.cover_url}
                      alt={coverAlt(book.title, a.display_name, book.first_published_year)}
                      width={160}
                      height={240}
                      className="rounded shadow-sm object-cover w-full"
                      sizes="160px"
                    />
                  ) : (
                    <BookCoverPlaceholder title={book.title} author={a.display_name} slug={book.slug} />
                  )}
                </div>
                <h3 className="text-sm font-semibold leading-snug group-hover:underline line-clamp-2">{book.title}</h3>
                {book.first_published_year && (
                  <p className="text-xs text-gray-400 mt-0.5">{book.first_published_year}</p>
                )}
                <div className="flex flex-wrap gap-0.5 mt-1.5 text-xs text-gray-400">
                  {displayBans.slice(0, 4).map(b => (
                    <span key={b.id} title={b.countries?.name_en ?? b.country_code}>
                      {countryFlag(b.country_code)}
                    </span>
                  ))}
                  {book.bans.length > 4 && <span>+{book.bans.length - 4}</span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {book.genres.slice(0, 2).map(g => <GenreBadge key={g} slug={g} />)}
                  {reasons.slice(0, 2).map(s => <ReasonBadge key={s} slug={s} />)}
                </div>
              </Link>
            )
          })}
        </div>
        </>
      )}

      <CitationBlock
        entityType="author"
        entity={{
          title: a.display_name,
          slug: a.slug,
        }}
        url={`https://www.banned-books.org/authors/${a.slug}`}
      />

      {/* Last verified — feeds Person.dateModified above. */}
      <div className="mt-6">
        {a.updated_at && (
          <p className="text-xs text-gray-400">
            Last verified:{' '}
            <time dateTime={a.updated_at}>
              {new Date(a.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </time>
          </p>
        )}
        <QualityFooterLine
          status={a.data_quality_status}
          evaluatedAt={a.data_quality_evaluated_at}
        />
      </div>

      {/* Other frequently banned authors */}
      {relatedAuthors.length > 0 && (
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h2 className="text-base font-semibold text-gray-700 mb-4">
            Other frequently banned authors
          </h2>
          <div className="flex flex-wrap gap-3">
            {relatedAuthors.map(ra => (
              <Link
                key={ra.id}
                href={`/authors/${ra.slug}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 hover:border-gray-400 transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 group-hover:underline leading-snug">
                    {ra.display_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {ra.banCount} {ra.banCount === 1 ? 'ban' : 'bans'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
