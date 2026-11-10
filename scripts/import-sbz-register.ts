/**
 * SBZ "Liste der auszusondernden Literatur" → REGISTER layer (register_lists +
 * register_entries). Lean entries only: no book/author rows, no enrichment.
 * Tier-(a) bans on books we already carry are a separate, approved step.
 *
 *   npx tsx --env-file=.env.local scripts/import-sbz-register.ts [--date=2026-11-10]           # dry-run
 *   npx tsx --env-file=.env.local scripts/import-sbz-register.ts [--date=2026-11-10] --apply   # write
 *
 * Input: data/sbz/stage0-<date>.json (scripts/build-sbz-register-stage0.ts).
 * Idempotent: upsert on (list_id, source_key); source_key = edition:sha1(raw)[:12]
 * (+ "#n" for the rare identical printed lines). Cross-references (xref) are
 * pointers, not entries, and are skipped. Dry-run runs in BEGIN READ ONLY.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { flagValue, isApply } from './lib/cli'

const DATE = flagValue('date') ?? '2026-11-10'
const APPLY = isApply()

export const SBZ_LIST = {
  slug: 'sbz-1946',
  title: 'Liste der auszusondernden Literatur (1946, Nachträge 1947, 1948, 1953)',
  title_en: 'List of Literature to Be Removed (Soviet Occupation Zone / GDR, 1946–1953)',
  issuer:
    'Deutsche Verwaltung für Volksbildung in der sowjetischen Besatzungszone (1946–1948); Ministerium für Volksbildung der DDR (1953)',
  country_code: 'DD',
  year_start: 1946,
  year_end: 1953,
  framing: 'denazification',
  source_name: 'Olaf Simons (ed.), transcription on polunbi.de — Datenbank Schrift und Bild 1900–1960',
  source_url: 'http://www.polunbi.de/bibliothek/1946-nslit.html',
  licence_note:
    'Official lists of 1946–1953 (amtliche Werke, §5 UrhG). Transcription by Olaf Simons, polunbi.de; entries link back to it.',
  intro_md: `In 1946 the German education administration in the Soviet occupation zone, working on Soviet orders, published a list of books to be withdrawn from every library and bookshop. The Deutsche Bücherei in Leipzig compiled it. Three supplements followed (1947, 1948 and, issued by the GDR's Ministry of Education, 1953).

The target was **fascist and militarist literature**: Nazi propaganda, race theory, war books, Hitler Youth and party publications, and also books seen as hostile to the Allies — which included anti-Soviet and anti-communist works. School books of 1933–1945 and military manuals were banned as whole groups.

This is **denazification**, not the kind of censorship most of this site documents, and it is shown separately: these titles are not counted in our banned-books totals. A small number of books here had *also* been banned by the Nazis before 1945; those link to their own pages.`,
} as const

const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

function letterOf(headword: string | null, title: string): string {
  const c = fold(headword ?? title).charAt(0).toUpperCase()
  return /[A-Z]/.test(c) ? c : '#'
}

type Stage = {
  edition: string; kind: string; headword: string | null; printed_author: string | null; author_display: string | null
  title: string; imprint: string | null; pub_year: number | null; ban_year: number; note: string | null
  printed_page: number | null; source_file: string; raw: string
}

async function main() {
  const stage: Stage[] = JSON.parse(readFileSync(`data/sbz/stage0-${DATE}.json`, 'utf8'))
  const seen = new Map<string, number>()
  const rows = stage
    .filter((e) => e.kind !== 'xref')
    .map((e) => {
      const base = `${e.edition}:${createHash('sha1').update(e.raw).digest('hex').slice(0, 12)}`
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      return {
        source_key: n === 1 ? base : `${base}#${n}`,
        edition: e.edition,
        kind: e.kind,
        letter: letterOf(e.headword, e.title),
        sort_key: `${fold(e.headword ?? e.title)} ${fold(e.title)}`.slice(0, 300),
        printed_author: e.printed_author,
        author_display: e.author_display,
        title: e.title,
        imprint: e.imprint,
        pub_year: e.pub_year,
        ban_year: e.ban_year,
        note: e.note,
        source_url: `http://www.polunbi.de/bibliothek/${e.source_file}`,
        printed_page: e.printed_page,
      }
    })
  const byKind: Record<string, number> = {}
  for (const r of rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1
  console.log(`stage rows ${stage.length}, register rows ${rows.length}`, byKind)

  const pg = newPgClient()
  await pg.connect()
  try {
    await pg.query(APPLY ? 'BEGIN' : 'BEGIN READ ONLY')
    const before = await pg.query(
      `select (select count(*) from register_lists)::int lists, (select count(*) from register_entries)::int entries`,
    )
    console.log('before', before.rows[0])
    if (!APPLY) {
      await pg.query('ROLLBACK')
      console.log('dry-run: nothing written (pass --apply)')
      return
    }
    const L = SBZ_LIST
    const { rows: lr } = await pg.query(
      `insert into register_lists (slug, title, title_en, issuer, country_code, year_start, year_end, framing, intro_md, source_name, source_url, licence_note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (slug) do update set title=excluded.title, title_en=excluded.title_en, issuer=excluded.issuer,
         country_code=excluded.country_code, year_start=excluded.year_start, year_end=excluded.year_end,
         framing=excluded.framing, intro_md=excluded.intro_md, source_name=excluded.source_name,
         source_url=excluded.source_url, licence_note=excluded.licence_note, updated_at=now()
       returning id`,
      [L.slug, L.title, L.title_en, L.issuer, L.country_code, L.year_start, L.year_end, L.framing, L.intro_md, L.source_name, L.source_url, L.licence_note],
    )
    const listId = lr[0].id as number
    const cols = ['source_key', 'edition', 'kind', 'letter', 'sort_key', 'printed_author', 'author_display', 'title', 'imprint', 'pub_year', 'ban_year', 'note', 'source_url', 'printed_page'] as const
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const params: unknown[] = []
      const values = chunk.map((r) => {
        const ph = [listId, ...cols.map((c) => r[c])].map((v) => {
          params.push(v)
          return `$${params.length}`
        })
        return `(${ph.join(',')})`
      })
      await pg.query(
        `insert into register_entries (list_id, ${cols.join(', ')}) values ${values.join(',')}
         on conflict (list_id, source_key) do update set ${cols.filter((c) => c !== 'source_key').map((c) => `${c}=excluded.${c}`).join(', ')}`,
        params,
      )
    }
    await pg.query(
      `update register_lists l set
         entry_count   = (select count(*) from register_entries e where e.list_id=l.id and e.kind in ('book','blanket')),
         book_count    = (select count(*) from register_entries e where e.list_id=l.id and e.kind='book'),
         matched_count = (select count(*) from register_entries e where e.list_id=l.id and e.matched_book_id is not null),
         updated_at = now()
       where l.id=$1`,
      [listId],
    )
    await pg.query('COMMIT')
    const after = await pg.query(
      `select l.slug, l.entry_count, l.book_count, l.matched_count, (select count(*) from register_entries e where e.list_id=l.id)::int total
       from register_lists l where l.id=$1`,
      [listId],
    )
    console.log('after', after.rows[0])
  } catch (e) {
    await pg.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    await pg.end()
  }
}

if (process.argv[1]?.endsWith('import-sbz-register.ts')) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
