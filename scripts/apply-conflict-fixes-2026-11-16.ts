/**
 * One-off 2026-11-16: ban-row fixes for the source/record conflicts found by the sourced-history pipeline
 * (data/censorship-context-verify-top100-2026-11-16.*). Each fix rests on a page the pipeline fetched and
 * quoted verbatim. Source disagreements (For Whom the Bell Tolls, Lolita, Hunchback, Satanic Verses,
 * Tropic of Capricorn) and false conflicts (Naked Lunch: petition 1964, trial Jan 1965) are NOT touched.
 * Backup first; dry-run default.
 */
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'
import { bustPaths } from './lib/revalidate'
import { promises as fs } from 'node:fs'
import path from 'node:path'
const APPLY = isApply(); const db = adminClient(); const TODAY = new Date().toISOString().slice(0, 10)
const FIX: Record<number, { why: string; src?: [string, string, string]; patch: Record<string, unknown> }> = {
  935: { why: 'Banquet/Egypt: withdrawn 2000, current status not documented', patch: { status: 'unclear' } },
  4755: { why: 'CMBYN/Russia: retailer hid the book Dec 2022, before the Nov 2023 ruling', src: ['The Bell — Russia bans books mentioning LGBT issues', 'https://thebell.io/russia-bans-books-mentioning-lgbt-issues', 'news'], patch: { year_started: 2022, description: 'Russian online retailer Labirint hid the book from sale in December 2022 amid removals of books that mention LGBT topics (The Bell); distribution was restricted further after the November 2023 Supreme Court ruling designating the "international LGBT movement" as extremist.' } },
  952: { why: 'Animal Farm/UAE: school ban by Ministry of Education, not a public-library ban', src: ['The Guardian, 14 Feb 2002', 'https://www.theguardian.com/books/2002/feb/14/news', 'news'], patch: { institution: 'Ministry of Education', description: 'In 2002 the UAE Ministry of Education banned the book from schools, saying it contained material that contradicted Islamic and Arab values (The Guardian, 14 February 2002).' } },
  4731: { why: 'Forever Amber/NZ: 1945 import-licence ban, not the Indecent Publications Act', src: ['Papers Past, Evening Star 20 Sep 1945', 'https://paperspast.natlib.govt.nz/newspapers/ESD19450920.2.30', 'news'], patch: { year_started: 1945, description: 'In 1945 the Minister of Customs, Walter Nash, banned the book for giving undue prominence to sex; the ban worked through import-licence regulations and did not prohibit private imports (Papers Past; Wikipedia, Censorship in New Zealand).' } },
  16: { why: 'Lady Chatterley/UK: unexpurgated edition effectively unavailable until the 1960 Penguin acquittal', src: ['Time: Lady Chatterley\'s Lover and censorship', 'https://time.com/6238284/lady-chatterleys-lover-history-censorship/', 'news'], patch: { year_ended: 1960, description: 'The unexpurgated novel could not be sold openly in the UK until Penguin Books was cleared under the Obscene Publications Act in 1960.' } },
  611: { why: 'Les Miserables/Spain: censors refused a print licence in 1961 citing the 1864 Index decree', src: ['Cultugrafia: Los Miserables y el franquismo', 'https://www.cultugrafia.com/los-miserables-franquismo-iv/', 'web'], patch: { year_started: 1961, confidence: 'reported', description: 'On 3 April 1961 Spanish censors denied a publisher\'s request to print the novel because it was registered on the Church\'s Index under the decree of 20 June 1864; a censor maintained the refusal in March 1963 (Cultugrafia, citing the censorship files).' } },
  624: { why: 'Nights/Egypt: 1985 injunction, reversed a year later (Qantara)', src: ['Qantara: Arabian Nights', 'https://qantara.de/en/article/arabian-nights-obscene-pornography-or-great-work-culture', 'news'], patch: { status: 'rescinded', year_ended: 1986, confidence: 'reported', description: 'In 1985 a group of Islamists won an injunction removing the book from the market; a higher court reversed the decision a year later (Qantara).' } },
  33650: { why: 'Handmaid\'s Tale/Goddard KS: removal reversed in 2021', src: ['KCUR, 9 Nov 2021', 'https://www.kcur.org/news/2021-11-09/a-kansas-school-district-ordered-29-books-removed-from-circulation', 'news'], patch: { status: 'rescinded', year_ended: 2021 } },
  16824: { why: 'This Book Is Gay/Iowa City: temporary removal pending review, later returned', src: ['NCAC on Iowa City removal, 7 Apr 2023', 'https://ncac.org/news/ncac-writes-to-school-board-in-iowa-city-about-the-temporary-removal-of-juno-dawsons-this-book-is-gay', 'ngo'], patch: { status: 'rescinded', year_ended: 2023 } },
  576: { why: 'Turner Diaries/Canada: customs import prohibition 1996, not 1980', src: ['Freedom to Read: The Turner Diaries', 'https://www.freedomtoread.ca/challenged-works/the-turner-diaries/', 'ngo'], patch: { year_started: 1996, description: 'Canada Customs reviewed the new mainstream edition, classified it as hate literature and issued an import prohibition in July 1996; earlier copies had been stopped at the border (Freedom to Read).' } },
  179: { why: 'Zhuan Falun/China: 24 July 1996 ban on Falun Gong publications', src: ['US DOJ/EOIR China country report', 'https://www.justice.gov/sites/default/files/eoir/legacy/2013/06/12/china_3.pdf', 'government'], patch: { year_started: 1996, description: 'The Chinese government banned Zhuan Falun and other Falun Gong publications on 24 July 1996 (US Department of Justice country report).' } },
}
async function main() {
  console.log(APPLY ? 'APPLY' : 'DRY-RUN')
  const ids = Object.keys(FIX).map(Number)
  const bans = (await db.from('bans').select('*').in('id', ids)).data ?? []
  const links = (await db.from('ban_source_links').select('*').in('ban_id', ids)).data ?? []
  const bk = path.join(process.cwd(), 'data', 'top100-check', 'backup-conflict-fixes-2026-11-16.json')
  if (APPLY) { try { await fs.access(bk); throw new Error('backup exists') } catch (e: any) { if (e.message === 'backup exists') throw e } await fs.writeFile(bk, JSON.stringify({ bans, ban_source_links: links }, null, 1)) }
  const led: string[] = []; const byId = new Map(bans.map((b: any) => [b.id, b]))
  for (const [k, f] of Object.entries(FIX)) {
    const id = +k; const b: any = byId.get(id); if (!b) { console.log('MISSING', id); continue }
    const diff = Object.entries(f.patch).filter(([c, v]) => b[c] !== v).map(([c, v]) => `${c}: ${JSON.stringify(b[c])} → ${JSON.stringify(v)}`)
    led.push(`- ban ${id} (${f.why}): ${diff.join('; ')}${f.src ? ' + source ' + f.src[1] : ''}`)
    if (!APPLY) continue
    if (f.src) {
      const e = await db.from('ban_sources').select('id').eq('source_url', f.src[1]).limit(1); let sid: number
      if (e.data?.length) sid = e.data[0].id; else { const r = await db.from('ban_sources').insert({ source_name: f.src[0], source_url: f.src[1], source_type: f.src[2], accessed_at: TODAY }).select('id').single(); if (r.error) throw r.error; sid = (r.data as any).id }
      const lr = await db.from('ban_source_links').upsert({ ban_id: id, source_id: sid, locator: 'fetched 2026-11-16 by the sourced-history pipeline' }, { onConflict: 'ban_id,source_id', ignoreDuplicates: true }); if (lr.error) throw lr.error
    }
    const r = await db.from('bans').update(f.patch).eq('id', id).select('id'); if (r.error) throw r.error
  }
  await fs.writeFile(path.join(process.cwd(), 'data', 'top100-check', 'LEDGER-conflicts.md'), `# Conflict fixes ${TODAY} (${APPLY ? 'applied' : 'dry run'})\n\n${led.join('\n')}\n`)
  if (APPLY) { const bi = [...new Set(bans.map((b: any) => b.book_id))]; const s = (await db.from('books').select('slug').in('id', bi)).data?.map((x: any) => x.slug) ?? []; await bustPaths(s.map((x: string) => `/books/${x}`)); console.log('busted', s.length) }
  console.log(led.length, 'fixes')
}
main().catch(e => { console.error(e); process.exit(1) })
