// _seed_bbw_elsewhere_block_2026_09_07.ts — one-off, by hand, cited.
//
// Seeds the `bbw-elsewhere` content block and publishes it.
//
// WHY
// The hub's own `bbw-what-is` copy says Banned Books Week "remains a US-organised
// effort" and that "Other countries have adopted parallel initiatives" — and then
// never names one. The Netherlands runs its own week on a different calendar,
// two weeks earlier, and the site had no mention of it anywhere.
//
// SOURCES (fetched and cross-checked 2026-09-07)
//   https://bibliotheek.cpnb.nl/campagnes/de-week-van-het-verboden-boek/
//   https://www.probiblio.nl/week-van-het-verboden-boek-keert-terug-van-19-tm-27-september-2026/
//   http://cpnb.nl/nieuws/week-van-het-verboden-boek-keert-terug-van-19-t-m-27-september-2026/
// All three agree on: 19-27 September 2026; second edition (first ran 2025);
// organised by Probiblio, CPNB, PEN Nederland, de Schrijverscentrale and the
// Koninklijke Boekverkopersbond; campaign line "Verhalen mogen schuren".
// Note: that line is the campaign's own framing across all three sources, but
// none of them labels it "the 2026 theme" — so the copy below quotes it as the
// campaign's line, not as an official theme.
//
// body_html is rendered through the same marked -> sanitize-html pipeline the
// admin save path uses (src/lib/markdown.ts), so a later edit in the admin UI
// produces byte-identical output for unchanged markdown.
//
// Usage:  npx tsx --env-file=.env.local scripts/_seed_bbw_elsewhere_block_2026_09_07.ts [--apply]

import { isApply } from './lib/cli'

const SLUG = 'bbw-elsewhere'

const TITLE = 'BBW hub — Banned Books Week outside the US'

const PLACEHOLDER_BRIEF =
  'Name the national equivalents of Banned Books Week that run on their own calendar, ' +
  'starting with the Dutch Week van het Verboden Boek. Give real dates and organisers, ' +
  'link to the official campaign page, and say plainly how the framing differs from the ' +
  'US week. Update the dates every year.'

const BODY_MARKDOWN = `Banned Books Week is organised in the United States, and its dates are set there. Several countries now run their own version on their own calendar — worth knowing if you are trying to take part from outside the US.

The Netherlands has the **Week van het Verboden Boek**, which in 2026 runs from **19 to 27 September** — opening just over two weeks before Banned Books Week does. It is a joint campaign by CPNB, Probiblio, PEN Nederland, de Schrijverscentrale and the Koninklijke Boekverkopersbond, with libraries and bookshops across the country running readings, book tables and discussions. 2026 is the second edition; the first ran in 2025. The campaign's line is *"Verhalen mogen schuren"* — stories are allowed to chafe.

The two weeks are worth reading side by side. The Dutch campaign is built around free access to stories and perspectives; Banned Books Week is built around the First Amendment and the American library system. The same object, a different civic vocabulary — which is the argument this site keeps making: the American numbers are not the whole map.

Programme and participation details for the Dutch week are at [bibliotheek.cpnb.nl](https://bibliotheek.cpnb.nl/campagnes/de-week-van-het-verboden-boek/).`

async function main() {
  const APPLY = isApply()
  const { renderContentBlockHtml } = await import('../src/lib/markdown')
  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()

  const html = renderContentBlockHtml(BODY_MARKDOWN)

  const { data: before } = await sb
    .from('content_blocks')
    .select('slug, status, body_markdown, published_at')
    .eq('slug', SLUG)
    .maybeSingle()

  console.log('════ BEFORE ════')
  console.log(before ? JSON.stringify({ ...(before as any), body_markdown: `${(before as any).body_markdown?.length ?? 0}ch` }) : '  (block does not exist yet)')

  console.log('\n════ PLANNED ════')
  console.log(`  slug   ${SLUG}`)
  console.log(`  title  ${TITLE}`)
  console.log(`  status published`)
  console.log(`  md     ${BODY_MARKDOWN.length}ch -> html ${html.length}ch`)
  console.log(`\n${BODY_MARKDOWN}\n`)

  if (!APPLY) {
    console.log('DRY RUN — re-run with --apply to write.')
    return
  }

  const now = new Date().toISOString()
  const { error } = await sb.from('content_blocks').upsert(
    {
      slug: SLUG,
      title: TITLE,
      placeholder_brief: PLACEHOLDER_BRIEF,
      body_markdown: BODY_MARKDOWN,
      body_html: html,
      status: 'published',
      notes:
        'Dates change every year — re-check bibliotheek.cpnb.nl before each edition. ' +
        'Seeded 2026-09-07 from CPNB / Probiblio / cpnb.nl news (three sources agreeing).',
      last_edited_by: 'bbw-preflight 2026-09-07',
      last_edited_at: now,
      published_at: now,
    },
    { onConflict: 'slug' },
  )
  if (error) throw new Error(`upsert failed: ${error.message}`)

  await sb.from('editorial_publish_log').insert({
    content_type: 'content_block',
    content_key: SLUG,
    action: 'publish',
    notes: 'Seeded + published the Dutch Week van het Verboden Boek section on the BBW hub.',
  })

  const { data: after } = await sb
    .from('content_blocks')
    .select('slug, status, published_at, body_html')
    .eq('slug', SLUG)
    .single()
  console.log('════ AFTER ════')
  console.log(`  ${(after as any).slug} — ${(after as any).status}, published_at ${(after as any).published_at}, html ${(after as any).body_html.length}ch`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
