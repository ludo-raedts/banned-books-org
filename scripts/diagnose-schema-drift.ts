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

    return {
      columns: columns.rows,
      views: views.rows.map(r => ({ name: r.name, kind: 'view' })),
      matviews: matviews.rows.map(r => ({ name: r.name, kind: 'matview' })),
      enums: enums.rows.map(r => ({ name: r.name, kind: 'enum', detail: r.values })),
      functions: functions.rows.map(r => ({ name: r.name, kind: 'function', detail: r.sig })),
    }
  } finally {
    await client.end()
  }
}

interface DeclaredArtefacts {
  columns: Set<string>          // "table.column"
  tables: Set<string>           // just table names
  views: Set<string>
  matviews: Set<string>
  enums: Set<string>
  functions: Set<string>
}

function parseDeclared(): DeclaredArtefacts {
  const out: DeclaredArtefacts = {
    columns: new Set(),
    tables: new Set(),
    views: new Set(),
    matviews: new Set(),
    enums: new Set(),
    functions: new Set(),
  }
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')

    // CREATE TABLE <name> ( ... );
    const createTableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)\s*\(([\s\S]*?)\)\s*;/gi
    let m: RegExpExecArray | null
    while ((m = createTableRegex.exec(sql)) !== null) {
      const table = m[1].toLowerCase()
      out.tables.add(table)
      const body = m[2]
      for (const line of body.split(/,(?![^()]*\))/)) {
        const trimmed = line.trim()
        if (!trimmed) continue
        if (/^(constraint|primary\s+key|foreign\s+key|unique|check)\b/i.test(trimmed)) continue
        const colMatch = /^["']?([a-zA-Z_]\w*)["']?\s+/.exec(trimmed)
        if (colMatch) out.columns.add(`${table}.${colMatch[1].toLowerCase()}`)
      }
    }

    // ALTER TABLE <name> ADD COLUMN [IF NOT EXISTS] <colname> ...;
    const alterRegex = /alter\s+table\s+(?:if\s+exists\s+)?(\w+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?["']?([a-zA-Z_]\w*)["']?/gi
    while ((m = alterRegex.exec(sql)) !== null) {
      out.columns.add(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`)
    }

    // CREATE [OR REPLACE] VIEW <name>
    const viewRegex = /create\s+(?:or\s+replace\s+)?view\s+(?:if\s+not\s+exists\s+)?(\w+)/gi
    while ((m = viewRegex.exec(sql)) !== null) out.views.add(m[1].toLowerCase())

    // CREATE MATERIALIZED VIEW <name>
    const matviewRegex = /create\s+materialized\s+view\s+(?:if\s+not\s+exists\s+)?(\w+)/gi
    while ((m = matviewRegex.exec(sql)) !== null) out.matviews.add(m[1].toLowerCase())

    // CREATE TYPE <name> AS ENUM (...)
    const enumRegex = /create\s+type\s+(\w+)\s+as\s+enum/gi
    while ((m = enumRegex.exec(sql)) !== null) out.enums.add(m[1].toLowerCase())

    // CREATE [OR REPLACE] FUNCTION <name>(
    const funcRegex = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)\s*\(/gi
    while ((m = funcRegex.exec(sql)) !== null) out.functions.add(m[1].toLowerCase())
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

async function main() {
  const prod = await queryProduction()
  console.log(
    `  Production: ${new Set(prod.columns.map(c => c.table_name)).size} tables, ` +
      `${prod.views.length} views, ${prod.matviews.length} matviews, ` +
      `${prod.enums.length} enums, ${prod.functions.length} functions.`,
  )

  console.log('▶ Parsing supabase/migrations/*.sql ...')
  const declared = parseDeclared()
  console.log(
    `  Declared: ${declared.tables.size} tables (${declared.columns.size} columns), ` +
      `${declared.views.size} views, ${declared.matviews.size} matviews, ` +
      `${declared.enums.size} enums, ${declared.functions.size} functions.`,
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
