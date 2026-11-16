import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Tiny JSON cache for *build-time* work, stored in `.next/cache` (which Vercel
// restores between builds). Use it for expensive-but-stable inputs to
// generateStaticParams so repeated deploys don't repeat the same DB scan.
// Fail-open: any read/write problem just runs the loader.
const DIR = join(process.cwd(), '.next', 'cache', 'bb-build')

export async function cachedForBuild<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const file = join(DIR, `${key}.json`)
  try {
    const hit = JSON.parse(readFileSync(file, 'utf8')) as { at: number; value: T }
    if (Date.now() - hit.at < ttlMs) return hit.value
  } catch {
    // no cache yet / unreadable → load
  }
  const value = await load()
  try {
    mkdirSync(DIR, { recursive: true })
    writeFileSync(file, JSON.stringify({ at: Date.now(), value }))
  } catch {
    // read-only FS etc. — not worth failing the build over
  }
  return value
}
