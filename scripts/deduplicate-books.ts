import { adminClient } from '../src/lib/supabase'

/**
 * Merges duplicate book records:
 * 1. Copies description from the record being deleted → the one being kept (if needed)
 * 2. Migrates bans from delete→keep for any country codes not already on keep
 * 3. Deletes ban_reason_links, ban_source_links, bans, book_authors, then the book itself
 */

const supabase = adminClient()

async function getBook(slug: string) {
  const { data: book } = await supabase.from('books').select('id, slug, title, description').eq('slug', slug).single()
  if (!book) throw new Error(`Book not found: ${slug}`)
  const { data: bans } = await supabase.from('bans').select('id, country_code, scope_id, action_type, status, year_started, actor, description, ban_reason_links(reason_id), ban_source_links(source_id)').eq('book_id', book.id)
  return { ...book, bans: (bans ?? []) as any[] }
}

async function mergeThenDelete(keepSlug: string, deleteSlug: string) {
  let keep: any, del: any
  try {
    keep = await getBook(keepSlug)
    del  = await getBook(deleteSlug)
  } catch (e: any) {
    console.log(`  [skip] ${e.message}`)
    return
  }

  // 1. Copy description if keep has none
  if (!keep.description && del.description) {
    await supabase.from('books').update({ description: del.description }).eq('id', keep.id)
    console.log(`    ↳ Copied description from ${deleteSlug}`)
  }

  // 2. Migrate bans that don't exist on keep
  const keepCountries = new Set(keep.bans.map((b: any) => b.country_code))
  for (const ban of del.bans) {
    if (keepCountries.has(ban.country_code)) {
      console.log(`    ↳ Skip duplicate ban ${ban.country_code} (already on keep)`)
      continue
    }
    // Insert ban on keep
    const { data: newBan } = await supabase.from('bans').insert({
      book_id: keep.id,
      country_code: ban.country_code,
      scope_id: ban.scope_id,
      action_type: ban.action_type,
      status: ban.status,
      year_started: ban.year_started,
      actor: ban.actor,
      description: ban.description,
    }).select('id').single()
    if (newBan) {
      for (const rl of ban.ban_reason_links ?? []) {
        await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: rl.reason_id })
      }
      for (const sl of ban.ban_source_links ?? []) {
        await supabase.from('ban_source_links').insert({ ban_id: newBan.id, source_id: sl.source_id })
      }
      console.log(`    ↳ Migrated ${ban.country_code} ban`)
    }
  }

  // 3. Delete the duplicate record
  for (const ban of del.bans) {
    await supabase.from('ban_source_links').delete().eq('ban_id', ban.id)
    await supabase.from('ban_reason_links').delete().eq('ban_id', ban.id)
    await supabase.from('bans').delete().eq('id', ban.id)
  }
  await supabase.from('book_authors').delete().eq('book_id', del.id)
  const { error } = await supabase.from('books').delete().eq('id', del.id)
  if (error) {
    console.error(`  [error] deleting ${deleteSlug}: ${error.message}`)
  } else {
    console.log(`  ✓ Deleted "${del.title}" (${deleteSlug}) → kept "${keep.title}" (${keepSlug})`)
  }
}

async function main() {
  // ── Confirmed exact duplicates ─────────────────────────────────────
  // Format: [keepSlug, deleteSlug]
  const pairs: [string, string][] = [
    // Bones by Chenjerai Hove
    ['bones-chenjerai-hove', 'bones-hove'],

    // Crank by Ellen Hopkins (keep original slug with US ban; delete batch20 duplicate)
    ['crank', 'crank-hopkins'],

    // Damsel by Elana K. Arnold
    ['damsel', 'damsel-arnold'],

    // Dialogue Concerning the Two Chief World Systems — Galileo
    ['dialogue-galileo', 'dialogue-concerning-the-two-chief-world-systems'],

    // Five Bandits by Kim Chi-ha
    ['five-bandits', 'five-bandits-kim-chi-ha'],

    // Fontamara by Ignazio Silone
    ['fontamara', 'fontamara-silone'],

    // Lajja by Taslima Nasrin (keep the one with BD+IR; delete BD-only duplicate)
    ['lajja', 'lajja-taslima-nasrin'],

    // Naked Lunch by Burroughs (keep GB+US record; delete GB-only; copy description)
    ['naked-lunch', 'the-naked-lunch'],

    // Open Veins of Latin America — Galeano (keep record with BR ban; delete partial)
    ['open-veins-of-latin-america', 'the-open-veins-of-latin-america'],

    // Shivaji: Hindu King in Islamic India — full title slug wins
    ['shivaji-hindu-king-in-islamic-india', 'shivaji-hindu-king'],

    // Sold by Patricia McCormick
    ['sold-patricia-mccormick', 'sold-mccormick'],

    // Speak by Laurie Halse Anderson
    ['speak', 'speak-anderson'],

    // Stamped by Jason Reynolds
    ['stamped-racism-antiracism-and-you', 'stamped-racism'],

    // Story of O — correct title has "The"
    ['the-story-of-o', 'story-of-o'],

    // The Forty Rules of Love — Elif Şafak
    ['the-forty-rules-of-love', 'the-forty-rules-of-love-tr'],

    // The Hive by Camilo José Cela
    ['the-hive', 'the-hive-cela'],

    // The Joke by Milan Kundera
    ['the-joke-kundera', 'the-joke-milan-kundera'],

    // The Jungle by Upton Sinclair (keep, will gain DE+SU bans from duplicate)
    ['the-jungle', 'the-jungle-upton-sinclair'],

    // The Satanic Verses — India edition was a pointless duplicate
    ['the-satanic-verses', 'the-satanic-verses-india'],

    // The Well of Loneliness by Radclyffe Hall
    ['the-well-of-loneliness', 'the-well-of-loneliness-uk'],

    // Wire Harp by Wolf Biermann
    ['the-wire-harp-wolf-biermann', 'wire-harp-biermann'],

    // Drama (graphic novel) — Raina Telgemeier: same book, two slugs
    ['drama-telgemeier', 'drama-a-graphic-novel'],

    // Last Exit to Brooklyn — Hubert Selby Jr.
    ['last-exit-to-brooklyn', 'last-exit-to-brooklyn-gb'],

    // Lucky by Alice Sebold — -as slug has correct author spelling; fix author on remaining
    ['lucky-as', 'lucky'],

    // Melissa / George — Alex Gino (same book, different title eras)
    ['melissa-alex-gino', 'melissa-george'],

    // Tricks by Ellen Hopkins
    ['tricks', 'tricks-tricks-series'],

    // Watchmen — Alan Moore & Dave Gibbons
    ['watchmen', 'watchmen-comics'],
  ]

  for (const [keep, del] of pairs) {
    console.log(`\nMerging: ${del} → ${keep}`)
    await mergeThenDelete(keep, del)
  }

  // ── Fix misspelled author on lucky-as ──────────────────────────────
  // lucky had "Alice Seabold"; lucky-as should have "Alice Sebold"
  {
    const { data: book } = await supabase.from('books').select('id').eq('slug', 'lucky-as').single()
    if (book) {
      const { data: ba } = await supabase.from('book_authors').select('author_id, authors(slug, display_name)').eq('book_id', book.id) as any
      const author = ba?.[0]?.authors
      if (author?.display_name === 'Alice Seabold') {
        await supabase.from('authors').update({ display_name: 'Alice Sebold' }).eq('id', ba[0].author_id)
        console.log('\n  Fixed author spelling: Alice Seabold → Alice Sebold')
      }
    }
  }

  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books: ${count}`)
}

main().catch(console.error)
