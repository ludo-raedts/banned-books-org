/**
 * SBZ register — tier (a): register entries that are books we ALREADY carry get
 * a real DD ban (via the shared commit-lib) and register_entries.matched_book_id.
 * No new books, no new authors.
 *
 *   npx tsx --env-file=.env.local scripts/import-sbz-register-matches.ts            # dry-run → data/sbz/matches-plan.md
 *   npx tsx --env-file=.env.local scripts/import-sbz-register-matches.ts --apply
 *
 * Match = exact slug of the printed title (books.slug) AND the printed surname
 * matches one of the book's authors (substring after folding, or edit distance
 * ≤ 1 for OCR/spelling variants such as Saller/Salier, Mütler/Mueller).
 * Generic-title collisions ("Adolf Hitler", "Lenin", "Deutschland") fail the
 * author test and stay register-only. Anonymous entries never match.
 *
 * Ban: country DD, scope government, action banned, status historical,
 * reason political, year = first edition that lists it (1946/1947/1948/1953).
 * 1948 "Berichtigungen" (ban lifted) → year_ended 1948 on that ban.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { slugify } from '../src/lib/imports/slugify'
import { commitNewBanForBook } from '../src/lib/imports/review-commit'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'
import { SBZ_LIST } from './import-sbz-register'

const DATE = '2026-11-10'
const APPLY = isApply()
const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').toLowerCase().replace(/[^a-z]/g, '')
// ü→ue style variants
const fold2 = (s: string) => fold(s.replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue'))
function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}
function surnameMatches(printed: string, authorNames: string[]): boolean {
  const sn = printed.split(',')[0].split(/\s+u\.\s/)[0].trim()
  const cands = [fold(sn), fold2(sn)].filter((s) => s.length >= 3)
  return authorNames.some((a) => {
    const toks = a.split(/[\s-]+/).flatMap((t) => [fold(t), fold2(t)])
    const whole = [fold(a), fold2(a)]
    return cands.some(
      (c) => whole.some((w) => w.includes(c)) || (c.length >= 5 && toks.some((t) => t.length >= 5 && lev(t, c) <= 1)),
    )
  })
}

async function main() {
  const stage = JSON.parse(readFileSync(`data/sbz/stage0-${DATE}.json`, 'utf8')) as any[]
  const pg = newPgClient()
  await pg.connect()
  await pg.query('BEGIN READ ONLY')
  const entries = stage.filter((e) => (e.kind === 'book' || e.kind === 'rescission') && e.printed_author)
  const slugs = [...new Set(entries.map((e) => slugify(e.title)))]
  const { rows: books } = await pg.query(
    `select b.id, b.slug, b.title, coalesce(array_agg(a.display_name) filter (where a.id is not null), '{}') authors,
            coalesce((select string_agg(x.country_code||x.year_started, ',') from bans x where x.book_id=b.id), '') bans
       from books b left join book_authors ba on ba.book_id=b.id left join authors a on a.id=ba.author_id
      where b.slug = any($1) group by b.id`,
    [slugs],
  )
  const bySlug = new Map(books.map((b: any) => [b.slug, b]))
  type Plan = { book: any; editions: Set<number>; rescinded: boolean; raws: string[]; keys: Array<{ edition: string; raw: string }> }
  const plan = new Map<number, Plan>()
  const rejected: string[] = []
  for (const e of entries) {
    const b = bySlug.get(slugify(e.title))
    if (!b) continue
    if (!surnameMatches(e.printed_author, b.authors)) {
      rejected.push(`- "${e.title}" (${e.printed_author}) ≠ #${b.id} by ${b.authors.join('; ')}`)
      continue
    }
    const p = plan.get(b.id) ?? { book: b, editions: new Set(), rescinded: false, raws: [], keys: [] }
    if (e.kind === 'rescission') p.rescinded = true
    else p.editions.add(e.ban_year)
    p.raws.push(`${e.edition}: ${e.raw}`)
    p.keys.push({ edition: e.edition, raw: e.raw })
    plan.set(b.id, p)
  }
  await pg.query('ROLLBACK')
  const { rows: pre } = await pg.query(`select count(*)::int n, count(distinct book_id)::int books from bans where country_code='DD'`)
  const md = [
    `# SBZ tier (a) plan — ${new Date().toISOString().slice(0, 10)}`,
    '',
    `Books to get a DD ban: ${plan.size} (rescinded 1948: ${[...plan.values()].filter((p) => p.rescinded).length}). DD bans before: ${pre[0].n} on ${pre[0].books} books.`,
    '',
    ...[...plan.values()].map(
      (p) =>
        `- #${p.book.id} "${p.book.title}" — ${p.book.authors.join('; ')} [${p.book.bans}] → DD ${Math.min(...p.editions)}${p.rescinded ? ' (lifted 1948)' : ''}\n  ${p.raws.join('\n  ')}`,
    ),
    '',
    `## Rejected (title slug matches, author does not) — ${rejected.length}`,
    '',
    ...rejected,
  ]
  writeFileSync(`data/sbz/matches-plan-${DATE}.md`, md.join('\n') + '\n')
  console.log(`plan: ${plan.size} books, rejected ${rejected.length} → data/sbz/matches-plan-${DATE}.md`)
  console.log('before', pre[0])
  if (!APPLY) {
    await pg.end()
    console.log('dry-run: nothing written (pass --apply)')
    return
  }
  const { createHash } = await import('node:crypto')
  let created = 0
  for (const p of plan.values()) {
    const year = Math.min(...p.editions)
    const ed = year === 1953 ? 'Dritter Nachtrag (DDR, 1953)' : year === 1948 ? 'Zweiter Nachtrag (1948)' : year === 1947 ? 'Erster Nachtrag (1947)' : '1946 edition'
    const r = await commitNewBanForBook(
      {
        book_id: p.book.id,
        country_code: 'DD',
        scope_slug: 'government',
        action_type: 'banned',
        ban_status: 'historical',
        year,
        reason_slug: 'political',
        description_ban: `Listed for removal from libraries and bookshops in the Soviet occupation zone (${ed} of the "Liste der auszusondernden Literatur") as fascist or militarist literature.${p.rescinded ? ' The ban was lifted in 1948.' : ''}`,
        source_url: SBZ_LIST.source_url,
        source_name: SBZ_LIST.source_name,
        source_type: 'government',
      },
      pg,
    )
    if (r.created) created++
    if (p.rescinded) await pg.query(`update bans set year_ended = 1948 where id = $1`, [r.ban_id])
    for (const k of p.keys) {
      const prefix = `${k.edition}:${createHash('sha1').update(k.raw).digest('hex').slice(0, 12)}`
      await pg.query(
        `update register_entries set matched_book_id = $1
          where list_id = (select id from register_lists where slug = $2) and (source_key = $3 or source_key like $3 || '#%')`,
        [p.book.id, SBZ_LIST.slug, prefix],
      )
    }
  }
  await pg.query(
    `update register_lists l set matched_count = (select count(*) from register_entries e where e.list_id=l.id and e.matched_book_id is not null), updated_at=now() where slug=$1`,
    [SBZ_LIST.slug],
  )
  const { rows: post } = await pg.query(`select count(*)::int n, count(distinct book_id)::int books from bans where country_code='DD'`)
  const { rows: m } = await pg.query(`select matched_count from register_lists where slug=$1`, [SBZ_LIST.slug])
  console.log(`created ${created} bans; after`, post[0], 'register matched entries', m[0].matched_count)
  await pg.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
