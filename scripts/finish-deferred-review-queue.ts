#!/usr/bin/env tsx
/**
 * Finish the four remaining `import_review_queue` rows left in `deferred`
 * state, plus the one genuine duplicate book pair they surfaced.
 *
 * Decided 2026-06-06 (see session). Four deferred rows + one book-merge:
 *
 *   APPROVE (normal — same path as the /admin/import-review Approve button):
 *     #425  "The Chongzhen Emperor: Diligent Ruler of a Failed Dynasty"
 *           Chen Wutong · CN · banned/government/historical · reason political
 *     #1354 HK reportage by 42 journalists (反修例風暴採訪戰場)
 *           HK · banned/government/active · reason political · zh
 *           Title follows the HK convention: title = transliteration,
 *           title_native = Hanzi (mirrors books #7527-#7530).
 *
 *   BLANKET-WORKS (approve, then flag is_blanket_works=true so the pseudo-book
 *   is excluded from sitemap/enrichment and shown under the author page's
 *   "blanket works" section — same model as the Liste Otto "Toutes ses œuvres"
 *   entries; see migration 20260529130000_books_is_blanket_works.sql):
 *     #200  "Works (Friedrich Nietzsche)" · SU · banned/government/historical
 *           ban year 1923 (Krupskaya proposal), not the parsed 1872.
 *     #213  "Works (Federico García Lorca)" · ES · banned/government/historical
 *           ban 1939-1954.
 *
 *   MERGE (book-to-book; mirrors merge-orwell-1984-dupes doctrine):
 *     KEEP #799  "Dwikhandita"  (en, isbn, OL work, pub 2003, IN+BD bans)
 *     DROP #6331 "Dwikhandito"  (only cover_url + censorship_context, IN ban)
 *     Same author #111 (Taslima Nasrin), same autobiography volume.
 *     DROP's IN/scope-4 ban dups KEEP's → union its links onto KEEP's IN ban,
 *     enrich KEEP's null cover_url + censorship_context from DROP, alias
 *     "dwikhandito" → KEEP, delete #6331, re-point queue row #39 → #799.
 *
 * Idempotent: rows already out of `deferred` are skipped; if #6331 is gone the
 * merge is a no-op.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/finish-deferred-review-queue.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/finish-deferred-review-queue.ts --apply
 */
import { adminClient } from '../src/lib/supabase'
import { newPgClient } from '../src/lib/wikipedia/importer'
import {
  approveQueueRow,
  mergeQueueRowIntoBook,
  getQueueSourceContext,
  type ApproveOverlay,
} from '../src/lib/imports/review-approve'

const APPLY = process.argv.includes('--apply')

type PlannedApprove = {
  queueId: number
  overlay: ApproveOverlay
  blanketWorks?: boolean
  banYearEnded?: number | null
  // When set, the book already exists: route through the merge path (enrich
  // nulls + add ban idempotently) instead of inserting a fresh `books` row.
  mergeTargetBookId?: number
}

const APPROVALS: PlannedApprove[] = [
  // #425 — book #7311 already exists with the identical CN/2023 ban (imported
  // via another path), so this row is redundant: merge-close it onto #7311.
  {
    queueId: 425,
    mergeTargetBookId: 7311,
    overlay: {
      title: 'The Chongzhen Emperor: Diligent Ruler of a Failed Dynasty',
      authors: ['Chen Wutong'],
      year: 2023,
      first_published_year: null,
      reason_slug: 'political',
      action_type: 'banned',
      scope_slug: 'government',
      ban_status: 'historical',
      description_ban:
        'Censored in China due to popular comparisons between the final Ming emperor, the Chongzhen Emperor, and Xi Jinping.',
      inclusion_rationale:
        'Listed among books censored in mainland China; pulled over readers drawing parallels between the Chongzhen Emperor and Xi Jinping.',
    },
  },
  // #1354 — HK reportage by 42 journalists. Title follows HK convention
  // (Latin transliteration as `title`, Hanzi as `title_native`).
  {
    queueId: 1354,
    overlay: {
      title: 'Fan xiu li feng bao cai fang zhan chang',
      title_native: '反修例風暴採訪戰場',
      title_transliterated: 'Fan xiu li feng bao cai fang zhan chang',
      original_language: 'zh',
      authors: ['42名新聞工作者 / 42 ming xin wen gong zuo zhe.'],
      year: 2023,
      first_published_year: null,
      reason_slug: 'political',
      action_type: 'banned',
      scope_slug: 'government',
      ban_status: 'active',
      inclusion_rationale:
        'Frontline reportage by 42 journalists of the 2019 anti-extradition-bill protests; among titles removed from Hong Kong public libraries.',
    },
  },
  // #200 — blanket-works: all of Nietzsche's works banned in the USSR from 1923.
  {
    queueId: 200,
    blanketWorks: true,
    overlay: {
      title: 'Works (Friedrich Nietzsche)',
      authors: ['Friedrich Nietzsche'],
      original_language: 'de',
      year: 1923,
      first_published_year: null,
      reason_slug: 'political',
      action_type: 'banned',
      scope_slug: 'government',
      ban_status: 'historical',
      description_ban:
        'All works placed on the Soviet Union’s list of forbidden books from 1923 (on Nadezhda Krupskaya’s proposal), kept only for restricted, authorized library use.',
      inclusion_rationale:
        'Author-level ban modelled as a blanket-works pseudo-entry: the USSR banned all of Nietzsche’s works from 1923.',
    },
  },
  // #213 — blanket-works: Lorca's works banned in Franco's Spain 1939-1954.
  {
    queueId: 213,
    blanketWorks: true,
    banYearEnded: 1954,
    overlay: {
      title: 'Works (Federico García Lorca)',
      authors: ['Federico García Lorca'],
      original_language: 'es',
      year: 1939,
      first_published_year: null,
      reason_slug: 'political',
      action_type: 'banned',
      scope_slug: 'government',
      ban_status: 'historical',
      description_ban:
        'All works banned in Franco’s Spain from 1939 until 1954; published in Argentina during the ban.',
      inclusion_rationale:
        'Author-level ban modelled as a blanket-works pseudo-entry: Franco’s Spain banned all of García Lorca’s works 1939-1954.',
    },
  },
]

// ---- Dwikhandita merge constants ----
const KEEP = 799
const DROP = 6331
const DROP_LEGACY_SLUG = 'dwikhandito'
const MERGE_QUEUE_ROW = 39 // its approved_book_id currently points at DROP

async function runApprovals() {
  const sb = adminClient()
  const pg = newPgClient()
  await pg.connect()
  try {
    for (const plan of APPROVALS) {
      const { data: row, error } = await sb
        .from('import_review_queue')
        .select('id, source_slug, source_url, status, agreement_details')
        .eq('id', plan.queueId)
        .maybeSingle()
      if (error) throw new Error(`fetch #${plan.queueId}: ${error.message}`)
      if (!row) {
        console.log(`  #${plan.queueId}: NOT FOUND — skip`)
        continue
      }
      if (row.status !== 'deferred') {
        console.log(`  #${plan.queueId}: status='${row.status}' (not deferred) — skip (idempotent)`)
        continue
      }

      const ctx = getQueueSourceContext(row.source_slug, row.agreement_details, row.source_url)
      console.log(
        `  #${plan.queueId} "${plan.overlay.title}" → ${ctx.country_code} ` +
          `${plan.overlay.action_type}/${plan.overlay.scope_slug}/${plan.overlay.ban_status} ` +
          `year=${plan.overlay.year}${plan.banYearEnded ? `-${plan.banYearEnded}` : ''} ` +
          `reason=${plan.overlay.reason_slug}${plan.blanketWorks ? ' [blanket-works]' : ''}` +
          `${plan.mergeTargetBookId ? ` [merge→#${plan.mergeTargetBookId}]` : ''}`,
      )

      if (!APPLY) continue

      if (plan.mergeTargetBookId != null) {
        const m = await mergeQueueRowIntoBook(
          plan.queueId,
          { ...plan.overlay, target_book_id: plan.mergeTargetBookId },
          ctx, pg, sb, 'manual:finish-deferred',
        )
        console.log(`     → merged into book #${m.book_id}; ban #${m.ban_id} (${m.ban_created ? 'created' : 'reused'}); enriched=[${m.enriched_fields.join(',')}] aliases=[${m.aliases_added.join(',')}]` +
          (m.queue_update_error ? ` ⚠ queue-update: ${m.queue_update_error}` : ''))
        continue
      }

      const result = await approveQueueRow(plan.queueId, plan.overlay, ctx, pg, sb, 'manual:finish-deferred')
      console.log(`     → book #${result.book_id}, bans ${JSON.stringify(result.ban_ids)}` +
        (result.queue_update_error ? ` ⚠ queue-update: ${result.queue_update_error}` : ''))

      if (plan.blanketWorks) {
        await pg.query('update books set is_blanket_works = true where id = $1', [result.book_id])
        console.log(`     → is_blanket_works = true on book #${result.book_id}`)
      }
      if (plan.banYearEnded != null && result.ban_ids.length > 0) {
        await pg.query('update bans set year_ended = $1 where id = $2', [plan.banYearEnded, result.ban_ids[0]])
        console.log(`     → ban #${result.ban_ids[0]} year_ended = ${plan.banYearEnded}`)
      }
    }
  } finally {
    await pg.end()
  }
}

type Ban = { id: number; country_code: string; scope_id: number | null; year_started: number | null }
function dedupKey(b: Ban): string {
  return `${b.country_code}|${b.scope_id ?? ''}`
}

async function runMerge() {
  const sb = adminClient()
  const pg = newPgClient()
  await pg.connect()
  try {
    const keepRow = await pg.query<{ id: number; slug: string; title: string; cover_url: string | null; censorship_context: string | null }>(
      'select id, slug, title, cover_url, censorship_context from books where id = $1', [KEEP])
    const dropRow = await pg.query<{ id: number; slug: string; title: string; cover_url: string | null; censorship_context: string | null }>(
      'select id, slug, title, cover_url, censorship_context from books where id = $1', [DROP])
    if (dropRow.rows.length === 0) {
      console.log(`  DROP #${DROP} already gone — merge is a no-op (idempotent).`)
      return
    }
    if (keepRow.rows.length === 0) throw new Error(`KEEP #${KEEP} not found`)
    const keep = keepRow.rows[0]
    const drop = dropRow.rows[0]
    console.log(`  KEEP #${keep.id} "${keep.title}" (${keep.slug})`)
    console.log(`  DROP #${drop.id} "${drop.title}" (${drop.slug})`)

    const dropBans = (await pg.query<Ban>(
      'select id, country_code, scope_id, year_started from bans where book_id = $1', [DROP])).rows
    const keepBans = (await pg.query<Ban>(
      'select id, country_code, scope_id, year_started from bans where book_id = $1', [KEEP])).rows
    const keepByKey = new Map(keepBans.map(b => [dedupKey(b), b]))

    if (APPLY) await pg.query('begin')

    for (const db of dropBans) {
      const match = keepByKey.get(dedupKey(db))
      const srcLinks = (await pg.query<{ source_id: number; locator: string | null }>(
        'select source_id, locator from ban_source_links where ban_id = $1', [db.id])).rows
      const rsnLinks = (await pg.query<{ reason_id: number }>(
        'select reason_id from ban_reason_links where ban_id = $1', [db.id])).rows
      if (match) {
        console.log(`  DUP  ${db.country_code}/scope=${db.scope_id} (ban ${db.id}) → union ${srcLinks.length} src + ${rsnLinks.length} rsn onto KEEP ban ${match.id}; row dropped via cascade`)
        if (APPLY) {
          for (const s of srcLinks) {
            await pg.query('insert into ban_source_links (ban_id, source_id, locator) values ($1,$2,$3) on conflict do nothing', [match.id, s.source_id, s.locator])
          }
          for (const r of rsnLinks) {
            await pg.query('insert into ban_reason_links (ban_id, reason_id) values ($1,$2) on conflict do nothing', [match.id, r.reason_id])
          }
        }
      } else {
        console.log(`  MOVE ${db.country_code}/scope=${db.scope_id} (ban ${db.id}) → re-point book_id ${DROP}→${KEEP}`)
        if (APPLY) await pg.query('update bans set book_id = $1 where id = $2', [KEEP, db.id])
        keepByKey.set(dedupKey(db), { ...db, id: db.id })
      }
    }

    // Re-point any DROP aliases, then add DROP's own slug as a legacy alias.
    const dropAliases = (await pg.query<{ slug: string }>('select slug from book_slug_aliases where book_id = $1', [DROP])).rows
    for (const a of dropAliases) {
      console.log(`  ALIAS re-point "${a.slug}" → KEEP #${KEEP}`)
      if (APPLY) await pg.query('update book_slug_aliases set book_id = $1 where slug = $2', [KEEP, a.slug])
    }
    if (drop.slug && drop.slug !== keep.slug) {
      console.log(`  ALIAS add legacy "${DROP_LEGACY_SLUG}" → KEEP #${KEEP}`)
      if (APPLY) await pg.query(`insert into book_slug_aliases (slug, book_id, source) values ($1,$2,'legacy_slug') on conflict do nothing`, [DROP_LEGACY_SLUG, KEEP])
    }

    // Enrich KEEP's null scalars from DROP (data beats null).
    for (const col of ['cover_url', 'censorship_context'] as const) {
      if (keep[col] == null && drop[col] != null) {
        console.log(`  ENRICH KEEP.${col} ← DROP (KEEP was null)`)
        if (APPLY) await pg.query(`update books set ${col} = $1 where id = $2`, [drop[col], KEEP])
      }
    }

    console.log(`  DELETE book #${DROP} (CASCADE)`)
    if (APPLY) await pg.query('delete from books where id = $1', [DROP])

    if (APPLY) await pg.query('commit')

    // Re-point the queue audit row (#39) that pointed at the now-deleted DROP.
    console.log(`  QUEUE re-point row #${MERGE_QUEUE_ROW}.approved_book_id ${DROP}→${KEEP}`)
    if (APPLY) {
      const { error } = await sb.from('import_review_queue')
        .update({ approved_book_id: KEEP, review_notes: `merged duplicate book #${DROP} into #${KEEP} (finish-deferred-review-queue 2026-06-06)` })
        .eq('id', MERGE_QUEUE_ROW)
      if (error) console.log(`     ⚠ queue re-point failed: ${error.message}`)
    }

    if (APPLY) {
      const after = (await pg.query<Ban>('select id, country_code, scope_id, year_started from bans where book_id = $1', [KEEP])).rows
      const gone = (await pg.query('select id from books where id = $1', [DROP])).rows.length === 0
      console.log(`  verify: KEEP bans now ${after.length} (${after.map(b => b.country_code).join(',')}); DROP deleted: ${gone}`)
    }
  } catch (err) {
    if (APPLY) { try { await pg.query('rollback') } catch { /* ignore */ } }
    throw err
  } finally {
    await pg.end()
  }
}

async function main() {
  console.log(`\n── finish-deferred-review-queue ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)
  console.log('APPROVALS:')
  await runApprovals()
  console.log('\nMERGE (Dwikhandita):')
  await runMerge()
  console.log(APPLY ? '\nDone.' : '\nDry-run complete. Re-run with --apply to execute.')
}

main().then(() => process.exit(0)).catch(err => { console.error('FAILED:', err); process.exit(1) })
