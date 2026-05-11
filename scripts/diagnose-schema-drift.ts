/**
 * Schema-drift diagnostic.
 *
 * Compares the production Postgres schema (queried via DIRECT_URL or
 * DATABASE_URL) against what is declared in `supabase/migrations/*.sql`.
 * Reports both forward drift (in production, not in migrations) and reverse
 * drift (declared in migrations, not in production). Also inspects
 * non-table objects: views, materialised views, enums, and user functions
 * in the `public` schema.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/diagnose-schema-drift.ts
 *   pnpm tsx --env-file=.env.local scripts/diagnose-schema-drift.ts --write
 *
 * Default is dry-run: print the diff and the generated SQL to stdout.
 * Pass `--write` to also write `supabase/migrations/020_repair_schema.sql`.
 *
 * Connection: prefers DIRECT_URL (Supabase direct session-mode, port 5432)
 * because pg_catalog and information_schema introspection require a real
 * session, not the pooled (pgbouncer transaction-mode) connection used by
 * DATABASE_URL on port 6543. Falls back to DATABASE_URL with a warning.
 *
 * Sprint A: this script runs once to repair existing drift. Going forward,
 * a CI guard should re-run it in --check mode and fail the build if any new
 * drift is detected.
 */
import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import {
  type DeclaredArtefacts,
  createEmptyArtefacts,
  parseSql,
} from '../src/lib/migration-parser'

const WRITE = process.argv.includes('--write')
const MIGRATIONS_DIR = 'supabase/migrations'
const REPAIR_FILE = '020_repair_schema.sql'

interface ProdColumn {
  table_name: string
  column_name: string
  data_type: string
  not_null: boolean
  default_expr: string | null
}

interface NamedObject {
  name: string
  kind: string // 'view' | 'matview' | 'enum' | 'function'
  detail?: string
}

interface ProdIndex {
  index_name: string
  table_name: string
  index_type: string  // btree | gin | gist | hash | brin
  is_unique: boolean
  columns: string | null  // null for expression indexes
}

interface ProdPolicy {
  table_name: string
  policy_name: string
  cmd: string           // ALL | SELECT | INSERT | UPDATE | DELETE
  qual: string | null   // USING clause
  with_check: string | null
}

interface ProdTrigger {
  table_name: string
  trigger_name: string
  timing: string        // BEFORE | AFTER | INSTEAD OF
  events: string        // INSERT, UPDATE, DELETE (comma-joined)
  function_name: string
}

// Tables we care about for the repair migration. Everything else
// (third-party tables, internal supabase tables) is out of scope.
const TRACKED_TABLES = new Set([
  'authors',
  'ban_reason_links',
  'ban_source_links',
  'ban_sources',
  'bans',
  'book_authors',
  'books',
  'countries',
  'reasons',
  'scopes',
])

function getConnectionString(): { url: string; via: 'direct' | 'pooled' } {
  const direct = process.env.DIRECT_URL
  if (direct && direct.length > 0) return { url: direct, via: 'direct' }
  const pooled = process.env.DATABASE_URL
  if (pooled && pooled.length > 0) {
    console.warn(
      '⚠ Using DATABASE_URL (pooled). pg_catalog introspection may fail on pgbouncer transaction-mode pools.\n' +
        '  Set DIRECT_URL=postgresql://... (port 5432, direct connection) in .env.local for reliable introspection.\n',
    )
    return { url: pooled, via: 'pooled' }
  }
  console.error(
    'Neither DIRECT_URL nor DATABASE_URL is set in .env.local.\n' +
      'Get them from Supabase Studio → Settings → Database → Connection string (URI).\n' +
      'Use the direct/session-mode form (port 5432) as DIRECT_URL.',
  )
  process.exit(1)
}

async function queryProduction(): Promise<{
  columns: ProdColumn[]
  views: NamedObject[]
  matviews: NamedObject[]
  enums: NamedObject[]
  functions: NamedObject[]
  indexes: ProdIndex[]
  policies: ProdPolicy[]
  triggers: ProdTrigger[]
}> {
  const { url, via } = getConnectionString()
  console.log(`▶ Connecting via ${via} connection...`)
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    const columns = await client.query<ProdColumn>(`
      SELECT
        t.relname                                              AS table_name,
        a.attname                                              AS column_name,
        pg_catalog.format_type(a.atttypid, a.atttypmod)        AS data_type,
        a.attnotnull                                           AS not_null,
        pg_get_expr(d.adbin, d.adrelid)                        AS default_expr
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class t       ON a.attrelid = t.oid
      JOIN pg_catalog.pg_namespace n   ON t.relnamespace = n.oid
      LEFT JOIN pg_catalog.pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
      WHERE n.nspname = 'public'
        AND t.relkind = 'r'
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY t.relname, a.attnum
    `)

    const views = await client.query<{ name: string }>(`
      SELECT c.relname AS name
      FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND c.relkind = 'v'
      ORDER BY c.relname
    `)

    const matviews = await client.query<{ name: string }>(`
      SELECT c.relname AS name
      FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND c.relkind = 'm'
      ORDER BY c.relname
    `)

    const enums = await client.query<{ name: string; values: string }>(`
      SELECT t.typname AS name,
             string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS values
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE n.nspname = 'public'
      GROUP BY t.typname
      ORDER BY t.typname
    `)

    const functions = await client.query<{ name: string; sig: string }>(`
      SELECT p.proname AS name,
             pg_get_function_identity_arguments(p.oid) AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
      ORDER BY p.proname
    `)

    // Indexes — user-defined only. Excludes:
    //   • extension-owned indexes (pg_depend.deptype = 'e'), so trigram-related
    //     extension installs and similar bookkeeping don't show as drift
    //   • indexes auto-created to back PRIMARY KEY / UNIQUE constraints
    //     (pg_depend.refclassid = pg_constraint), since those are declared via
    //     the constraint in CREATE TABLE, not via CREATE INDEX
    const indexes = await client.query<ProdIndex>(`
      SELECT
        c.relname                                AS index_name,
        t.relname                                AS table_name,
        am.amname                                AS index_type,
        ix.indisunique                           AS is_unique,
        (SELECT string_agg(a.attname, ', ' ORDER BY array_position(ix.indkey::int[], a.attnum))
           FROM pg_attribute a
           WHERE a.attrelid = t.oid
             AND a.attnum = ANY(ix.indkey::int[])
             AND a.attnum > 0)                   AS columns
      FROM pg_class c
      JOIN pg_index ix       ON c.oid = ix.indexrelid
      JOIN pg_class t        ON ix.indrelid = t.oid
      JOIN pg_namespace n    ON t.relnamespace = n.oid
      JOIN pg_am am          ON c.relam = am.oid
      WHERE n.nspname = 'public'
        AND c.relkind = 'i'
        AND NOT EXISTS (
          SELECT 1 FROM pg_depend d
          WHERE d.classid = 'pg_class'::regclass
            AND d.objid = c.oid
            AND d.deptype = 'e'
        )
        AND NOT EXISTS (
          SELECT 1 FROM pg_depend d
          WHERE d.classid = 'pg_class'::regclass
            AND d.objid = c.oid
            AND d.refclassid = 'pg_constraint'::regclass
        )
      ORDER BY t.relname, c.relname
    `)

    // RLS policies — pg_policies is the standard view.
    const policies = await client.query<ProdPolicy>(`
      SELECT
        tablename     AS table_name,
        policyname    AS policy_name,
        cmd           AS cmd,
        qual          AS qual,
        with_check    AS with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `)

    // Triggers — exclude internal triggers (FK enforcement, constraint triggers
    // managed by the system, etc.) via tgisinternal=false.
    const triggers = await client.query<ProdTrigger>(`
      SELECT
        c.relname                                                    AS table_name,
        tg.tgname                                                    AS trigger_name,
        CASE
          WHEN (tg.tgtype & 64) <> 0  THEN 'INSTEAD OF'
          WHEN (tg.tgtype & 2)  <> 0  THEN 'BEFORE'
          ELSE                              'AFTER'
        END                                                          AS timing,
        concat_ws(', ',
          CASE WHEN (tg.tgtype & 4)  <> 0 THEN 'INSERT' END,
          CASE WHEN (tg.tgtype & 8)  <> 0 THEN 'DELETE' END,
          CASE WHEN (tg.tgtype & 16) <> 0 THEN 'UPDATE' END,
          CASE WHEN (tg.tgtype & 32) <> 0 THEN 'TRUNCATE' END
        )                                                            AS events,
        p.proname                                                    AS function_name
      FROM pg_trigger tg
      JOIN pg_class c     ON tg.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      JOIN pg_proc p      ON tg.tgfoid = p.oid
      WHERE n.nspname = 'public'
        AND NOT tg.tgisinternal
      ORDER BY c.relname, tg.tgname
    `)

    return {
      columns: columns.rows,
      views: views.rows.map(r => ({ name: r.name, kind: 'view' })),
      matviews: matviews.rows.map(r => ({ name: r.name, kind: 'matview' })),
      enums: enums.rows.map(r => ({ name: r.name, kind: 'enum', detail: r.values })),
      functions: functions.rows.map(r => ({ name: r.name, kind: 'function', detail: r.sig })),
      indexes: indexes.rows,
      policies: policies.rows,
      triggers: triggers.rows,
    }
  } finally {
    await client.end()
  }
}

function parseDeclared(): DeclaredArtefacts {
  const out = createEmptyArtefacts()
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    parseSql(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8'), out)
  }
  return out
}

function buildRepairSQL(missing: ProdColumn[]): string {
  const header = `-- Generated by scripts/diagnose-schema-drift.ts on ${new Date().toISOString()}.
-- Brings supabase/migrations/ in line with the production schema for columns
-- that were added directly in Supabase Studio without a migration. Idempotent.
--
-- After running this against a fresh DB, the schema state matches production
-- for all TRACKED_TABLES columns. Any further drift should be added via the
-- normal migration flow, not directly in Studio.

`
  const grouped = new Map<string, ProdColumn[]>()
  for (const col of missing) {
    if (!grouped.has(col.table_name)) grouped.set(col.table_name, [])
    grouped.get(col.table_name)!.push(col)
  }

  const blocks: string[] = []
  for (const [table, cols] of [...grouped.entries()].sort()) {
    const lines = [`-- ── ${table} ─────────────────────────────────────────────`]
    for (const c of cols) {
      const nullClause = c.not_null ? ' NOT NULL' : ''
      const defaultClause = c.default_expr ? ` DEFAULT ${c.default_expr}` : ''
      lines.push(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${c.column_name} ${c.data_type}${nullClause}${defaultClause};`,
      )
    }
    blocks.push(lines.join('\n'))
  }

  return header + blocks.join('\n\n') + '\n'
}

function logSection(title: string) {
  console.log('\n' + '═'.repeat(70))
  console.log(title)
  console.log('═'.repeat(70))
}

function oneline(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

async function main() {
  const prod = await queryProduction()
  console.log(
    `  Production: ${new Set(prod.columns.map(c => c.table_name)).size} tables, ` +
      `${prod.views.length} views, ${prod.matviews.length} matviews, ` +
      `${prod.enums.length} enums, ${prod.functions.length} functions,\n` +
      `              ${prod.indexes.length} indexes, ` +
      `${prod.policies.length} policies, ${prod.triggers.length} triggers.`,
  )

  console.log('▶ Parsing supabase/migrations/*.sql ...')
  const declared = parseDeclared()
  console.log(
    `  Declared: ${declared.tables.size} tables (${declared.columns.size} columns), ` +
      `${declared.views.size} views, ${declared.matviews.size} matviews, ` +
      `${declared.enums.size} enums, ${declared.functions.size} functions,\n` +
      `             ${declared.indexes.size} indexes, ` +
      `${declared.policies.size} policies, ${declared.triggers.size} triggers.`,
  )

  // ── Forward drift on tracked tables: in production, not in migrations ──
  const trackedProdCols = prod.columns.filter(c => TRACKED_TABLES.has(c.table_name))
  const forwardMissing: ProdColumn[] = []
  for (const col of trackedProdCols) {
    if (!declared.columns.has(`${col.table_name}.${col.column_name}`)) forwardMissing.push(col)
  }

  logSection(`FORWARD DRIFT — columns in production but not in migrations (tracked tables)`)
  if (forwardMissing.length === 0) {
    console.log('  (none)')
  } else {
    const byTable = new Map<string, ProdColumn[]>()
    for (const c of forwardMissing) {
      if (!byTable.has(c.table_name)) byTable.set(c.table_name, [])
      byTable.get(c.table_name)!.push(c)
    }
    for (const [table, cols] of [...byTable.entries()].sort()) {
      console.log(`\n  ${table}  (${cols.length})`)
      for (const c of cols) {
        const ann = [c.not_null ? 'NOT NULL' : 'NULL', c.default_expr ? `DEFAULT ${c.default_expr}` : '']
          .filter(Boolean)
          .join(' ')
        console.log(`    - ${c.column_name.padEnd(30)} ${c.data_type.padEnd(30)} ${ann}`)
      }
    }
  }

  // ── Reverse drift: declared in migrations but not in production ──
  const prodColKeys = new Set(prod.columns.map(c => `${c.table_name}.${c.column_name}`))
  const reverseMissing: string[] = []
  for (const key of declared.columns) {
    const [tname] = key.split('.')
    // Only check reverse drift on tables that DO exist in production (otherwise the
    // whole table is the issue, not just columns).
    if (prod.columns.some(c => c.table_name === tname) && !prodColKeys.has(key)) {
      reverseMissing.push(key)
    }
  }

  logSection(`REVERSE DRIFT — columns declared in migrations but missing in production`)
  if (reverseMissing.length === 0) {
    console.log('  (none — every declared column exists in production)')
  } else {
    for (const k of reverseMissing.sort()) console.log(`  - ${k}`)
  }

  // ── Tables: in production but not declared, or vice versa ──
  const prodTables = new Set(prod.columns.map(c => c.table_name))
  const tablesInProdNotDeclared = [...prodTables].filter(t => !declared.tables.has(t)).sort()
  const tablesDeclaredNotInProd = [...declared.tables].filter(t => !prodTables.has(t)).sort()

  logSection(`TABLES — set differences`)
  console.log(`\n  In production, not declared (${tablesInProdNotDeclared.length}):`)
  for (const t of tablesInProdNotDeclared) console.log(`    - ${t}`)
  console.log(`\n  Declared, not in production (${tablesDeclaredNotInProd.length}):`)
  for (const t of tablesDeclaredNotInProd) console.log(`    - ${t}`)

  // ── Non-table objects ──
  logSection(`NON-TABLE OBJECTS in production`)
  console.log(`\n  Views (${prod.views.length}):`)
  for (const v of prod.views) {
    const inDecl = declared.views.has(v.name.toLowerCase()) ? '✓ declared' : '✗ NOT in migrations'
    console.log(`    - ${v.name.padEnd(40)} ${inDecl}`)
  }
  console.log(`\n  Materialised views (${prod.matviews.length}):`)
  for (const v of prod.matviews) {
    const inDecl = declared.matviews.has(v.name.toLowerCase()) ? '✓ declared' : '✗ NOT in migrations'
    console.log(`    - ${v.name.padEnd(40)} ${inDecl}`)
  }
  console.log(`\n  Enums (${prod.enums.length}):`)
  for (const e of prod.enums) {
    const inDecl = declared.enums.has(e.name.toLowerCase()) ? '✓ declared' : '✗ NOT in migrations'
    console.log(`    - ${e.name.padEnd(40)} ${inDecl}    (values: ${e.detail})`)
  }
  console.log(`\n  Functions in public schema (${prod.functions.length}):`)
  const userFuncs = prod.functions.filter(
    f => !f.name.startsWith('_') && !['gen_random_uuid', 'uuid_generate_v4'].includes(f.name),
  )
  for (const f of userFuncs) {
    const inDecl = declared.functions.has(f.name.toLowerCase()) ? '✓ declared' : '✗ NOT in migrations'
    console.log(`    - ${f.name}(${f.detail})  ${inDecl}`)
  }

  // ── Indexes: forward + reverse drift ──
  logSection(`INDEXES — set differences (user-defined only; extension- and constraint-backed indexes excluded)`)
  const prodIndexNames = new Set(prod.indexes.map(i => i.index_name.toLowerCase()))
  const idxInProdNotDeclared = prod.indexes
    .filter(i => !declared.indexes.has(i.index_name.toLowerCase()))
    .sort((a, b) => (a.table_name + a.index_name).localeCompare(b.table_name + b.index_name))
  const idxDeclaredNotInProd = [...declared.indexes].filter(i => !prodIndexNames.has(i)).sort()

  console.log(`\n  In production, not declared (${idxInProdNotDeclared.length}):`)
  for (const i of idxInProdNotDeclared) {
    const unique = i.is_unique ? ' UNIQUE' : ''
    const cols = i.columns ? `(${i.columns})` : '(<expression>)'
    console.log(`    - ${i.index_name.padEnd(40)} on ${i.table_name.padEnd(22)} ${i.index_type}${unique} ${cols}`)
  }
  console.log(`\n  Declared, not in production (${idxDeclaredNotInProd.length}):`)
  for (const name of idxDeclaredNotInProd) console.log(`    - ${name}`)

  // ── RLS policies: forward + reverse drift ──
  logSection(`RLS POLICIES — set differences`)
  const prodPolicyKeys = new Set(
    prod.policies.map(p => `${p.table_name.toLowerCase()}.${p.policy_name.toLowerCase()}`),
  )
  const polInProdNotDeclared = prod.policies
    .filter(p => !declared.policies.has(`${p.table_name.toLowerCase()}.${p.policy_name.toLowerCase()}`))
    .sort((a, b) => (a.table_name + a.policy_name).localeCompare(b.table_name + b.policy_name))
  const polDeclaredNotInProd = [...declared.policies].filter(k => !prodPolicyKeys.has(k)).sort()

  console.log(`\n  In production, not declared (${polInProdNotDeclared.length}):`)
  for (const p of polInProdNotDeclared) {
    const where = p.qual ? `  USING (${oneline(p.qual)})` : ''
    const check = p.with_check ? `  WITH CHECK (${oneline(p.with_check)})` : ''
    console.log(`    - ${p.table_name}.${p.policy_name.padEnd(36)} cmd=${p.cmd}${where}${check}`)
  }
  console.log(`\n  Declared, not in production (${polDeclaredNotInProd.length}):`)
  for (const k of polDeclaredNotInProd) console.log(`    - ${k}`)

  // ── Triggers: forward + reverse drift ──
  logSection(`TRIGGERS — set differences (internal triggers excluded)`)
  const prodTriggerKeys = new Set(
    prod.triggers.map(t => `${t.table_name.toLowerCase()}.${t.trigger_name.toLowerCase()}`),
  )
  const trgInProdNotDeclared = prod.triggers
    .filter(t => !declared.triggers.has(`${t.table_name.toLowerCase()}.${t.trigger_name.toLowerCase()}`))
    .sort((a, b) => (a.table_name + a.trigger_name).localeCompare(b.table_name + b.trigger_name))
  const trgDeclaredNotInProd = [...declared.triggers].filter(k => !prodTriggerKeys.has(k)).sort()

  console.log(`\n  In production, not declared (${trgInProdNotDeclared.length}):`)
  for (const t of trgInProdNotDeclared) {
    console.log(`    - ${t.table_name}.${t.trigger_name.padEnd(36)} ${t.timing} ${t.events}  →  ${t.function_name}()`)
  }
  console.log(`\n  Declared, not in production (${trgDeclaredNotInProd.length}):`)
  for (const k of trgDeclaredNotInProd) console.log(`    - ${k}`)

  // ── Generated SQL ──
  if (forwardMissing.length > 0) {
    logSection(`GENERATED 020_repair_schema.sql (tracked tables only)`)
    const repairSQL = buildRepairSQL(forwardMissing)
    console.log(repairSQL)
    if (WRITE) {
      const out = path.join(MIGRATIONS_DIR, REPAIR_FILE)
      fs.writeFileSync(out, repairSQL)
      console.log(`✓ Wrote ${out}`)
    } else {
      console.log(`(dry-run; pass --write to save to ${path.join(MIGRATIONS_DIR, REPAIR_FILE)})`)
    }
  }
}

main().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})
