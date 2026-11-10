/**
 * SBZ "Liste der auszusondernden Literatur" (1946 + Nachträge 1947/1948/1953)
 * — Stap 0 builder for the REGISTER layer (READ-ONLY, never touches Supabase).
 *
 * Official lists of the Deutsche Verwaltung für Volksbildung in der sowjetischen
 * Besatzungszone (1946, 1947, 1948) and the Ministerium für Volksbildung der DDR
 * (Dritter Nachtrag, Stand 1.4.1952, printed 1953): Nazi / militarist literature
 * to be withdrawn from libraries and the book trade (denazification). This is a
 * different kind of list from repression censorship — the page must say so.
 *
 * Source: the scholarly transcription on polunbi.de ("Projekt Politische
 * Unterhaltungsbibliothek", bibliothek/1946-nslit*.html and 1947/1948/1953-*),
 * fetched from Wayback copies because polunbi.de times out from here. Do NOT
 * use the vho.org copy (revisionist site; polunbi's intro explicitly warns about it).
 *   Raw HTML lives in data/sbz/raw/ (gitignored).
 *
 *   npx tsx scripts/build-sbz-register-stage0.ts [--in=data/sbz/raw] [--date=YYYY-MM-DD] [--sample=200]
 *   → data/sbz/stage0-<date>.json (+ sample-<date>.json)
 *
 * Every transcript entry is `<li><p class="lit">[prefix] <b>HEADWORD</b> rest</p></li>`;
 * page breaks are inline `|<N>` markers. Kinds:
 *   book        — a single title (with or without a personal author)
 *   blanket     — "Sämtliche Schriften" (all works of an author)
 *   group       — a whole category ("die Schulbücher aus den Jahren 1933-1945")
 *   periodical  — the Zeitschriften sections (outside books-only scope; counted apart)
 *   xref        — "… s. L i n s t ä d t, Franz [Verf.]" (pointer, not an entry)
 *   rescission  — 1948 "III. Berichtigungen": bans lifted on earlier entries
 * year = ban year of the edition (1946/1947/1948/1953), pub_year = imprint year.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { flagValue, intFlag } from './lib/cli'

export const SBZ_EDITIONS = {
  '1946': { list_slug: 'sbz-1946', label: 'Vorläufige Ausgabe, Stand 1. April 1946', ban_year: 1946 },
  '1947': { list_slug: 'sbz-1946', label: 'Erster Nachtrag, Stand 1. Januar 1947', ban_year: 1947 },
  '1948': { list_slug: 'sbz-1946', label: 'Zweiter Nachtrag, Stand 1. September 1948', ban_year: 1948 },
  '1953': { list_slug: 'sbz-1946', label: 'Dritter Nachtrag, Stand 1. April 1952 (gedruckt 1953)', ban_year: 1953 },
} as const
type EditionKey = keyof typeof SBZ_EDITIONS

export type SbzKind = 'book' | 'blanket' | 'group' | 'periodical' | 'xref' | 'rescission'
export type SbzEntry = {
  seq: number
  edition: EditionKey
  kind: SbzKind
  headword: string | null // the bold sort word of the print (alphabetisation key)
  printed_author: string | null // as printed: "Adler, Hermann"
  author_display: string | null // "Hermann Adler"
  title: string
  imprint: string | null // "Berlin: Limpert 1940"
  pub_year: number | null
  ban_year: number
  note: string | null // "Nur 2. u. 3. Auflage verboten." etc.
  printed_page: number | null
  source_file: string // polunbi page, e.g. 1946-nslit-b.html
  raw: string
}

const ENT: Record<string, string> = {
  mdash: '—', mdas: '—', ndash: '–', uuml: 'ü', auml: 'ä', ouml: 'ö', szlig: 'ß', amp: '&', quot: '"',
  nbsp: ' ', Ouml: 'Ö', Uuml: 'Ü', Auml: 'Ä', eacute: 'é', aacute: 'á', oacute: 'ó', egrave: 'è',
  acirc: 'â', agrave: 'à', uacute: 'ú', iacute: 'í', ecirc: 'ê', ntilde: 'ñ', icirc: 'î', ocirc: 'ô',
  gt: '>', lt: '<', larr: '', dagger: '†',
}
function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => {
      const c = Number(n)
      // cp1252 range used by the HTML editor
      const cp1252: Record<number, string> = { 133: '…', 134: '†', 145: '‘', 142: 'Ž', 154: 'š', 158: 'ž' }
      return cp1252[c] ?? String.fromCharCode(c)
    })
    .replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m)
}
const stripTags = (s: string) => s.replace(/<[^>]+>/g, '')
const clean = (s: string) =>
  decode(stripTags(s))
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** "L i n s t ä d t" → "Linstädt" (Sperrsatz in the print). */
export function unLetterspace(s: string): string {
  return s.replace(/(?:^|(?<=\s))((?:\p{L}\s){2,}\p{L})(?=[\s,.;:\]]|$)/gu, (m) => m.replace(/\s/g, ''))
}

const IMPRINT_RE = /^(?:[A-ZÄÖÜ][^:—]{0,80}(?::|\s1[789]\d\d\b)|o\.\s?O\.|\(|Hrsg)/u
const NOTE_RE = /\b(verboten|Auflage|Ausgaben?|Jahrg|Jg\.|ab\s+\d|nur\s)/i

function splitImprint(main: string): { body: string; imprint: string | null; note: string | null } {
  const parts = main.split(/\s—\s/)
  if (parts.length === 1) return { body: main, imprint: null, note: null }
  let i = 1
  while (i < parts.length && !IMPRINT_RE.test(parts[i])) i++
  if (i >= parts.length) i = parts.length - 1
  const body = parts.slice(0, i).join(' — ')
  let imprint = parts.slice(i).join(' — ')
  let note: string | null = null
  // trailing notes after the imprint's year/period: "… 1938. Nur 2. Aufl. verboten."
  const m = imprint.match(/^(.*?\b1[789]\d\d\b[^.]*\.)\s+(.+)$/)
  if (m && NOTE_RE.test(m[2])) {
    imprint = m[1]
    note = m[2]
  } else {
    const br = imprint.match(/^(.*?)\s*(\[[^\]]+\])\s*$/)
    if (br) {
      imprint = br[1]
      note = br[2]
    }
  }
  return { body: body.trim(), imprint: imprint.replace(/\.$/, '').trim() || null, note }
}

function displayName(printed: string): string {
  // "Adler, Hermann" → "Hermann Adler"; "Abercron, Hugo Wilhelm von" → "Hugo Wilhelm von Abercron";
  // multi-author or pseudonym-only strings stay as printed.
  if (/\bu\.\s|\bund\s|;/.test(printed)) return printed
  const m = printed.match(/^([^,]+),\s*([^,]+)$/)
  return m ? `${m[2].trim()} ${m[1].trim()}` : printed
}

export function parseEntry(
  html: string,
  ctx: { edition: EditionKey; section: 'books' | 'periodicals' | 'rescissions'; page: number | null; file: string; seq: number },
): SbzEntry {
  const bIdx = html.search(/<b>/i)
  const prefix = bIdx > 0 ? clean(html.slice(0, bIdx)) : ''
  const raw = unLetterspace(clean(html))
  const hw = html.match(/<b>([\s\S]*?)<\/b>/i)
  const base = {
    seq: ctx.seq,
    headword: hw ? unLetterspace(clean(hw[1])).replace(/[,.:!?]+$/, '') || null : null,
    edition: ctx.edition,
    ban_year: SBZ_EDITIONS[ctx.edition].ban_year,
    printed_page: ctx.page,
    source_file: ctx.file,
    raw,
  }
  // Rescission references "(Liste vom 1.4.46 S. 54)" — strip into note.
  let text = raw
  let note: string | null = null
  const ref = text.match(/\(\s*(?:aufgeführt in\s+)?Liste vom ([\d.]+) S\. (\d+)\s*\)\.?/)
  if (ref) {
    note = `aufgehoben; vorher Liste vom ${ref[1]} S. ${ref[2]}`
    text = text.replace(ref[0], '').trim()
  }
  const isXref = !/\s—\s/.test(text) && /(?:^|\s)s\.\s+\S/.test(text)
  if (/^die\s/.test(text) && !/\s—\s/.test(text) && !isXref) {
    return { ...base, kind: 'group', printed_author: null, author_display: null, title: text.replace(/[,.]$/, ''), imprint: null, pub_year: null, note }
  }
  const { body, imprint, note: n2 } = splitImprint(text)
  note = [note, n2].filter(Boolean).join(' ') || null
  const pubYears = imprint ? [...imprint.matchAll(/\b(1[789]\d\d)\b/g)].map((m) => Number(m[1])) : []
  const pub_year = pubYears.length ? pubYears[pubYears.length - 1] : null

  let printed_author: string | null = null
  let title = body
  const colon = body.indexOf(':')
  if (!prefix && colon > 0) {
    const before = body.slice(0, colon).trim()
    if (before.split(/\s+/).length <= 9 && !/Hrsg|hrsg\./.test(before) && !/[!?]/.test(before)) {
      printed_author = before.replace(/\.$/, (m) => (/\s\p{Lu}\.$/u.test(before) ? m : ''))
      title = body.slice(colon + 1).trim()
    }
  }
  title = title.replace(/\s*\.$/, '').trim()
  const kind: SbzKind =
    ctx.section === 'rescissions'
      ? 'rescission'
      : isXref
        ? 'xref'
        : ctx.section === 'periodicals'
          ? 'periodical'
          : /^Sämtliche Schriften/i.test(title)
            ? 'blanket'
            : 'book'
  return {
    ...base,
    kind,
    printed_author,
    author_display: printed_author ? displayName(printed_author) : null,
    title,
    imprint,
    pub_year,
    note,
  }
}

export function parseFile(path: string, file: string, startSeq: number): SbzEntry[] {
  const html = new TextDecoder('latin1').decode(readFileSync(path))
  const edition = file.slice(0, 4) as EditionKey
  const isZeit = file.includes('-zeit')
  const rescStart = isZeit ? html.indexOf('III. Berichtigungen') : -1
  const pageMarks = [...html.matchAll(/\|&lt;(\d+)&gt;/g)].map((m) => ({ pos: m.index ?? 0, page: Number(m[1]) }))
  const out: SbzEntry[] = []
  for (const m of html.matchAll(/class="lit">([\s\S]*?)<\/li>/g)) {
    const pos = m.index ?? 0
    const mark = pageMarks.filter((p) => p.pos < pos).pop()
    const section = rescStart >= 0 && pos > rescStart ? 'rescissions' : isZeit ? 'periodicals' : 'books'
    // drop inline page markers before parsing
    const inner = m[1].replace(/\|&lt;\d+&gt;/g, ' ').replace(/<font size="\+2">([^<]*)<\/font>/g, '$1')
    out.push(parseEntry(inner, { edition, section, page: mark?.page ?? null, file, seq: startSeq + out.length }))
  }
  return out
}

function main() {
  const dir = flagValue('in') ?? 'data/sbz/raw'
  const date = flagValue('date') ?? new Date().toISOString().slice(0, 10)
  const sampleN = intFlag('sample', 200)
  const files = readdirSync(dir)
    .filter((f) => /^(1946|1947|1948|1953)-nslit.*\.html$/.test(f))
    .sort((a, b) => {
      // edition, then main page first, then letters, then zeit
      const key = (f: string) => `${f.slice(0, 4)}-${f === `${f.slice(0, 4)}-nslit.html` ? '0' : f.includes('zeit') ? 'z~' : `1${f}`}`
      return key(a).localeCompare(key(b))
    })
  const all: SbzEntry[] = []
  for (const f of files) all.push(...parseFile(join(dir, f), f, all.length))
  const counts: Record<string, number> = {}
  for (const e of all) counts[`${e.edition}:${e.kind}`] = (counts[`${e.edition}:${e.kind}`] ?? 0) + 1
  mkdirSync('data/sbz', { recursive: true })
  writeFileSync(`data/sbz/stage0-${date}.json`, JSON.stringify(all, null, 1))
  const books = all.filter((e) => e.kind === 'book')
  const step = Math.max(1, Math.floor(books.length / sampleN))
  const sample = books.filter((_, i) => i % step === 0).slice(0, sampleN)
  writeFileSync(`data/sbz/sample-${date}.json`, JSON.stringify(sample, null, 1))
  console.log(`files ${files.length}, entries ${all.length}`)
  console.log(counts)
  console.log(`books with author ${books.filter((b) => b.printed_author).length}, with pub_year ${books.filter((b) => b.pub_year).length}`)
  console.log(`→ data/sbz/stage0-${date}.json, sample ${sample.length}`)
}

if (process.argv[1]?.endsWith('build-sbz-register-stage0.ts')) main()
