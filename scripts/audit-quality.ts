/**
 * Data quality audit — report only, no writes.
 * Outputs one CSV block per category to stdout.
 */
import { adminClient } from '../src/lib/supabase'
import { writeFileSync } from 'fs'

const supabase = adminClient()

function csvRow(fields: (string | number | null | undefined)[]) {
  return fields.map(f => {
    const s = String(f ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }).join(',')
}

function normaliseTitle(t: string) {
  return t.toLowerCase()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normaliseName(n: string) {
  return n.toLowerCase().replace(/[^a-z]/g, '')
}

// Extract "Firstname Lastname's" or "Firstname Lastname's" from start of description
function extractDescriptionAuthor(desc: string): string | null {
  // Match patterns like "John Green's", "Toni Morrison's", "García Márquez's"
  const m = desc.match(/^([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+(?:\s+[A-ZÁÉÍÓÚÑÜ]?[a-záéíóúñü'-]+){1,3})'s?\s/)
  return m ? m[1] : null
}

async function main() {
  console.log('Fetching data...')

  const { data: books } = await supabase
    .from('books')
    .select(`
      id, title, slug, description,
      book_authors(authors(display_name, slug)),
      bans(
        id, country_code, action_type, status,
        scopes(slug),
        ban_reason_links(reasons(slug)),
        ban_source_links(source_id)
      )
    `)
    .order('title')

  if (!books) { console.error('No books returned'); process.exit(1) }

  const rows: typeof books = books

  // ══════════════════════════════════════════════════════════════════════════
  // 1. Description author mismatch
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n\n=== 1. DESCRIPTION AUTHOR MISMATCH ===')
  console.log(csvRow(['slug', 'title', 'book_author', 'desc_starts_with', 'first_80_chars']))

  for (const book of rows) {
    if (!book.description) continue
    const bookAuthor = (book.book_authors as any[])[0]?.authors?.display_name ?? ''
    const descAuthor = extractDescriptionAuthor(book.description)
    if (!descAuthor) continue

    const bookNorm = normaliseName(bookAuthor)
    const descNorm = normaliseName(descAuthor)

    // Flag if the desc author shares fewer than 4 chars with book author
    // (catches "García Márquez" vs "Gabriel García Márquez" — OK,
    //  catches "Toni Morrison" vs "Ernest Gaines" — flag)
    const overlap = [...descNorm].filter(c => bookNorm.includes(c)).length
    const minLen = Math.min(descNorm.length, bookNorm.length)
    const similarity = minLen > 0 ? overlap / minLen : 0

    if (similarity < 0.5 && descAuthor.length > 4) {
      console.log(csvRow([
        book.slug,
        book.title,
        bookAuthor,
        descAuthor,
        book.description.slice(0, 80),
      ]))
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Duplicate books (same normalised title, similar author)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n\n=== 2. DUPLICATE BOOKS ===')
  console.log(csvRow(['slug_a', 'slug_b', 'title', 'author_a', 'author_b']))

  const titleMap = new Map<string, typeof rows>()
  for (const book of rows) {
    const key = normaliseTitle(book.title)
    if (!titleMap.has(key)) titleMap.set(key, [])
    titleMap.get(key)!.push(book)
  }

  for (const [, group] of titleMap) {
    if (group.length < 2) continue
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j]
        const authorA = (a.book_authors as any[])[0]?.authors?.display_name ?? ''
        const authorB = (b.book_authors as any[])[0]?.authors?.display_name ?? ''
        const authNormA = normaliseName(authorA)
        const authNormB = normaliseName(authorB)
        // Flag if authors are similar (share >60% chars) or either is empty
        const overlap = [...authNormA].filter(c => authNormB.includes(c)).length
        const sim = Math.min(authNormA.length, authNormB.length) > 0
          ? overlap / Math.min(authNormA.length, authNormB.length)
          : 1
        if (sim > 0.6 || !authorA || !authorB) {
          console.log(csvRow([a.slug, b.slug, a.title, authorA, authorB]))
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Truncated descriptions
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n\n=== 3. TRUNCATED DESCRIPTIONS ===')
  console.log(csvRow(['slug', 'title', 'length', 'last_40_chars']))

  for (const book of rows) {
    if (!book.description) continue
    const desc = book.description.trimEnd()
    const last = desc.slice(-1)
    if (!['.', '?', '!', '"', '’', '”'].includes(last)) {
      console.log(csvRow([
        book.slug,
        book.title,
        desc.length,
        desc.slice(-40),
      ]))
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. US school bans with reason 'other'
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n\n=== 4. US SCHOOL BANS WITH REASON \'other\' ===')
  console.log(csvRow(['ban_id', 'slug', 'title', 'year_started', 'source_count']))

  for (const book of rows) {
    const usBans = (book.bans as any[]).filter(b =>
      b.country_code === 'US' && b.scopes?.slug === 'school'
    )
    for (const ban of usBans) {
      const reasons = (ban.ban_reason_links as any[]).map((l: any) => l.reasons?.slug)
      if (reasons.length === 1 && reasons[0] === 'other') {
        const sources = (ban.ban_source_links as any[]).length
        console.log(csvRow([ban.id, book.slug, book.title, ban.year_started ?? '', sources]))
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. Bans with no source links
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n\n=== 5. BANS WITHOUT SOURCE CITATIONS ===')
  console.log(csvRow(['ban_id', 'slug', 'title', 'country_code', 'year_started', 'scope']))

  for (const book of rows) {
    for (const ban of book.bans as any[]) {
      if ((ban.ban_source_links as any[]).length === 0) {
        console.log(csvRow([
          ban.id,
          book.slug,
          book.title,
          ban.country_code,
          ban.year_started ?? '',
          ban.scopes?.slug ?? '',
        ]))
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Summary counts
  // ══════════════════════════════════════════════════════════════════════════
  const totalBans = rows.flatMap(b => b.bans as any[])
  const unsourced = totalBans.filter(b => (b.ban_source_links as any[]).length === 0)
  const otherUS = totalBans.filter(b => {
    const reasons = (b.ban_reason_links as any[]).map((l: any) => l.reasons?.slug)
    return b.country_code === 'US' && b.scopes?.slug === 'school'
      && reasons.length === 1 && reasons[0] === 'other'
  })

  console.log('\n\n=== SUMMARY ===')
  console.log(`Total books: ${rows.length}`)
  console.log(`Total bans:  ${totalBans.length}`)
  console.log(`Unsourced bans: ${unsourced.length}`)
  console.log(`US school bans with only 'other' reason: ${otherUS.length}`)
}

main().catch(console.error)
