// Shared commit helper for both auto-approve (Wikipedia bulk importer) and
// manual-approve (admin /admin/import-review UI).
//
// Both paths funnel through commitParsedRow(), which performs the same
// transactional INSERTs into books / book_authors / bans / ban_sources /
// ban_source_links / ban_reason_links. The auto-approve caller (importer)
// constructs CommitInput from a ParsedRow + SectionConfig + reason mapping;
// the manual-approve caller (admin API) constructs it from the form overlay
// merged onto the queued parsed_row. Keeping the write-logic in one place
// avoids drift between the two paths and makes acceptance #5 (manual approve
// produces the same downstream shape as auto-approve) trivially true.

import { Client } from 'pg'
import { slugify } from './slugify'

export type CommitInput = {
  title: string
  title_native?: string | null
  title_english_meaningful?: string | null
  // ISO 639-1 two-letter code. books.original_language is `character(2)`.
  original_language?: string | null
  authors: string[]
  // Year the ban started (maps to bans.year_started). The Wikipedia "Year"
  // column always refers to the ban year, not the publication year.
  year: number | null
  first_published_year?: number | null
  country_code: string
  scope_slug: string
  action_type: 'banned' | 'restricted' | 'challenged'
  ban_status: 'active' | 'historical'
  reason_slug: string
  description_book?: string | null
  description_ban?: string | null
  inclusion_rationale: string
  source_url: string
  source_name: string
  source_type: string
}

export type CommitResult = {
  book_id: number
  ban_ids: number[]
}

export async function commitParsedRow(input: CommitInput, pg: Client): Promise<CommitResult> {
  if (input.year === null) {
    throw new Error('commitParsedRow: year is required (ban.year_started cannot be NULL for new imports)')
  }
  if (input.authors.length === 0) {
    throw new Error('commitParsedRow: at least one author is required')
  }
  if (input.original_language && input.original_language.length !== 2) {
    throw new Error(
      `commitParsedRow: original_language must be a 2-letter ISO-639-1 code, got '${input.original_language}'`,
    )
  }

  await pg.query('BEGIN')
  try {
    // 1. Authors
    const authorIds: number[] = []
    for (const name of input.authors) {
      authorIds.push(await upsertAuthor(pg, name))
    }

    // 2. Scope
    const scopeRes = await pg.query('select id from scopes where slug = $1', [input.scope_slug])
    if (scopeRes.rows.length === 0) {
      throw new Error(`commitParsedRow: unknown scope slug '${input.scope_slug}'`)
    }
    const scopeId = scopeRes.rows[0].id as number

    // 3. Book
    const slug = slugify(input.title)
    if (!slug) {
      throw new Error(`commitParsedRow: slugify produced empty slug for title '${input.title}'`)
    }
    const bookRes = await pg.query(
      `insert into books (
         title, slug, inclusion_rationale, ai_drafted,
         title_native, title_english_meaningful, original_language,
         description_book, first_published_year
       )
       values ($1, $2, $3, false, $4, $5, $6, $7, $8)
       returning id`,
      [
        input.title,
        slug,
        input.inclusion_rationale,
        input.title_native ?? null,
        input.title_english_meaningful ?? null,
        input.original_language ?? null,
        input.description_book ?? null,
        input.first_published_year ?? null,
      ],
    )
    const bookId = bookRes.rows[0].id as number

    // 4. book_authors join
    for (const aid of authorIds) {
      await pg.query(
        `insert into book_authors (book_id, author_id) values ($1, $2) on conflict do nothing`,
        [bookId, aid],
      )
    }

    // 5. Reason slug → id
    const reasonRes = await pg.query('select id from reasons where slug = $1', [input.reason_slug])
    if (reasonRes.rows.length === 0) {
      throw new Error(`commitParsedRow: unknown reason slug '${input.reason_slug}'`)
    }
    const reasonId = reasonRes.rows[0].id as number

    // 6. Ban
    const description = capDescription(input.description_ban)
    const banRes = await pg.query(
      `insert into bans (book_id, country_code, scope_id, action_type, status,
                         year_started, year_ended, description)
       values ($1, $2, $3, $4, $5, $6, null, $7)
       returning id`,
      [
        bookId,
        input.country_code,
        scopeId,
        input.action_type,
        input.ban_status,
        input.year,
        description,
      ],
    )
    const banId = banRes.rows[0].id as number

    // 7. ban_sources (upsert on URL — multiple bans can share a source URL)
    const sourceRes = await pg.query(
      `insert into ban_sources (source_name, source_url, source_type,
                                verification_status, accessed_at)
       values ($1, $2, $3, 'unverified', now())
       on conflict (source_url) do update
         set source_name = excluded.source_name,
             source_type = excluded.source_type,
             accessed_at = now()
       returning id`,
      [input.source_name, input.source_url, input.source_type],
    )
    const sourceId = sourceRes.rows[0].id as number

    // 8. ban_source_links
    await pg.query(
      `insert into ban_source_links (ban_id, source_id) values ($1, $2) on conflict do nothing`,
      [banId, sourceId],
    )

    // 9. ban_reason_links
    await pg.query(
      `insert into ban_reason_links (ban_id, reason_id) values ($1, $2) on conflict do nothing`,
      [banId, reasonId],
    )

    await pg.query('COMMIT')
    return { book_id: bookId, ban_ids: [banId] }
  } catch (err) {
    await pg.query('ROLLBACK')
    throw err
  }
}

async function upsertAuthor(pg: Client, displayName: string): Promise<number> {
  const slug = slugify(displayName)
  if (!slug) {
    throw new Error(`upsertAuthor: slugify produced empty slug for '${displayName}'`)
  }
  const ins = await pg.query(
    `insert into authors (display_name, slug) values ($1, $2)
     on conflict (slug) do nothing
     returning id`,
    [displayName, slug],
  )
  if (ins.rows.length > 0) return ins.rows[0].id as number
  const sel = await pg.query('select id from authors where slug = $1', [slug])
  if (sel.rows.length === 0) {
    throw new Error(`upsertAuthor: insert+select for '${displayName}' (${slug}) produced no row`)
  }
  return sel.rows[0].id as number
}

// Postgres text has no length cap, but excessively long descriptions hurt admin
// UI rendering. Cap at 2 KB; full text survives on the source URL.
function capDescription(text: string | null | undefined): string | null {
  if (!text) return null
  return text.length > 2000 ? text.slice(0, 1997) + '…' : text
}
