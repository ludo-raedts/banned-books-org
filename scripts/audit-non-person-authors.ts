#!/usr/bin/env tsx
/**
 * Audit: vind author-rijen waarvan de display_name aanduidt dat het géén
 * persoon is — uitgeverijen, redacties, comités, ministeries, instituten,
 * partijen, "et al."-staarten, …
 *
 * Achtergrond: cleanup van 2026-05-28 ruimde 13 Argentijnse non-persoon
 * authors op (7 title-as-author + 6 publishers). Dit script vangt
 * vergelijkbare gevallen uit andere imports (KDN-Maleisië, China-batches,
 * etc.) — wereldwijd, niet alleen Argentinië.
 *
 * Per rij: keyword + bio-aanwezigheid + boek-count + voorbeelden, plus
 * een classificatie:
 *
 *   PUBLISHER   — "Editorial X", "Ediciones X", "Press", "Penerbit"
 *   ORG_BODY    — overheid / partij / instituut / comité
 *   STAFF_TAIL  — "Editorial Staff, X 1952"
 *   ANON_GROUP  — "X and Others", "et al.", "and 4 Others"
 *   TITLE_LIKE  — verdacht lange string die op een boektitel lijkt
 *   REVIEW      — keyword aanwezig maar context onduidelijk
 *
 * Read-only. Schrijft markdown-rapport naar
 *   data/non-person-authors-review.md
 *
 *   pnpm tsx --env-file=.env.local scripts/audit-non-person-authors.ts
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient } from '../src/lib/supabase'

type Row = {
  id: number
  display_name: string
  slug: string
  bio: string | null
  birth_year: number | null
  death_year: number | null
}

// Keyword-categorieën. Volgorde: meest specifiek eerst.
// Match is case-insensitive; word-boundary tussen letters niet vereist —
// we vangen ook "Penerbit" als één-woord-prefix etc.
type KeywordRule = {
  category: 'PUBLISHER' | 'ORG_BODY' | 'STAFF_TAIL' | 'ANON_GROUP' | 'TITLE_LIKE' | 'REVIEW'
  pattern: RegExp
  label: string
}

const RULES: KeywordRule[] = [
  // ── ANON_GROUP — staarten ──────────────────────────────────────────
  { category: 'ANON_GROUP', pattern: /\b(?:et\s+al\.?|et\.\s*al\.?)\s*$/i, label: 'et al.' },
  { category: 'ANON_GROUP', pattern: /\b(?:and|&|en|y)\s+\d+\s+others\b/i, label: 'and N Others' },
  { category: 'ANON_GROUP', pattern: /\b(?:and|&)\s+others\s*$/i, label: 'and Others' },

  // ── STAFF_TAIL — "Editorial Staff, X" of "Redaksi …" ───────────────
  { category: 'STAFF_TAIL', pattern: /\bEditorial\s+Staff\b/i, label: 'Editorial Staff' },
  { category: 'STAFF_TAIL', pattern: /\bRedactie\b/i, label: 'Redactie (NL)' },
  { category: 'STAFF_TAIL', pattern: /\bRedaksi\b/i, label: 'Redaksi (ID/MS)' },
  { category: 'STAFF_TAIL', pattern: /\bSidang\s+Pengarang\b/i, label: 'Sidang Pengarang (MS editorial board)' },

  // ── PUBLISHER ──────────────────────────────────────────────────────
  { category: 'PUBLISHER', pattern: /\bEditorial\b/i, label: 'Editorial' },
  { category: 'PUBLISHER', pattern: /\bEdiciones\b/i, label: 'Ediciones' },
  { category: 'PUBLISHER', pattern: /\bEditores\b/i, label: 'Editores' },
  { category: 'PUBLISHER', pattern: /\b(?:Press|Penerbit|Penerbitan)\b/i, label: 'Press/Penerbit' },
  { category: 'PUBLISHER', pattern: /\b(?:Publishing|Publishers?|Publication[s]?)\b/i, label: 'Publishing' },
  { category: 'PUBLISHER', pattern: /\bUitgeverij\b/i, label: 'Uitgeverij (NL)' },
  { category: 'PUBLISHER', pattern: /\bVerlag\b/i, label: 'Verlag (DE)' },
  { category: 'PUBLISHER', pattern: /\b(?:Maison\s+d['’]?[ée]dition|[ÉE]dition[s]?)\b/i, label: 'Édition(s) (FR)' },
  { category: 'PUBLISHER', pattern: /\bImprint\b/i, label: 'Imprint' },
  { category: 'PUBLISHER', pattern: /\bBooks?\s+(?:Inc|Ltd|Co)\b/i, label: 'Books Inc/Ltd' },

  // ── ORG_BODY — overheid, partij, instituut, comité ─────────────────
  { category: 'ORG_BODY', pattern: /\b(?:Ministry|Ministerio|Ministerie|Minist[èe]re)\b/i, label: 'Ministry' },
  { category: 'ORG_BODY', pattern: /\b(?:Department|Departement|Dept\.?|Jabatan)\b/i, label: 'Department/Jabatan' },
  { category: 'ORG_BODY', pattern: /\b(?:Bureau|Biro)\b/i, label: 'Bureau' },
  { category: 'ORG_BODY', pattern: /\b(?:Office|Pejabat|Kantor)\b/i, label: 'Office' },
  { category: 'ORG_BODY', pattern: /\b(?:Committee|Comm?ittee|Komite|Jawatankuasa|Panitia)\b/i, label: 'Committee/Panitia' },
  { category: 'ORG_BODY', pattern: /\b(?:Commission|Comisi[óo]n|Commissie|Komisi)\b/i, label: 'Commission' },
  { category: 'ORG_BODY', pattern: /\b(?:Council|Consejo|Raad|Majlis|Dewan)\b/i, label: 'Council' },
  { category: 'ORG_BODY', pattern: /\b(?:Institute|Instituto|Instituut|Institut)\b/i, label: 'Institute' },
  { category: 'ORG_BODY', pattern: /\b(?:Centre|Center|Centro|Centrum|Pusat)\b/i, label: 'Centre/Pusat' },
  { category: 'ORG_BODY', pattern: /\b(?:Foundation|Fondation|Fundaci[óo]n|Stichting|Yayasan)\b/i, label: 'Foundation/Yayasan' },
  { category: 'ORG_BODY', pattern: /\b(?:Association|Asociaci[óo]n|Asosiasi|Persatuan|Persekutuan)\b/i, label: 'Association/Persatuan' },
  { category: 'ORG_BODY', pattern: /\b(?:Society|Sociedad|Vereniging|Masyarakat)\b/i, label: 'Society' },
  { category: 'ORG_BODY', pattern: /\b(?:Federation|Federaci[óo]n|Federasi|Federatie)\b/i, label: 'Federation' },
  { category: 'ORG_BODY', pattern: /\b(?:Union|Uni[óo]n|Unie|Kesatuan)\b/i, label: 'Union/Kesatuan' },
  { category: 'ORG_BODY', pattern: /\b(?:Agency|Agencia|Agentschap|Agensi)\b/i, label: 'Agency' },
  { category: 'ORG_BODY', pattern: /\b(?:Party|Partido|Partij|Parti|Partai)\b/i, label: 'Party/Parti' },
  { category: 'ORG_BODY', pattern: /\b(?:Front|Frente|Fronte)\b/i, label: 'Front' },
  { category: 'ORG_BODY', pattern: /\b(?:Movement|Movimiento|Beweging|Pergerakan)\b/i, label: 'Movement' },
  { category: 'ORG_BODY', pattern: /\b(?:Brigade|Brigada)\b/i, label: 'Brigade' },
  { category: 'ORG_BODY', pattern: /\b(?:Corps|Cuerpo|Korps)\b/i, label: 'Corps' },
  { category: 'ORG_BODY', pattern: /\b(?:Congress|Congreso|Kongres)\b/i, label: 'Congress' },
  { category: 'ORG_BODY', pattern: /\b(?:Parliament|Parlamento|Parlement)\b/i, label: 'Parliament' },
  { category: 'ORG_BODY', pattern: /\b(?:Embassy|Embajada|Ambassade|Kedutaan)\b/i, label: 'Embassy' },
  { category: 'ORG_BODY', pattern: /\b(?:Army|Tentara|Ej[ée]rcito|Leger)\b/i, label: 'Army/Tentara' },
  { category: 'ORG_BODY', pattern: /\b(?:Group|Grupo|Groep|Kumpulan)\b/i, label: 'Group/Kumpulan' },

  // ── TITLE_LIKE — heuristisch te lang, beginnen met "The/Atlas/etc." ─
  { category: 'TITLE_LIKE', pattern: /^(?:Atlas|Diccionario|Enciclopedia|Manual|Cuaderno|Cuadernos|Colecci[óo]n|Antolog[ií]a|Cat[áa]logo|Bolet[ií]n|Revista|Almanaque|Anuario|Compendio|S[ée]rie|Serie)\b/i, label: 'reference-work prefix' },
]

// Whitelist: echte persoonsnamen die per ongeluk een keyword bevatten
// (vooral Indonesische/Maleise vertalingen die als achternaam voorkomen).
const WHITELIST_NAMES = new Set([
  'Melissa Kantor',  // "Kantor" = Office (ID/MS) maar hier achternaam
])

type Hit = { row: Row; category: KeywordRule['category']; keyword: string }

async function loadAll(sb: ReturnType<typeof adminClient>): Promise<Row[]> {
  const PAGE = 1000
  let offset = 0
  const rows: Row[] = []
  while (true) {
    const { data, error } = await sb.from('authors')
      .select('id, display_name, slug, bio, birth_year, death_year')
      .order('id').range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as Row[]))
    if (data.length < PAGE) break
    offset += PAGE
  }
  return rows
}

function classify(name: string): Hit['category'] | null {
  // Geef de categorie van de FIRST match terug, in volgorde van RULES.
  for (const rule of RULES) {
    if (rule.pattern.test(name)) return rule.category
  }
  return null
}

function firstHit(name: string): { category: Hit['category']; keyword: string } | null {
  for (const rule of RULES) {
    if (rule.pattern.test(name)) return { category: rule.category, keyword: rule.label }
  }
  return null
}

async function main() {
  const sb = adminClient()
  console.log('── audit: non-person author names ──\n')

  const rows = await loadAll(sb)
  console.log(`Loaded ${rows.length} authors`)

  const hits: Hit[] = []
  for (const r of rows) {
    if (WHITELIST_NAMES.has(r.display_name)) continue
    const m = firstHit(r.display_name)
    if (m) hits.push({ row: r, category: m.category, keyword: m.keyword })
  }
  console.log(`Hits: ${hits.length}\n`)

  // Per categorie
  const byCat: Record<string, Hit[]> = {}
  for (const h of hits) (byCat[h.category] ??= []).push(h)
  for (const [cat, arr] of Object.entries(byCat).sort()) {
    console.log(`  ${cat.padEnd(12)} ${arr.length}`)
  }

  // Book-counts ophalen voor alle hits (batch-friendly: per author een quick query)
  const bookCounts = new Map<number, number>()
  const sampleTitles = new Map<number, string[]>()
  for (const h of hits) {
    const { data: ba } = await sb.from('book_authors').select('books(title)').eq('author_id', h.row.id)
    bookCounts.set(h.row.id, ba?.length ?? 0)
    sampleTitles.set(h.row.id, (ba ?? []).slice(0, 3).map((x: any) => x.books.title))
  }

  // Markdown rapport
  const md: string[] = []
  md.push('# Non-person author audit')
  md.push('')
  md.push(`_Gegenereerd ${new Date().toISOString().slice(0, 10)} door \`scripts/_audit_non_person_authors.ts\`._`)
  md.push('')
  md.push(`Totaal authors: ${rows.length}. Verdachte rijen: **${hits.length}**.`)
  md.push('')
  md.push('| categorie | aantal |')
  md.push('|---|---:|')
  for (const [cat, arr] of Object.entries(byCat).sort()) md.push(`| \`${cat}\` | ${arr.length} |`)
  md.push('')
  md.push('Categorieën:')
  md.push('')
  md.push('- **PUBLISHER** — uitgeverij ("Editorial X", "Ediciones X", "Penerbit Y")')
  md.push('- **ORG_BODY** — overheid / partij / comité / instituut / kerkelijke orde')
  md.push('- **STAFF_TAIL** — "Editorial Staff, X 1952", "Redaksi Z", redactionele groep')
  md.push('- **ANON_GROUP** — "X et al.", "X and Others", "Y and 12 Others"')
  md.push('- **TITLE_LIKE** — naam begint met reference-work woord (Atlas/Diccionario/Enciclopedia)')
  md.push('')
  md.push('Aanbevolen actie per categorie:')
  md.push('')
  md.push('- **PUBLISHER / TITLE_LIKE / STAFF_TAIL** → verwijder author-rij, book_authors-link weg. Boeken blijven, géén auteur. Volg `scripts/_fix_argentina_publisher_authors.ts`.')
  md.push('- **ORG_BODY** → meestal verwijderen, maar individueel beoordelen. Sommige overheid/partij-publicaties hebben legitiem de organisatie als author (kerkelijke encyclieken, partijcongres-resoluties).')
  md.push('- **ANON_GROUP** → eerste naam-deel hernoemen + staart wegslopen (zie `scripts/split-ampersand-smush-authors.ts` STRIP_OTHERS-tak).')
  md.push('')

  const order: Hit['category'][] = ['PUBLISHER', 'ORG_BODY', 'STAFF_TAIL', 'ANON_GROUP', 'TITLE_LIKE', 'REVIEW']
  for (const cat of order) {
    const inCat = byCat[cat]
    if (!inCat || inCat.length === 0) continue
    md.push(`## ${cat} (${inCat.length})`)
    md.push('')
    // Sorteer op book-count (meeste impact eerst) dan id
    inCat.sort((a, b) => (bookCounts.get(b.row.id) ?? 0) - (bookCounts.get(a.row.id) ?? 0) || a.row.id - b.row.id)
    for (const h of inCat) {
      const r = h.row
      const bc = bookCounts.get(r.id) ?? 0
      const titles = sampleTitles.get(r.id) ?? []
      md.push(`### id=${r.id} · \`${r.display_name}\``)
      md.push('')
      md.push(`- keyword: **${h.keyword}** · boeken: **${bc}** · bio=${r.bio ? `${r.bio.length}c` : 'N'} · b.${r.birth_year ?? '?'} d.${r.death_year ?? '?'}`)
      if (titles.length > 0) md.push(`- voorbeelden: _${titles.join(' / ')}_`)
      if (r.bio) md.push(`- bio: _${r.bio.slice(0, 140).replace(/\n/g, ' ')}…_`)
      md.push('')
    }
  }

  const outPath = join(process.cwd(), 'data', 'non-person-authors-review.md')
  writeFileSync(outPath, md.join('\n'))
  console.log(`\nMarkdown report: ${outPath}`)
}

main().catch(err => { console.error(err); process.exit(1) })
