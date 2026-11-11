/**
 * Set four hand-verified covers on Ashaari Muhammad's books (author id 8156).
 *
 * Each cover was inspected by eye on 2026-11-11 (front cover shows the title +
 * author name; not a copyright/title page). Candidates come from Google Books
 * volumes found via free-text search.
 *
 * Guards: only writes when the book still has NO cover_url and no cover_status,
 * and the title on the book row matches the expected one.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/fix-ashaari-covers.ts           # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-ashaari-covers.ts --apply
 */
import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { isApply } from './lib/cli'

const gb = (id: string) =>
  `https://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=1&source=gbs_api`

const PICKS = [
  { book_id: 12211, expect: 'Inilah Pandanganku', gb_id: 'mg4aAAAAIAAJ' },
  { book_id: 12217, expect: 'Perang Teluk', gb_id: '7hAeAAAAIAAJ' },
  { book_id: 12367, expect: 'Manusia Tidak Memiliki', gb_id: 'BDYaAAAAIAAJ' },
  { book_id: 12373, expect: 'Mengenal Diri', gb_id: 'O2xPCwAAQBAJ' },
]

async function main() {
  const APPLY = isApply()
  const sb = adminClient()
  console.log(APPLY ? 'MODE: APPLY' : 'MODE: dry-run (no writes)')

  const { data: before } = await sb
    .from('books')
    .select('id,title,cover_url,cover_status')
    .in('id', PICKS.map((p) => p.book_id))
  const byId = new Map((before ?? []).map((b) => [b.id as number, b]))

  let ok = 0
  for (const p of PICKS) {
    const row = byId.get(p.book_id)
    const url = gb(p.gb_id)
    const why: string[] = []
    if (!row) why.push('book row not found')
    else {
      if (!row.title.toLowerCase().includes(p.expect.toLowerCase())) why.push(`title mismatch: "${row.title}"`)
      if (row.cover_url) why.push('already has cover_url')
      if (row.cover_status) why.push(`cover_status=${row.cover_status}`)
    }
    if (!isAllowedImageUrl(url)) why.push('host not allowed')
    let bytes = 0
    try {
      const r = await fetch(url)
      const buf = Buffer.from(await r.arrayBuffer())
      bytes = buf.length
      if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) why.push(`fetch ${r.status}`)
      if (bytes < 2500) why.push(`image too small (${bytes} B, likely placeholder)`)
    } catch (e) {
      why.push(`fetch error: ${(e as Error).message}`)
    }
    const status = why.length ? `SKIP — ${why.join('; ')}` : 'OK'
    console.log(`#${p.book_id} "${row?.title}" ← ${p.gb_id} (${bytes} B): ${status}`)
    if (why.length) continue
    ok++
    if (APPLY) {
      const { error } = await sb
        .from('books')
        .update({ cover_url: url, cover_status: 'valid', cover_checked_at: new Date().toISOString() })
        .eq('id', p.book_id)
        .is('cover_url', null)
        .is('cover_status', null)
      if (error) throw error
    }
  }

  const { data: after } = await sb
    .from('books')
    .select('id,cover_url')
    .in('id', (await sb.from('book_authors').select('book_id').eq('author_id', 8156)).data!.map((x) => x.book_id as number))
  const withCover = (after ?? []).filter((b) => b.cover_url).length
  console.log(`\nwould-apply/applied: ${ok} of ${PICKS.length}`)
  console.log(`books of author 8156 with cover now: ${withCover} of ${after?.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
