#!/usr/bin/env tsx
/**
 * ONE-TIME, DESTRUCTIVE: block (Bucket A) the two CSAM-adjacent works per
 * docs/editorial/csam-adjacent-policy.md.
 *
 * 1. Targeted backup of all affected rows -> ~/Documents/banned-books-backups/.
 * 2. Transactional (pg BEGIN/COMMIT): insert blocked_works rows, then
 *    DELETE FROM books (cascades to bans, ban_*_links, book_authors,
 *    book_slug_aliases, purchase_links — all ON DELETE CASCADE).
 *
 * Author rows are intentionally NOT deleted (book_authors is the join; the
 * authors table is shared and not cascaded).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1)
  }
}
loadEnvLocal()

const TARGETS = [
  {
    id: 6516,
    slug: 'david-hamiltons-private-collection',
    title: "David Hamilton's Private Collection",
    reason:
      'Posthumous abuse allegations by former models concerning the production of the work (CSAM-adjacent policy, trigger 2).',
  },
  {
    id: 755,
    slug: 'total-abuse-peter-sotos',
    title: 'Total Abuse',
    reason:
      'Maker convicted of CSAM possession; the material recurs in and is the subject of the work (CSAM-adjacent policy, triggers 3 & 4).',
  },
]

async function main() {
  const ids = TARGETS.map(t => t.id)
  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()

  // ── 1. Targeted backup ──────────────────────────────────────────────────
  const books = (await sb.from('books').select('*').in('id', ids)).data ?? []
  if (books.length !== ids.length) {
    throw new Error(`expected ${ids.length} books, found ${books.length} — aborting before any write`)
  }
  const bans = (await sb.from('bans').select('*').in('book_id', ids)).data ?? []
  const banIds = bans.map((b: { id: number }) => b.id)
  const reasonLinks = banIds.length ? (await sb.from('ban_reason_links').select('*').in('ban_id', banIds)).data ?? [] : []
  const sourceLinks = banIds.length ? (await sb.from('ban_source_links').select('*').in('ban_id', banIds)).data ?? [] : []
  const bookAuthors = (await sb.from('book_authors').select('*').in('book_id', ids)).data ?? []
  const aliases = (await sb.from('book_slug_aliases').select('*').in('book_id', ids)).data ?? []
  const purchaseLinks = (await sb.from('purchase_links').select('*').in('book_id', ids)).data ?? []

  const backup = {
    exported_at: new Date().toISOString(),
    note: 'Targeted backup before CSAM Bucket A block. Restore by re-inserting these rows.',
    targets: TARGETS,
    books, bans, ban_reason_links: reasonLinks, ban_source_links: sourceLinks,
    book_authors: bookAuthors, book_slug_aliases: aliases, purchase_links: purchaseLinks,
  }
  const dir = join(homedir(), 'Documents', 'banned-books-backups')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'csam-block-2026-05-29.json')
  writeFileSync(file, JSON.stringify(backup, null, 2))
  console.log(`backup written: ${file}`)
  console.log(
    `  books=${books.length} bans=${bans.length} reasonLinks=${reasonLinks.length} ` +
    `sourceLinks=${sourceLinks.length} bookAuthors=${bookAuthors.length} aliases=${aliases.length} purchaseLinks=${purchaseLinks.length}`,
  )

  // ── 2. Transactional delete ─────────────────────────────────────────────
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  const { Client } = await import('pg')
  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query('BEGIN')
    for (const t of TARGETS) {
      await client.query(
        `INSERT INTO blocked_works (slug, title, reason) VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, reason = EXCLUDED.reason`,
        [t.slug, t.title, t.reason],
      )
    }
    const del = await client.query('DELETE FROM books WHERE id = ANY($1::bigint[])', [ids])
    console.log(`deleted books rows: ${del.rowCount} (cascades to bans/links/joins/aliases)`)
    await client.query('COMMIT')
    console.log('committed.')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('rolled back:', e)
    throw e
  } finally {
    await client.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
