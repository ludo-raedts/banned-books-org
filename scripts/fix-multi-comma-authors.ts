/**
 * One-shot: per-case fix voor de 18 MULTI_COMMA author-rijen uit
 * `data/misc-comma-authors-review.md`. 12 splits naar meerdere personen,
 * 2 renames (één persoon mis-geparsed), 4 skips met documented reden.
 *
 * Voor splits: optioneel `existingId` per part om te linken aan een
 * bestaande sorted-name author-rij ipv een nieuwe te maken (vermijdt
 * duplicates die later via merge moeten worden opgeruimd).
 *
 *   pnpm tsx --env-file=.env.local scripts/fix-multi-comma-authors.ts
 *   pnpm tsx --env-file=.env.local scripts/fix-multi-comma-authors.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'

const APPLY = process.argv.includes('--apply')

type SplitPart = { name: string; existingId?: number }

type Action =
  | { kind: 'split'; id: number; expected: string; parts: SplitPart[]; note?: string }
  | {
      kind: 'rename'
      id: number
      expected: string
      newName: string
      clearBio?: true
      clearBirthYear?: true
      clearDeathYear?: true
      note?: string
    }

const ACTIONS: Action[] = [
  // ── Splits ────────────────────────────────────────────────────────────
  {
    kind: 'split',
    id: 9208,
    expected: 'Cukier, Zulema/Rey, Rosa María/ Tornadú, Beatriz',
    parts: [{ name: 'Zulema Cukier' }, { name: 'Rosa María Rey' }, { name: 'Beatriz Tornadú' }],
    note: '3 Argentijnse co-auteurs van "Páginas para mí"; sorted-pairs met slash-separators',
  },
  {
    kind: 'split',
    id: 7304,
    expected: 'King Chuk Ann,Chen Chi Fong,Young Pak Yu,King Ching Yu',
    parts: [
      { name: 'King Chuk Ann' },
      { name: 'Chen Chi Fong' },
      { name: 'Young Pak Yu' },
      { name: 'King Ching Yu' },
    ],
    note: '4 Chinese auteurs op "Map Communist China"',
  },
  {
    kind: 'split',
    id: 8011,
    expected: 'Tyler Hartley, Marie Fontell, Bill Buxom',
    parts: [{ name: 'Tyler Hartley' }, { name: 'Marie Fontell' }, { name: 'Bill Buxom' }],
  },
  {
    kind: 'split',
    id: 8583,
    expected: 'The Message International- USA, Saheeh International UK, Dar Al Mountada-Saudi Arabia, Al-Qummah-Eygpt',
    parts: [
      { name: 'The Message International USA' },
      { name: 'Saheeh International UK' },
      { name: 'Dar Al Mountada Saudi Arabia' },
      { name: 'Al-Qummah Egypt' },
    ],
    note: '4 islamitische uitgevers van Engelse Quran-vertaling; fix "Eygpt" → "Egypt"',
  },
  {
    kind: 'split',
    id: 8664,
    expected: 'Al-Mustaqeem Mahmod Radhi, Adib Zalkapli, Omarsaid',
    parts: [
      { name: 'Al-Mustaqeem Mahmod Radhi', existingId: 8658 },
      { name: 'Adib Zalkapli' },
      { name: 'Omarsaid' },
    ],
    note: '3 Maleisische auteurs; Al-Mustaqeem bestaat al',
  },
  {
    kind: 'split',
    id: 9159,
    expected: 'Bustinza, Juan A./ Ribas, Gabriel',
    parts: [
      { name: 'Juan A. Bustinza', existingId: 9158 },
      { name: 'Gabriel Ribas', existingId: 9157 },
    ],
    note: '2 personen; bestaande sorted-name rijen 9158/9157 hergebruikt',
  },
  {
    kind: 'split',
    id: 9277,
    expected: 'Gaboriau,M.- Gaudemar,P. De y Otros',
    parts: [{ name: 'M. Gaboriau' }, { name: 'P. de Gaudemar' }],
    note: '"y Otros" (and others) tail weggelaten',
  },
  {
    kind: 'split',
    id: 9297,
    expected: 'Gianet, Claude/Laterrasse, Colette, Vernaud, Gerard',
    parts: [{ name: 'Claude Gianet' }, { name: 'Colette Laterrasse' }, { name: 'Gerard Vernaud' }],
  },
  {
    kind: 'split',
    id: 9311,
    expected: 'Grenger, Gilles-Levi –Strauss, Claude-Mantovanni, Giuseppe-Serres, Michele',
    parts: [
      { name: 'Gilles Grenger' },
      { name: 'Claude Lévi-Strauss' },
      { name: 'Giuseppe Mantovanni' },
      { name: 'Michele Serres' },
    ],
    note: 'sorted-pairs gescheiden door en-dash/hyphen; Lévi-Strauss zelf bevat hyphen',
  },
  {
    kind: 'split',
    id: 9343,
    expected: 'Lester, Julius-Dapreste, Renee',
    parts: [{ name: 'Julius Lester' }, { name: 'Renee Dapreste' }],
  },
  {
    kind: 'split',
    id: 9358,
    expected: 'Malewska, Hanna- Amzalag, Gisse',
    parts: [{ name: 'Hanna Malewska' }, { name: 'Gisse Amzalag' }],
  },
  {
    kind: 'split',
    id: 9429,
    expected: 'Paoli, Pedro de- Mercado, Manuel G.',
    parts: [{ name: 'Pedro de Paoli' }, { name: 'Manuel G. Mercado' }],
  },

  // ── Renames ───────────────────────────────────────────────────────────
  {
    kind: 'rename',
    id: 3403,
    expected: 'Keith F., Jr, Miller',
    newName: 'Keith F. Miller Jr.',
    clearBio: true,        // bio gaat over Robert F. Kennedy Jr. (verkeerde persoon)
    clearBirthYear: true,  // 1954 = RFK Jr.'s birth year
    note: 'sorted "Miller, Keith F., Jr." — auteur van "Pritty" (Children\'s)',
  },
  {
    kind: 'rename',
    id: 9298,
    expected: 'Gluscksman, A.-Grasset, B.',
    newName: 'André Glucksmann',
    note: '"Grasset, B." was Bernard Grasset (Franse uitgever) — verwijderd; "Gluscksman" typo voor "Glucksmann"',
  },
]

// Skip-met-reden — gedocumenteerd, niet uitgevoerd
const SKIPPED: Array<{ id: number; reason: string }> = [
  { id: 7329, reason: 'Marx, Stalin, Lenin — canonical rijen voor alle drie bestaan al (in sorted of full form); apart op te ruimen via sorted-name-dedupe' },
  { id: 8084, reason: 'Li Yi Wen, He Ku Han, Xin — Chinese namen, onduidelijk of dit 3 of 2 personen zijn; vereist bron-check' },
  { id: 7645, reason: 'Lpm, Prm, Perak State Liaison Committee Secretariat — Maleisische politieke organisatie-hiërarchie; vereist context' },
  { id: 9473, reason: 'Realidad económica N° 13, 14, 16, 17 y 18 — geen auteur maar journaal-uitgave-nummers; aparte fix nodig' },
]

async function loadOrCreatePart(
  sb: ReturnType<typeof adminClient>,
  part: SplitPart,
): Promise<number | null> {
  if (part.existingId) return part.existingId
  const partSlug = slugify(part.name)
  const { data: existing } = await sb.from('authors').select('id').eq('slug', partSlug).maybeSingle()
  if (existing) return existing.id
  if (!APPLY) return -1
  const { data: created, error } = await sb.from('authors')
    .insert({ display_name: part.name, slug: partSlug, is_placeholder: false })
    .select('id')
    .single()
  if (error || !created) {
    console.error(`      ! create '${part.name}': ${error?.message}`)
    return null
  }
  return created.id
}

async function main() {
  const sb = adminClient()
  console.log(`── fix-multi-comma-authors ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  console.log(`── Skipped (${SKIPPED.length}) ──`)
  for (const s of SKIPPED) console.log(`  id=${s.id} — ${s.reason}`)
  console.log('')

  console.log(`── Actions (${ACTIONS.length}) ──\n`)

  for (const a of ACTIONS) {
    const { data: row } = await sb.from('authors')
      .select('id, display_name, slug, bio, birth_year, death_year')
      .eq('id', a.id)
      .maybeSingle()
    if (!row) {
      console.log(`  ! id=${a.id} not found — skip`)
      continue
    }
    if (row.display_name !== a.expected) {
      console.log(`  ! id=${a.id} display-mismatch — verwacht ${JSON.stringify(a.expected)}, kreeg ${JSON.stringify(row.display_name)} — skip`)
      continue
    }

    console.log(`  id=${a.id} slug=${row.slug}`)
    console.log(`    FROM: ${row.display_name}`)

    if (a.kind === 'rename') {
      console.log(`    →     ${a.newName}`)
      if (a.note) console.log(`    note: ${a.note}`)
      if (a.clearBio && row.bio) console.log(`    also clear bio (${row.bio.length}c)`)
      if (a.clearBirthYear && row.birth_year) console.log(`    also clear birth_year=${row.birth_year}`)
      if (a.clearDeathYear && row.death_year) console.log(`    also clear death_year=${row.death_year}`)
      if (APPLY) {
        const update: Record<string, unknown> = { display_name: a.newName }
        if (a.clearBio) update.bio = null
        if (a.clearBirthYear) update.birth_year = null
        if (a.clearDeathYear) update.death_year = null
        const { error } = await sb.from('authors').update(update).eq('id', a.id)
        if (error) { console.error(`    ! ${error.message}`); continue }
        console.log(`    ✓ renamed`)
      }
      console.log('')
      continue
    }

    // split
    console.log(`    →     ${a.parts.map(p => `"${p.name}"${p.existingId ? ` (id=${p.existingId})` : ''}`).join(' + ')}`)
    if (a.note) console.log(`    note: ${a.note}`)

    const { data: bookLinks } = await sb.from('book_authors')
      .select('book_id, role')
      .eq('author_id', a.id)
    const links = (bookLinks ?? []) as Array<{ book_id: number; role: string | null }>
    console.log(`    boeken: ${links.length}`)

    const partIds: number[] = []
    for (const p of a.parts) {
      const pid = await loadOrCreatePart(sb, p)
      if (pid === null) continue
      partIds.push(pid)
      const prefix = p.existingId ? 'use existing' : 'created/found'
      const action = APPLY ? prefix : (pid === -1 ? '→ would create' : `→ ${prefix}`)
      console.log(`      "${p.name}" ${action} id=${pid}`)
    }

    if (!APPLY) {
      console.log('')
      continue
    }

    // Voor elk boek: link aan elke nieuwe author (skip duplicaten)
    for (const link of links) {
      for (const newId of partIds) {
        const { count } = await sb.from('book_authors')
          .select('book_id', { count: 'exact', head: true })
          .eq('book_id', link.book_id)
          .eq('author_id', newId)
        if ((count ?? 0) > 0) continue
        const { error } = await sb.from('book_authors')
          .insert({ book_id: link.book_id, author_id: newId, role: link.role ?? 'author' })
        if (error) console.error(`      ! link book=${link.book_id} author=${newId}: ${error.message}`)
      }
    }
    const { error: dle } = await sb.from('book_authors').delete().eq('author_id', a.id)
    if (dle) { console.error(`    ! delete book_authors: ${dle.message}`); continue }
    const { error: dae } = await sb.from('authors').delete().eq('id', a.id)
    if (dae) { console.error(`    ! delete author: ${dae.message}`); continue }
    console.log(`    ✓ split into ${partIds.length} authors, old row deleted`)
    console.log('')
  }

  if (!APPLY) console.log(`── Dry-run. Re-run with --apply. ──`)
}

main().catch(err => { console.error(err); process.exit(1) })
