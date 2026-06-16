#!/usr/bin/env tsx
/**
 * Merge cross-language (different-script) duplicate records: a foreign-language
 * ban import (Russia FSEM) created fresh author/book rows keyed on the Cyrillic
 * name/title instead of matching the existing canonical English record.
 *
 * Two confirmed cases — and they are TWO DIFFERENT shapes:
 *
 *  A. Anton LaVey — author-dupe AND work-dupe.
 *       book  DROP #14340 "Сатанинская Библия" (slug sataninskaya-bibliya, RU ban)
 *             → KEEP #6361 "The Satanic Bible" (ISBN+OL+desc, ZA ban)
 *       author DROP #9639 "Антон Шандор ЛаВей" → KEEP #4433 "Anton LaVey"
 *     The Russian book IS the same work → fold the book (migrate the RU ban +
 *     keep the old URL as an alias), then fold the author.
 *
 *  B. Li Hongzhi — author-dupe ONLY.
 *       author DROP #9637 "Ли Хунчжи" → KEEP #190 "Li Hongzhi"
 *     His two Russian books (#14333/#14334, Essentials of Diligent Practice) are
 *     genuinely DIFFERENT works from Zhuan Falun (#171) — they are re-pointed to
 *     the unified author and KEPT as distinct books. No book merge.
 *
 * Doctrine (refs: scripts/archive/merge-orwell-1984-dupes.ts for the book merge;
 * scripts/archive/merge-vs-naipaul-authors.ts for the author merge + slug alias;
 * memory "Merge order: DELETE dupe before enrich on unique fields"):
 *   book merge:   migrate bans (dedup country+scope), re-point book_slug_aliases
 *                 + add DROP.slug as legacy alias, enrich KEEP's language-NEUTRAL
 *                 nulls only, DELETE DROP (CASCADE).
 *   author merge: re-point book_authors (delete on PK clash), union awards,
 *                 enrich KEEP's language-NEUTRAL nulls only, author_slug_aliases
 *                 (DROP.slug→KEEP), DELETE DROP (CASCADE).
 *   NB: title, name, original_language and description fields are NEVER copied
 *   from a foreign DROP — they describe the translation, not the canonical work.
 * Whole run is ONE transaction under --apply. Idempotent: gone rows = no-op.
 *
 *   pnpm tsx --env-file=.env.local scripts/merge-cross-language-dupes.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/merge-cross-language-dupes.ts --apply
 */
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()

// Tables holding a *curated* selection of books. If a DROP book sits in one of
// these, a blind CASCADE delete would silently drop an editorial pick — abort.
const CURATED_BOOK_TABLES = [
  'bbw_featured_selections', 'reading_club_classics', 'reading_club_currently_challenged',
  'reading_club_international', 'reading_club_theme_books', 'reading_club_young_readers',
]

type Ban = { id: number; country_code: string; scope_id: number | null; year_started: number | null }
const banKey = (b: Ban) => `${b.country_code}|${b.scope_id ?? ''}`

async function getBans(pg: Client, bookId: number): Promise<Ban[]> {
  const { rows } = await pg.query<Ban>(
    `select id, country_code, scope_id, year_started from bans where book_id = $1 order by country_code`,
    [bookId])
  return rows
}

async function curatedRefs(pg: Client, bookId: number): Promise<string[]> {
  const hits: string[] = []
  for (const t of CURATED_BOOK_TABLES) {
    const { rows } = await pg.query(`select 1 from ${t} where book_id = $1 limit 1`, [bookId])
    if (rows.length) hits.push(t)
  }
  return hits
}

type Award = { award: string; category?: string; year: number }
function mergeAwards(keep: unknown, drop: unknown): Award[] {
  const arr = (x: unknown): Award[] => (Array.isArray(x) ? (x as Award[]) : [])
  const seen = new Set<string>(); const out: Award[] = []
  for (const a of [...arr(keep), ...arr(drop)]) {
    if (!a || typeof a.award !== 'string' || typeof a.year !== 'number') continue
    const k = `${a.award}|${a.category ?? ''}|${a.year}`
    if (seen.has(k)) continue
    seen.add(k); out.push(a)
  }
  return out.sort((a, b) => a.year - b.year)
}

// CROSS-LANGUAGE ENRICH SAFETY: the DROP row came from a foreign ban source, so
// its title_*/name_*/original_language/description_* describe the TRANSLATION, not
// the work's original form (The Satanic Bible is English; "Сатанинская Библия" is
// a Russian edition title, "Антон Шандор ЛаВей" a Russian transliteration). Copying
// any of those onto the canonical record mislabels a translation as the original.
// So enrich ONLY from language-neutral fields the canonical row genuinely lacks.
const BOOK_ENRICH = ['first_published_year', 'isbn13', 'openlibrary_work_id',
  'cover_url', 'archive_org_id', 'gutenberg_id'] as const

const AUTHOR_ENRICH = ['birth_year', 'death_year', 'birth_country', 'photo_url',
  'openlibrary_author_id'] as const

/** Book merge: DROP → KEEP. Foreign DROP contributes only its ban + URL alias. */
async function mergeBook(pg: Client, KEEP: number, DROP: number) {
  const keepRow = (await pg.query(`select * from books where id=$1`, [KEEP])).rows[0]
  const dropRow = (await pg.query(`select * from books where id=$1`, [DROP])).rows[0]
  if (!dropRow) { console.log(`  [book] DROP #${DROP} already gone — no-op.`); return }
  if (!keepRow) throw new Error(`[book] KEEP #${KEEP} not found`)
  console.log(`\n[book] KEEP #${KEEP} "${keepRow.title}" ← DROP #${DROP} "${dropRow.title}"`)

  const curated = await curatedRefs(pg, DROP)
  if (curated.length) throw new Error(`[book] DROP #${DROP} is referenced by curated table(s): ${curated.join(', ')} — abort.`)

  // NB: the Russian title ("Сатанинская Библия") is deliberately NOT carried onto
  // KEEP — KEEP is the English original, and title_native means the work's native
  // title, not a translation. The DROP slug is preserved as an alias instead (3),
  // so /books/sataninskaya-bibliya still resolves to the canonical record.

  // 1. Migrate bans (dedup on country+scope). Clean MOVE re-points book_id; links travel with ban_id.
  const [keepBans, dropBans] = await Promise.all([getBans(pg, KEEP), getBans(pg, DROP)])
  const keepKeys = new Set(keepBans.map(banKey))
  for (const b of dropBans) {
    if (keepKeys.has(banKey(b))) {
      // Same country+scope already on KEEP → union links onto KEEP's ban, drop this one via cascade.
      const match = keepBans.find(k => banKey(k) === banKey(b))!
      console.log(`  ban ${b.id} ${b.country_code}/scope=${b.scope_id}: DUP of KEEP ban ${match.id} → union links, drop via cascade`)
      if (APPLY) {
        await pg.query(`insert into ban_source_links(ban_id,source_id,locator) select $1,source_id,locator from ban_source_links where ban_id=$2 on conflict do nothing`, [match.id, b.id])
        await pg.query(`insert into ban_reason_links(ban_id,reason_id) select $1,reason_id from ban_reason_links where ban_id=$2 on conflict do nothing`, [match.id, b.id])
      }
    } else {
      console.log(`  ban ${b.id} ${b.country_code}/scope=${b.scope_id}: MOVE → KEEP`)
      if (APPLY) await pg.query(`update bans set book_id=$1 where id=$2`, [KEEP, b.id])
      keepKeys.add(banKey(b))
    }
  }

  // 2. Slug aliases: re-point DROP's aliases, add DROP.slug as legacy alias.
  if (APPLY) await pg.query(`update book_slug_aliases set book_id=$1 where book_id=$2`, [KEEP, DROP])
  if (dropRow.slug && dropRow.slug !== keepRow.slug) {
    console.log(`  alias add legacy "${dropRow.slug}" → KEEP`)
    if (APPLY) await pg.query(`insert into book_slug_aliases(slug,book_id,source) values($1,$2,'legacy_slug') on conflict do nothing`, [dropRow.slug, KEEP])
  }

  // 3. Enrich KEEP's NULL scalars from DROP (KEEP-set wins). Note: description_ban
  //    is intentionally NOT enriched — KEEP's covers only the ZA ban; it now needs
  //    a regen to mention RU too. Flagged below, not silently overwritten.
  const enrich: Record<string, unknown> = {}
  for (const f of BOOK_ENRICH) if (keepRow[f] == null && dropRow[f] != null) enrich[f] = dropRow[f]
  if (Object.keys(enrich).length) {
    console.log(`  enrich KEEP nulls: ${Object.keys(enrich).join(', ')}`)
    if (APPLY) await pg.query(`update books set ${Object.keys(enrich).map((k, i) => `${k}=$${i + 2}`).join(', ')} where id=$1`, [KEEP, ...Object.values(enrich)])
  }
  console.log(`  ⚠ KEEP.description_ban still describes ZA only — regenerate to include the RU ban.`)

  // 4. Delete DROP (CASCADE removes its book_authors, search-attempt logs, purchase_links).
  console.log(`  DELETE book #${DROP} (CASCADE)`)
  if (APPLY) await pg.query(`delete from books where id=$1`, [DROP])
}

/** Author merge: DROP → KEEP. Books kept as-is, just re-pointed. */
async function mergeAuthor(pg: Client, KEEP: number, DROP: number) {
  const keep = (await pg.query(`select * from authors where id=$1`, [KEEP])).rows[0]
  const drop = (await pg.query(`select * from authors where id=$1`, [DROP])).rows[0]
  if (!drop) { console.log(`  [author] DROP #${DROP} already gone — no-op.`); return }
  if (!keep) throw new Error(`[author] KEEP #${KEEP} not found`)
  console.log(`\n[author] KEEP #${KEEP} "${keep.display_name}" ← DROP #${DROP} "${drop.display_name}"`)

  // 1. Re-point book_authors (delete DROP's row on PK clash).
  const dropLinks = (await pg.query(`select book_id, role from book_authors where author_id=$1`, [DROP])).rows
  const keepBooks = new Set((await pg.query(`select book_id from book_authors where author_id=$1`, [KEEP])).rows.map((r: any) => r.book_id))
  for (const l of dropLinks) {
    if (keepBooks.has(l.book_id)) {
      console.log(`  book ${l.book_id}: KEEP already linked → delete DROP row`)
      if (APPLY) await pg.query(`delete from book_authors where author_id=$1 and book_id=$2`, [DROP, l.book_id])
    } else {
      console.log(`  book ${l.book_id}: re-point → KEEP (role=${l.role})`)
      if (APPLY) await pg.query(`update book_authors set author_id=$1 where author_id=$2 and book_id=$3`, [KEEP, DROP, l.book_id])
    }
  }

  // 2. awards union.
  const merged = mergeAwards(keep.awards, drop.awards)
  if (JSON.stringify(keep.awards ?? []) !== JSON.stringify(merged)) {
    console.log(`  awards: → ${JSON.stringify(merged)}`)
    if (APPLY) await pg.query(`update authors set awards=$1 where id=$2`, [JSON.stringify(merged), KEEP])
  }

  // 3. enrich KEEP's language-NEUTRAL nulls only (dates/country/photo/IDs); never names.
  const enrich: Record<string, unknown> = {}
  for (const f of AUTHOR_ENRICH) if (keep[f] == null && drop[f] != null) enrich[f] = drop[f]
  if (Object.keys(enrich).length) {
    console.log(`  enrich KEEP nulls: ${Object.keys(enrich).join(', ')}`)
    if (APPLY) await pg.query(`update authors set ${Object.keys(enrich).map((k, i) => `${k}=$${i + 2}`).join(', ')} where id=$1`, [KEEP, ...Object.values(enrich)])
  }

  // 4. slug alias so DROP's old URL resolves → KEEP.
  if (drop.slug && drop.slug !== keep.slug) {
    const clash = (await pg.query(`select id from authors where slug=$1 and id<>$2`, [drop.slug, DROP])).rows[0]
    if (clash) console.log(`  alias: SKIP — slug "${drop.slug}" owned by author #${clash.id}`)
    else {
      console.log(`  alias: "${drop.slug}" → KEEP`)
      if (APPLY) await pg.query(`insert into author_slug_aliases(slug,author_id,source) values($1,$2,'merge') on conflict(slug) do nothing`, [drop.slug, KEEP])
    }
  }

  // 5. delete DROP (CASCADE).
  console.log(`  DELETE author #${DROP} (CASCADE)`)
  if (APPLY) await pg.query(`delete from authors where id=$1`, [DROP])
}

async function main() {
  const pg = newPgClient()
  await pg.connect()
  console.log(`── merge-cross-language-dupes ── (${APPLY ? 'APPLY' : 'DRY-RUN'})`)
  try {
    if (APPLY) await pg.query('begin')
    // Case A: LaVey — book first (so its book_authors cascades), then author.
    await mergeBook(pg, 6361, 14340)
    await mergeAuthor(pg, 4433, 9639)
    // Case B: Li Hongzhi — author only; books #14333/#14334 kept as distinct works.
    await mergeAuthor(pg, 190, 9637)
    if (APPLY) { await pg.query('commit'); console.log(`\nApplied (single transaction).`) }
    else console.log(`\nDry-run — re-run with --apply.`)
  } catch (err) {
    if (APPLY) { try { await pg.query('rollback'); console.error('Rolled back.') } catch { /* */ } }
    throw err
  } finally {
    await pg.end()
  }
}
main().catch(e => { console.error('FAILED:', e); process.exit(1) })
