/**
 * Step 0 — French-language rendering validation.
 *
 * Adds three real French-language banned books to validate Model-3-style
 * rendering before Sprint A builds the pipeline. NOT a pipeline script.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/add-books-french-validation.ts
 *
 * Idempotent: skips books whose slug already exists.
 */
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()
const COVER_DELAY_MS = 300

interface OLResult {
  coverUrl: string | null
  workId: string | null
  publishYear: number | null
}

async function fetchOL(title: string, author: string): Promise<OLResult> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${q}&fields=key,cover_i,first_publish_year&limit=1`,
    )
    const json = (await res.json()) as {
      docs: Array<{ key?: string; cover_i?: number; first_publish_year?: number }>
    }
    const doc = json.docs?.[0]
    return {
      coverUrl: doc?.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : null,
      workId: doc?.key?.replace('/works/', '') ?? null,
      publishYear: doc?.first_publish_year ?? null,
    }
  } catch {
    return { coverUrl: null, workId: null, publishYear: null }
  }
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function upsertSource(name: string, url: string) {
  const { data, error } = await supabase
    .from('ban_sources')
    .upsert(
      { source_name: name, source_url: url, source_type: 'web' },
      { onConflict: 'source_url' },
    )
    .select('id')
    .single()
  if (error) {
    console.error(`  [source error] ${name}: ${error.message}`)
    return null
  }
  return data?.id as number | null
}

interface AuthorSpec {
  display_name: string
  slug: string
  birth_year: number | null
  death_year: number | null
}

interface BanSpec {
  country: string
  scope: 'government' | 'school' | 'public_library' | 'church' | 'customs' | 'prison' | 'retail'
  status: 'active' | 'historical'
  action_type: 'banned' | 'restricted' | 'challenged'
  year_started: number
  year_ended: number | null
  reasons: string[]
  description: string
  sources: { name: string; url: string }[]
}

interface BookSpec {
  title: string
  slug: string
  original_language: string
  first_published_year: number
  genres: string[]
  description_book: string
  description_ban: string
  authors: AuthorSpec[]
  bans: BanSpec[]
  /** Manual cover override; if null, fall back to Open Library lookup. */
  cover_url_override?: string | null
}

const BOOKS: BookSpec[] = [
  {
    title: "Suicide, mode d'emploi",
    slug: 'suicide-mode-demploi',
    original_language: 'fr',
    first_published_year: 1982,
    genres: ['essay', 'controversial-non-fiction'],
    description_book:
      "A 1982 French essay-manual by journalist Claude Guillon and Yves Le Bonniec that argued for a right to chosen death and provided practical information on suicide methods. Published by Éditions Alain Moreau, it became one of the most legally consequential French books of the late twentieth century: its existence prompted Parliament to pass a dedicated criminal statute.",
    description_ban:
      "The book's publication led directly to Law n° 87-1133 of 31 December 1987 (the 'loi Mazeaud'), which criminalised provocation to suicide as a press offence. Subsequent rulings by the Cour de cassation confirmed that commercial distribution of the work constitutes an offence under the new statute, effectively withdrawing it from regular circulation. The ban has never been formally lifted.",
    authors: [
      {
        display_name: 'Claude Guillon',
        slug: 'claude-guillon',
        birth_year: 1952,
        death_year: null,
      },
      {
        display_name: 'Yves Le Bonniec',
        slug: 'yves-le-bonniec',
        birth_year: null,
        death_year: null,
      },
    ],
    bans: [
      {
        country: 'FR',
        scope: 'government',
        status: 'active',
        action_type: 'banned',
        year_started: 1987,
        year_ended: null,
        reasons: ['moral'],
        description:
          "The book's existence led to Law n° 87-1133 of 31 December 1987 ('loi Mazeaud'), which criminalised provocation to suicide. Subsequent court rulings confirmed that commercial distribution of the work constitutes a criminal offence under French law.",
        sources: [
          {
            name: 'Légifrance — Loi n° 87-1133 du 31 décembre 1987',
            url: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000874092',
          },
          // No Wayback snapshot — Legifrance is Cloudflare-protected and rejects
          // archive.org's crawler with HTTP 520. Sprint A archiving pipeline
          // needs a fallback chain for these origins.
        ],
      },
    ],
  },

  {
    title: 'Éden, Éden, Éden',
    slug: 'eden-eden-eden',
    original_language: 'fr',
    first_published_year: 1970,
    genres: ['literary-fiction', 'experimental'],
    description_book:
      'A 1970 experimental prose work by Pierre Guyotat (Éditions Gallimard) set against the backdrop of the Algerian War. Written as a single uninterrupted sentence and described by its publisher Jérôme Lindon and supporters including Roland Barthes, Michel Leiris, and Pierre Boulez as a major literary event, the book combined explicit sexual content with depictions of colonial violence.',
    description_ban:
      "Subject to a triple ministerial ban (interdiction d'exposition, de publicité, et de vente aux mineurs) issued by Interior Minister Raymond Marcellin under article 14 of the Law of 16 July 1949 on publications for youth. A public petition signed by leading French writers protested the ban. The restrictions were effectively lifted in 1981 when the Mitterrand government came to power and the article-14 regime ceased to be enforced for adult literary works.",
    authors: [
      {
        display_name: 'Pierre Guyotat',
        slug: 'pierre-guyotat',
        birth_year: 1940,
        death_year: 2020,
      },
    ],
    bans: [
      {
        country: 'FR',
        scope: 'government',
        status: 'historical',
        action_type: 'restricted',
        year_started: 1970,
        year_ended: 1981,
        reasons: ['sexual', 'moral'],
        description:
          'Subject to a triple ministerial ban (exposure, advertising, and sale to minors) under article 14 of the 1949 Law on Publications for Youth. The restrictions were effectively lifted in 1981 with the change of government.',
        sources: [
          {
            name: 'Légifrance — Loi n° 49-956 du 16 juillet 1949',
            url: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000878175',
          },
          // No Wayback snapshot — Legifrance is Cloudflare-protected.
        ],
      },
    ],
  },

  {
    title: 'La Question',
    slug: 'la-question',
    original_language: 'fr',
    first_published_year: 1958,
    genres: ['memoir', 'political-non-fiction'],
    description_book:
      "Henri Alleg's first-person account of his torture by French paratroopers in Algiers in 1957. Alleg, a journalist and director of the suspended Alger républicain newspaper, wrote the manuscript clandestinely in prison and smuggled it out. Published by Éditions de Minuit in February 1958, it sold tens of thousands of copies within weeks and became the most influential text documenting state-sanctioned torture during the Algerian War.",
    description_ban:
      "Seized by French authorities in March 1958 — only weeks after publication — for compromising military secrets and demoralising the army. The seizure (saisie) was administrative rather than legislative: no formal court ban was ever issued, and the measure was never officially lifted. Underground reprints and Swiss editions circulated throughout the war. The seizure became unenforceable after Algerian independence in 1962. The Sénat debated the affair in March 1958 in the context of press freedom.",
    authors: [
      {
        display_name: 'Henri Alleg',
        slug: 'henri-alleg',
        birth_year: 1921,
        death_year: 2013,
      },
    ],
    bans: [
      {
        country: 'FR',
        scope: 'government',
        status: 'historical',
        action_type: 'banned',
        year_started: 1958,
        year_ended: 1962,
        reasons: ['political'],
        description:
          'Seized by French authorities in March 1958 following publication, due to its detailed account of torture by the French Army in Algeria. The seizure was never formally lifted but became unenforceable after Algerian independence in 1962.',
        sources: [
          {
            name: 'Sénat — Compte rendu de séance du 28 mars 1958',
            url: 'https://www.senat.fr/comptes-rendus-seances/4eme/pdf/1958/03/S19580328_0785_0820.pdf',
          },
          {
            name: 'Internet Archive — Wayback snapshot (Sénat 1958 PDF)',
            url: 'https://web.archive.org/web/20260511083958/https://www.senat.fr/comptes-rendus-seances/4eme/pdf/1958/03/S19580328_0785_0820.pdf',
          },
        ],
      },
    ],
  },
]

async function main() {
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const { data: existing } = await supabase.from('books').select('slug')
  const { data: existingAuthors } = await supabase
    .from('authors')
    .select('id, slug')

  if (!scopes || !reasons) {
    console.error('Failed to load vocabularies')
    process.exit(1)
  }

  const existingSlugs = new Set((existing ?? []).map(b => b.slug))
  const authorMap = new Map(
    (existingAuthors ?? []).map(a => [a.slug, a.id as number]),
  )

  const scopeId = (slug: string) => {
    const s = scopes.find(x => x.slug === slug)
    if (!s) throw new Error(`Scope missing: ${slug}`)
    return s.id
  }
  const reasonId = (slug: string) => {
    const r = reasons.find(x => x.slug === slug)
    if (!r) throw new Error(`Reason missing: ${slug}`)
    return r.id
  }

  async function getOrCreateAuthor(spec: AuthorSpec): Promise<number | null> {
    if (authorMap.has(spec.slug)) return authorMap.get(spec.slug)!
    const { data, error } = await supabase
      .from('authors')
      .insert({
        slug: spec.slug,
        display_name: spec.display_name,
        birth_year: spec.birth_year,
        death_year: spec.death_year,
      })
      .select('id')
      .single()
    if (error) {
      const { data: ex } = await supabase
        .from('authors')
        .select('id')
        .eq('slug', spec.slug)
        .single()
      if (ex) {
        authorMap.set(spec.slug, ex.id)
        return ex.id
      }
      console.error(`  [author error] ${spec.display_name}: ${error.message}`)
      return null
    }
    authorMap.set(spec.slug, data.id)
    return data.id
  }

  for (const book of BOOKS) {
    if (existingSlugs.has(book.slug)) {
      console.log(`[skip] ${book.title} (slug ${book.slug} exists)`)
      continue
    }

    process.stdout.write(`▶ ${book.title} — `)

    // Cover
    let coverUrl: string | null = book.cover_url_override ?? null
    let openlibraryWorkId: string | null = null
    if (coverUrl === null) {
      const primaryAuthor = book.authors[0]?.display_name ?? ''
      const ol = await fetchOL(book.title, primaryAuthor)
      coverUrl = ol.coverUrl
      openlibraryWorkId = ol.workId
      await sleep(COVER_DELAY_MS)
    }
    process.stdout.write(coverUrl ? 'cover ✓ ' : 'no cover ')

    // Authors
    const authorIds: number[] = []
    for (const a of book.authors) {
      const id = await getOrCreateAuthor(a)
      if (id) authorIds.push(id)
    }

    // Book row
    const { data: inserted, error: be } = await supabase
      .from('books')
      .insert({
        title: book.title,
        slug: book.slug,
        original_language: book.original_language,
        first_published_year: book.first_published_year,
        ai_drafted: false,
        genres: book.genres,
        cover_url: coverUrl,
        openlibrary_work_id: openlibraryWorkId,
        description_book: book.description_book,
        description_ban: book.description_ban,
      })
      .select('id')
      .single()
    if (be) {
      console.log(`\n  [book error] ${be.message}`)
      continue
    }
    const bookId = inserted.id
    existingSlugs.add(book.slug)

    // Book-authors join
    for (const aid of authorIds) {
      await supabase.from('book_authors').insert({ book_id: bookId, author_id: aid })
    }

    // Bans
    for (const ban of book.bans) {
      const { data: newBan, error: bane } = await supabase
        .from('bans')
        .insert({
          book_id: bookId,
          country_code: ban.country,
          scope_id: scopeId(ban.scope),
          action_type: ban.action_type,
          status: ban.status,
          year_started: ban.year_started,
          year_ended: ban.year_ended,
          description: ban.description,
        })
        .select('id')
        .single()
      if (bane) {
        console.log(`\n  [ban error] ${ban.country}: ${bane.message}`)
        continue
      }

      for (const r of ban.reasons) {
        await supabase
          .from('ban_reason_links')
          .insert({ ban_id: newBan.id, reason_id: reasonId(r) })
      }

      for (const src of ban.sources) {
        const sid = await upsertSource(src.name, src.url)
        if (sid) {
          await supabase
            .from('ban_source_links')
            .insert({ ban_id: newBan.id, source_id: sid })
        }
      }
    }

    console.log('[ok]')
  }

  console.log('\nDone. Visit:')
  console.log('  http://localhost:3000/books/suicide-mode-demploi')
  console.log('  http://localhost:3000/books/eden-eden-eden')
  console.log('  http://localhost:3000/books/la-question')
}

main().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})
