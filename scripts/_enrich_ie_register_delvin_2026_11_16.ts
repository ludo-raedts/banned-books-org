#!/usr/bin/env tsx
/** Hand bio for author #27961 David Delvin (follow-up to the IE-register enrichment).
 *  Source: The Daily Telegraph obituary (2018-03-29) via PressReader — born 28 Jan 1939
 *  London, died 9 Mar 2018; GP, TV/media sex-education broadcaster, 30+ books incl.
 *  The Book of Love (1974). Only written when bio and years are empty. */
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'
const APPLY = isApply()
const URL = 'https://www.pressreader.com/uk/the-daily-telegraph/20180329/282303910688273'
const BIO = 'David Delvin (1939–2018) was a London-born general practitioner who became one of Britain’s best-known ' +
  'media voices on sex and relationships, appearing in hundreds of television programmes. He wrote more than thirty ' +
  'books, among them The Book of Love (1974), which was banned in Ireland in 1983.'
async function main() {
  const pg = newPgClient(); await pg.connect()
  try {
    const a = (await pg.query(`select display_name, bio, birth_year, death_year from authors where id=27961`)).rows[0]
    if (!a || a.display_name !== 'David Delvin') throw new Error('author drift')
    if (a.bio || a.birth_year || a.death_year) { console.log('already has data — leaving alone', a); return }
    console.log(`${APPLY ? 'SET' : 'WOULD SET'} bio (${BIO.length} chars), 1939–2018, source ${URL}`)
    if (APPLY) await pg.query(`update authors set bio=$1, birth_year=1939, death_year=2018, bio_source_type='manual', bio_source_url=$2, updated_at=now() where id=27961`, [BIO, URL])
  } finally { await pg.end() }
}
main().catch(e => { console.error(e); process.exit(1) })
