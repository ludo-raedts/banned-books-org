/**
 * Reclassify books whose only ban reason is "other" by inferring the correct
 * reason(s) from their description_ban / description text.
 *
 * For each affected ban:
 *   1. Infer specific reason(s) from the description
 *   2. Add missing reason links
 *   3. Remove the "other" reason link — but ONLY when at least one specific
 *      reason was successfully added
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/reclassify-other-reasons.ts        # dry-run
 *   npx tsx --env-file=.env.local scripts/reclassify-other-reasons.ts --write
 */
import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')

// Reason slug → id (from DB audit)
const REASON_IDS: Record<string, number> = {
  lgbtq: 1, political: 2, religious: 3, sexual: 4,
  violence: 5, racial: 6, drugs: 7, other: 8,
  obscenity: 9, language: 10, moral: 11, blasphemy: 12,
}

function inferReasons(desc: string): string[] {
  const t = desc.toLowerCase()
  const found = new Set<string>()

  if (/lgbtq|lesbian|gay |same-sex|transgender|\btrans\b|queer|gender identity|gender expression|gender-fluid|genderqueer|non-?binary|bisexual|sexual identity|conversion therapy|homosexual|coming out|pride |rainbow flag|same sex|intersex|asexual/.test(t))
    found.add('lgbtq')

  // sexual: look for explicit sexual content — but not just "sexuality" alone,
  // which could be LGBTQ identity discussion
  if (/sexual content|explicit sex|sex scene|erotic|pornograph|sexually explicit|sexual relationship|sexual references|adult romantic|sexual material|sexual violence|sexual assault|sexual abuse|obscene|nude|nudity|incest|prostitut|rape|masturbat|genitalia/.test(t))
    found.add('sexual')

  if (/\bviolence\b|violent|murder|graphic depic|graphic content|torture|war crime|brutal|gore|graphic|killing|assault|abuse|self.harm|suicide|self-harm|gun violence|domestic abuse|kidnap|captiv/.test(t))
    found.add('violence')

  if (/\brace\b|racism|racial|systemic racism|police violence|police brutality|kkk|racial slur|n-word|white supremac|civil rights|black teenager|anti-?black|anti-?racism|colonialism|segregation|slavery|microagression|microaggression|reparation/.test(t))
    found.add('racial')

  if (/drug use|\bdrugs?\b|addiction|substance abuse|\balcohol\b|narcotics|heroin|cocaine|marijuana|cannabis/.test(t))
    found.add('drugs')

  // religious: specific religious objection, not just "religion" appearing in a fantasy plot
  if (/religious content|religious objection|religious material|religious upbringing|anti-?religious|irreverence|religious group|anti.christian|anti.islam|blasphemy|faith.based|witchcraft|occult|satanism|biblical|supernatural (belief|concern)/.test(t))
    found.add('religious')

  // political: deliberate political censorship or challenged for political ideology/commentary
  if (/politic|totalitarian|communist|communism|capitalism|authoritarian|systemic inequality|social justice|protest|policing|anti-?authoritarian|marxis|censorship of|ideologic/.test(t))
    found.add('political')

  if (/obscen/.test(t) && !found.has('sexual'))
    found.add('obscenity')

  if (/blasphemy|blasphemous/.test(t))
    found.add('blasphemy')

  return [...found]
}

async function main() {
  const s = adminClient()

  const { data: reasons } = await s.from('reasons').select('id, slug')
  const otherId = reasons?.find(r => r.slug === 'other')?.id
  if (!otherId) { console.error('other reason not found'); process.exit(1) }

  // Get all ban_reason_links for "other"
  const { data: otherLinks } = await s
    .from('ban_reason_links')
    .select('ban_id, bans(book_id)')
    .eq('reason_id', otherId)

  // book_id → ban_ids that have "other"
  const bookBanMap = new Map<number, number[]>()
  for (const link of otherLinks ?? []) {
    const bookId = (link.bans as any)?.book_id
    if (!bookId) continue
    if (!bookBanMap.has(bookId)) bookBanMap.set(bookId, [])
    bookBanMap.get(bookId)!.push(link.ban_id)
  }

  // Load those books' descriptions + existing reasons
  const bookIds = [...bookBanMap.keys()]
  const { data: books } = await s
    .from('books')
    .select('id, title, slug, description_ban, description, bans(id, ban_reason_links(reason_id))')
    .in('id', bookIds)

  // Build: bookId → existing reason ids across all bans
  const existingReasonsByBan = new Map<number, Set<number>>()
  for (const book of books ?? []) {
    for (const ban of (book.bans as any[]) ?? []) {
      const set = new Set<number>((ban.ban_reason_links as any[]).map((l: any) => l.reason_id))
      existingReasonsByBan.set(ban.id, set)
    }
  }

  let totalBooks = 0, totalAdded = 0, totalRemoved = 0, noMatch = 0

  for (const book of books ?? []) {
    const desc = (book.description_ban ?? book.description ?? '').trim()
    if (!desc) { noMatch++; continue }

    const inferred = inferReasons(desc)
    if (inferred.length === 0) { noMatch++; continue }

    const banIds = bookBanMap.get(book.id) ?? []
    let bookModified = false

    if (!WRITE) {
      // Dry-run: just report
      const existingReasonSlugs = [...(existingReasonsByBan.get(banIds[0]) ?? [])].map(
        id => reasons?.find(r => r.id === id)?.slug
      ).filter(Boolean)
      const toAdd = inferred.filter(r => !existingReasonSlugs.includes(r) && r !== 'other')
      console.log(`[${book.slug}]`)
      console.log(`  Current: ${existingReasonSlugs.join(', ')} | Inferred: ${inferred.join(', ')}`)
      if (toAdd.length) console.log(`  → ADD: ${toAdd.join(', ')} | REMOVE: other`)
      else console.log(`  → REMOVE other (inferred already present)`)
      continue
    }

    // WRITE mode
    for (const banId of banIds) {
      const existing = existingReasonsByBan.get(banId) ?? new Set()

      // Add new reason links
      const toAdd = inferred
        .map(slug => REASON_IDS[slug])
        .filter(id => id && !existing.has(id))

      if (toAdd.length > 0) {
        const inserts = toAdd.map(reasonId => ({ ban_id: banId, reason_id: reasonId }))
        const { error } = await s.from('ban_reason_links').insert(inserts)
        if (error) { console.error(`  insert error ban ${banId}:`, error.message); continue }
        totalAdded += toAdd.length
        bookModified = true
      }

      // Remove "other" reason link
      const { error: delErr } = await s
        .from('ban_reason_links')
        .delete()
        .eq('ban_id', banId)
        .eq('reason_id', otherId)
      if (delErr) { console.error(`  delete error ban ${banId}:`, delErr.message); continue }
      totalRemoved++
      bookModified = true
    }

    if (bookModified) {
      totalBooks++
      process.stderr.write(`  ✓ ${book.title} → ${inferred.join(', ')}\n`)
    }
  }

  if (!WRITE) {
    console.log(`\n[DRY-RUN] Would update books. Re-run with --write to apply.`)
    console.log(`No-match (kept as "other"): ${noMatch}`)
  } else {
    console.log(`\nDone. Books updated: ${totalBooks}`)
    console.log(`Reason links added: ${totalAdded}  "other" links removed: ${totalRemoved}`)
    console.log(`Kept as "other" (no signal): ${noMatch}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
