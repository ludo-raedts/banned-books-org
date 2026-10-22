/**
 * _botd_week_2026_09_07b.ts — follow-up pre-flight for the REPLACEMENT pick of
 * 2026-09-14. After _botd_week_2026_09_07.ts cleared the contaminated row for
 * "Love in the Open Air", the user excluded book 7282 (bluesky_excluded_books)
 * and the rotation re-froze 2026-09-14 to book 17043, "Three Wishes:
 * Palestinian and Israeli Children Speak" by Deborah Ellis — which came with
 * its own gaps (no ISBN; author bio was the importer TEMPLATE, no links).
 *
 * Sources, as always one per field and recorded on the row:
 *   author bio  → en.wikipedia.org/wiki/Deborah_Ellis
 *   author links→ Wikidata Q290374 (probed 2026-09-07), each URL live-checked
 *   book blurb  → the publisher's own page (House of Anansi / Groundwood)
 *   description_ban → freedomtoread.ca/challenged-works/three-wishes/, which is
 *                     already the cited source (ban_sources 3925) of our own
 *                     ban row 29828 for this book
 *
 * Read-only by default; pass --apply to write.
 */
import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { descriptionBanQualityGate } from '../src/lib/censorship-context-quality'
import { isApply } from './lib/cli'

const NOW = new Date().toISOString()
const APPLY = isApply()

type Patch = { id: number; why: string; patch: Record<string, unknown> }

const AUTHORS: Patch[] = [
  {
    id: 6020,
    why: 'Deborah Ellis (pick 2026-09-14) — bio carried the importer TEMPLATE tail ("Their work has been subject to censorship or banning challenges.", with the wrong pronoun), was UNSTAMPED and had no links. Wikidata Q290374 (P31=Q5, "Canadian author", P569 1960 matches our birth_year 1960, enwiki sitelink = Deborah Ellis, P18 = the Commons photo we already show): X @DebEllisAuthor (P2002, 200), Instagram deborahellisauthor (P2003, 200), VIAF 85388767. website_url deliberately NOT written — P856 http://deborahellis.com/ now serves a "Squarespace — Website Expired" 404 on every variant. birth_month/day deliberately NOT written — Wikipedia says 7 August 1960 and Wikidata P569 says 1960-08-08; a one-day conflict is not good enough for the birthday feature.',
    patch: {
      bio: [
        'Deborah Ellis (born 7 August 1960) is a Canadian writer and activist whose books deal with the lives of children caught in war and poverty. She was born in Cochrane, Ontario, moved several times as a child, and began writing at eleven or twelve. Much of her work grows out of her travels and out of conversations with the people she meets; she has held many jobs in the peace and anti-war movements, and donates almost all of her royalties to organisations including Canadian Women for Women in Afghanistan and UNICEF.',
        'In 1997 she travelled to Pakistan to interview refugees at an Afghan refugee camp, and out of those interviews came The Breadwinner (2001), the story of a girl named Parvana, followed by Parvana’s Journey (2002), Mud City (2003), My Name is Parvana (2011) and One More Mountain (2022), which takes up Parvana’s story as the Americans leave Afghanistan and the Taliban retake Kabul. Her 1999 novel Looking for X, about a girl’s daily life in a poor part of Toronto, won the Governor General’s Award for English-language children’s literature in 2000. The Heaven Shop (2004) follows a family of orphans in Malawi displaced by the HIV/AIDS epidemic; I Am a Taxi (2006) a Bolivian boy sent to work in the coca pits after his family is accused of smuggling coca paste; Moon at Nine (2014) is based on the true story of two teenage girls imprisoned in Iran, where homosexuality is punishable by death. She also wrote Bifocal (2007) with Eric Walters, the story collection Lunch with Lenin and Other Stories (2008) and Looks Like Daylight: Stories of Indigenous Kids (2013). She was named to the Order of Ontario in 2006 and made a Member of the Order of Canada in December 2016, and has won the Jane Addams Children’s Book Award and the Vicky Metcalf Award for a body of work.',
        'Two of her books are recorded in this database. Three Wishes: Palestinian and Israeli Children Speak (2004) was restricted by the Toronto District School Board in Ontario in 2006 — held to Grade 7 and above and withdrawn from school library shelves — after the Canadian Jewish Congress urged Ontario boards to deny the book to elementary pupils; four other Ontario boards set restrictions of their own. I Am a Taxi was restricted in Clay County School District in Florida in 2023.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/Deborah_Ellis',
      wikidata_id: 'Q290374',
      social_links: {
        twitter: 'https://x.com/DebEllisAuthor',
        instagram: 'https://www.instagram.com/deborahellisauthor/',
        viaf: 'https://viaf.org/viaf/85388767',
      },
      links_checked_at: NOW,
    },
  },
]

const BOOK_PATCHES: Patch[] = [
  {
    id: 17043,
    why: 'Three Wishes (pick 2026-09-14) — no ISBN at all, so no buy links. Our stored cover (OL cover 686137, visually verified as the right jacket) belongs to OpenLibrary edition OL8212190M: Groundwood Books, 20 May 2004, ISBN 9780888995544 — so that is the canonical isbn13. It 404s on Bookshop; the Groundwood paperback 9780888996459 resolves there ("Three Wishes a book by Deborah Ellis … Groundwood Books, 112 pages"), which is exactly what bookshop_isbn13 is for. description_book was ai_consensus tier (weakest, "not from a single cited source"); replaced with the publisher’s own copy. description_ban asserted "religious themes" — not in any of our sources — and named only one board; rewritten from freedomtoread.ca, the cited source of our ban row, which documents five boards and what the CJC actually objected to. Both texts stamped human_curated so the LLM sweeps leave them alone.',
    patch: {
      isbn13: '9780888995544',
      isbn_status: 'valid',
      isbn_checked_at: NOW,
      bookshop_isbn13: '9780888996459',
      bookshop_status: 'valid',
      bookshop_checked_at: NOW,
      description_book:
        'Deborah Ellis presents the stories of children of the war-torn Middle East, based on interviews she carried out with Israeli and Palestinian children in the winter of 2002. In a rehabilitation centre for disabled children, twelve-year-old Nora says she loves the colour pink and chewing gum, and explains that the wheels of her wheelchair are like her legs. Eleven-year-old Mohammad describes how his house was demolished by soldiers. Twelve-year-old Salam’s older sister walked into a store in Jerusalem and blew herself up, killing two people and injuring twenty. All of these children live both ordinary and extraordinary lives: they argue with their siblings and dream about the future, and they have also seen their homes destroyed and their families killed. The book lets children elsewhere see those caught in the Israeli-Palestinian conflict as children like themselves, living far more difficult and dangerous lives.',
      description_source_type: 'manual',
      description_source_url: 'https://houseofanansi.com/products/three-wishes',
      description_ban:
        'In 2006 the Canadian Jewish Congress urged Ontario’s public school boards to keep this book of interviews with Israeli and Palestinian children away from pupils in the elementary grades, arguing that Ellis had given a flawed historical introduction to the conflict and that some of the children in the book portrayed Israeli soldiers as brutal, expressed ethnic hatred and glorified suicide bombing; the effect on young readers, it said, would be “toxic”. At least five Ontario boards imposed restrictions even though the Ontario Library Association had recommended the book for its Silver Birch reading programme and no child was required to read it: the Toronto and Greater Essex County boards held it to Grade 7 and above (Toronto also taking it off library shelves), the District School Board of Niagara told librarians to steer pupils in Grades 4–6 away from it and to inform their parents, the Ottawa-Carleton board refused to stock it or supply it on request, and the York Region board had already dropped it from the Silver Birch programme in 2005. Protests by the Ontario Library Association, The Writers’ Union of Canada, PEN Canada and the Association of Canadian Publishers did not persuade the boards to lift the restrictions.',
      description_ban_status: 'human_curated',
    },
  },
  {
    id: 439,
    why: 'Fly on the Wall — the description_ban rewritten by hand earlier today (from our own ten PEN rows) was left with the inherited status. Stamped human_curated so the LLM description sweeps never overwrite it.',
    patch: { description_ban_status: 'human_curated' },
  },
  {
    id: 7282,
    why: 'Love in the Open Air — same: the hand-written, source-matched description_ban (R18 restriction, not a ban) gets human_curated so it is not re-generated.',
    patch: { description_ban_status: 'human_curated' },
  },
]

async function main() {
  const sb = adminClient()
  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN (pass --apply to write) ===')

  for (const a of AUTHORS) {
    const p = a.patch.photo_url
    if (typeof p === 'string' && !isAllowedImageUrl(p)) throw new Error(`photo_url rejected: ${p}`)
  }
  for (const b of BOOK_PATCHES) {
    const c = b.patch.cover_url
    if (typeof c === 'string' && !isAllowedImageUrl(c)) throw new Error(`cover_url rejected: ${c}`)
    const d = b.patch.description_ban
    if (typeof d === 'string') {
      const g = descriptionBanQualityGate(d)
      console.log(`gate book ${b.id} description_ban:`, JSON.stringify(g))
    }
  }

  let authorRows = 0
  for (const a of AUTHORS) {
    const sel = ['id', 'slug', 'display_name', ...Object.keys(a.patch)].filter((v, i, s) => s.indexOf(v) === i).join(',')
    const { data: before, error: e1 } = await sb.from('authors').select(sel).eq('id', a.id).single()
    if (e1) throw e1
    console.log(`\n--- author ${a.id} — ${a.why}`)
    console.log('BEFORE:', JSON.stringify(before))
    if (!APPLY) {
      console.log('AFTER : (dry run) would set', JSON.stringify(Object.keys(a.patch)))
      continue
    }
    const { data: after, error: e2 } = await sb
      .from('authors')
      .update({ ...a.patch, updated_at: NOW })
      .eq('id', a.id)
      .select(sel)
    if (e2) throw e2
    authorRows += after?.length ?? 0
    console.log('AFTER :', JSON.stringify(after?.[0]))
  }

  let bookRows = 0
  for (const b of BOOK_PATCHES) {
    const sel = ['id', 'title', ...Object.keys(b.patch)].filter((v, i, s) => s.indexOf(v) === i).join(',')
    const { data: before, error: e1 } = await sb.from('books').select(sel).eq('id', b.id).single()
    if (e1) throw e1
    console.log(`\n--- book ${b.id} — ${b.why}`)
    console.log('BEFORE:', JSON.stringify(before))
    if (!APPLY) {
      console.log('AFTER : (dry run)')
      continue
    }
    const { data: after, error: e2 } = await sb
      .from('books')
      .update({ ...b.patch, updated_at: NOW })
      .eq('id', b.id)
      .select(sel)
    if (e2) throw e2
    bookRows += after?.length ?? 0
    console.log('AFTER :', JSON.stringify(after?.[0]))
  }

  console.log(`\n== rows: authors ${authorRows}, books ${bookRows}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
