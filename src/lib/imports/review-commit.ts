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
  title_transliterated?: string | null
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
         title_native, title_transliterated, title_english_meaningful,
         original_language, description_book, first_published_year
       )
       values ($1, $2, $3, false, $4, $5, $6, $7, $8, $9)
       returning id`,
      [
        input.title,
        slug,
        input.inclusion_rationale,
        input.title_native ?? null,
        input.title_transliterated ?? null,
        input.title_english_meaningful ?? null,
        input.original_language ?? null,
        input.description_book ?? null,
        input.first_published_year ?? null,
      ],
    )
    const bookId = bookRes.rows[0].id as number

    // Auto-insert slug aliases for the alt-title variants so /books/<engl>
    // → 308 → /books/<canonical>. Each candidate is slugified, then:
    //   - skipped if it equals the canonical slug we just wrote
    //   - skipped if it collides with another book's canonical slug
    //   - inserted via ON CONFLICT DO NOTHING (idempotent)
    // The whole alias block runs INSIDE the existing transaction; if any
    // alias INSERT fails for any reason the entire book commit rolls back,
    // matching the all-or-nothing semantics of the rest of the function.
    const aliasCandidates: Array<{ slug: string; source: string }> = []
    const pushAlias = (text: string | null | undefined, source: string) => {
      if (!text) return
      const aliasSlug = slugify(text)
      if (!aliasSlug || aliasSlug === slug) return
      aliasCandidates.push({ slug: aliasSlug, source })
    }
    pushAlias(input.title_english_meaningful, 'title_english_meaningful')
    pushAlias(input.title_native, 'title_native')
    pushAlias(input.title_transliterated, 'title_transliterated')
    for (const c of aliasCandidates) {
      // Collision check: skip if another book already owns this slug as
      // canonical. We do NOT reject alias-table collisions here — the ON
      // CONFLICT below handles re-inserts of the same (slug, book_id).
      const collision = await pg.query(
        'select 1 from books where slug = $1 and id <> $2 limit 1',
        [c.slug, bookId],
      )
      if (collision.rowCount && collision.rowCount > 0) continue
      await pg.query(
        `insert into book_slug_aliases (slug, book_id, source)
         values ($1, $2, $3)
         on conflict (slug) do nothing`,
        [c.slug, bookId, c.source],
      )
    }

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

// Add a new ban (and its source/reason links) to an EXISTING book row.
// Used by the Wikipedia importer's auto_add_ban path: dedup matched the row
// to a known book, but the row describes a ban in a different country / year
// / scope and should be preserved as a new ban on the same book.
//
// Idempotent per (book_id, country_code, year_started, scope_id):
//   - if a ban with that tuple already exists, we reuse its id and just
//     add the source/reason links (also idempotent via ON CONFLICT)
//   - else we INSERT a new ban
//
// The SELECT-then-INSERT pattern is race-prone in principle; for the
// sequential import pipeline this is acceptable, and once the
// bans_unique_per_scope constraint is deployed in prod, a parallel writer
// would simply fail and retry. We deliberately do NOT use ON CONFLICT on
// the INSERT here because the constraint may not yet be present on the
// caller's environment.
export type AddBanInput = {
  book_id: number
  country_code: string
  scope_slug: string
  action_type: 'banned' | 'restricted' | 'challenged'
  ban_status: 'active' | 'historical'
  year: number
  reason_slug: string
  description_ban?: string | null
  source_url: string
  source_name: string
  source_type: string
}

export type AddBanResult = {
  ban_id: number
  created: boolean   // false if we reused an existing ban for this scope-tuple
}

export async function commitNewBanForBook(
  input: AddBanInput,
  pg: Client,
): Promise<AddBanResult> {
  await pg.query('BEGIN')
  try {
    const scopeRes = await pg.query(
      'select id from scopes where slug = $1',
      [input.scope_slug],
    )
    if (scopeRes.rows.length === 0) {
      throw new Error(`commitNewBanForBook: unknown scope slug '${input.scope_slug}'`)
    }
    const scopeId = scopeRes.rows[0].id as number

    const existing = await pg.query(
      `select id from bans
       where book_id = $1
         and country_code = $2
         and year_started = $3
         and scope_id = $4
       limit 1`,
      [input.book_id, input.country_code, input.year, scopeId],
    )

    let banId: number
    let created: boolean
    if (existing.rows.length > 0) {
      banId = existing.rows[0].id as number
      created = false
    } else {
      const description = capDescription(input.description_ban)
      const ins = await pg.query(
        `insert into bans (book_id, country_code, scope_id, action_type, status,
                           year_started, year_ended, description)
         values ($1, $2, $3, $4, $5, $6, null, $7)
         returning id`,
        [
          input.book_id,
          input.country_code,
          scopeId,
          input.action_type,
          input.ban_status,
          input.year,
          description,
        ],
      )
      banId = ins.rows[0].id as number
      created = true
    }

    const reasonRes = await pg.query(
      'select id from reasons where slug = $1',
      [input.reason_slug],
    )
    if (reasonRes.rows.length === 0) {
      throw new Error(`commitNewBanForBook: unknown reason slug '${input.reason_slug}'`)
    }
    const reasonId = reasonRes.rows[0].id as number

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

    await pg.query(
      `insert into ban_source_links (ban_id, source_id) values ($1, $2)
       on conflict do nothing`,
      [banId, sourceId],
    )
    await pg.query(
      `insert into ban_reason_links (ban_id, reason_id) values ($1, $2)
       on conflict do nothing`,
      [banId, reasonId],
    )

    await pg.query('COMMIT')
    return { ban_id: banId, created }
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
