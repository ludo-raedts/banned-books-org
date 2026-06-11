#!/usr/bin/env tsx
/**
 * READ-ONLY audit: how many catalogue entries trip the CSAM red-flag terms?
 *
 * Scope decision helper — NOT the Fase-7 sweep. Writes nothing. Just counts.
 *
 * Sweeps the four book text fields the policy names (description_ban,
 * censorship_context, extended_context, inclusion_rationale) AND, separately,
 * bans.description — the only free-text field likely to hold original-language
 * ban material — so we can see whether widening the field set / translating
 * terms actually changes the result.
 *
 * Usage: npx tsx scripts/_audit_csam_red_flags.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1)
  }
}
loadEnvLocal()

const BOOK_FIELDS = [
  'description_ban',
  'censorship_context',
  'extended_context',
  'inclusion_rationale',
] as const

// Unicode-aware word boundaries (JS \b is ASCII-only — breaks on é, ü, etc.)
function wb(re: string) {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${re})(?![\\p{L}\\p{N}])`, 'giu')
}

const HARD: { label: string; re: RegExp }[] = [
  { label: 'child porn(ography)', re: wb('child\\s+porn(?:ography)?') },
  { label: 'kinderporno(grafie) [nl]', re: wb('kinderporno(?:grafie)?') },
  { label: 'Kinderpornografie [de]', re: wb('kinderpornograf(?:ie|ie)|kinderpornographie') },
  { label: 'pédopornographie [fr]', re: wb('p(?:é|e)dopornographie') },
  { label: 'child sexual abuse material / CSAM', re: wb('child\\s+sexual\\s+abuse\\s+material|csam') },
]

const SOFT: { label: string; re: RegExp }[] = [
  { label: 'pedophilia/paedophil*', re: wb('p(?:a)?edophil(?:ia|e|es|ic)?') },
]

type Hit = { field: string; label: string; snippet: string }

function scan(text: string | null, sets: { label: string; re: RegExp }[], field: string): Hit[] {
  if (!text) return []
  const hits: Hit[] = []
  for (const { label, re } of sets) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const i = m.index
      const start = Math.max(0, i - 60)
      const end = Math.min(text.length, i + m[0].length + 60)
      const snippet = (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '')
      hits.push({ field, label, snippet })
      if (m[0].length === 0) re.lastIndex++
    }
  }
  return hits
}

async function fetchAll<T>(table: string, cols: string): Promise<T[]> {
  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()
  const PAGE = 1000
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(cols).order('id').range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...(data as T[]))
    if (data.length < PAGE) break
  }
  return out
}

async function main() {
  type Book = {
    id: number; slug: string; title: string
    description_ban: string | null; censorship_context: string | null
    extended_context: string | null; inclusion_rationale: string | null
  }
  type Ban = { id: number; book_id: number; description: string | null }

  const books = await fetchAll<Book>('books', 'id, slug, title, ' + BOOK_FIELDS.join(', '))
  const bans = await fetchAll<Ban>('bans', 'id, book_id, description')

  const bansByBook = new Map<number, string[]>()
  for (const b of bans) {
    if (!b.description) continue
    const arr = bansByBook.get(b.book_id) ?? []
    arr.push(b.description)
    bansByBook.set(b.book_id, arr)
  }

  type Row = {
    book: Book
    hard: Hit[]
    soft: Hit[]
    banHard: Hit[]
    banSoft: Hit[]
  }
  const rows: Row[] = []

  for (const book of books) {
    const hard: Hit[] = []
    const soft: Hit[] = []
    for (const f of BOOK_FIELDS) {
      hard.push(...scan(book[f], HARD, f))
      soft.push(...scan(book[f], SOFT, f))
    }
    const banText = (bansByBook.get(book.id) ?? []).join('\n')
    const banHard = scan(banText, HARD, 'bans.description')
    const banSoft = scan(banText, SOFT, 'bans.description')

    if (hard.length || soft.length || banHard.length || banSoft.length) {
      rows.push({ book, hard, soft, banHard, banSoft })
    }
  }

  // Tier per book: hard wins. Field-set scope = the 4 book fields only.
  const bookTier = (r: Row) => (r.hard.length ? 'HARD' : r.soft.length ? 'soft' : null)
  const banOnly = rows.filter(r => !bookTier(r) && (r.banHard.length || r.banSoft.length))

  const hardBooks = rows.filter(r => bookTier(r) === 'HARD')
  const softBooks = rows.filter(r => bookTier(r) === 'soft')

  console.log('\n=========================================================')
  console.log(' CSAM RED-FLAG AUDIT  (read-only)')
  console.log('=========================================================')
  console.log(`Books scanned:            ${books.length}`)
  console.log(`Ban rows scanned:         ${bans.length}`)
  console.log('---------------------------------------------------------')
  console.log(`SCOPE = 4 book fields (policy Fase 7):`)
  console.log(`  HARD-flag books:        ${hardBooks.length}`)
  console.log(`  soft-flag books:        ${softBooks.length}`)
  console.log(`  total flagged:          ${hardBooks.length + softBooks.length}`)
  console.log('---------------------------------------------------------')
  console.log(`BLIND-SPOT CHECK = bans.description (NOT in policy scope):`)
  console.log(`  books that hit ONLY via bans.description: ${banOnly.length}`)
  console.log('=========================================================\n')

  const show = (title: string, list: Row[], pick: (r: Row) => Hit[]) => {
    if (!list.length) return
    console.log(`\n### ${title} (${list.length})\n`)
    for (const r of list) {
      console.log(`• ${r.book.title}  /books/${r.book.slug}  [id=${r.book.id}]`)
      const seen = new Set<string>()
      for (const h of pick(r)) {
        const key = h.field + '|' + h.label
        if (seen.has(key)) continue
        seen.add(key)
        console.log(`    [${h.label}] (${h.field}): ${h.snippet}`)
      }
    }
  }

  show('HARD tier — literal "child pornography" & translations', hardBooks, r => [...r.hard])
  show('SOFT tier — pedophilia/paedophilia (expect noise)', softBooks, r => [...r.soft])
  show('BLIND SPOT — only matched in bans.description (original-language?)', banOnly, r => [...r.banHard, ...r.banSoft])

  console.log('')
}

main().catch(e => { console.error(e); process.exit(1) })
