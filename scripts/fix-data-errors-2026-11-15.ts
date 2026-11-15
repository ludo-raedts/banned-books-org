/**
 * One-off, 2026-11-15: correct three demonstrable data errors found in the Google-core
 * source sample (data/corrections/2026-11-15-data-errors.md has the evidence).
 *
 *   lenin-charasch (22511)  ISBN, blurb and cover belong to Resnick's 1987 juvenile "Lenin".
 *   gaibeus (717)           duplicate PT ban sourced only by a homepage; unsupported reason text.
 *   the-da-vinci-code (11)  wrong year (Iran), unsupported rows ("Source needed"), over-broad rationale.
 *
 * Dry-run by default; --apply writes. Every touched row is backed up (old values, links,
 * deleted rows in full) to data/corrections/2026-11-15-data-errors-backup.json BEFORE any write.
 * No historical claim is changed without a source: rows without proof get confidence='unverified'
 * plus the note "Source needed…", they are not deleted or re-dated.
 */
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'
import { bustPaths } from './lib/revalidate'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const APPLY = isApply()
const OUT = path.join(process.cwd(), 'data', 'corrections')
const NOW = new Date().toISOString()
const TODAY = NOW.slice(0, 10)
const db = adminClient()

const SOURCE_NEEDED = 'Source needed: the page cited for this ban does not record it.'

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, what: string): Promise<T> {
  const r = await p
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return r.data as T
}

async function findOrCreateSource(name: string, url: string, type: string): Promise<number> {
  const found = await must(db.from('ban_sources').select('id').eq('source_url', url).limit(1), 'find source')
  if (found && found.length) return found[0].id as number
  if (!APPLY) return -1
  const ins = await must(db.from('ban_sources').insert({ source_name: name, source_url: url, source_type: type, accessed_at: TODAY }).select('id').single(), 'create source')
  return (ins as { id: number }).id
}

async function addLink(banId: number, sourceId: number, locator: string) {
  console.log(`  + link ban ${banId} ← source ${sourceId} [${locator}]`)
  if (!APPLY) return
  const { error } = await db.from('ban_source_links').upsert({ ban_id: banId, source_id: sourceId, locator }, { onConflict: 'ban_id,source_id', ignoreDuplicates: true })
  if (error) throw new Error('addLink: ' + error.message)
}

async function main() {
  console.log(APPLY ? 'APPLY' : 'DRY-RUN')
  await fs.mkdir(OUT, { recursive: true })

  // ── 0. snapshot everything we will touch ────────────────────────────────────
  const bookIds = [22511, 717, 11]
  const banIds = [783, 40011, 17, 987, 6012, 13127, 959, 1018, 1019, 1134, 1135]
  const books = await must(db.from('books').select('*').in('id', bookIds), 'books snapshot')
  const bans = await must(db.from('bans').select('*').in('id', banIds), 'bans snapshot')
  const banLinks = await must(db.from('ban_source_links').select('*').in('ban_id', banIds), 'links snapshot')
  const reasonLinks = await must(db.from('ban_reason_links').select('*').in('ban_id', banIds), 'reason links snapshot')
  const backup = { takenAt: NOW, books, bans, ban_source_links: banLinks, ban_reason_links: reasonLinks }
  const backupFile = path.join(OUT, '2026-11-15-data-errors-backup.json')
  if (APPLY) { await fs.writeFile(backupFile, JSON.stringify(backup, null, 1)); console.log('backup →', path.relative(process.cwd(), backupFile)) }

  // ── 1. Lenin (Charasch) ─────────────────────────────────────────────────────
  // Evidence: OL work OL3473223W = Abraham Resnick, "Lenin", 1987, juvenile; its OL description is the
  // blurb verbatim; ISBN 9780516032603 = Resnick, Children's Press 1987; the cover is that ISBN's Google
  // Books cover. The Charasch 1920 ban (Berlin list) is correct and untouched.
  console.log('\n[1] lenin-charasch')
  const lenin = {
    isbn13: null, isbn_status: 'not_found', isbn_checked_at: NOW,
    description_book: null, description_source_url: null, description_source_type: null,
    cover_url: null, cover_status: 'rejected_placeholder', cover_checked_at: NOW,
    // 'flagged' = enrichment (descriptions v1/v2) skips the row; isbn_checked_at + cover_status pin the rest.
    data_quality_status: 'flagged',
  }
  console.log('  set', JSON.stringify(lenin))
  if (APPLY) await must(db.from('books').update(lenin).eq('id', 22511).select('id'), 'lenin update')

  // ── 2. Gaibéus ──────────────────────────────────────────────────────────────
  // Ban 783 (PT, no year, only source = Index on Censorship homepage) duplicates ban 40011 (PT 1940,
  // Brandão list). Doctrine (scripts/README "Ban-merges"): KEEP 40011, union source + reason links,
  // DELETE 783. The homepage link is carried over with a locator saying what it is.
  console.log('\n[2] gaibeus')
  await addLink(40011, 564, 'carried over from merged duplicate ban #783 (2026-11-15): site homepage, not case-specific evidence')
  // 783's reason link (no source stated it: basis NULL on an AI-era row) is NOT carried to the survivor;
  // it stays in the backup file. Reasons must come from a source, not from a duplicate.
  for (const rl of reasonLinks.filter((r: { ban_id: number }) => r.ban_id === 783)) console.log('  (reason link dropped, kept in backup)', JSON.stringify(rl))
  console.log('  delete ban 783 (+ its links); description_ban nulled; inclusion_rationale re-written from the Brandão listing only')
  if (APPLY) {
    await must(db.from('ban_source_links').delete().eq('ban_id', 783).select('ban_id'), 'del links 783')
    await must(db.from('ban_reason_links').delete().eq('ban_id', 783).select('ban_id'), 'del reason links 783')
    await must(db.from('bans').delete().eq('id', 783).select('id'), 'del ban 783')
    await must(db.from('books').update({
      description_ban: null, description_ban_status: null,
      inclusion_rationale: 'Listed in José Brandão\'s compilation of books prohibited under the Estado Novo (1933–74), marked with a special prohibition; the year given (1940) is Brandão\'s edition-or-prohibition year.',
    }).eq('id', 717).select('id'), 'gaibeus update')
  }

  // ── 3. The Da Vinci Code ────────────────────────────────────────────────────
  console.log('\n[3] the-da-vinci-code')
  const lbSrc = await findOrCreateSource('Wikipedia: List of books banned by governments', 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments#Lebanon', 'wikipedia')
  const bbcFa = await findOrCreateSource('BBC Persian — ممنوعیت چاپ کتاب رمز داوینچی در ایران (26 July 2006)', 'https://www.bbc.com/persian/arts/story/2006/07/060726_jk-davinci-code-iran', 'news')
  // Lebanon: supported by the governments list (which cites BBC News, 16 Sep 2004).
  await addLink(17, lbSrc, 'Lebanon entry: banned Sept 2004 (the list cites BBC News, 16 Sep 2004)')
  // India/Nagaland: supported by the India list; the existing note is left as is.
  await addLink(13127, 710, 'Nagaland, 2006 (list entry cites Telegraph India, 24 May 2006)')
  // Iran: ban 987 said 2004; the BBC Persian report is of July 2006 (ministry spokesperson: publication
  // banned at the request of three Christian clergymen). Merge duplicate 6012 (Iran list) into 987.
  console.log('  ban 987: year 2004→2006, status active→unclear (no source for current status), note from BBC Persian; merge ban 6012 into it')
  await addLink(987, bbcFa, 'ministry spokesperson: ban on publishing announced at the request of three Christian clergymen (July 2006)')
  for (const l of banLinks.filter((x: { ban_id: number }) => x.ban_id === 6012)) await addLink(987, (l as { source_id: number }).source_id, 'carried over from merged duplicate ban #6012 (2026-11-15)')
  if (APPLY) {
    await must(db.from('bans').update({
      year_started: 2006, status: 'unclear',
      description: 'The Iranian Ministry of Culture and Islamic Guidance announced a ban on publishing the book in July 2006, at the request of three Christian clergymen (BBC Persian). Current status not documented.',
    }).eq('id', 987).select('id'), 'ban 987')
    await must(db.from('bans').update({
      description: 'Banned in September 2004 after Catholic leaders deemed the book offensive to Christianity, according to the list of books banned by governments, which cites BBC News.',
    }).eq('id', 17).select('id'), 'ban 17')
    await must(db.from('ban_source_links').delete().eq('ban_id', 6012).select('ban_id'), 'del links 6012')
    await must(db.from('ban_reason_links').delete().eq('ban_id', 6012).select('ban_id'), 'del reason links 6012')
    await must(db.from('bans').delete().eq('id', 6012).select('id'), 'del ban 6012')
  }
  // Rows whose cited page does not record the ban: kept, marked, not re-dated.
  for (const id of [959, 1018, 1019, 1134, 1135]) {
    console.log(`  ban ${id}: confidence → unverified, note "${SOURCE_NEEDED}"`)
    if (APPLY) await must(db.from('bans').update({ confidence: 'unverified', description: SOURCE_NEEDED }).eq('id', id).select('id'), `ban ${id}`)
  }
  console.log('  inclusion_rationale narrowed to the sourced bans')
  if (APPLY) await must(db.from('books').update({
    inclusion_rationale: 'Reported banned for content considered offensive to Christianity: Lebanon (Sept 2004), Iran (July 2006) and the Indian state of Nagaland (2006) per the cited lists; further reported bans are marked "Source needed".',
  }).eq('id', 11).select('id'), 'dvc update')

  if (APPLY) await bustPaths(['/books/lenin-charasch', '/books/gaibeus', '/books/the-da-vinci-code'])
  console.log(APPLY ? '\ndone' : '\n--apply to write')
}
main().catch(e => { console.error(e); process.exit(1) })
