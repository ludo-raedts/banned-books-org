import { adminClient } from '../src/lib/supabase'
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

// A real book cover is always portrait. Google Books returns a degenerate
// horizontal strip (the top sliver of the cover, watermarked) for some books
// at high zoom levels. Detect by aspect ratio: height/width well above 1.
const MIN_PORTRAIT_RATIO = 1.2
const CONCURRENCY = 12

type Row = { id: number; slug: string; title: string; cover_url: string }
type Finding = {
  id: number
  slug: string
  title: string
  z3w: number | null
  z3h: number | null
  z3ratio: number | null
  z1w: number | null
  z1h: number | null
  z1ratio: number | null
  z1usable: boolean
  error?: string
}

async function dims(url: string): Promise<{ w: number; h: number } | null> {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const m = await sharp(buf).metadata()
    if (!m.width || !m.height) return null
    return { w: m.width, h: m.height }
  } catch {
    return null
  }
}

async function fetchAll(): Promise<Row[]> {
  const s = adminClient()
  const PAGE = 1000
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await s
      .from('books')
      .select('id,slug,title,cover_url')
      .like('cover_url', '%books.google.com/books/content%')
      .like('cover_url', '%zoom=3%')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...(data as Row[]))
    if (data.length < PAGE) break
  }
  return out
}

async function pool<T>(items: T[], n: number, fn: (t: T, i: number) => Promise<void>) {
  let idx = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (idx < items.length) {
        const i = idx++
        await fn(items[i], i)
      }
    })
  )
}

async function main() {
  const rows = await fetchAll()
  console.error(`Fetched ${rows.length} google-content zoom=3 covers. Auditing...`)

  const degenerate: Finding[] = []
  let ok = 0
  let errors = 0
  let done = 0

  await pool(rows, CONCURRENCY, async (r) => {
    const z3 = await dims(r.cover_url)
    done++
    if (done % 200 === 0) console.error(`  ...${done}/${rows.length}`)

    if (!z3) {
      errors++
      degenerate.push({
        id: r.id, slug: r.slug, title: r.title,
        z3w: null, z3h: null, z3ratio: null,
        z1w: null, z1h: null, z1ratio: null, z1usable: false,
        error: 'z3 fetch/metadata failed',
      })
      return
    }
    const ratio = z3.h / z3.w
    if (ratio >= MIN_PORTRAIT_RATIO) {
      ok++
      return
    }
    // degenerate — probe zoom=1
    const z1url = r.cover_url.replace('zoom=3', 'zoom=1')
    const z1 = await dims(z1url)
    const z1ratio = z1 ? z1.h / z1.w : null
    degenerate.push({
      id: r.id, slug: r.slug, title: r.title,
      z3w: z3.w, z3h: z3.h, z3ratio: +ratio.toFixed(2),
      z1w: z1?.w ?? null, z1h: z1?.h ?? null,
      z1ratio: z1ratio != null ? +z1ratio.toFixed(2) : null,
      z1usable: z1ratio != null && z1ratio >= MIN_PORTRAIT_RATIO,
    })
  })

  degenerate.sort((a, b) => a.title.localeCompare(b.title))
  const fixable = degenerate.filter((d) => d.z1usable)
  const unfixable = degenerate.filter((d) => !d.z1usable)

  writeFileSync('data/google-cover-audit.json', JSON.stringify(degenerate, null, 2))

  const md: string[] = []
  md.push('# Google Books degenerate cover audit')
  md.push('')
  md.push(`- Total google-content zoom=3 covers scanned: **${rows.length}**`)
  md.push(`- OK (portrait): **${ok}**`)
  md.push(`- Degenerate (ratio < ${MIN_PORTRAIT_RATIO}): **${degenerate.length}**`)
  md.push(`  - Fixable via zoom=1: **${fixable.length}**`)
  md.push(`  - Not fixable (zoom=1 also bad / fetch failed): **${unfixable.length}**`)
  md.push(`- Fetch/metadata errors: **${errors}**`)
  md.push('')
  md.push('## Fixable (zoom=3 → zoom=1)')
  md.push('')
  md.push('| slug | title | z3 | z1 |')
  md.push('|---|---|---|---|')
  for (const d of fixable) {
    md.push(`| ${d.slug} | ${d.title} | ${d.z3w}×${d.z3h} (${d.z3ratio}) | ${d.z1w}×${d.z1h} (${d.z1ratio}) |`)
  }
  md.push('')
  md.push('## Not fixable')
  md.push('')
  md.push('| slug | title | z3 | z1 | note |')
  md.push('|---|---|---|---|---|')
  for (const d of unfixable) {
    md.push(`| ${d.slug} | ${d.title} | ${d.z3w ?? '—'}×${d.z3h ?? '—'} | ${d.z1w ?? '—'}×${d.z1h ?? '—'} | ${d.error ?? 'zoom=1 still non-portrait'} |`)
  }
  writeFileSync('data/google-cover-audit.md', md.join('\n'))

  console.error('')
  console.error(`OK: ${ok}  Degenerate: ${degenerate.length}  (fixable ${fixable.length}, unfixable ${unfixable.length})  errors: ${errors}`)
  console.error('Report: data/google-cover-audit.md  +  data/google-cover-audit.json')
}

main()
