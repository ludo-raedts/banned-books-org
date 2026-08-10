#!/usr/bin/env tsx
/**
 * READ-ONLY detector: cross-script duplicate AUTHORS — a foreign-language ban
 * import (Russia FSEM, KDN, Iran, …) minted a fresh author row keyed on the
 * source-language transliteration of someone we already catalogue in Latin
 * (e.g. "Антон Шандор ЛаВей" #9639 shadowing "Anton LaVey" #4433).
 *
 * Two cheap, high-precision signals (no LLM, no translation):
 *   1. name-match  — a non-Latin author whose name_english (normalised) equals
 *                    an existing Latin author's display_name.
 *   2. bio-match   — two author rows, one Latin + one non-Latin, sharing an
 *                    identical bio prefix (the import copied the same bio text).
 *
 * A hit is a candidate AUTHOR merge → fold per scripts/merge-cross-language-dupes.ts
 * (foreign DROP contributes only its ban + URL alias + language-neutral facts;
 * never its name/title/description). Whether the *books* also merge is a separate
 * call: same work in two languages → merge book; different works by the same
 * person → keep books, merge only the author.
 *
 * Coverage caveat: name-match only fires where name_english is populated (sparse
 * today — most non-Latin authors have neither name_english nor name_transliterated),
 * so this UNDER-counts. Backfilling those fields is what would widen it; until then
 * a 0 here means "no *detectable* twin", not "no twin".
 *
 *   pnpm tsx --env-file=.env.local scripts/_audit_cross_script_dupes.ts
 */
import { adminClient } from '../src/lib/supabase'

const sb = adminClient()
const PAGE = 1000

async function allAuthors() {
  let out: any[] = [], from = 0
  for (;;) {
    const { data, error } = await sb.from('authors')
      .select('id,slug,display_name,name_native,name_english,bio')
      .order('id').range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    out = out.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

// A display string is "non-Latin" if it contains any char outside the Latin +
// common-punctuation range (so accented Latin names stay on the Latin side).
const isLatin = (s: string) => !/[^ -ɏ\s'’.,()-]/.test(s || '')
const norm = (s: string) => (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()

async function main() {
  const authors = await allAuthors()
  const latin = authors.filter(a => a.display_name && isLatin(a.display_name))
  const nonLatin = authors.filter(a => a.display_name && !isLatin(a.display_name))

  const latinByName = new Map<string, any[]>()
  for (const a of latin) {
    const k = norm(a.display_name)
    if (!k) continue
    ;(latinByName.get(k) ?? latinByName.set(k, []).get(k)!).push(a)
  }

  // Signal 1: name_english of a non-Latin author matches a Latin author's name.
  const nameHits: string[] = []
  for (const a of nonLatin) {
    const k = norm(a.name_english)
    if (k && latinByName.has(k)) {
      nameHits.push(`  #${a.id} "${a.display_name}" (name_english="${a.name_english}") → ` +
        latinByName.get(k)!.map(x => `#${x.id} "${x.display_name}"`).join(', '))
    }
  }

  // Signal 2: identical bio prefix shared across scripts.
  const byBio = new Map<string, any[]>()
  for (const a of authors) {
    if (!a.bio) continue
    const k = a.bio.slice(0, 120)
    ;(byBio.get(k) ?? byBio.set(k, []).get(k)!).push(a)
  }
  const bioHits: string[] = []
  for (const g of byBio.values()) {
    if (g.length > 1 && g.some(a => !isLatin(a.display_name)) && g.some(a => isLatin(a.display_name))) {
      bioHits.push('  ' + g.map(a => `#${a.id} "${a.display_name}"`).join('  ||  '))
    }
  }

  console.log(`Scanned ${authors.length} authors (${nonLatin.length} non-Latin display_name; ` +
    `${nonLatin.filter(a => a.name_english).length} have name_english).\n`)
  console.log(`Signal 1 — name_english matches a Latin author: ${nameHits.length}`)
  nameHits.forEach(l => console.log(l))
  console.log(`\nSignal 2 — identical bio across scripts: ${bioHits.length}`)
  bioHits.forEach(l => console.log(l))

  const total = nameHits.length + bioHits.length
  console.log(`\n${total === 0 ? '✓ No detectable cross-script author twins.' : `⚠ ${total} candidate(s) — fold via scripts/merge-cross-language-dupes.ts.`}`)
}
main().catch(e => { console.error(e); process.exit(1) })
