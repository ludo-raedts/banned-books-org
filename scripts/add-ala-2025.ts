/**
 * Add ALA Most Challenged Books of 2025 as new ban records.
 * Source: https://www.ala.org/bbooks/book-ban-data
 */
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

const SCOPE_SCHOOL = 1
const SOURCE_URL = 'https://www.ala.org/bbooks/book-ban-data'
const SOURCE_NAME = 'ALA Office for Intellectual Freedom'

const BOOKS: { slug: string; reasons: string[] }[] = [
  { slug: 'sold-patricia-mccormick',          reasons: ['sexual'] },
  { slug: 'the-perks-of-being-a-wallflower',  reasons: ['lgbtq', 'sexual'] },
  { slug: 'gender-queer',                      reasons: ['lgbtq'] },
  { slug: 'empire-of-storms',                  reasons: ['sexual'] },
  { slug: 'last-night-at-the-telegraph-club',  reasons: ['lgbtq'] },
  { slug: 'tricks',                            reasons: ['sexual'] },
  { slug: 'a-court-of-thorns-and-roses',       reasons: ['sexual'] },
  { slug: 'a-clockwork-orange',                reasons: ['violence'] },
  { slug: 'identical',                         reasons: ['sexual'] },
  { slug: 'looking-for-alaska',                reasons: ['sexual'] },
  { slug: 'storm-and-fury',                    reasons: ['sexual'] },
]

async function main() {
  // Fetch reason IDs
  const { data: reasonRows } = await supabase.from('reasons').select('id, slug')
  const reasonMap = Object.fromEntries((reasonRows ?? []).map(r => [r.slug, r.id]))

  // Fetch or create the ALA ban source
  let sourceId: number
  const { data: existingSource } = await supabase
    .from('ban_sources')
    .select('id')
    .eq('source_url', SOURCE_URL)
    .single()

  if (existingSource) {
    sourceId = existingSource.id
  } else {
    const { data: newSource, error } = await supabase
      .from('ban_sources')
      .insert({ source_name: SOURCE_NAME, source_url: SOURCE_URL })
      .select('id')
      .single()
    if (error || !newSource) { console.error('Could not create source:', error?.message); process.exit(1) }
    sourceId = newSource.id
  }

  console.log(`Using source id=${sourceId} (${SOURCE_NAME})\n`)

  for (const { slug, reasons } of BOOKS) {
    // Look up book
    const { data: book } = await supabase
      .from('books')
      .select('id, title')
      .eq('slug', slug)
      .single()

    if (!book) { console.log(`  [skip] ${slug}: not found`); continue }

    // Insert the 2025 ban
    const { data: ban, error: banErr } = await supabase
      .from('bans')
      .insert({
        book_id: book.id,
        country_code: 'US',
        scope_id: SCOPE_SCHOOL,
        year_started: 2025,
        status: 'active',
        action_type: 'challenged',
      })
      .select('id')
      .single()

    if (banErr || !ban) {
      console.log(`  ✗ ${slug}: ${banErr?.message}`)
      continue
    }

    // Link reasons
    const reasonLinks = reasons.map(r => ({ ban_id: ban.id, reason_id: reasonMap[r] }))
    const { error: reasonErr } = await supabase.from('ban_reason_links').insert(reasonLinks)
    if (reasonErr) { console.log(`  ✗ ${slug} reasons: ${reasonErr.message}`); continue }

    // Link source
    const { error: sourceErr } = await supabase
      .from('ban_source_links')
      .insert({ ban_id: ban.id, source_id: sourceId })
    if (sourceErr) { console.log(`  ✗ ${slug} source: ${sourceErr.message}`); continue }

    console.log(`  ✓ ${book.title} → ban #${ban.id} (${reasons.join(', ')})`)
  }

  console.log('\nDone.')
}

main().catch(console.error)
