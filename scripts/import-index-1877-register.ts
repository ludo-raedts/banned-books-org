#!/usr/bin/env tsx
/**
 * Load the Index Librorum Prohibitorum 1877 REGISTER list: the 1,118 entries
 * the full-book import held back (no reliable decree year in the OCR, author not
 * identifiable), built by scripts/build-index-1877-register.ts into the gitignored
 * data/index-1877/register-<date>.json. No book/author rows — register only
 * (supabase/migrations/20261110100000_register_lists.sql). The other ~4,780 Index
 * titles are full books (see /contexts/index-librorum-prohibitorum).
 *
 * Idempotent: list upserted on slug, entries on (list_id, source_key); counts are
 * denormalised into register_lists here (nothing is triggered).
 *
 *   npx tsx --env-file=.env.local scripts/import-index-1877-register.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/import-index-1877-register.ts --apply
 */
import { readFileSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { flagValue, isApply } from './lib/cli'
import { INDEX_1877_SOURCE_URL } from './build-index-1877-stage0'
import type { RegisterEntry } from './build-index-1877-register'

const APPLY = isApply()
const DATE = flagValue('date') ?? '2026-11-10'

export const INDEX_1877_LIST = {
  slug: 'index-1877',
  title: 'Index librorum prohibitorum … Pii IX Pont. Max. iussu editus (Romae 1877)',
  title_en: 'Index of Prohibited Books (1877 edition)',
  issuer: 'Holy See — Sacred Congregation of the Index',
  country_code: 'VA',
  year_start: 1877,
  year_end: null,
  framing: 'religious',
  source_name: 'Index librorum prohibitorum (Rome, 1877; complete to 1876), scan on the Internet Archive',
  source_url: INDEX_1877_SOURCE_URL,
  licence_note: 'Published 1877 — public domain. Entries transcribed from the Internet Archive OCR; page numbers are the printed pages (±1 where the OCR lost the page header).',
  page_url_template: `${INDEX_1877_SOURCE_URL}/page/{page}/mode/1up`,
  intro_md: `The 1877 edition of the *Index Librorum Prohibitorum* lists every book the Catholic Church still forbade Catholics to read, print or keep, from the Tridentine Index of 1564 up to decrees of 1876. About 4,780 of its titles have their own page in this catalogue.

The entries below are the rest: titles whose decree date or author could not be read reliably from the scanned text. They are listed as printed — author names in the Index's own (often Latinised, sometimes garbled) spelling — with a link to the page of the original. Where no date is given, the title was on the Index by 1877.

These entries are not counted in our banned-books totals.`,
} as const

// Same work already in the catalogue with its VA ban (held as exact slug hits, checked by hand).
const MATCHED: Record<string, number> = { 'seq-2823': 6693, 'seq-2825': 6688 }

async function main() {
  const entries: RegisterEntry[] = JSON.parse(readFileSync(`data/index-1877/register-${DATE}.json`, 'utf8'))
  const rows = entries.map(e => ({ ...e, source_url: null as string | null, matched_book_id: MATCHED[e.source_key] ?? null }))
  console.log(`register rows ${rows.length} (book ${rows.filter(r => r.kind === 'book').length}, blanket ${rows.filter(r => r.kind === 'blanket').length}, matched ${rows.filter(r => r.matched_book_id).length})`)

  const pg = newPgClient()
  await pg.connect()
  try {
    await pg.query(APPLY ? 'BEGIN' : 'BEGIN READ ONLY')
    const before = (await pg.query(`select (select count(*) from register_lists)::int lists, (select count(*) from register_entries)::int entries,
      (select count(*) from register_entries e join register_lists l on l.id=e.list_id where l.slug=$1)::int index_entries`, [INDEX_1877_LIST.slug])).rows[0]
    console.log('before', before)
    for (const [k, id] of Object.entries(MATCHED)) {
      const b = (await pg.query(`select title, exists(select 1 from bans where book_id=$1 and country_code='VA') va from books where id=$1`, [id])).rows[0]
      if (!b?.va) throw new Error(`matched book #${id} for ${k} missing or without VA ban`)
    }
    if (!APPLY) { await pg.query('ROLLBACK'); console.log('dry-run: nothing written (pass --apply)'); return }

    const L = INDEX_1877_LIST
    const listId = (await pg.query(
      `insert into register_lists (slug, title, title_en, issuer, country_code, year_start, year_end, framing, intro_md, source_name, source_url, licence_note, page_url_template)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict (slug) do update set title=excluded.title, title_en=excluded.title_en, issuer=excluded.issuer,
         country_code=excluded.country_code, year_start=excluded.year_start, year_end=excluded.year_end, framing=excluded.framing,
         intro_md=excluded.intro_md, source_name=excluded.source_name, source_url=excluded.source_url,
         licence_note=excluded.licence_note, page_url_template=excluded.page_url_template, updated_at=now()
       returning id`,
      [L.slug, L.title, L.title_en, L.issuer, L.country_code, L.year_start, L.year_end, L.framing, L.intro_md, L.source_name, L.source_url, L.licence_note, L.page_url_template],
    )).rows[0].id as number
    const cols = ['source_key', 'edition', 'kind', 'letter', 'sort_key', 'printed_author', 'author_display', 'title', 'ban_year', 'note', 'source_url', 'printed_page', 'locator', 'matched_book_id'] as const
    for (let i = 0; i < rows.length; i += 500) {
      const params: unknown[] = []
      const values = rows.slice(i, i + 500).map(r => `(${[listId, ...cols.map(c => r[c])].map(v => { params.push(v); return `$${params.length}` }).join(',')})`)
      await pg.query(
        `insert into register_entries (list_id, ${cols.join(', ')}) values ${values.join(',')}
         on conflict (list_id, source_key) do update set ${cols.filter(c => c !== 'source_key').map(c => `${c}=excluded.${c}`).join(', ')}`,
        params,
      )
    }
    await pg.query(
      `update register_lists l set
         entry_count   = (select count(*) from register_entries e where e.list_id=l.id and e.kind in ('book','blanket')),
         book_count    = (select count(*) from register_entries e where e.list_id=l.id and e.kind='book'),
         matched_count = (select count(*) from register_entries e where e.list_id=l.id and e.matched_book_id is not null),
         updated_at = now()
       where l.id=$1`, [listId])
    await pg.query('COMMIT')
    const after = (await pg.query(`select l.id, l.slug, l.entry_count, l.book_count, l.matched_count, (select count(*) from register_entries e where e.list_id=l.id)::int total,
      (select count(*) from register_entries)::int all_entries from register_lists l where l.id=$1`, [listId])).rows[0]
    console.log('after', after)
  } catch (e) {
    await pg.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    await pg.end()
  }
}

if (process.argv[1]?.endsWith('import-index-1877-register.ts')) main().catch(e => { console.error(e); process.exit(1) })
