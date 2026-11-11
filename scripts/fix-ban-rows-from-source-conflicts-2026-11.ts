/**
 * Corrections to ban rows that a cited source contradicts (2026-11-11).
 *
 * The source verification of the censorship histories
 * (scripts/verify-censorship-context.ts) refused to publish a text for 47
 * books because a cited passage disagreed with one of our ban rows
 * (data/ban-row-conflict-leads-2026-11-11.md). Each of the 47 was read by hand
 * and put in one of two classes:
 *
 *   (a) the source is clear, authoritative, and about exactly this ban row —
 *       a correction is defensible. A change of status, year, country or
 *       action type needs a primary or authoritative source (the body itself,
 *       a court, an official register, an ALA record) or two independent ones.
 *   (b) unclear, one weak source, or a second reading is possible — nothing
 *       changes; the lead stays on the list with the reason.
 *
 * This script holds the (a) corrections: 16 rows over 16 books (a 17th, the
 * Malaysian Satanic Verses row, cannot be applied without merging a duplicate). It never
 * deletes a row and only touches the ids listed here. Each correction states
 * the values it expects to find; a row that no longer matches is skipped.
 * The class (b) leads and the findings are in the dry-run report.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/fix-ban-rows-from-source-conflicts-2026-11.ts          # dry-run + report
 *   npx tsx --env-file=.env.local scripts/fix-ban-rows-from-source-conflicts-2026-11.ts --apply
 * Dry-run writes data/ban-row-corrections-2026-11-11.md.
 * --apply writes a backup of every changed row to data/ban-row-corrections-backup-2026-11-11.json
 * first, then updates in one transaction and links the sources.
 * After --apply: scripts/refresh-mv.ts, bust the book and country pages, audit-integrity.
 */

import fs from 'node:fs'
import path from 'node:path'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()
const ACCESSED_AT = '2026-11-11'

type Source = { source_name: string; source_url: string; source_type: string; quote: string }
type Fields = Partial<{
  country_code: string; scope_id: number; action_type: string; status: string
  year_started: number | null; year_ended: number | null
  institution: string | null; region: string | null; description: string | null
}>
type Correction = {
  banId: number
  book: string
  /** Values the row must still have, or the correction is skipped. */
  expect: Fields
  set: Fields
  why: string
  sources: Source[]
}

const ALA_CLASSICS = {
  source_name: 'American Library Association — Banned & Challenged Classics',
  source_url: 'https://www.ala.org/bbooks/frequentlychallengedbooks/top10',
  source_type: 'ngo',
}

const CORRECTIONS: Correction[] = [
  {
    banId: 13080, book: 'A Clockwork Orange',
    expect: { scope_id: 2, year_started: 1982, region: 'Anniston, Alabama' },
    set: {
      scope_id: 1,
      description: 'In 1982, A Clockwork Orange was removed from two Anniston, Alabama high school libraries, later to be reinstated on a restricted basis.',
    },
    why: 'Scope: the libraries were high school libraries, not public libraries.',
    sources: [{ ...ALA_CLASSICS, quote: 'Removed from two Anniston, AL High school libraries (1982), but later reinstated on a restricted basis.' }],
  },
  {
    banId: 149, book: 'A Farewell to Arms',
    expect: { country_code: 'IE', year_started: 1929 },
    set: { year_started: 1939 },
    why: 'Year: 1929 is the publication year; the ALA record dates the Irish ban to 1939.',
    sources: [
      { ...ALA_CLASSICS, quote: 'Banned in Italy (1929) because of its painfully accurate account of the Italian retreat from Caporetto, Italy. Burned by the Nazis in Germany (1933). Banned in Ireland (1939).' },
      { source_name: 'The File Room — Ernest Hemingway, A Farewell to Arms', source_url: 'https://www.ntticc.or.jp/en/feature/1995/The_Museum_Inside_The_Network/fileroom/documents/Cases/266hemingway.html', source_type: 'web', quote: '1939 Ireland: "A Farewell to Arms" banned.' },
    ],
  },
  {
    banId: 680, book: 'Girls of Riyadh',
    expect: { country_code: 'SA', status: 'active', year_started: 2005 },
    set: {
      status: 'rescinded', year_ended: 2006,
      description: 'Saqi Books was at first forbidden from distributing the novel in Saudi Arabia; the ban was lifted in March 2006. In October 2006 the Court of Grievances in Riyadh dropped a lawsuit that two citizens had filed against the Ministry of Information for permitting its distribution.',
    },
    why: 'Status: two independent reports say the Saudi distribution ban was lifted in 2006.',
    sources: [
      { source_name: 'The New York Observer — From Saudi Arabia, Chick Lit Without the Racy Bits (June 2007)', source_url: 'https://observer.com/2007/06/from-saudi-arabia-chick-lit-without-the-racy-bits/', source_type: 'news', quote: 'Saqi Books was initially forbidden from distributing the book in Saudi Arabia, although that ban was lifted in March 2006.' },
      { source_name: 'Arab News — Court Rejects Case Against Rajaa Al-Sanea (9 October 2006)', source_url: 'https://www.arabnews.com/archive/290232', source_type: 'news', quote: 'Two Saudi citizens had filed a lawsuit against the Ministry of Information for giving the author permission to distribute the novel' },
    ],
  },
  {
    banId: 4873, book: 'Howl',
    expect: { country_code: 'US', year_started: 1955 },
    set: {
      year_started: 1957, year_ended: 1957,
      description: 'Part of the second printing was seized by San Francisco customs inspectors in March 1957; publisher Lawrence Ferlinghetti was arrested on obscenity charges in June 1957, and on 3 October 1957 Judge Clayton W. Horn ruled that the poem had "redeeming social importance".',
    },
    why: "Year: the row's own note dates the seizure to March 1957 (1955 predates the book's publication in 1956); the trial ended on 3 October 1957. Note: it was the second printing.",
    sources: [
      { source_name: 'Los Angeles Times — "Howl" at 40 (22 January 1996)', source_url: 'https://www.latimes.com/archives/la-xpm-1996-01-22-ls-27430-story.html', source_type: 'news', quote: 'First published in the fall of 1956, it became a cause celebre when part of the second printing was seized by San Francisco customs inspectors in March 1957.' },
      { source_name: 'University of Delaware Library — Literature vs. Law: Allen Ginsberg and Howl', source_url: 'https://exhibitions.lib.udel.edu/literature-vs-law/home/allen-ginsberg-and-howl/', source_type: 'academic', quote: 'the case concluded on October 3, 1957, when Judge Clayton W. Horn ruled the poem had "redeeming social importance."' },
    ],
  },
  {
    banId: 883, book: 'Inside Linda Lovelace',
    expect: { country_code: 'GB', action_type: 'banned', year_started: 1976 },
    set: {
      action_type: 'challenged',
      description: 'The publisher was prosecuted under the Obscene Publications Act 1959 at the Old Bailey in 1976 and acquitted; the book was not banned.',
    },
    why: 'Action: a prosecution that ended in acquittal is a challenge, not a ban.',
    sources: [
      { source_name: 'Bernard Williams (ed.), Obscenity and Film Censorship (Cambridge University Press) — The situation', source_url: 'https://www.cambridge.org/core/books/abs/obscenity-and-film-censorship/situation/F4E50574DBE99FD8E723E60859C72861', source_type: 'academic', quote: 'It was the trial, and acquittal, of the publisher of Inside Linda Lovelace' },
      { source_name: 'Index on Censorship — Obscenity timeline (2009)', source_url: 'https://journals.sagepub.com/doi/pdf/10.1080/03064220902727180', source_type: 'ngo', quote: '1976 Inside Linda Lovelace, a book by the former porn star, is prosecuted on charges of obscenity.' },
    ],
  },
  {
    banId: 29850, book: 'Les Onze Mille Verges',
    expect: { country_code: 'TR', year_started: 2000 },
    set: {
      description: 'In September 2000 a Turkish court fined the publisher of the Turkish translation for publishing obscene material and ordered all copies seized and destroyed. At final instance the Court of Cassation quashed the destruction order and upheld the fine (European Court of Human Rights, Akdaş v. Turkey).',
    },
    why: 'Note: the destruction order was quashed on appeal; the note said the copies were destroyed.',
    sources: [{ source_name: 'European Court of Human Rights — Akdaş v. Turkey, legal summary (HUDOC)', source_url: 'https://hudoc.echr.coe.int/eng?i=002-1133', source_type: 'government', quote: 'At final instance, the Court of Cassation quashed the order to destroy copies of the publication, further to a 2003 legislative amendment, and upheld the fine' }],
  },
  {
    banId: 33829, book: 'New Kid',
    expect: { status: 'active', year_started: 2021, institution: 'Katy Independent School District' },
    set: {
      status: 'rescinded', year_ended: 2021,
      description: 'Pulled from Katy ISD libraries in October 2021 after a parent petition; the district returned it to library shelves the same month after its review committee determined the book was appropriate.',
    },
    why: 'Status: the district itself announced in October 2021 that the book was back on library shelves.',
    sources: [
      { source_name: 'NBC News — Texas school district reinstates book by Black author amid critical race theory claims (October 2021)', source_url: 'https://www.nbcnews.com/news/us-news/texas-school-district-reinstates-book-black-author-amid-critical-race-n1281585', source_type: 'news', quote: '“The reading material is already back on District library shelves and the virtual author visit is scheduled to take place on October 25 as part of the instructional day,” the district said in its statement.' },
      { source_name: 'KPRC Click2Houston — Banned books back on shelves in Katy ISD (15 October 2021)', source_url: 'https://www.click2houston.com/news/local/2021/10/15/banned-books-back-on-shelves-in-katy-isd-after-parents-claimed-author-was-teaching-critical-race-theory', source_type: 'news', quote: 'the review committee met and determined the appropriateness of the book, “New Kid.” The reading material is already back on District library shelves' },
    ],
  },
  {
    banId: 4758, book: 'Norwegian Wood',
    expect: { country_code: 'RU', year_started: 2024 },
    set: {
      description: 'Removed from sale by the Russian online marketplace Megamarket in February 2024 as part of a list of 252 titles flagged for "LGBT propaganda" content. Murakami and Norwegian Wood were named in independent reporting on the list.',
    },
    why: "Note: the removal was in February 2024, not late 2024 (the row's own source, Meduza, is dated 21 February 2024).",
    sources: [{ source_name: "Russian Life — Dostoyevsky: The New 'LGBT Propaganda'?", source_url: 'https://www.russianlife.com/the-russia-file/dostoyevsky-the-new-lgbt-propaganda/', source_type: 'news', quote: 'On February 20, Russian online retailer Megamarket, owned by massive financial institution Sberbank, confirmed it had stopped selling over 250 books in connection with a law banning "LGBT Propaganda."' }],
  },
  {
    banId: 29854, book: 'Philosophical Dictionary',
    expect: { country_code: 'CH', year_started: 1765, region: 'Geneva' },
    set: {
      year_started: 1764,
      description: 'On 10 September 1764 the procurer general of Geneva prompted the city council to seize and burn all extant copies of the Philosophical Dictionary, as an outrage to religion and contrary to Church dogma.',
    },
    why: 'Year: Geneva condemned and burned the book in 1764, the year it appeared; 1765 is the Paris and Rome condemnations.',
    sources: [
      { source_name: 'EBSCO Research Starters — Voltaire Publishes A Philosophical Dictionary for the Pocket', source_url: 'https://www.ebsco.com/research-starters/history/voltaire-publishes-philosophical-dictionary-pocket', source_type: 'academic', quote: 'On September 10, 1764, the procurer general of Geneva prompted the city council to seize and burn all extant copies of the book' },
      { source_name: "Revue d'histoire de la justice (Cairn) — on the condemnations of the Dictionnaire philosophique", source_url: 'https://droit.cairn.info/article/RHJ_023_0081/pdf?lang=fr', source_type: 'academic', quote: "l’ouvrage a fait scandale dès sa parution en 1764. C’est d’abord à Genève que l’ouvrage a été condamné à être « lacéré et brûlé »" },
    ],
  },
  {
    banId: 29872, book: 'The Great Gatsby',
    expect: { status: 'historical', year_started: 2020, institution: 'Matanuska-Susitna Borough School District' },
    set: {
      status: 'rescinded', year_ended: 2020,
      description: 'On 22 April 2020 the Mat-Su Borough School Board voted to remove the book from the reading list for high school English electives; on 20 May 2020 it voted 6–1 to rescind that vote and put off the question of the reading list.',
    },
    why: 'Status: the board rescinded its own removal vote four weeks later.',
    sources: [
      { source_name: 'Alaska Public Media — Mat-Su school board rescinds vote to remove ‘Catch-22’ and 4 other books from English classes (21 May 2020)', source_url: 'https://alaskapublic.org/news/2020-05-21/mat-su-school-board-rescinds-vote-to-remove-catch-22-and-4-other-books-from-reading-list', source_type: 'news', quote: 'The school board of the Matanuska-Susitna Borough School District rescinded its vote to remove “Catch-22,” “The Great Gatsby” and three other novels from the reading list for high school English electives' },
      { source_name: 'Marshall University Libraries — Banned Books: The Great Gatsby (ALA field report)', source_url: 'https://www.marshall.edu/library/bannedbooks/great-gatsby/', source_type: 'academic', quote: 'After the community protested the board’s vote, it rescinded its decision and the books remain available in the schools.' },
    ],
  },
  {
    banId: 1166, book: 'The Jungle',
    expect: { country_code: 'SU', year_started: 1956 },
    set: { country_code: 'DD', description: 'Banned in East Germany in 1956 as inimical to communism.' },
    why: 'Country: the 1956 ban was in East Germany, not the Soviet Union.',
    sources: [
      { ...ALA_CLASSICS, quote: 'Banned in East Germany (1956) as inimical to communism.' },
      { source_name: 'Georgetown University Library — Banned Books Week 2013', source_url: 'https://library.georgetown.edu/banned-books-week/2013', source_type: 'academic', quote: 'for its opposition to Communist ideology (East Germany, 1956)' },
    ],
  },
  {
    banId: 1114, book: 'The Peaceful Pill Handbook',
    expect: { country_code: 'AU', year_started: 2007 },
    set: {
      description: 'In February 2007 the Classification Review Board unanimously classified the publication RC (Refused Classification) because it instructs in the manufacture of a prohibited drug (barbiturates); it is banned in Australia.',
    },
    why: 'Note: the RC decision was the Classification Review Board’s, not the Classification Board’s.',
    sources: [{ source_name: 'Australian Classification Review Board — decision, The Peaceful Pill Handbook (February 2007)', source_url: 'https://www.classification.gov.au/sites/default/files/2019-09/crb-decision-24february2007-the-peaceful-pill-handbook.pdf', source_type: 'government', quote: 'The Classification Review Board (the Review Board) in a unanimous decision classified the publication The Peaceful Pill Handbook (the publication), by Dr Philip Nitschke and Dr Fiona Stewart, ‘RC’ (Refused Classification)' }],
  },
  {
    banId: 958, book: 'The Satanic Verses',
    expect: { country_code: 'ID', year_started: 1988 },
    set: { year_started: 1989 },
    why: "Year: the row's own note says \"Banned March 1989\"; the year field said 1988.",
    sources: [{ source_name: 'ALA Office for Intellectual Freedom — Timeline entry for 1989: The Satanic Verses', source_url: 'https://www.oif.ala.org/timeline-entry-for-1989-the-satanic-verses/', source_type: 'ngo', quote: 'The novel was banned in Pakistan, Saudi Arabia, Egypt, Somalia, Sudan, Bangladesh, Malaysia, Qatar, Indonesia, South Africa, and India in 1989' }],
  },
  {
    banId: 56, book: 'Their Eyes Were Watching God',
    expect: { action_type: 'banned', year_started: 1997, institution: null },
    set: {
      action_type: 'challenged', institution: 'Stonewall Jackson High School', region: 'Virginia',
      description: "Challenged for sexual explicitness in 1997 but retained on Stonewall Jackson High School's academically advanced reading list in Brentsville, Virginia; a parent had objected to the novel's language and sexual explicitness.",
    },
    why: 'Action: the book was challenged and retained, not banned.',
    sources: [{ ...ALA_CLASSICS, quote: "Challenged for sexual explicitness, but retained on the Stonewall Jackson High School's academically advanced reading list in Brentsville, VA (1997)." }],
  },
  {
    banId: 19, book: 'To Kill a Mockingbird',
    expect: { status: 'active', year_started: 1977, institution: null, region: null },
    set: {
      status: 'historical', region: 'Eden Valley, Minnesota',
      description: 'Challenged in Eden Valley, Minnesota, in 1977 and temporarily banned over the words "damn" and "whore lady" used in the novel.',
    },
    why: 'Status: the 1977 ban was temporary; it is not an active ban.',
    sources: [
      { ...ALA_CLASSICS, quote: 'Challenged in Eden Valley, MN (1977) and temporarily banned due to words "damn" and "whore lady" used in the novel.' },
      { source_name: 'PBS NewsHour — ‘To Kill a Mockingbird’ remains among top banned classical novels', source_url: 'https://www.pbs.org/newshour/education/to-kill-a-mockingbird-remains-among-top-banned-classical-novels', source_type: 'news', quote: '1977 Challenged and temporarily banned in Eden Valley, Minn., for vulgar language.' },
    ],
  },
  {
    banId: 32793, book: 'When Aidan Became a Brother',
    expect: { action_type: 'restricted', year_started: 2022, institution: 'Escambia County Public Schools' },
    set: {
      action_type: 'banned',
      description: 'On 20 February 2023 the Escambia County School Board voted to remove the book from the schools in the district.',
    },
    why: 'Action: the board voted to remove the book; the row recorded the earlier restriction pending review.',
    sources: [
      { source_name: 'WUWF Public Media — Escambia school board removes three books from libraries (21 February 2023)', source_url: 'https://www.wuwf.org/local-news/2023-02-21/escambia-school-board-removes-three-books-from-libraries', source_type: 'news', quote: 'The Escambia County School Board voted to remove three books from school libraries last night in a meeting that ran over four hours.' },
      { source_name: 'Kirkus Reviews — Florida School District Bans 3 LGBTQ+ Books', source_url: 'https://www.kirkusreviews.com/news-and-features/articles/florida-school-district-bans-3-lgbtq-books/', source_type: 'news', quote: 'The board of Escambia County Public Schools in northwest Florida voted to remove All Boys Aren’t Blue by George M. Johnson; And Tango Makes Three, written by Justin Richardson and Peter Parnell and illustrated by Henry Cole; and When Aidan Became a Brother' },
    ],
  },
]

// ── Class (b): left as they are, with the reason ────────────────────────
const LEFT: Array<[string, string]> = [
  ['2001: A Space Odyssey — Collier County #20569', 'A PEN news item says "banned"; PEN\'s own index, our source, records the row as restricted. Same publisher, two wordings.'],
  ['A Court of Thorns and Roses — Brevard #34462, Beaufort #30349', 'Brevard: one news page reports a 2024 board vote to remove, a later event than the 2022 row. Beaufort: the district page confirms a restriction (grades 9–12 only), which is what the row says.'],
  ['A Handbook of Marxism — New Zealand #1229', 'Only a Wikipedia list says "unrestricted", without a date.'],
  ['All American Boys — Pitt County #34740', 'ALA and WITN say the board voted in January 2022 to keep the book, but WITN also reports it is no longer available at one middle school. Mixed outcome.'],
  ['American Psycho — New Zealand #1214', 'One university exhibit says the 1991 decision was an R18 restriction, not a ban. Likely right, but one source. See finding 3.'],
  ['Doctor Zhivago — Soviet Union #64', 'Two sources date the refusal by Novy Mir to September 1956; counting the ban from 1957 (publication abroad) is a defensible reading.'],
  ['Droll Stories — New Zealand #4770', 'The 1935 Magistrate\'s Court ruling (Otago Daily Times, 8 February 1935) is a separate act from the Customs prohibition the row records. Candidate for a new row, not a correction.'],
  ['Five Past Midnight in Bhopal — India #4782', 'The court record names a police official as plaintiff; our note names Mahindra Singh Kalsi. There may have been two suits. Strong lead, needs the second suit checked.'],
  ['For Bread Alone — Morocco #855', 'One source (Qantara) says banned 1982 when the Arabic edition appeared and lifted 2000; the row says 1973. Strong lead, one source.'],
  ['Forever Amber — New Zealand #4731', 'Only a Wikipedia list gives 1944 and "unrestricted 1945".'],
  ['From Hell — Australia #923', 'One specialist site dates the seizures to 2000 and the clearance to 14 November; the row says 2002. One source.'],
  ['Gabi, a Girl in Pieces — Wentzville #34720', 'The district committee memo of 9 February 2022 says "voted to retain". Strong lead; whether the board followed and the book went back is not in the sources at hand.'],
  ['Germinal — Russia #612', 'One Russian journal article mentions an 1894 ban; the 1885 row may be an earlier measure.'],
  ['How to Kill (series) — Canada #5991', 'Only Wikipedia gives 1977; our 1973 is the publication year. See finding 1.'],
  ['Islam (Gordon) — Malaysia #39644', 'The ministry was called Ministry of Internal Security in 2006; our register notes use today\'s name. A naming matter, not a contradiction.'],
  ['Lady Chatterley\'s Lover — Japan #4723, Australia #1004, United Kingdom #16', 'Japan: the Supreme Court ruling was 1957; the source that says 1950 is imprecise. Australia: 1929 vs 1930 rests on one exhibit page. UK: the 1960 trial is a separate event from the 1928 row.'],
  ['Last Night at the Telegraph Club — Flagler Schools', 'One local news report says both high school committees voted to retain; PEN lists the district. One source.'],
  ['Les 120 Journées de Sodome — France #858', 'The 1990 ministerial order (Journal officiel) forbids sale to minors; it is a separate, later measure. Candidate for a new row.'],
  ['Nana — New Zealand #1207', 'Which body acted (Magistrate\'s Court) is not something the row contradicts.'],
  ['Never Let Me Go — Orange County #21818', 'A PEN summary says "banned in two districts"; PEN\'s index records one as restricted.'],
  ['Pinkalicious — Lamar CISD #11820', 'A newspaper speaks of the 2025–26 school year; PEN\'s 2024–25 index is our source for 2024.'],
  ['Spycatcher — Australia #600', 'The UK government\'s claim failed in the Australian courts (High Court, 1988), so "banned" is doubtful — but the publisher was under an undertaking not to publish while the case ran. Needs the law report read before the row changes.'],
  ['The Blind Owl — Iran #639', 'One source (The File Room) says publication was allowed again in 1993 in censored form.'],
  ['The Satanic Verses — Malaysia #1003', 'Its note says "Banned March 1989" while the year field says 1988, so 1989 is right — but the KDN register row #26694 already records this same ban under 1989, and the unique key on (book, country, year, scope, region, institution) refuses a second one. The first --apply on 2026-11-11 failed on exactly this and rolled back. Correcting the year needs the two rows merged, and this script deletes nothing. See finding 5.'],
  ['The Satanic Verses — the other 1988 rows, Iran #4, Venezuela', 'The ALA timeline says "1989" for eleven countries where our rows carry exact dates in late 1988. Our rows are the more precise.'],
  ['The Story of O — New Zealand #4768', 'Only a Wikipedia list says "restricted to psychiatrists" rather than banned.'],
  ['The Turner Diaries — Canada #576, Germany #575', 'Canada: Freedom to Read says the book was never allowed in and that the formal prohibition dates from July 1996; our 1980 is unsourced, but the two do not exclude each other. Germany: only Wikipedia gives April 2006. See finding 1.'],
  ['This Book Is Gay — Sioux City #29814, Iowa City #16824', 'Sioux City: an NCAC letter of 6 April 2022 protests a removal our row dates to 2023; possibly two events. Iowa City: returned in May 2023, then removed again under Senate File 496 — the row is right to be active.'],
  ['Tintin in the Congo — Belgium #13071', 'A spelling difference in the plaintiff\'s name (Mbuto / Mbutu).'],
  ['Tropic of Cancer — United States #61, New Zealand #4764', 'Whether the US ban ended in 1961 (publication) or 1964 (Supreme Court) is a matter of definition. New Zealand 1934 rests on a Wikipedia list.'],
  ['Water for Elephants — #189 (2012)', 'ALA: removed from one elective course in Bedford, New Hampshire. Whether that is "banned" or "restricted" in our terms is a judgment call.'],
  ['Women Without Men — Iran #640', 'Two sources say "shortly after its 1989 publication" without a year; the row says 1992.'],
  ['Чему на самом деле учит Библия? — Russia #30121', 'The court decision is from 2009; the row says 2020 because the register feed carried "added 2020-09-04". The right listing year is not in our sources. See finding 2.'],
]

const FINDINGS = [
  'Publication year as ban year. Several older rows carry the book\'s publication year as year_started (A Farewell to Arms 1929, Howl 1955, How to Kill 1973, The Turner Diaries Germany 1979). The same pattern as source 825 earlier today, in rows from "Wikipedia" and "List of books banned by governments" sources.',
  'Russian extremist register, early entries. Entries around #510–#588 all carry year_started 2020 ("Added to list: 2020-09-04") although their court decisions date from 2009. The feed date was taken for the listing date.',
  'New Zealand rows from FYI.org.nz. The note template says "classified as objectionable" for every title; for at least American Psycho and The Story of O the decision was a restriction (R18, professionals only), not a ban.',
  'Mat-Su 2020. The rescinded board vote covered five books; only The Great Gatsby was in this set. The rows for The Things They Carried, I Know Why the Caged Bird Sings, Catch-22 and Invisible Man, if present, need the same change.',
  'Duplicate ban. The Satanic Verses has two Malaysia rows for the same ban (#1003 from Wikipedia, #26694 from the KDN register).',
  'PEN "banned pending investigation". Rows from PEN\'s index stay active after a district reviews a book and keeps it (New Kid; probably Gabi, a Girl in Pieces and All American Boys). PEN records the removal, not the outcome.',
]

const COLS = ['country_code', 'scope_id', 'action_type', 'status', 'year_started', 'year_ended', 'institution', 'region', 'description'] as const

async function main() {
  const pg = newPgClient()
  await pg.connect()
  console.log(`\n── fix-ban-rows-from-source-conflicts-2026-11 (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)
  const L: string[] = [
    '# Ban-row corrections from the source conflicts (2026-11-11)', '',
    `47 leads read by hand (data/ban-row-conflict-leads-2026-11-11.md). Class (a), a defensible correction: ${new Set(CORRECTIONS.map(c => c.book)).size} books, ${CORRECTIONS.length} rows. Class (b), left as it is: ${LEFT.length} items over 31 books.`,
    'No row is deleted; only the ids below change. Each section says whether the correction is proposed or applied.', '',
    '## Class (a) — corrections', '',
  ]
  try {
    const ids = CORRECTIONS.map(c => c.banId)
    const rows = (await pg.query(
      `select id, book_id, ${COLS.join(', ')}, trim(country_code) as cc from bans where id = any($1::bigint[])`, [ids],
    )).rows as Array<Record<string, unknown>>
    const byId = new Map(rows.map(r => [Number(r.id), r]))
    // Once applied, the report keeps showing what each row was: read it from the backup.
    const backupFile = path.resolve('data', 'ban-row-corrections-backup-2026-11-11.json')
    const before = new Map<number, Record<string, unknown>>(
      fs.existsSync(backupFile)
        ? (JSON.parse(fs.readFileSync(backupFile, 'utf8')) as Array<Record<string, unknown>>).map(r => [Number(r.id), r])
        : [],
    )
    const section = (c: Correction, was: (k: string) => unknown, label: string) => {
      L.push(`### #${c.banId} — ${c.book}${label}`, '', `**Why:** ${c.why}`, '', '| field | before | after |', '|---|---|---|')
      for (const [k, v] of Object.entries(c.set)) L.push(`| ${k} | ${String(was(k) ?? '—').replace(/\|/g, '\\|')} | ${String(v ?? '—').replace(/\|/g, '\\|')} |`)
      L.push('')
      for (const s of c.sources) L.push(`- [${s.source_name}](${s.source_url}): "${s.quote}"`)
      L.push('')
    }
    const todo: Array<{ c: Correction; row: Record<string, unknown> }> = []

    for (const c of CORRECTIONS) {
      const row = byId.get(c.banId)
      if (!row) { console.log(`  ✗ #${c.banId} ${c.book}: row not found — skipped`); continue }
      const cur = (k: string) => (k === 'country_code' ? row.cc : row[k])
      // node-pg returns bigint columns (scope_id) as strings: compare by value, not by type.
      const same = (x: unknown, y: unknown) => (x ?? null) === null || (y ?? null) === null ? (x ?? null) === (y ?? null) : String(x) === String(y)
      const mismatch = Object.entries(c.expect).filter(([k, v]) => !same(cur(k), v))
      const already = Object.entries(c.set).every(([k, v]) => same(cur(k), v))
      if (already) {
        console.log(`  · #${c.banId} ${c.book}: already corrected`)
        const was = before.get(c.banId)
        if (was) section(c, k => (k === 'country_code' ? String(was.country_code ?? '').trim() : was[k]), ' — applied')
        continue
      }
      if (mismatch.length) { console.log(`  ✗ #${c.banId} ${c.book}: row changed since review (${mismatch.map(([k]) => k).join(', ')}) — skipped`); continue }
      todo.push({ c, row })
      const diff = Object.entries(c.set).map(([k, v]) => `${k}: ${JSON.stringify(cur(k) ?? null)} → ${JSON.stringify(v)}`)
      console.log(`  ✓ #${c.banId} ${c.book}: ${diff.filter(d => !d.startsWith('description')).join(' · ') || 'note only'}`)
      section(c, cur, ' — proposed')
    }

    L.push('## Class (b) — left as they are', '')
    for (const [what, why] of LEFT) L.push(`- **${what}.** ${why}`)
    L.push('', '## Findings (patterns seen, nothing applied)', '')
    FINDINGS.forEach((f, i) => L.push(`${i + 1}. ${f}`))
    if (!APPLY) {
      const reportPath = path.resolve('data', 'ban-row-corrections-2026-11-11.md')
      fs.writeFileSync(reportPath, L.join('\n') + '\n')
      console.log(`\nWould correct ${todo.length} rows. Report: ${reportPath}\nDRY-RUN — add --apply to write.`)
      return
    }

    const backupPath = path.resolve('data', 'ban-row-corrections-backup-2026-11-11.json')
    fs.writeFileSync(backupPath, JSON.stringify(todo.map(t => { const { cc: _cc, ...rest } = t.row; return rest }), null, 2) + '\n')
    console.log(`\nBackup of ${todo.length} rows: ${backupPath}`)

    await pg.query('begin')
    for (const { c } of todo) {
      const keys = Object.keys(c.set)
      await pg.query(
        `update bans set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1`,
        [c.banId, ...keys.map(k => (c.set as Record<string, unknown>)[k])],
      )
      for (const s of c.sources) {
        const sourceId = (await pg.query(
          `insert into ban_sources(source_name, source_url, source_type, accessed_at, verification_status)
           values($1,$2,$3,$4,'verified')
           on conflict (source_url) do update set accessed_at = excluded.accessed_at
           returning id`,
          [s.source_name, s.source_url, s.source_type, ACCESSED_AT],
        )).rows[0].id
        await pg.query(
          `insert into ban_source_links(ban_id, source_id, locator) values($1,$2,'correction 2026-11-11') on conflict do nothing`,
          [c.banId, sourceId],
        )
      }
    }
    await pg.query('commit')
    console.log(`Corrected ${todo.length} rows.`)
  } catch (e) {
    if (APPLY) await pg.query('rollback').catch(() => {})
    throw e
  } finally {
    await pg.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
