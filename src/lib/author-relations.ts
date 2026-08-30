// Cached relation lookups for /authors/[slug] — the counterpart to
// src/lib/book-relations.ts, same rationale: with ~12.7k author pages and only
// the top-100 prebuilt, every long-tail author renders cold, so anything the
// render path asks Postgres gets multiplied by the whole catalogue under crawl.
//
// The "other frequently banned authors" block is a GLOBAL top-N list. The only
// per-author part was `.neq('entity_id', author.id)`, which made an otherwise
// identical result set look book-specific and therefore uncacheable — the same
// pattern as the country/reason lookups on the book page. Caching the global
// list once and dropping the current author in memory turns two queries per
// render into zero on a warm cache.
//
// Worth caching on its own merits: v_top_banned_authors is a materialised view
// precisely because the live aggregate was a Disk-IO problem.
import { unstable_cache } from 'next/cache'
import { adminClient } from './supabase'

// Ban counts move on an import cadence; six hours matches book-relations.
const RELATION_TTL = 21600

export const AUTHOR_RELATIONS_TAG = 'author-relations'

export type TopBannedAuthor = {
  id: number
  display_name: string
  slug: string
  banCount: number
}

// Buffer of 25 rather than the caller's final 5: placeholder and slug-less
// authors are filtered out here, and the caller still drops itself, so the
// list has to survive both. (The uncached version pulled 20 *after* excluding
// the current author, so this is never a smaller candidate pool.)
const _topBannedAuthors = unstable_cache(
  async (): Promise<TopBannedAuthor[]> => {
    const sb = adminClient()
    const { data: ranked } = await sb
      .from('v_top_banned_authors')
      .select('entity_id, total_bans')
      .order('total_bans', { ascending: false })
      .limit(25)
    if (!ranked?.length) return []

    const countById = new Map(
      (ranked as { entity_id: number; total_bans: number }[])
        .map(r => [Number(r.entity_id), Number(r.total_bans)] as const),
    )
    const { data: details } = await sb
      .from('authors')
      .select('id, display_name, slug')
      .in('id', [...countById.keys()])
      .not('slug', 'is', null)
      .eq('is_placeholder', false)

    return ((details ?? []) as { id: number; display_name: string; slug: string }[])
      .map(d => ({
        id: d.id,
        display_name: d.display_name,
        slug: d.slug,
        banCount: countById.get(d.id) ?? 0,
      }))
      .sort((x, y) => y.banCount - x.banCount)
  },
  ['top-banned-authors'],
  { revalidate: RELATION_TTL, tags: [AUTHOR_RELATIONS_TAG] },
)

/**
 * Top banned authors excluding `excludeId`, highest ban count first.
 * Never throws — the caller renders the block only when it is non-empty.
 */
export async function loadRelatedAuthors(
  excludeId: number,
  limit = 5,
): Promise<TopBannedAuthor[]> {
  try {
    const all = await _topBannedAuthors()
    return all.filter(a => a.id !== excludeId).slice(0, limit)
  } catch {
    return []
  }
}
