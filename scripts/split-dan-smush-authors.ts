/**
 * Splits author-rijen die meerdere personen smushen via een NIET-Engelse
 * conjunctie (` dan `, ` serta `, ` dengan `, ` và `, ` 和 `, ` 與 `).
 * Re-implementeert de classificatie uit
 * scripts/_audit_dan_smush_authors.ts.
 *
 * Zustertaak van scripts/split-ampersand-smush-authors.ts. Beide gebruiken
 * de identieke STRIP/SPLIT-helper voor find-or-create + link-verhuizing.
 *
 *   pnpm tsx --env-file=.env.local scripts/split-dan-smush-authors.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/split-dan-smush-authors.ts --apply  # mutate
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { canonicaliseAuthorName } from '../src/lib/imports/canonicalise-author-name'

const APPLY = process.argv.includes('--apply')

const PARTICLES_LOWER = new Set(['van', 'von', 'de', 'da', 'di', 'du', 'al', 'el', 'der', 'den', 'des', 'of', 'the', 'and', 'et', 'bin', 'binti'])
const NON_NAME_KEYWORDS = new Set([
  'party', 'office', 'division', 'department', 'committee', 'council',
  'company', 'corp', 'inc', 'ltd', 'group', 'agency', 'commission',
  'foundation', 'society', 'union', 'front', 'movement', 'association',
])
const OTHERS_TAIL = /(?:^|\s+(?:and|&)\s+)(?:\d+\s+)?others\s*$/i
const RELATIVE_TAIL = /\b(?:his|her|their)\s+(?:daughter|son|wife|husband|father|mother|sister|brother|family|children)\b/i
const TRANSLATED_BY = /^translated\s+by\s+/i

// Case-sensitive — zie audit-script voor waarom geen ` et `.
const NON_ENGLISH_CONJUNCTIONS: RegExp[] = [
  / dan /g,
  / serta /g,
  / dengan /g,
  / và /g,
  / 和 /g,
  / 與 /g,
]

type Action =
  | { kind: 'SPLIT'; parts: string[]; role: string }
  | { kind: 'SPLIT_SURNAME'; parts: string[]; role: string }
  | { kind: 'STRIP_OTHERS'; rename: string }
  | { kind: 'SKIP'; reason: string }

function normaliseSeparators(s: string): string {
  let out = s
  for (const pattern of NON_ENGLISH_CONJUNCTIONS) {
    out = out.replace(pattern, ' & ')
  }
  return out
    .replace(/\s+and\s+/gi, ' & ')
    .replace(/,\s+/g, ' & ')
    .replace(/&/g, ' & ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanPart(raw: string): string {
  let s = raw.trim()
  s = s.replace(/([a-z])([A-Z])/g, '$1 $2')
  s = s.replace(/^(?:dr|prof|professor|mr|mrs|ms)\.\s*/i, '')
  s = canonicaliseAuthorName(s)
  s = s.replace(/([A-Z]\.)([A-Z][a-z])/g, '$1 $2')
  s = s.split(/\s+/).map(tok => {
    if (!tok) return tok
    const lower = tok.toLowerCase()
    if (PARTICLES_LOWER.has(lower)) return lower
    if (/^[a-z]+$/.test(tok)) return tok.charAt(0).toUpperCase() + tok.slice(1)
    return tok
  }).join(' ')
  return s.trim()
}

function isLikelyOrg(name: string): boolean {
  const lower = name.toLowerCase()
  for (const kw of NON_NAME_KEYWORDS) if (lower.includes(kw)) return true
  return false
}

function classify(name: string): Action {
  if (isLikelyOrg(name)) return { kind: 'SKIP', reason: 'organisation-like' }
  if (RELATIVE_TAIL.test(name)) return { kind: 'SKIP', reason: 'anonymous-relative' }
  if (OTHERS_TAIL.test(name)) {
    const head = name.replace(OTHERS_TAIL, '').trim()
    return { kind: 'STRIP_OTHERS', rename: cleanPart(head) }
  }
  let working = name
  let role = 'author'
  if (TRANSLATED_BY.test(working)) {
    working = working.replace(TRANSLATED_BY, '').trim()
    role = 'translator'
  }
  const pen = working.match(/^([A-Z][a-z]{0,4})\s*&\s*([A-Z][a-z]{0,4})$/)
  if (pen) return { kind: 'SKIP', reason: 'pen-name duo' }
  const norm = normaliseSeparators(working)
  const rawParts = norm.split(' & ').map(p => p.trim()).filter(Boolean)
  if (rawParts.length < 2) return { kind: 'SKIP', reason: 'no separators after normalise' }
  if (rawParts.length === 2) {
    const a = rawParts[0].split(/\s+/)
    const b = rawParts[1].split(/\s+/)
    if (a.length === 1 && b.length === 2 && /^[A-Z][a-z]+$/.test(a[0]) && /^[A-Z][a-z]+$/.test(b[1])) {
      const surname = b[1]
      return { kind: 'SPLIT_SURNAME', parts: [cleanPart(`${a[0]} ${surname}`), cleanPart(rawParts[1])], role }
    }
  }
  const parts = rawParts.map(cleanPart).filter(Boolean)
  if (parts.some(p => isLikelyOrg(p) || /\bothers\b/i.test(p))) return { kind: 'SKIP', reason: 'organisation-after-split' }
  if (parts.some(p => p.length < 3)) return { kind: 'SKIP', reason: 'fragment-too-short' }
  // Een persoonsnaam heeft typisch 2-5 tokens; meer betekent vrijwel altijd dat
  // ` dan ` werd gebruikt in werkwoord-context of dat er een editorial-credit
  // prefix in zit. Niet veilig auto-splitten.
  if (parts.some(p => p.split(/\s+/).length > 5)) return { kind: 'SKIP', reason: 'part-too-many-tokens' }
  return { kind: 'SPLIT', parts, role }
}

type Author = { id: number; display_name: string; slug: string }

async function findExisting(sb: ReturnType<typeof adminClient>, name: string): Promise<Author | null> {
  const slug = slugify(name)
  if (slug) {
    const { data } = await sb.from('authors').select('id, display_name, slug').eq('slug', slug).maybeSingle()
    if (data) return data as Author
  }
  const { data: byName } = await sb.from('authors').select('id, display_name, slug').ilike('display_name', name).limit(1)
  if (byName && byName.length) return byName[0] as Author
  return null
}

async function insertAuthor(sb: ReturnType<typeof adminClient>, displayName: string): Promise<Author> {
  let slug = slugify(displayName)
  if (!slug) throw new Error(`empty slug for "${displayName}"`)
  for (let attempt = 1; attempt < 6; attempt++) {
    const candidate = attempt === 1 ? slug : `${slug}-${attempt}`
    const { data, error } = await sb.from('authors')
      .insert({ display_name: displayName, slug: candidate })
      .select('id, display_name, slug')
      .single()
    if (!error && data) return data as Author
    if (error && /duplicate key/i.test(error.message)) continue
    if (error) throw new Error(`insert "${displayName}": ${error.message}`)
  }
  throw new Error(`insert "${displayName}": slug-collision na 5 pogingen`)
}

async function moveBookLink(
  sb: ReturnType<typeof adminClient>,
  fromAuthorId: number, toAuthorId: number, bookId: number, role: string,
): Promise<'inserted' | 'already-linked'> {
  const { data: existing } = await sb.from('book_authors')
    .select('book_id').eq('author_id', toAuthorId).eq('book_id', bookId).maybeSingle()
  if (existing) return 'already-linked'
  const { error } = await sb.from('book_authors')
    .insert({ book_id: bookId, author_id: toAuthorId, role })
  if (error) throw new Error(`link ${toAuthorId}→book ${bookId}: ${error.message}`)
  return 'inserted'
}

async function main() {
  const sb = adminClient()
  console.log(`── split-dan-smush-authors ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // Verzamel kandidaten per conjunctie (zelfde aanpak als audit). Postgres LIKE
  // is case-sensitive — de extra JS-filter is zekerheidshalve.
  const probes = NON_ENGLISH_CONJUNCTIONS.map(re => {
    const literal = re.source.replace(/\\\//g, '/')
    return literal
  })
  const queries = NON_ENGLISH_CONJUNCTIONS.map(async (pattern, i) => {
    const conj = probes[i].trim() // " dan " → "dan"
    const probe = `% ${conj} %`
    const { data, error } = await sb.from('authors')
      .select('id, display_name, slug')
      .like('display_name', probe)
      .order('id')
    if (error) throw new Error(`query "${conj}": ${error.message}`)
    pattern.lastIndex = 0
    return (data ?? []).filter(r => pattern.test(r.display_name))
  })
  const perConj = await Promise.all(queries)

  const seen = new Set<number>()
  const rows: Author[] = []
  for (const list of perConj) {
    for (const r of list as Author[]) {
      if (seen.has(r.id)) continue
      seen.add(r.id); rows.push(r)
    }
  }
  rows.sort((a, b) => a.id - b.id)
  console.log(`Kandidaten: ${rows.length}\n`)

  let actionsSplit = 0, actionsStrip = 0, actionsSkip = 0
  let createdAuthors = 0, reusedAuthors = 0, movedLinks = 0, deletedRows = 0, errors = 0
  const createdIds: number[] = []
  const errorRows: { id: number; name: string; err: string }[] = []

  for (const row of rows) {
    const action = classify(row.display_name)

    if (action.kind === 'SKIP') {
      actionsSkip++
      console.log(`  · SKIP id=${row.id} "${row.display_name}" (${action.reason})`)
      continue
    }

    const { data: links, error: le } = await sb.from('book_authors')
      .select('book_id, role').eq('author_id', row.id)
    if (le) {
      errors++; errorRows.push({ id: row.id, name: row.display_name, err: `fetch links: ${le.message}` })
      console.error(`  ! ${row.id}: fetch links failed`)
      continue
    }
    const bookLinks = links ?? []

    if (action.kind === 'STRIP_OTHERS') {
      actionsStrip++
      const newName = action.rename
      console.log(`  → STRIP id=${row.id} "${row.display_name}" → "${newName}"`)

      if (!APPLY) continue

      let target = await findExisting(sb, newName)
      try {
        if (target && target.id === row.id) {
          const newSlug = slugify(newName)
          const { error } = await sb.from('authors').update({ display_name: newName, slug: newSlug }).eq('id', row.id)
          if (error) throw new Error(`update: ${error.message}`)
          console.log(`    ✓ renamed in-place id=${row.id}`)
        } else {
          if (!target) {
            target = await insertAuthor(sb, newName)
            createdAuthors++; createdIds.push(target.id)
            console.log(`    ✓ created id=${target.id} "${newName}"`)
          } else {
            reusedAuthors++
            console.log(`    · reuse id=${target.id} "${target.display_name}"`)
          }
          for (const l of bookLinks) {
            const status = await moveBookLink(sb, row.id, target.id, l.book_id, l.role ?? 'author')
            if (status === 'inserted') movedLinks++
          }
          const { error: dle } = await sb.from('book_authors').delete().eq('author_id', row.id)
          if (dle) throw new Error(`delete links: ${dle.message}`)
          const { error: dre } = await sb.from('authors').delete().eq('id', row.id)
          if (dre) throw new Error(`delete row: ${dre.message}`)
          deletedRows++
        }
      } catch (err) {
        errors++; errorRows.push({ id: row.id, name: row.display_name, err: err instanceof Error ? err.message : String(err) })
        console.error(`    ! ${err instanceof Error ? err.message : err}`)
      }
      continue
    }

    actionsSplit++
    console.log(`  → SPLIT id=${row.id} "${row.display_name}" → [${action.parts.join(' | ')}] (role=${action.role})`)
    if (!APPLY) continue

    try {
      const targets: Author[] = []
      for (const part of action.parts) {
        let target = await findExisting(sb, part)
        if (!target) {
          target = await insertAuthor(sb, part)
          createdAuthors++; createdIds.push(target.id)
          console.log(`      ✓ created id=${target.id} "${part}"`)
        } else {
          reusedAuthors++
          console.log(`      · reuse  id=${target.id} "${target.display_name}"`)
        }
        targets.push(target)
      }
      for (const l of bookLinks) {
        const role = action.role || l.role || 'author'
        for (const tgt of targets) {
          const status = await moveBookLink(sb, row.id, tgt.id, l.book_id, role)
          if (status === 'inserted') movedLinks++
        }
      }
      const { error: dle } = await sb.from('book_authors').delete().eq('author_id', row.id)
      if (dle) throw new Error(`delete links: ${dle.message}`)
      const { error: dre } = await sb.from('authors').delete().eq('id', row.id)
      if (dre) throw new Error(`delete row: ${dre.message}`)
      deletedRows++
    } catch (err) {
      errors++; errorRows.push({ id: row.id, name: row.display_name, err: err instanceof Error ? err.message : String(err) })
      console.error(`      ! ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log('\n── Samenvatting ──')
  console.log(`  Acties: SPLIT=${actionsSplit}, STRIP=${actionsStrip}, SKIP=${actionsSkip}`)
  if (APPLY) {
    console.log(`  Nieuwe authors aangemaakt : ${createdAuthors}`)
    console.log(`  Bestaande authors herbruikt: ${reusedAuthors}`)
    console.log(`  Book-links verhuisd        : ${movedLinks}`)
    console.log(`  Smush-rijen verwijderd     : ${deletedRows}`)
    console.log(`  Errors                     : ${errors}`)
    if (errorRows.length > 0) {
      console.log('\n  Error details:')
      for (const e of errorRows) console.log(`    id=${e.id} "${e.name}": ${e.err}`)
    }
    const outPath = join(process.cwd(), 'data', 'split-dan-newly-created-ids.json')
    writeFileSync(outPath, JSON.stringify({ generated: new Date().toISOString(), ids: createdIds }, null, 2))
    console.log(`\n  Newly-created IDs geschreven naar ${outPath}`)
    if (createdIds.length > 0) {
      console.log(`  Volgende stap: pnpm tsx --env-file=.env.local scripts/enrich-author-bios.ts --apply --ids=${createdIds.join(',')}`)
    }
  } else {
    console.log('\n── Dry-run klaar. Re-run met --apply om mutaties uit te voeren. ──')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
