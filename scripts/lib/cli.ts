// cli.ts — shared CLI-flag helpers for scripts/.
//
// Canonical write-flag is --apply (catalog convention, see scripts/README.md
// "Flag-conventie"). A handful of older scripts shipped with --write; isApply()
// accepts both so migrated scripts keep their documented invocation working,
// while every new script just imports isApply() and gets the convention for free.

/** True when the canonical --apply flag (or the legacy --write alias) is passed. */
export function isApply(): boolean {
  const apply = process.argv.includes('--apply')
  const legacyWrite = process.argv.includes('--write')
  if (legacyWrite && !apply) {
    console.warn('⚠ --write is een legacy-alias; de catalogus-conventie is --apply.')
  }
  return apply || legacyWrite
}

/** True when the boolean flag `--<name>` is present. */
export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

/** Value of `--<name>=<value>`, or undefined when absent. */
export function flagValue(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.slice(name.length + 3) : undefined
}

/** Integer value of `--<name>=<n>`, falling back to `def` when absent/invalid. */
export function intFlag(name: string, def: number): number {
  const raw = flagValue(name)
  if (raw == null) return def
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : def
}

/**
 * Optional id scope: `--ids-file=<path>` (JSON array, or ids separated by
 * commas/whitespace) or `--ids=1,2,3`. Returns null when neither is given, so
 * callers keep their normal full-catalogue selection. Use it to point an
 * enricher at one import batch instead of the whole backlog.
 */
export function idsFlag(): number[] | null {
  const file = flagValue('ids-file')
  const inline = flagValue('ids')
  if (!file && !inline) return null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = file ? require('node:fs').readFileSync(file, 'utf8') as string : inline!
  const trimmed = raw.trim()
  const list: unknown[] = trimmed.startsWith('[') ? JSON.parse(trimmed) : trimmed.split(/[\s,]+/)
  return list.map(x => Number(x)).filter(n => Number.isInteger(n) && n > 0)
}

/**
 * Split an idsFlag() list into `.in('id', chunk)`-sized batches. PostgREST puts
 * the list in the URL: ~3,600 ids (the 2026-11-03 Texas import) is ~20 KB and
 * fails with "Bad Request". Returns [null] when there is no id scope, so callers
 * can always loop: `for (const chunk of idChunks(IDS)) { …; if (chunk) q = q.in('id', chunk) }`.
 */
export function idChunks(ids: number[] | null, size = 300): (number[] | null)[] {
  if (!ids) return [null]
  const out: number[][] = []
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size))
  return out
}
