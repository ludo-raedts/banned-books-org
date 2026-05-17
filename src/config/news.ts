// News pipeline runtime config — DB-backed.
//
// Mirrors the bbw_config pattern (migration 017): a singleton row in
// news_config that an editor can flip from /admin/news without a deploy.
// Controls daily auto-publish and the embeddings dedup thresholds.
//
// The DEFAULTS below match the seed values in migration 018; they kick in
// only when the row hasn't been seeded or the read fails, so the public
// site never 500s on a missing config.

import { adminClient } from '@/lib/supabase'

export type NewsConfig = {
  /** When true, items that pass relevance + dedup are saved as 'published'. */
  autoPublish: boolean
  /** Cosine similarity above this counts as a duplicate. */
  dedupThreshold: number
  /** Lookback window (days) for the dedup similarity comparison. */
  dedupWindowDays: number
}

const DEFAULTS: NewsConfig = {
  autoPublish: false,
  dedupThreshold: 0.85,
  dedupWindowDays: 14,
}

type DbRow = {
  auto_publish: boolean
  dedup_threshold: number
  dedup_window_days: number
}

function rowToConfig(row: DbRow): NewsConfig {
  return {
    autoPublish: row.auto_publish,
    dedupThreshold: row.dedup_threshold,
    dedupWindowDays: row.dedup_window_days,
  }
}

// Read via service role: news_config is admin/cron-only and the anon role
// can't see the row (RLS in the live project blocks it even though the
// migration only declares GRANTs). Falling back to DEFAULTS silently was the
// bug that made the auto-publish toggle look like it wasn't being saved.
export async function getNewsConfig(): Promise<NewsConfig> {
  try {
    const { data } = await adminClient()
      .from('news_config')
      .select('auto_publish, dedup_threshold, dedup_window_days')
      .eq('id', 1)
      .maybeSingle()
    return data ? rowToConfig(data as DbRow) : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export async function updateNewsConfig(
  patch: Partial<NewsConfig>,
  updatedBy?: string,
): Promise<NewsConfig> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.autoPublish !== undefined) update.auto_publish = patch.autoPublish
  if (patch.dedupThreshold !== undefined) update.dedup_threshold = patch.dedupThreshold
  if (patch.dedupWindowDays !== undefined) update.dedup_window_days = patch.dedupWindowDays
  if (updatedBy !== undefined) update.updated_by = updatedBy

  const { data, error } = await adminClient()
    .from('news_config')
    .update(update)
    .eq('id', 1)
    .select('auto_publish, dedup_threshold, dedup_window_days')
    .single()
  if (error) throw new Error(error.message)
  return rowToConfig(data as DbRow)
}
