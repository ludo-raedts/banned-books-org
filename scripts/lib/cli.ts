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
