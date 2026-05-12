/**
 * Migration-SQL parser used by scripts/diagnose-schema-drift.ts.
 *
 * Parses both styles of SQL emitted into supabase/migrations:
 *   • human-written:   CREATE TABLE authors ( id uuid, ... );
 *   • pg_dump output:  CREATE TABLE IF NOT EXISTS "public"."authors" ( "id" bigint, ... );
 *
 * Identifiers are normalised to lowercase, unquoted, and stripped of a
 * leading "public." schema prefix so that both styles collapse to the
 * same canonical name for set-comparison.
 *
 * Tracked dimensions: tables, columns ("table.col"), views, matviews,
 * enums, functions, indexes, policies ("table.policy"),
 * triggers ("table.trigger").
 */

export interface DeclaredArtefacts {
  columns: Set<string>          // "table.column"
  tables: Set<string>
  views: Set<string>
  matviews: Set<string>
  enums: Set<string>
  functions: Set<string>
  indexes: Set<string>
  policies: Set<string>         // "table.policyname"
  triggers: Set<string>         // "table.triggername"
}

export function createEmptyArtefacts(): DeclaredArtefacts {
  return {
    columns: new Set(),
    tables: new Set(),
    views: new Set(),
    matviews: new Set(),
    enums: new Set(),
    functions: new Set(),
    indexes: new Set(),
    policies: new Set(),
    triggers: new Set(),
  }
}

// ── Identifier pattern ──────────────────────────────────────────────────────
//
// Matches any of:
//   foo                  (bare unquoted)
//   "foo"                (quoted)
//   public.foo           (schema-qualified bare)
//   "public".foo         (mixed)
//   public."foo"         (mixed)
//   "public"."foo"       (pg_dump default)
//
// Two capture groups: $1 = quoted name, $2 = bare name. Exactly one fires.
// The schema prefix (when present and equal to public) is consumed and
// discarded. Non-public schemas are out of scope for this comparator.
const ID = `(?:(?:"public"|public)\\.)?(?:"([^"]+)"|(\\w+))`

function pickName(g1: string | undefined, g2: string | undefined): string {
  return (g1 ?? g2 ?? '').toLowerCase()
}

// Split a string on commas that are NOT inside a string literal or a balanced
// (), [] group. Postgres-style '' inside a single-quoted string is treated
// as an escaped single quote and does not close the string.
function splitTopLevelCommas(body: string): string[] {
  const parts: string[] = []
  let current = ''
  let paren = 0
  let bracket = 0
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (inSingle) {
      current += c
      if (c === "'") {
        if (body[i + 1] === "'") {
          current += body[++i]
        } else {
          inSingle = false
        }
      }
      continue
    }
    if (inDouble) {
      current += c
      if (c === '"') inDouble = false
      continue
    }
    if (c === "'") { inSingle = true; current += c; continue }
    if (c === '"') { inDouble = true; current += c; continue }
    if (c === '(') { paren++; current += c; continue }
    if (c === ')') { paren--; current += c; continue }
    if (c === '[') { bracket++; current += c; continue }
    if (c === ']') { bracket--; current += c; continue }
    if (c === ',' && paren === 0 && bracket === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += c
  }
  if (current.trim()) parts.push(current)
  return parts
}

/**
 * Parse one SQL string and accumulate discovered artefacts into `out`.
 * Pass the same `out` to multiple calls to merge across files.
 */
export function parseSql(sql: string, out: DeclaredArtefacts): void {
  let m: RegExpExecArray | null

  // CREATE TABLE [IF NOT EXISTS] <id> ( body );
  // Body is captured into group 3 so we can pick columns out of it.
  const createTableRegex = new RegExp(
    `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${ID}\\s*\\(([\\s\\S]*?)\\)\\s*;`,
    'gi',
  )
  while ((m = createTableRegex.exec(sql)) !== null) {
    const table = pickName(m[1], m[2])
    if (!table) continue
    out.tables.add(table)
    const body = m[3]
    // Split on commas that are NOT inside parens (skip CHECK ((..., ...)) etc.).
    for (const line of body.split(/,(?![^()]*\))/)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      // Skip table-level constraints
      if (/^(constraint|primary\s+key|foreign\s+key|unique|check)\b/i.test(trimmed)) continue
      const colMatch = /^(?:"([^"]+)"|([a-zA-Z_]\w*))\s+/.exec(trimmed)
      if (colMatch) {
        const col = pickName(colMatch[1], colMatch[2])
        if (col) out.columns.add(`${table}.${col}`)
      }
    }
  }

  // ALTER TABLE [IF EXISTS|ONLY] <id> <body>;
  // Body may contain one or more comma-separated clauses (ADD/DROP/ALTER
  // COLUMN, etc.). We pick out each ADD COLUMN clause. splitTopLevelCommas
  // respects string literals and balanced parens/brackets so commas inside
  // DEFAULT expressions like ARRAY['a', 'b'] do not split clauses.
  const alterTableRegex = new RegExp(
    `alter\\s+table\\s+(?:if\\s+exists\\s+|only\\s+)?${ID}\\s+([\\s\\S]*?);`,
    'gi',
  )
  const addColumnClauseRegex = /^\s*add\s+column\s+(?:if\s+not\s+exists\s+)?(?:"([^"]+)"|(\w+))/i
  while ((m = alterTableRegex.exec(sql)) !== null) {
    const table = pickName(m[1], m[2])
    if (!table) continue
    for (const clause of splitTopLevelCommas(m[3])) {
      const colMatch = addColumnClauseRegex.exec(clause)
      if (colMatch) {
        const col = pickName(colMatch[1], colMatch[2])
        if (col) out.columns.add(`${table}.${col}`)
      }
    }
  }

  // CREATE [OR REPLACE] VIEW [IF NOT EXISTS] <id>
  const viewRegex = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?view\\s+(?:if\\s+not\\s+exists\\s+)?${ID}`,
    'gi',
  )
  while ((m = viewRegex.exec(sql)) !== null) {
    const name = pickName(m[1], m[2])
    if (name) out.views.add(name)
  }

  // CREATE MATERIALIZED VIEW [IF NOT EXISTS] <id>
  const matviewRegex = new RegExp(
    `create\\s+materialized\\s+view\\s+(?:if\\s+not\\s+exists\\s+)?${ID}`,
    'gi',
  )
  while ((m = matviewRegex.exec(sql)) !== null) {
    const name = pickName(m[1], m[2])
    if (name) out.matviews.add(name)
  }

  // CREATE TYPE <id> AS ENUM
  const enumRegex = new RegExp(`create\\s+type\\s+${ID}\\s+as\\s+enum`, 'gi')
  while ((m = enumRegex.exec(sql)) !== null) {
    const name = pickName(m[1], m[2])
    if (name) out.enums.add(name)
  }

  // CREATE [OR REPLACE] FUNCTION <id>(
  const funcRegex = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?function\\s+${ID}\\s*\\(`,
    'gi',
  )
  while ((m = funcRegex.exec(sql)) !== null) {
    const name = pickName(m[1], m[2])
    if (name) out.functions.add(name)
  }

  // CREATE [UNIQUE] INDEX [CONCURRENTLY] [IF NOT EXISTS] <id> ON ...
  // Index names are not schema-qualified in their CREATE statement.
  const indexRegex = new RegExp(
    `create\\s+(?:unique\\s+)?index\\s+(?:concurrently\\s+)?(?:if\\s+not\\s+exists\\s+)?(?:"([^"]+)"|(\\w+))\\s+on\\b`,
    'gi',
  )
  while ((m = indexRegex.exec(sql)) !== null) {
    const name = pickName(m[1], m[2])
    if (name) out.indexes.add(name)
  }

  // CREATE POLICY <name> ON <table>
  // Policy names are often quoted (may contain spaces).
  const policyRegex = new RegExp(
    `create\\s+policy\\s+(?:"([^"]+)"|(\\w+))\\s+on\\s+${ID}`,
    'gi',
  )
  while ((m = policyRegex.exec(sql)) !== null) {
    const policy = pickName(m[1], m[2])
    const table = pickName(m[3], m[4])
    if (policy && table) out.policies.add(`${table}.${policy}`)
  }

  // CREATE [OR REPLACE] [CONSTRAINT] TRIGGER <name>
  //   {BEFORE|AFTER|INSTEAD OF} ... ON <table>
  const triggerRegex = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?(?:constraint\\s+)?trigger\\s+(?:"([^"]+)"|(\\w+))\\s+(?:before|after|instead\\s+of)\\b[\\s\\S]*?\\son\\s+${ID}`,
    'gi',
  )
  while ((m = triggerRegex.exec(sql)) !== null) {
    const trigger = pickName(m[1], m[2])
    const table = pickName(m[3], m[4])
    if (trigger && table) out.triggers.add(`${table}.${trigger}`)
  }
}
