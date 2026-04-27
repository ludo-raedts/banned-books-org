/**
 * Fix: insert the missing bans for books added in batch 42.
 * Books were inserted but ban inserts failed due to confidence constraint.
 */

import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')
const supabase = adminClient()

async function main() {
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')

  const scopeId = (slug: string) => scopes!.find(s => s.slug === slug)!.id
  const reasonId = (slug: string) => reasons!.find(r => r.slug === slug)!.id
  const gov = scopeId('government')

  const bans = [
    {
      slug: 'the-raped-little-runaway',
      cc: 'IE', scope: gov, actionType: 'banned', status: 'active',
      yearStarted: 2016, yearEnded: null,
      reasons: ['obscenity', 'sexual'],
      description: `Register of Prohibited Publications, Part I. The 2025 minister confirmed possession and distribution remain criminal due to child sexual abuse content.`,
    },
    {
      slug: 'abortion-internationally',
      cc: 'IE', scope: gov, actionType: 'banned', status: 'active',
      yearStarted: 1983, yearEnded: null,
      reasons: ['moral'],
      description: `Register of Prohibited Publications, Part II. Legal basis (prohibition of abortion advocacy) abolished 2018; register not formally stood down as of 2025.`,
    },
    {
      slug: 'abortion-our-struggle-for-control',
      cc: 'IE', scope: gov, actionType: 'banned', status: 'active',
      yearStarted: 1983, yearEnded: null,
      reasons: ['moral'],
      description: `Register of Prohibited Publications, Part II. Legal basis abolished 2018; register not formally stood down as of 2025.`,
    },
    {
      slug: 'abortion-right-or-wrong',
      cc: 'IE', scope: gov, actionType: 'banned', status: 'active',
      yearStarted: 1942, yearEnded: null,
      reasons: ['moral'],
      description: `Register of Prohibited Publications, Part II. Explicitly cited by name in a 2025 parliamentary answer as still listed; legal basis abolished 2018.`,
    },
    {
      slug: 'how-to-drive-your-man-wild-in-bed',
      cc: 'IE', scope: gov, actionType: 'banned', status: 'active',
      yearStarted: 1985, yearEnded: null,
      reasons: ['sexual', 'obscenity'],
      description: `Register of Prohibited Publications, Part II. Still formally listed as of the 2025 parliamentary response.`,
    },
    {
      slug: 'into-the-river',
      cc: 'NZ', scope: gov, actionType: 'banned', status: 'historical',
      yearStarted: 2013, yearEnded: 2015,
      reasons: ['sexual', 'violence', 'drugs'],
      description: `Interim Restriction Order 2015 made possession and distribution a criminal offence. Lifted after challenge; returned to unrestricted status. Led to 2017 legislative amendment.`,
    },
  ]

  for (const ban of bans) {
    const { data: book } = await supabase.from('books').select('id').eq('slug', ban.slug).single()
    if (!book) { console.log(`[skip] book not found: ${ban.slug}`); continue }

    const { data: existingBan } = await supabase.from('bans').select('id').eq('book_id', book.id).eq('country_code', ban.cc).maybeSingle()
    if (existingBan) { console.log(`[skip] ban already exists: ${ban.slug} / ${ban.cc}`); continue }

    console.log(`[${ban.slug}] will insert ban (${ban.cc}, ${ban.status})`)
    if (!WRITE) continue

    const { data: banRow, error: banErr } = await supabase.from('bans').insert({
      book_id: book.id,
      country_code: ban.cc,
      scope_id: ban.scope,
      action_type: ban.actionType,
      status: ban.status,
      year_started: ban.yearStarted,
      year_ended: ban.yearEnded,
      description: ban.description,
    }).select('id').single()

    if (banErr || !banRow) { console.error(`  ✗ ${ban.slug}: ${banErr?.message}`); continue }

    for (const rSlug of ban.reasons) {
      const { error } = await supabase.from('ban_reason_links').insert({ ban_id: banRow.id, reason_id: reasonId(rSlug) })
      if (error) console.warn(`  [warn] reason ${rSlug}: ${error.message}`)
    }
    console.log(`  ✓ ban inserted — reasons: ${ban.reasons.join(', ')}`)
  }

  if (!WRITE) console.log('\n[DRY-RUN] Re-run with --write to apply.')
}

main().catch(e => { console.error(e); process.exit(1) })
