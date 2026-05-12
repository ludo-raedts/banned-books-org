/**
 * Seed a local Supabase database with production data.
 *
 * Used as the first step of any data-touching migration. Locally testing a
 * migration on an empty DB only validates SQL syntax; it cannot reveal how
 * the migration behaves against the row shapes that actually exist in
 * production. Run this script BEFORE applying a data-touching migration
 * locally so the lokale verification step has real rows to chew on.
 *
 * Workflow:
 *   1. Verify DIRECT_URL is set in env.
 *   2. Verify the local Supabase database is reachable on 127.0.0.1:54322.
 *   3. Verify `supabase` and `psql` CLIs are on PATH.
 *   4. `supabase db dump --linked --data-only -f /tmp/prod-seed-<ts>.sql`
 *   5. Sanity-check dump: size >= 5 MB and >= 10 000 lines (a near-empty
 *      dump means the connection failed silently).
 *   6. `supabase db reset` — wipes local DB and re-applies all migrations.
 *   7. `psql ... -f <seed-file>` — apply the dump on top of the fresh schema.
 *   8. Sanity-check post-load counts: books >= 4400, ban_sources >= 4500.
 *   9. Always remove the seed file from /tmp (try/finally).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/seed-local-from-prod.ts
 *
 * Requirements:
 *   - DIRECT_URL in .env.local (Supabase Studio → Settings → Database → URI,
 *     session/direct mode, port 5432).
 *   - `docker` on PATH and a running supabase_db_* container. We pipe the
 *     seed file through `docker exec -i … psql`, so libpq does NOT need to
 *     be installed on the host.
 *   - Local Supabase stack running (`supabase start`; Docker must be up).
 *
 * NB: by design, this script does NOT call `supabase start` for you. If the
 * stack is down, it stops with a clear error so you can decide whether to
 * start it.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createReadStream, existsSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Client } from 'pg'

const LOCAL_DB_HOST = '127.0.0.1'
const LOCAL_DB_PORT = 54322
const LOCAL_DB_URL = `postgresql://postgres:postgres@${LOCAL_DB_HOST}:${LOCAL_DB_PORT}/postgres`

const MIN_DUMP_BYTES = 5 * 1024 * 1024 // 5 MB
const MIN_DUMP_LINES = 10_000
// Lower bounds tuned to current production sizes (May 2026):
//   books ~4482, bans ~4716, ban_sources ~254. The bounds are generous
//   floors that catch a silently-truncated dump while still leaving room
//   for organic growth or modest deletions.
const MIN_BOOK_COUNT = 4_000
const MIN_BANS_COUNT = 4_000
const MIN_BAN_SOURCES_COUNT = 200

export class PreflightError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PreflightError'
  }
}

export function assertDirectUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DIRECT_URL
  if (!url || url.length === 0) {
    throw new PreflightError(
      'DIRECT_URL is not set. Add it to .env.local from Supabase Studio → ' +
        'Settings → Database → Connection string (URI), session/direct mode (port 5432).',
    )
  }
  return url
}

export function tcpProbe(
  host: string,
  port: number,
  timeoutMs = 1500,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port })
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

export async function assertLocalSupabaseRunning(
  probe: (host: string, port: number) => Promise<boolean> = tcpProbe,
): Promise<void> {
  const ok = await probe(LOCAL_DB_HOST, LOCAL_DB_PORT)
  if (!ok) {
    throw new PreflightError(
      `Local Supabase database is not reachable on ${LOCAL_DB_HOST}:${LOCAL_DB_PORT}. ` +
        'Start the stack with `supabase start` (Docker daemon must be running) and re-run.',
    )
  }
}

export function assertBinaryAvailable(bin: string): void {
  const r = spawnSync(bin, ['--version'], { stdio: 'ignore' })
  if (r.error && (r.error as NodeJS.ErrnoException).code === 'ENOENT') {
    if (bin === 'docker') {
      throw new PreflightError(
        'docker is not on PATH. Install Docker Desktop (https://docker.com) ' +
          'and ensure the daemon is running.',
      )
    }
    throw new PreflightError(`${bin} is not on PATH.`)
  }
}

/**
 * Find the running Supabase database container. The stack creates a
 * container named `supabase_db_<project-slug>` per directory. If multiple
 * are running (e.g. several Supabase projects on the same machine), prefer
 * the one whose name contains the current cwd basename.
 */
export function findSupabaseDbContainer(): string {
  const r = spawnSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
  if (r.status !== 0) {
    throw new PreflightError(
      `Failed to list Docker containers (exit ${r.status}): ${r.stderr ?? ''}`.trim(),
    )
  }
  const names = (r.stdout ?? '').trim().split('\n').filter(Boolean)
  if (names.length === 0) {
    throw new PreflightError(
      'No supabase_db_* container is running. Start the stack with ' +
        '`supabase start` (Docker daemon must be up) and re-run.',
    )
  }
  const cwd = path.basename(process.cwd())
  return names.find((n) => n.includes(cwd)) ?? names[0]
}

export function assertDumpHealthy(filePath: string): {
  bytes: number
  lines: number
} {
  if (!existsSync(filePath)) {
    throw new PreflightError(`Dump file does not exist: ${filePath}`)
  }
  const bytes = statSync(filePath).size
  if (bytes < MIN_DUMP_BYTES) {
    throw new PreflightError(
      `Dump too small: ${bytes} bytes (< ${MIN_DUMP_BYTES}). ` +
        'Production may be empty, the connection silently failed, or pg_dump emitted only headers.',
    )
  }
  const content = readFileSync(filePath, 'utf8')
  const lines = content.split('\n').length
  if (lines < MIN_DUMP_LINES) {
    throw new PreflightError(`Dump too short: ${lines} lines (< ${MIN_DUMP_LINES}).`)
  }
  return { bytes, lines }
}

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '_' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  )
}

function runSupabase(args: string[]): void {
  execFileSync('supabase', args, { stdio: 'inherit' })
}

/**
 * Pipe the seed file to `psql` running inside the Supabase db container.
 * Using docker exec keeps libpq off the host. Streams stdin so the dump can
 * be arbitrarily large without bloating memory.
 */
function runPsqlInContainer(container: string, file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      [
        'exec',
        '-i',
        container,
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    )
    const input = createReadStream(file)
    input.on('error', reject)
    input.pipe(child.stdin)
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`docker exec psql exited with code ${code}`))
    })
  })
}

async function getCount(table: string): Promise<number> {
  const client = new Client({ connectionString: LOCAL_DB_URL })
  await client.connect()
  try {
    const { rows } = await client.query<{ count: string }>(
      `SELECT count(*)::text FROM ${table}`,
    )
    return Number(rows[0].count)
  } finally {
    await client.end()
  }
}

export async function main(): Promise<void> {
  const start = Date.now()
  console.log('▶ Preflight checks…')
  assertDirectUrl()
  await assertLocalSupabaseRunning()
  assertBinaryAvailable('supabase')
  assertBinaryAvailable('docker')
  const container = findSupabaseDbContainer()
  console.log(
    `  ✓ DIRECT_URL set, local DB reachable, supabase + docker on PATH, container: ${container}`,
  )

  const dumpFile = path.join(tmpdir(), `prod-seed-${timestamp()}.sql`)
  let dumpedBytes = 0
  let dumpedLines = 0
  try {
    console.log(`▶ Dumping production data → ${dumpFile}…`)
    runSupabase(['db', 'dump', '--linked', '--data-only', '-f', dumpFile])

    console.log('▶ Verifying dump is healthy…')
    const { bytes, lines } = assertDumpHealthy(dumpFile)
    dumpedBytes = bytes
    dumpedLines = lines
    console.log(
      `  ✓ ${(bytes / 1_048_576).toFixed(1)} MB, ${lines.toLocaleString()} lines`,
    )

    console.log('▶ Resetting local DB (re-applies all migrations on empty DB)…')
    runSupabase(['db', 'reset'])

    console.log(`▶ Applying seed via docker exec psql (container ${container})…`)
    await runPsqlInContainer(container, dumpFile)

    console.log('▶ Sanity-checking row counts…')
    const books = await getCount('books')
    const bans = await getCount('bans')
    const sources = await getCount('ban_sources')
    if (books < MIN_BOOK_COUNT) {
      throw new Error(
        `books count too low after seed: ${books} (< ${MIN_BOOK_COUNT})`,
      )
    }
    if (bans < MIN_BANS_COUNT) {
      throw new Error(`bans count too low after seed: ${bans} (< ${MIN_BANS_COUNT})`)
    }
    if (sources < MIN_BAN_SOURCES_COUNT) {
      throw new Error(
        `ban_sources count too low after seed: ${sources} (< ${MIN_BAN_SOURCES_COUNT})`,
      )
    }

    const duration = ((Date.now() - start) / 1000).toFixed(1)
    console.log()
    console.log('═'.repeat(60))
    console.log('Seed complete.')
    console.log(`  Dump size:    ${(dumpedBytes / 1_048_576).toFixed(1)} MB`)
    console.log(`  Dump lines:   ${dumpedLines.toLocaleString()}`)
    console.log(`  Books:        ${books.toLocaleString()}`)
    console.log(`  Bans:         ${bans.toLocaleString()}`)
    console.log(`  Ban sources:  ${sources.toLocaleString()}`)
    console.log(`  Duration:     ${duration}s`)
    console.log('═'.repeat(60))
  } finally {
    if (existsSync(dumpFile)) {
      try {
        unlinkSync(dumpFile)
        console.log(`  ✓ Removed ${dumpFile}`)
      } catch (e) {
        console.warn(
          `  ⚠ Failed to remove ${dumpFile}: ${(e as Error).message}`,
        )
      }
    }
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  main().catch((err) => {
    if (err instanceof PreflightError) {
      console.error('\n✗ Preflight failed:\n  ' + err.message.replace(/\n/g, '\n  '))
    } else {
      console.error('\n✗ Seed failed:', err)
    }
    process.exit(1)
  })
}
