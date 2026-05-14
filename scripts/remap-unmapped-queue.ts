/**
 * Re-run reason mapping over import_review_queue rows that still carry the
 * `unmapped_reason` quality_flag. Two passes per row:
 *
 *   1. The current strict `mapReason()` from src/lib/wikipedia/reason-mapper.ts.
 *      If it now finds a slug (patterns were extended after the row was
 *      originally imported — see the 2026-05-14 international-corpus additions),
 *      update `agreement_details.reason_mapping`, drop the `unmapped_reason`
 *      flag, and add any extra flags the mapper produced (defamation_suit_civil,
 *      import_ban_no_explicit_reason, etc.).
 *
 *   2. If pass-1 still returns null, try a broader keyword heuristic ported
 *      from scripts/reclassify-other-reasons.ts. On a hit, set
 *      reason_mapping = { slug: <first>, confidence: 'low' } but KEEP the
 *      `unmapped_reason` flag so the editor recognises this as a low-confidence
 *      guess in the review UI.
 *
 * Rows with empty/whitespace notes_raw are skipped (no signal).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/remap-unmapped-queue.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/remap-unmapped-queue.ts --write
 */
import { adminClient } from '../src/lib/supabase'
import { mapReason } from '../src/lib/wikipedia/reason-mapper'

const WRITE = process.argv.includes('--write')

// Broader keyword heuristic, ported from scripts/reclassify-other-reasons.ts.
// Looser than the strict wikipedia mapper — used only as a fallback for rows
// the strict mapper rejected. All hits are marked confidence='low'.
function inferReasonsBroad(text: string): string[] {
  const t = text.toLowerCase()
  const found = new Set<string>()

  if (/lgbtq|lesbian|gay |same-sex|transgender|\btrans\b|queer|gender identity|gender expression|gender-fluid|genderqueer|non-?binary|bisexual|sexual identity|conversion therapy|homosexual|coming out|pride |rainbow flag|same sex|intersex|asexual/.test(t))
    found.add('lgbtq')

  if (/sexual content|explicit sex|sex scene|erotic|pornograph|sexually explicit|sexual relationship|sexual references|adult romantic|sexual material|sexual violence|sexual assault|sexual abuse|obscene|nude|nudity|incest|prostitut|rape|masturbat|genitalia/.test(t))
    found.add('sexual')

  if (/\bviolence\b|violent|murder|graphic depic|graphic content|torture|war crime|brutal|gore|graphic|killing|assault|abuse|self.harm|suicide|self-harm|gun violence|domestic abuse|kidnap|captiv/.test(t))
    found.add('violence')

  if (/\brace\b|racism|racial|systemic racism|police violence|police brutality|kkk|racial slur|n-word|white supremac|civil rights|black teenager|anti-?black|anti-?racism|colonialism|segregation|slavery|microagression|microaggression|reparation/.test(t))
    found.add('racial')

  if (/drug use|\bdrugs?\b|addiction|substance abuse|\balcohol\b|narcotics|heroin|cocaine|marijuana|cannabis/.test(t))
    found.add('drugs')

  if (/religious content|religious objection|religious material|religious upbringing|anti-?religious|irreverence|religious group|anti.christian|anti.islam|blasphemy|faith.based|witchcraft|occult|satanism|biblical|supernatural (belief|concern)/.test(t))
    found.add('religious')

  if (/politic|totalitarian|communist|communism|capitalism|authoritarian|systemic inequality|social justice|protest|policing|anti-?authoritarian|marxis|censorship of|ideologic/.test(t))
    found.add('political')

  if (/obscen/.test(t) && !found.has('sexual'))
    found.add('obscenity')

  if (/blasphemy|blasphemous/.test(t))
    found.add('blasphemy')

  return [...found]
}

type QueueRow = {
  id: number
  source_slug: string
  agreement_details: {
    parsed_row?: { title?: string; notes_raw?: string }
    quality_flags?: string[]
    reason_mapping?: { slug: string | null; confidence: 'high' | 'low' }
    [k: string]: unknown
  } | null
}

async function loadPendingUnmapped(s: ReturnType<typeof adminClient>): Promise<QueueRow[]> {
  let all: QueueRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await s
      .from('import_review_queue')
      .select('id, source_slug, agreement_details')
      .eq('status', 'pending_review')
      .order('id', { ascending: false })
      .range(offset, offset + 999)
    if (error) throw new Error(`load queue: ${error.message}`)
    if (!data || data.length === 0) break
    all = all.concat(data as unknown as QueueRow[])
    if (data.length < 1000) break
    offset += 1000
  }
  return all.filter(r => (r.agreement_details?.quality_flags ?? []).includes('unmapped_reason'))
}

async function main() {
  const s = adminClient()
  const rows = await loadPendingUnmapped(s)
  console.log(`Pending rows with unmapped_reason: ${rows.length}`)
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}\n`)

  let pass1Hits = 0
  let pass2Hits = 0
  let noSignal = 0
  let emptyNotes = 0
  let errors = 0

  for (const row of rows) {
    const ad = row.agreement_details ?? {}
    const notes = (ad.parsed_row?.notes_raw ?? '').trim()
    const title = ad.parsed_row?.title ?? '(no title)'

    if (!notes) {
      emptyNotes++
      continue
    }

    const flags = [...(ad.quality_flags ?? [])]
    const result = mapReason(notes)

    let nextMapping: { slug: string | null; confidence: 'high' | 'low' } | null = null
    let nextFlags: string[] | null = null
    let label = ''

    if (result.mapping.slug !== null) {
      // Pass-1 hit: strict mapper now produces a slug.
      nextMapping = result.mapping
      nextFlags = flags.filter(f => f !== 'unmapped_reason')
      for (const f of result.extra_flags) {
        if (!nextFlags.includes(f)) nextFlags.push(f)
      }
      label = `pass-1 (${result.mapping.confidence}) → ${result.mapping.slug}`
      pass1Hits++
    } else {
      // Pass-2 fallback: broad keyword heuristic.
      const broad = inferReasonsBroad(notes)
      if (broad.length > 0) {
        nextMapping = { slug: broad[0], confidence: 'low' }
        nextFlags = flags // keep unmapped_reason — signals "guessed via broad heuristic"
        label = `pass-2 (low) → ${broad[0]}${broad.length > 1 ? ` (also: ${broad.slice(1).join(', ')})` : ''}`
        pass2Hits++
      } else {
        noSignal++
        continue
      }
    }

    console.log(`[${row.id}] ${title}`)
    console.log(`  notes: ${notes.slice(0, 160)}${notes.length > 160 ? '…' : ''}`)
    console.log(`  → ${label}`)

    if (!WRITE) continue

    const newAgreementDetails = {
      ...ad,
      reason_mapping: nextMapping,
      quality_flags: nextFlags,
    }
    const { error } = await s
      .from('import_review_queue')
      .update({ agreement_details: newAgreementDetails })
      .eq('id', row.id)
      .eq('status', 'pending_review') // guard: don't touch already-reviewed rows
    if (error) {
      console.error(`  ✗ update error: ${error.message}`)
      errors++
    }
  }

  console.log('\n──────────── Summary ────────────')
  console.log(`Total inspected:        ${rows.length}`)
  console.log(`Pass-1 strict hits:     ${pass1Hits}   (slug filled, unmapped_reason flag removed)`)
  console.log(`Pass-2 broad hits:      ${pass2Hits}   (low-confidence slug; flag kept)`)
  console.log(`Empty notes (skipped):  ${emptyNotes}`)
  console.log(`No signal (skipped):    ${noSignal}`)
  if (WRITE) console.log(`Update errors:          ${errors}`)
  if (!WRITE) console.log(`\n[DRY-RUN] Re-run with --write to apply.`)
}

main().catch(e => { console.error(e); process.exit(1) })
