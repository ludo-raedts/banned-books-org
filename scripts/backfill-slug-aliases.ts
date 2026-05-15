#!/usr/bin/env tsx
/**
 * Phase 3c: Populate book_slug_aliases from each book's alternate-title
 * variants. Used after the multilingual title schema (Phase 0a/0b/0c) lands.
 *
 * Sources, in priority order:
 *   - 'title':                    slug of the current canonical title — only
 *                                 inserts when it differs from books.slug
 *                                 (covers Phase 0c year-stripping cases like
 *                                 id=6348 with slug 'frankenstein-1818' and
 *                                 title 'Frankenstein').
 *   - 'title_english_meaningful': slug of the English-meaning variant.
 *   - 'title_native':             slug of the native-script form (rarely
 *                                 useful since most rows have native = title,
 *                                 but covers cases like id=6325 Tamil).
 *   - 'title_transliterated':     slug of the romanized form.
 *
 * Skip rules per candidate:
 *   1. Empty slug after slugify (e.g. native = "मीन्डेझुम").
 *   2. slug === books.slug (already canonical, no alias needed).
 *   3. slug already used as another book's canonical (`books.slug` collision).
 *   4. slug already exists in book_slug_aliases (idempotent re-run).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/backfill-slug-aliases.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/backfill-slug-aliases.ts --apply
 */
import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'

const APPLY = process.argv.includes('--apply')

type BookRow = {
  id: number
  slug: string
  title: string
  title_native: string | null
  title_transliterated: string | null
  title_english_meaningful: string | null
}

type Candidate = {
  book_id: number
  alias_slug: string
  source: 'title' | 'title_english_meaningful' | 'title_native' | 'title_transliterated'
  canonical_slug: string
}

async function main() {
  const sb = adminClient()
  console.log(`\n── backfill-slug-aliases (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  // Page through all books — there are <10k rows, so a single pass is fine.
  const all: BookRow[] = []
  const PAGE = 1000
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('books')
      .select('id, slug, title, title_native, title_transliterated, title_english_meaningful')
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as unknown as BookRow[]))
    offset += PAGE
    if (data.length < PAGE) break
  }
  console.log(`Books scanned: ${all.length}`)

  // Build candidate list
  const allBookSlugs = new Set(all.map(b => b.slug))
  const candidates: Candidate[] = []
  for (const b of all) {
    const sources: { value: string | null; source: Candidate['source'] }[] = [
      { value: b.title, source: 'title' },
      { value: b.title_english_meaningful, source: 'title_english_meaningful' },
      { value: b.title_native, source: 'title_native' },
      { value: b.title_transliterated, source: 'title_transliterated' },
    ]
    const seenPerBook = new Set<string>([b.slug])
    for (const { value, source } of sources) {
      if (!value) continue
      const aliasSlug = slugify(value)
      if (!aliasSlug) continue
      if (seenPerBook.has(aliasSlug)) continue
      if (allBookSlugs.has(aliasSlug)) continue  // would collide with another book's canonical
      seenPerBook.add(aliasSlug)
      candidates.push({ book_id: b.id, alias_slug: aliasSlug, source, canonical_slug: b.slug })
    }
  }

  console.log(`Candidate aliases: ${candidates.length}`)

  // Filter against existing book_slug_aliases.slug (idempotent skip)
  const { data: existing } = await sb.from('book_slug_aliases').select('slug')
  const existingSet = new Set((existing ?? []).map(r => r.slug as string))
  const fresh = candidates.filter(c => !existingSet.has(c.alias_slug))
  console.log(`After dedup vs book_slug_aliases: ${fresh.length} new`)

  // Detect intra-candidate collisions (multiple books would claim the same alias)
  const aliasCount = new Map<string, number>()
  for (const c of fresh) aliasCount.set(c.alias_slug, (aliasCount.get(c.alias_slug) ?? 0) + 1)
  const collisions = [...aliasCount.entries()].filter(([, n]) => n > 1)
  if (collisions.length) {
    console.log(`\n⚠ ${collisions.length} intra-candidate collisions (alias claimed by >1 book) — skipping all conflicting candidates:`)
    for (const [slug, n] of collisions.slice(0, 5)) {
      console.log(`  '${slug}' (${n} books)`)
    }
  }
  const collidingSlugs = new Set(collisions.map(([s]) => s))
  const insertable = fresh.filter(c => !collidingSlugs.has(c.alias_slug))
  console.log(`Insertable: ${insertable.length}`)

  console.log('\nSample (first 15):')
  for (const c of insertable.slice(0, 15)) {
    console.log(`  '${c.alias_slug}' → ${c.canonical_slug} (book_id=${c.book_id}, src=${c.source})`)
  }

  if (!APPLY) {
    console.log(`\nPass --apply to insert ${insertable.length} aliases.`)
    return
  }

  // Batch insert (chunked to stay under PostgREST limits).
  const CHUNK = 500
  let inserted = 0
  let errors = 0
  for (let i = 0; i < insertable.length; i += CHUNK) {
    const batch = insertable.slice(i, i + CHUNK).map(c => ({
      slug: c.alias_slug,
      book_id: c.book_id,
      source: c.source,
    }))
    const { error } = await sb
      .from('book_slug_aliases')
      .upsert(batch, { onConflict: 'slug', ignoreDuplicates: true })
    if (error) {
      console.error(`  chunk @${i}: ${error.message}`)
      errors++
    } else {
      inserted += batch.length
    }
  }
  console.log(`\nInserted: ${inserted}, batch errors: ${errors}`)
}

main().catch(e => { console.error(e); process.exit(1) })
