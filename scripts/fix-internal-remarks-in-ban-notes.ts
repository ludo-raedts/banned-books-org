#!/usr/bin/env tsx
/**
 * Strip an importer's working remark from public ban notes.
 *
 * WHY: 28 ban notes (bans.description) end with a sentence the import wrote
 * for its own review step — "Adds a Poland ban to the existing record." —
 * and it was stored with the note. The note is public: it shows in the bans
 * table and, when a book has no vetted ban text, as the lead under "Why it was
 * banned" (1984 read "…treated as a serious offence. Adds a Poland ban to the
 * existing record."). Found while checking the pages after the UX review of
 * 2026-11-11.
 *
 * HOW: remove the sentence that matches
 *   Adds a|an <…> to the existing record[ (which already holds …)].
 * and nothing else. Where the remark is followed by "; <more>", the rest is
 * kept as its own sentence ("…; exact ban year not specified in the register."
 * → "Exact ban year not specified in the register."). A note that would become
 * empty is left alone and reported.
 *
 * Idempotent. Backup of every touched note in data/ on --apply; the touched
 * book pages are busted afterwards.
 *
 *   pnpm tsx --env-file=.env.local scripts/fix-internal-remarks-in-ban-notes.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-internal-remarks-in-ban-notes.ts --apply
 */
import { writeFileSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'
import { bustChangedPages } from './lib/revalidate'

const APPLY = isApply()
const REMARK_WITH_TAIL = /Adds an? [^.;(]{0,80} to the existing record;\s*(\w)/
const REMARK = /\s*Adds an? [^.;(]{0,80} to the existing record(\s*\([^)]*\))?\.?/

function clean(note: string): string {
  return note
    .replace(REMARK_WITH_TAIL, (_m, first: string) => first.toUpperCase())
    .replace(REMARK, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

async function main() {
  const pg = newPgClient()
  await pg.connect()
  try {
    await pg.query(APPLY ? 'BEGIN' : 'BEGIN READ ONLY')
    const { rows } = await pg.query<{ id: number; description: string; slug: string }>(
      `select bn.id, bn.description, b.slug from bans bn join books b on b.id = bn.book_id
        where bn.description ~ 'Adds an? [^.]{0,80} to the existing record' order by bn.id`,
    )
    const changes = rows
      .map(r => ({ ...r, cleaned: clean(r.description) }))
      .filter(r => r.cleaned !== r.description.trim())
    const emptied = changes.filter(c => c.cleaned.length === 0)
    const todo = changes.filter(c => c.cleaned.length > 0)
    console.log(`Ban notes carrying the remark: ${rows.length}; to clean: ${todo.length}; would become empty (left alone): ${emptied.length}; unchanged by the pattern (left alone): ${rows.length - changes.length}`)
    for (const id of [29486, 29587, 29693]) {
      const c = todo.find(x => Number(x.id) === id)
      if (c) console.log(`  #${c.id}: …${c.cleaned.slice(-110)}`)
    }
    for (const c of todo.slice(0, 3)) console.log(`  #${c.id} ${c.slug}: …${c.cleaned.slice(-70)}`)

    if (!APPLY) {
      await pg.query('ROLLBACK')
      console.log('\nDry-run: nothing written. Re-run with --apply.')
      return
    }
    const at = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const backupPath = `data/fix-internal-remarks-in-ban-notes-backup-${at}.json`
    writeFileSync(backupPath, JSON.stringify(todo.map(({ id, description }) => ({ id, description })), null, 2))
    let n = 0
    for (const c of todo) {
      const res = await pg.query(`update bans set description = $2 where id = $1 and description = $3`, [c.id, c.cleaned, c.description])
      n += res.rowCount ?? 0
    }
    await pg.query('COMMIT')
    console.log(`\nApplied: ${n} ban notes cleaned. Backup: ${backupPath}`)
    await bustChangedPages({ bookSlugs: [...new Set(todo.map(c => c.slug))], authorSlugs: [] })
  } catch (err) {
    await pg.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    await pg.end()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
