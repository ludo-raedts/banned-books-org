#!/usr/bin/env tsx
// One-off (2026-10-11): repair 7 garbled author names minted by the first
// Magnusson import (import-magnusson-delta.ts). Some came from the source
// ("lgnatiev"/"lnga"/"lngeborg" with a lowercase L for I, "E, Carl P." truncated
// from Eby, "Stirling Danie" reversed). Others came from our parser, which did
// not understand "Glaude, Jr., Eddie S." and has since been fixed
// (parseAuthors in build-magnusson-stage0.ts). Each author is renamed and
// re-slugged; the old slug becomes an author_slug_aliases row (source='rename').
//
// Usage: npx tsx --env-file=.env.local scripts/_fix_magnusson_author_names.ts [--apply]
import { newPgClient } from '../src/lib/wikipedia/importer'
import { slugify } from '../src/lib/imports/slugify'
import { isApply } from './lib/cli'

const APPLY = isApply()
const RENAMES: [number, string][] = [
  [17908, 'Eddie S. Glaude Jr.'],
  [17922, 'John Hartigan Jr.'],
  [17991, 'Noel Ignatiev'],
  [18058, 'Inga Muscio'],
  [18116, "Ingeborg Maier O'Sickey"],
  [17871, 'Carl P. Eby'],
  [18272, 'Danie Stirling'],
]

async function main() {
  const pg = newPgClient(); await pg.connect()
  await pg.query('BEGIN')
  try {
    for (const [id, name] of RENAMES) {
      const cur = (await pg.query('select slug, display_name from authors where id=$1', [id])).rows[0]
      if (!cur) { console.log(`∅ #${id} gone`); continue }
      const slug = slugify(name)
      const clash = (await pg.query('select id from authors where slug=$1 and id<>$2', [slug, id])).rows[0]
      if (clash) { console.log(`✗ #${id}: slug ${slug} owned by #${clash.id} — needs a merge, skipped`); continue }
      await pg.query('update authors set display_name=$2, slug=$3 where id=$1', [id, name, slug])
      if (cur.slug !== slug)
        await pg.query(`insert into author_slug_aliases (slug, author_id, source) values ($1,$2,'rename') on conflict (slug) do nothing`, [cur.slug, id])
      console.log(`#${id} "${cur.display_name}" → "${name}" (${cur.slug} → ${slug})`)
    }
    await pg.query(APPLY ? 'COMMIT' : 'ROLLBACK')
    console.log(APPLY ? 'Committed.' : 'Dry-run — re-run with --apply.')
  } catch (e) { await pg.query('ROLLBACK'); throw e } finally { await pg.end() }
}
main().catch(e => { console.error(e); process.exit(1) })
