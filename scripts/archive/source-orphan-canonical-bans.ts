// source-orphan-canonical-bans.ts — attach the per-book English Wikipedia page
// as the source citation to the 46 "canonical" seed bans that were left with
// zero ban_source_links.
//
// ORIGIN (established from git history): these bans were inserted by a series of
// hand-curated bulk-import batches on 2026-04-24/25 and 2026-05-04
// (scripts/add-books-batch*.ts, since deleted), built from Wikipedia
// government-ban lists + ALA/PEN. Every book in those seeds carried a `wikiUrl`
// (its English Wikipedia article) that was meant to become the ban source — but
// the earliest batches predate the ban_source_links code, so the link was never
// created. This script finishes that original intent.
//
// Each book is linked to ITS OWN Wikipedia article (NOT the generic
// "List of books banned by governments" row, and NOT the wrong
// "National Security Act (South Korea)" row that Das Kapital had picked up).
// All 31 URLs were HTTP-verified (200) before committing them here.
//
// find-or-create by source_url means books whose own Wikipedia source row
// already exists (Animal Farm #10, 1984 #1, …) are reused, not duplicated.
//
// Idempotent. Run (dry): pnpm tsx --env-file=.env.local scripts/source-orphan-canonical-bans.ts
//             (write):   …/source-orphan-canonical-bans.ts --apply

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const sb = adminClient()

// book slug → its own English Wikipedia article (all verified HTTP 200, 2026-06-04)
const WIKI: Record<string, string> = {
  'mein-kampf': 'https://en.wikipedia.org/wiki/Mein_Kampf',
  'das-kapital': 'https://en.wikipedia.org/wiki/Das_Kapital',
  'son-lois-lowry': 'https://en.wikipedia.org/wiki/Son_(novel)',
  'the-general-in-his-labyrinth': 'https://en.wikipedia.org/wiki/The_General_in_His_Labyrinth',
  'animal-farm': 'https://en.wikipedia.org/wiki/Animal_Farm',
  'one-hundred-years-of-solitude': 'https://en.wikipedia.org/wiki/One_Hundred_Years_of_Solitude',
  'the-da-vinci-code': 'https://en.wikipedia.org/wiki/The_Da_Vinci_Code',
  '1984': 'https://en.wikipedia.org/wiki/Nineteen_Eighty-Four',
  'canto-general': 'https://en.wikipedia.org/wiki/Canto_General',
  'the-captive-mind': 'https://en.wikipedia.org/wiki/The_Captive_Mind',
  'the-tin-drum': 'https://en.wikipedia.org/wiki/The_Tin_Drum',
  'candide': 'https://en.wikipedia.org/wiki/Candide',
  'the-origin-of-species': 'https://en.wikipedia.org/wiki/On_the_Origin_of_Species',
  'lolita': 'https://en.wikipedia.org/wiki/Lolita',
  'lajja': 'https://en.wikipedia.org/wiki/Lajja_(novel)',
  'les-miserables': 'https://en.wikipedia.org/wiki/Les_Mis%C3%A9rables',
  'the-trial': 'https://en.wikipedia.org/wiki/The_Trial',
  'the-great-gatsby': 'https://en.wikipedia.org/wiki/The_Great_Gatsby',
  'peoples-republic-of-amnesia': "https://en.wikipedia.org/wiki/The_People%27s_Republic_of_Amnesia",
  'the-metamorphosis': 'https://en.wikipedia.org/wiki/The_Metamorphosis',
  'death-of-a-salesman': 'https://en.wikipedia.org/wiki/Death_of_a_Salesman',
  'the-prophet-gibran': 'https://en.wikipedia.org/wiki/The_Prophet_(book)',
  'all-quiet-on-the-western-front': 'https://en.wikipedia.org/wiki/All_Quiet_on_the_Western_Front',
  'lady-chatterleys-lover': "https://en.wikipedia.org/wiki/Lady_Chatterley%27s_Lover",
  'the-sorrow-of-war': 'https://en.wikipedia.org/wiki/The_Sorrow_of_War',
  'the-line-of-beauty': 'https://en.wikipedia.org/wiki/The_Line_of_Beauty',
  'the-vagina-monologues': 'https://en.wikipedia.org/wiki/The_Vagina_Monologues',
  'forever-amber': 'https://en.wikipedia.org/wiki/Forever_Amber',
  'the-new-class': 'https://en.wikipedia.org/wiki/The_New_Class:_An_Analysis_of_the_Communist_System',
  'detained-a-writers-prison-diary': "https://en.wikipedia.org/wiki/Ng%C5%A9g%C4%A9_wa_Thiong%27o",
  'quran': 'https://en.wikipedia.org/wiki/Quran',
}

async function banIdsWithSource(): Promise<Set<number>> {
  const s = new Set<number>()
  let from = 0
  const PAGE = 1000
  for (;;) {
    const { data, error } = await sb
      .from('ban_source_links')
      .select('ban_id')
      .order('ban_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    for (const r of data as { ban_id: number }[]) s.add(r.ban_id)
    if (data.length < PAGE) break
    from += PAGE
  }
  return s
}

const sourceCache = new Map<string, number>()
async function findOrCreateWikiSource(url: string): Promise<number> {
  if (sourceCache.has(url)) return sourceCache.get(url)!
  const { data: existing, error } = await sb.from('ban_sources').select('id').eq('source_url', url).limit(1)
  if (error) throw error
  if (existing?.length) {
    sourceCache.set(url, existing[0].id)
    return existing[0].id
  }
  if (!APPLY) {
    sourceCache.set(url, -1)
    console.log(`  [dry] would CREATE ban_sources: Wikipedia — ${url}`)
    return -1
  }
  const { data, error: insErr } = await sb
    .from('ban_sources')
    .insert({ source_name: 'Wikipedia', source_url: url, source_type: 'web', accessed_at: '2026-06-04' })
    .select('id')
    .single()
  if (insErr) throw insErr
  sourceCache.set(url, data.id)
  console.log(`  created ban_sources #${data.id}: Wikipedia — ${url}`)
  return data.id
}

async function run() {
  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN (pass --apply to write) ===')
  const withSrc = await banIdsWithSource()

  // all bans for the books we know about, restricted to the orphans
  const slugs = Object.keys(WIKI)
  const { data: books, error: be } = await sb.from('books').select('id, slug').in('slug', slugs)
  if (be) throw be
  const idToSlug = new Map<number, string>((books as { id: number; slug: string }[]).map((b) => [b.id, b.slug]))
  const bookIds = [...idToSlug.keys()]

  const { data: bans, error } = await sb.from('bans').select('id, book_id').in('book_id', bookIds)
  if (error) throw error
  const orphans = (bans as { id: number; book_id: number }[]).filter((b) => !withSrc.has(b.id))

  console.log(`${orphans.length} canonical orphan bans to source\n`)
  let linked = 0
  for (const ban of orphans) {
    const slug = idToSlug.get(ban.book_id)!
    const url = WIKI[slug]
    if (!url) throw new Error(`no Wikipedia URL mapped for slug ${slug}`)
    const sourceId = await findOrCreateWikiSource(url)
    if (sourceId === -1) {
      console.log(`  [dry] ban #${ban.id} (${slug}) → ${url}`)
      continue
    }
    if (APPLY) {
      const { error: le } = await sb
        .from('ban_source_links')
        .upsert([{ ban_id: ban.id, source_id: sourceId }], { onConflict: 'ban_id,source_id', ignoreDuplicates: true })
      if (le) throw le
    }
    console.log(`  ban #${ban.id} (${slug}) → src#${sourceId}`)
    linked++
  }
  console.log(`\n${APPLY ? 'Linked' : '[dry] would link'} ${linked} bans.`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
