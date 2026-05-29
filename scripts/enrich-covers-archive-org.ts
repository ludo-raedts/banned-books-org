/**
 * Set cover_url for books that already have an archive_org_id but no cover.
 *
 * Re-uses the matches that scripts/enrich-archive-org.ts already produced —
 * archive.org/services/img/<id> serves a 200 image/jpeg directly (no redirect,
 * no auth), so we only need a small HEAD check before writing.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-covers-archive-org.ts            # dry-run
 *   npx tsx --env-file=.env.local scripts/enrich-covers-archive-org.ts --apply    # write
 *   npx tsx --env-file=.env.local scripts/enrich-covers-archive-org.ts --apply --limit=10
 */
import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'

const APPLY = process.argv.includes('--apply')
const LIMIT = (() => {
  const a = process.argv.find(x => x.startsWith('--limit='))
  return a ? parseInt(a.split('=')[1], 10) : null
})()
const DELAY_MS = 500
const MIN_BYTES = 1500  // archive.org's "no cover" placeholder is ~1.2KB; real covers are 10KB+

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const sb = adminClient()
  const { data, error } = await sb
    .from('books')
    .select('id, slug, title, archive_org_id')
    .not('archive_org_id', 'is', null)
    .is('cover_url', null)
    .order('id')
  if (error) { console.error(error); process.exit(1) }

  const rows = (data ?? []).slice(0, LIMIT ?? undefined)
  console.log(`${APPLY ? 'Processing' : '[dry-run]'} ${rows.length} candidate(s)\n`)

  let found = 0, rejected = 0, errored = 0

  for (const b of rows as Array<{ id: number; slug: string; title: string; archive_org_id: string }>) {
    const url = `https://archive.org/services/img/${encodeURIComponent(b.archive_org_id)}`
    if (!isAllowedImageUrl(url)) {
      console.log(`  ✗ ${b.slug}: URL not allowlisted (shouldn't happen)`)
      errored++
      continue
    }

    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
      const ct = res.headers.get('content-type') ?? ''
      const cl = parseInt(res.headers.get('content-length') ?? '0', 10)
      if (!res.ok || !ct.startsWith('image/') || cl < MIN_BYTES) {
        console.log(`  – ${b.slug}: ${res.status} ${ct} ${cl}B`)
        rejected++
        await sleep(DELAY_MS)
        continue
      }

      if (APPLY) {
        const { error: ue } = await sb
          .from('books')
          .update({
            cover_url: url,
            cover_status: 'valid',
            cover_checked_at: new Date().toISOString(),
          })
          .eq('id', b.id)
          .is('cover_url', null)
        if (ue) { console.log(`  ✗ ${b.slug}: ${ue.message}`); errored++ }
        else { console.log(`  ✓ ${b.slug} → ${url} (${cl}B)`); found++ }
      } else {
        console.log(`  ✓ ${b.slug} → ${url} (${cl}B) [dry-run]`)
        found++
      }
    } catch (e) {
      console.log(`  ✗ ${b.slug}: ${e instanceof Error ? e.message : String(e)}`)
      errored++
    }

    await sleep(DELAY_MS)
  }

  console.log(`\nDone. found=${found} rejected=${rejected} errored=${errored}`)
  if (!APPLY) console.log('Re-run with --apply to persist.')
}

main().catch(e => { console.error(e); process.exit(1) })
