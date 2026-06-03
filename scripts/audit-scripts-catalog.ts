/**
 * READ-ONLY catalog freshness check. No DB, no IO beyond reading the scripts
 * directory + scripts/README.md.
 *
 * Flags any script file under scripts/ whose filename is NOT mentioned anywhere
 * in scripts/README.md — i.e. a script that was added without being added to
 * the catalog. Keeps the "which script for what" guide from silently rotting.
 *
 * Used two ways:
 *   - standalone:  npx tsx scripts/audit-scripts-catalog.ts
 *   - as the closing message of enrich-all.ts (so you see it after every run).
 *
 * Exports findUndocumentedScripts() for the enrich-all integration.
 */
import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const README = resolve(HERE, 'README.md')

// Files that intentionally need no catalog entry.
const IGNORE = new Set<string>([
  'README.md',
  'audit-scripts-catalog.ts', // this script
])

// Throwaway prototypes / scratch scripts — never cataloged.
const IGNORE_PREFIX = ['_tmp_']

/** Script filenames present on disk but absent from scripts/README.md. */
export function findUndocumentedScripts(): string[] {
  let readme: string
  try {
    readme = readFileSync(README, 'utf-8')
  } catch {
    return [] // no catalog → nothing to enforce
  }

  const files = readdirSync(HERE, { withFileTypes: true })
    .filter(d => d.isFile())
    .map(d => d.name)
    .filter(n => /\.(ts|tsx|js|py)$/.test(n))
    .filter(n => !IGNORE.has(n))
    .filter(n => !IGNORE_PREFIX.some(p => n.startsWith(p)))

  // A script is "documented" if its exact filename appears in the README.
  return files.filter(name => !readme.includes(name)).sort()
}

/** Pretty closing message; returns the text so callers can print it themselves. */
export function catalogReminder(): string | null {
  const missing = findUndocumentedScripts()
  if (missing.length === 0) return null
  const list = missing.map(m => `      • ${m}`).join('\n')
  return [
    `  ⚠ ${missing.length} script(s) niet in scripts/README.md — voeg ze toe aan de catalogus:`,
    list,
  ].join('\n')
}

// Standalone run
if (import.meta.url === `file://${process.argv[1]}`) {
  const missing = findUndocumentedScripts()
  if (missing.length === 0) {
    console.log('✓ scripts/README.md is up to date — every script is cataloged.')
  } else {
    console.log(`⚠ ${missing.length} script(s) missing from scripts/README.md:\n`)
    for (const m of missing) console.log(`  • ${m}`)
    console.log('\nAdd them to the right family section in scripts/README.md.')
    process.exit(1)
  }
}
