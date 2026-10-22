/**
 * _botd_week_2026_09_08.ts — pre-flight fix for the book-of-the-day pick that
 * rolled into the window when the date turned over (2026-09-08, Mason Deaver,
 * "I Wish You All the Best"). Produced by the /botd-week skill.
 *
 * Bio from the author's own about page (recorded in bio_source_url); links from
 * that page + Wikidata Q133260754 (probed 2026-09-01); closing censorship
 * sentence grounded in our own bans rows.
 *
 * NOTE the photo fix: authors.photo_url held the NOVEL'S COVER
 * (upload.wikimedia.org/wikipedia/en/d/d3/I_wish_you_all_the_best.jpg) as the
 * author portrait. Replaced with the Commons portrait (File:Mason Deaver.jpg,
 * CC BY-SA 4.0, "Mason Deaver at Loudmouth Books in Indianapolis, IN, January
 * 2024") after viewing it — a person in front of a YOUNG ADULT bookshelf,
 * consistent with the description — and stickied via photo_v2_checked_at.
 *
 * Read-only by default; pass --apply to write.
 */
import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { isApply } from './lib/cli'

const NOW = new Date().toISOString()
const APPLY = isApply()

const PATCH: Record<string, unknown> = {
  bio: [
    'Mason Deaver (pronouns: they/them) is an American author of young adult fiction and adult romance. They were born in North Carolina and now live in San Francisco.',
    'Their debut young adult novel, I Wish You All the Best (2019), about a nonbinary teenager thrown out of the family home after coming out, was an instant bestseller and was named to Cosmopolitan’s 100 Best YA Books; a film adaptation written and directed by Tommy Dorfman premiered at SXSW in 2024. Their debut adult romance, The Build-A-Boyfriend Project, drew a starred Booklist review, made an Editors’ Choice list for 2025 and was named an Amazon Best Romance of 2025. Their books have been translated into several languages, have taken starred reviews from BookPage and Booklist, have been nominated for the Goodreads Choice Awards, and have won the PinkNews Best Young Adult Book Award.',
    'Three Deaver titles appear in this database, with nine recorded bans and restrictions, all of them in the United States. I Wish You All the Best is restricted in Clay County School District in Florida and Collierville Schools in Tennessee (both 2022) and in Katy Independent School District in Texas and Clear Creek-Amana Community School District in Iowa (both 2024), and was banned outright across the Department of Defense Education Activity’s schools in 2025 — the same 2025 DoDEA removal that also took Okay, Cupid and The Feeling of Falling in Love.',
  ].join('\n\n'),
  bio_source_type: 'manual',
  bio_source_url: 'https://www.masondeaverwrites.com/about-1',
  wikidata_id: 'Q133260754',
  website_url: 'https://www.masondeaverwrites.com/',
  social_links: {
    instagram: 'https://www.instagram.com/mason_deaver/',
    viaf: 'https://viaf.org/viaf/38155767446827762988',
  },
  photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Mason_Deaver.jpg/500px-Mason_Deaver.jpg',
  photo_v2_checked_at: NOW,
  birth_country: 'United States',
  links_checked_at: NOW,
}

async function main() {
  const sb = adminClient()
  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN (pass --apply to write) ===')
  if (!isAllowedImageUrl(PATCH.photo_url as string)) throw new Error('photo_url rejected by isAllowedImageUrl')

  const sel = ['id', 'slug', 'display_name', ...Object.keys(PATCH)].filter((v, i, s) => s.indexOf(v) === i).join(',')
  const { data: before, error: e1 } = await sb.from('authors').select(sel).eq('id', 1130).single()
  if (e1) throw e1
  console.log('BEFORE:', JSON.stringify(before))
  if (!APPLY) {
    console.log('AFTER : (dry run) would set', JSON.stringify(Object.keys(PATCH)))
    return
  }
  const { data: after, error: e2 } = await sb
    .from('authors')
    .update({ ...PATCH, updated_at: NOW })
    .eq('id', 1130)
    .select(sel)
  if (e2) throw e2
  console.log('AFTER :', JSON.stringify(after?.[0]))
  console.log(`\n== rows: authors ${after?.length ?? 0}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
