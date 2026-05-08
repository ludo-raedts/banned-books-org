// Banned Books Week runtime config — DB-backed.
//
// At runtime the config lives in the `bbw_config` singleton table (migration
// 017). Editors flip `enabled`, dates, and `promoStartDate` from the admin
// UI at /admin/banned-books-week — no code deploy needed.
//
// The fallback values below are used only when the DB row hasn't been seeded
// yet (fresh environment) or when the read fails. They mirror the seed values
// in migration 017 so a freshly-cloned dev environment behaves predictably.

import { adminClient, serverClient } from '@/lib/supabase'

export type BannedBooksWeekConfig = {
  enabled: boolean
  /** ISO date, inclusive (UTC) — first day of the actual BBW week. */
  startDate: string
  /** ISO date, inclusive (UTC) — last day of the actual BBW week. */
  endDate: string
  /**
   * Optional ISO date — when to start promoting on the homepage tile and
   * Reading Club hub. Defaults to `startDate` (no lead-up).
   */
  promoStartDate: string | null
  /** Year used for content-block lookups, archive routes, and the tile label. */
  year: number
}

const DEFAULTS: BannedBooksWeekConfig = {
  enabled: false,
  startDate: '2026-09-27',
  endDate: '2026-10-03',
  promoStartDate: '2026-09-01',
  year: 2026,
}

// In-memory cache so the homepage doesn't hit the DB on every request. TTL
// is short (60s) so a flip in the admin UI shows up within a minute even
// across separate Vercel function instances. Manual cache-bust on save.
let cached: { config: BannedBooksWeekConfig; expiresAt: number } | null = null
const TTL_MS = 60_000

type DbRow = {
  enabled: boolean
  year: number
  start_date: string
  end_date: string
  promo_start: string | null
}

function rowToConfig(row: DbRow): BannedBooksWeekConfig {
  return {
    enabled: row.enabled,
    year: row.year,
    startDate: row.start_date,
    endDate: row.end_date,
    promoStartDate: row.promo_start,
  }
}

export async function getBBWConfig(): Promise<BannedBooksWeekConfig> {
  if (cached && Date.now() < cached.expiresAt) return cached.config
  try {
    const { data } = await serverClient()
      .from('bbw_config')
      .select('enabled, year, start_date, end_date, promo_start')
      .eq('id', 1)
      .maybeSingle()
    const config = data ? rowToConfig(data as DbRow) : DEFAULTS
    cached = { config, expiresAt: Date.now() + TTL_MS }
    return config
  } catch {
    // DB unreachable / table missing — fall back to seed defaults so the
    // public site keeps rendering rather than 500-ing.
    return DEFAULTS
  }
}

export async function updateBBWConfig(
  patch: Partial<BannedBooksWeekConfig>,
  updatedBy?: string,
): Promise<BannedBooksWeekConfig> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.enabled !== undefined) update.enabled = patch.enabled
  if (patch.year !== undefined) update.year = patch.year
  if (patch.startDate !== undefined) update.start_date = patch.startDate
  if (patch.endDate !== undefined) update.end_date = patch.endDate
  if (patch.promoStartDate !== undefined) update.promo_start = patch.promoStartDate
  if (updatedBy !== undefined) update.updated_by = updatedBy

  const { data, error } = await adminClient()
    .from('bbw_config')
    .update(update)
    .eq('id', 1)
    .select('enabled, year, start_date, end_date, promo_start')
    .single()
  if (error) throw new Error(error.message)
  cached = null // bust local cache so subsequent reads see the new value
  return rowToConfig(data as DbRow)
}

// True only during the actual BBW week. Use this when an action only makes
// sense during the week itself (e.g., a "happening this week" banner).
export async function isBannedBooksWeekActive(now: Date = new Date()): Promise<boolean> {
  const c = await getBBWConfig()
  if (!c.enabled) return false
  const today = now.toISOString().slice(0, 10)
  return today >= c.startDate && today <= c.endDate
}

// True during the broader promo window (lead-up + actual week). Use this
// for the homepage tile-swap and the Reading Club → BBW cross-link, where
// you want to start drawing attention to BBW before it opens.
export async function isBannedBooksWeekPromoActive(now: Date = new Date()): Promise<boolean> {
  const c = await getBBWConfig()
  if (!c.enabled) return false
  const today = now.toISOString().slice(0, 10)
  const start = c.promoStartDate ?? c.startDate
  return today >= start && today <= c.endDate
}

// "Sep 27 – Oct 3"-style range string for the homepage tile and other
// places that show the BBW week at a glance. UTC-anchored so the result
// is identical regardless of server / client timezone.
export async function formatBBWDateRange(): Promise<string> {
  const c = await getBBWConfig()
  const fmt = (iso: string) => {
    const d = new Date(iso + 'T00:00:00Z')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }
  return `${fmt(c.startDate)} – ${fmt(c.endDate)}`
}
