/**
 * Colorado CDHE banned book list updates.
 * Source: https://cdhe.colorado.gov/banned-book-list
 *
 * Actions:
 * 1. Create 3 missing books + US school ban
 * 2. Add US school bans for brave-new-world and the-god-of-small-things
 * 3. Fix 'other' reasons on fahrenheit-451, lawn-boy, the-poet-x, this-book-is-gay
 */
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()
const SOURCE_URL = 'https://cdhe.colorado.gov/banned-book-list'
const SOURCE_NAME = 'Colorado Department of Higher Education'

async function fetchOL(title: string, author: string): Promise<{ coverUrl: string | null; publishYear: number | null }> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=cover_i,first_publish_year&limit=1`)
    const json = await res.json() as { docs: Array<{ cover_i?: number; first_publish_year?: number }> }
    const doc = json.docs?.[0]
    return {
      coverUrl: doc?.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      publishYear: doc?.first_publish_year ?? null,
    }
  } catch { return { coverUrl: null, publishYear: null } }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function getOrCreateAuthor(display: string, slug: string): Promise<number> {
  const { data: existing } = await supabase.from('authors').select('id').eq('slug', slug).single()
  if (existing) return existing.id
  const { data } = await supabase.from('authors').insert({ display_name: display, slug }).select('id').single()
  return data!.id
}

async function getReason(slug: string): Promise<number> {
  const { data } = await supabase.from('reasons').select('id').eq('slug', slug).single()
  if (!data) throw new Error(`Reason not found: ${slug}`)
  return data.id
}

async function getScope(slug: string): Promise<number> {
  const { data } = await supabase.from('scopes').select('id').eq('slug', slug).single()
  return data!.id
}

async function main() {
  // Upsert source
  const { data: srcData } = await supabase
    .from('ban_sources')
    .upsert({ source_name: SOURCE_NAME, source_url: SOURCE_URL }, { onConflict: 'source_url' })
    .select('id').single()
  const sourceId = srcData!.id
  const schoolScopeId = await getScope('school')

  console.log(`Source id=${sourceId}\n`)

  // ─── 1. Create missing books ────────────────────────────────────────────────

  const newBooks = [
    {
      title: 'A Lesson Before Dying', slug: 'a-lesson-before-dying',
      author: 'Ernest J. Gaines', authorSlug: 'ernest-j-gaines',
      year: 1993, genres: ['fiction', 'historical'],
      reasons: ['sexual', 'violence', 'language'],
    },
    {
      title: 'Born a Crime', slug: 'born-a-crime',
      author: 'Trevor Noah', authorSlug: 'trevor-noah',
      year: 2016, genres: ['memoir', 'nonfiction'],
      reasons: ['religious'],
    },
    {
      title: 'The Curious Incident of the Dog in the Night-Time', slug: 'the-curious-incident-of-the-dog-in-the-night-time',
      author: 'Mark Haddon', authorSlug: 'mark-haddon',
      year: 2003, genres: ['fiction', 'mystery'],
      reasons: ['religious', 'language'],
    },
  ]

  for (const b of newBooks) {
    const { data: existing } = await supabase.from('books').select('id').eq('slug', b.slug).single()
    if (existing) { console.log(`  [skip] ${b.slug}: already exists`); continue }

    process.stdout.write(`  Creating ${b.title}... cover `)
    const ol = await fetchOL(b.title, b.author)
    await sleep(500)
    console.log(ol.coverUrl ? 'ok' : 'none')

    const authorId = await getOrCreateAuthor(b.author, b.authorSlug)

    const { data: book, error: be } = await supabase.from('books').insert({
      title: b.title, slug: b.slug, original_language: 'en',
      first_published_year: b.year, genres: b.genres,
      cover_url: ol.coverUrl, ai_drafted: false,
    }).select('id').single()
    if (be || !book) { console.log(`  ✗ ${b.slug}: ${be?.message}`); continue }

    await supabase.from('book_authors').insert({ book_id: book.id, author_id: authorId })

    const { data: ban, error: bane } = await supabase.from('bans').insert({
      book_id: book.id, country_code: 'US', scope_id: schoolScopeId,
      action_type: 'challenged', status: 'active', year_started: null,
    }).select('id').single()
    if (bane || !ban) { console.log(`  ✗ ban: ${bane?.message}`); continue }

    for (const r of b.reasons) {
      await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: await getReason(r) })
    }
    await supabase.from('ban_source_links').insert({ ban_id: ban.id, source_id: sourceId })
    console.log(`  ✓ created ${b.slug} with ban #${ban.id}`)
  }

  // ─── 2. Add US school bans for books that have none ─────────────────────────

  const addBans = [
    { slug: 'brave-new-world',      reasons: ['sexual', 'religious', 'drugs', 'language'] },
    { slug: 'the-god-of-small-things', reasons: ['sexual', 'religious'] },
  ]

  for (const item of addBans) {
    const { data: book } = await supabase.from('books').select('id').eq('slug', item.slug).single()
    if (!book) { console.log(`  [skip] ${item.slug}: not found`); continue }

    // Check no existing US school ban
    const { data: existing } = await supabase.from('bans')
      .select('id').eq('book_id', book.id).eq('country_code', 'US')
    if ((existing ?? []).length > 0) { console.log(`  [skip] ${item.slug}: US ban already exists`); continue }

    const { data: ban, error: bane } = await supabase.from('bans').insert({
      book_id: book.id, country_code: 'US', scope_id: schoolScopeId,
      action_type: 'challenged', status: 'active', year_started: null,
    }).select('id').single()
    if (bane || !ban) { console.log(`  ✗ ${item.slug}: ${bane?.message}`); continue }

    for (const r of item.reasons) {
      await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: await getReason(r) })
    }
    await supabase.from('ban_source_links').insert({ ban_id: ban.id, source_id: sourceId })
    console.log(`  ✓ added US school ban to ${item.slug} (${item.reasons.join(', ')})`)
  }

  // ─── 3. Fix 'other' reasons on existing bans ────────────────────────────────

  const fixReasons = [
    { slug: 'fahrenheit-451',  reasons: ['sexual', 'violence', 'drugs', 'religious', 'language'] },
    { slug: 'lawn-boy',        reasons: ['lgbtq', 'sexual'] },
    { slug: 'the-poet-x',     reasons: ['religious'] },
    { slug: 'this-book-is-gay', reasons: ['lgbtq', 'sexual'] },
  ]

  const { data: otherReason } = await supabase.from('reasons').select('id').eq('slug', 'other').single()
  const otherReasonId = otherReason!.id

  for (const item of fixReasons) {
    const { data: book } = await supabase.from('books').select('id').eq('slug', item.slug).single()
    if (!book) { console.log(`  [skip] ${item.slug}: not found`); continue }

    // Find US school bans with only 'other' as reason
    const { data: bans } = await supabase.from('bans')
      .select('id, ban_reason_links(reason_id)')
      .eq('book_id', book.id).eq('country_code', 'US')
    if (!bans?.length) { console.log(`  [skip] ${item.slug}: no US bans`); continue }

    for (const ban of bans) {
      const reasonIds = (ban.ban_reason_links as any[]).map((l: any) => l.reason_id)
      const isOnlyOther = reasonIds.length === 1 && reasonIds[0] === otherReasonId
      if (!isOnlyOther) continue

      // Delete 'other' link and replace with proper reasons
      await supabase.from('ban_reason_links').delete().eq('ban_id', ban.id).eq('reason_id', otherReasonId)
      for (const r of item.reasons) {
        await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: await getReason(r) })
      }
      // Add source if not already linked
      await supabase.from('ban_source_links').upsert(
        { ban_id: ban.id, source_id: sourceId },
        { onConflict: 'ban_id,source_id' }
      )
      console.log(`  ✓ fixed ${item.slug} ban #${ban.id}: other → ${item.reasons.join(', ')}`)
    }
  }

  console.log('\nDone.')
}

main().catch(console.error)
