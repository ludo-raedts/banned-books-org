/**
 * find-author-interviews.ts — DISCOVERY ONLY (read-only, no DB or registry writes).
 *
 * For the most-banned authors (and optionally books), searches YouTube for a
 * "HEEL DUIDELIJK" interview/clip — ideally the author themselves speaking
 * about their banned work or about censorship — and writes a RANKED CANDIDATE
 * worklist for human review. We then hand-pick the winners into
 * src/lib/featured-videos.ts (which the book/author pages embed via the
 * privacy-safe facade player).
 *
 * Why review-gated, not auto-applied: "very clear and relevant" is a judgement
 * call (right person, on-topic, watchable audio/quality). The script ranks and
 * surfaces strong candidates with a confidence score + watch links; you confirm
 * by eye before anything ships. Same doctrine as the cover/title enrichment
 * worklists.
 *
 * ── Setup (one-time) ────────────────────────────────────────────────────────
 * The YouTube Data API v3 must be ENABLED on the Google Cloud project that owns
 * your key. As of writing both GOOGLE_BOOKS_API_KEY and GOOGLE_AI_API_KEY return
 * 403 "Requests to this API ... are blocked" — i.e. the API is off for the
 * project. Enable it here (same project as the Books/Gemini key):
 *   https://console.cloud.google.com/apis/library/youtube.googleapis.com
 * then re-run. No new env var needed: the script reuses YOUTUBE_API_KEY if set,
 * else falls back to GOOGLE_BOOKS_API_KEY, else GOOGLE_AI_API_KEY.
 *
 * Quota: search.list costs 100 units, videos.list costs 1; daily free quota is
 * 10,000 units. So ~100 author searches/day. Defaults stay well under that.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   npx tsx --env-file=.env.local scripts/find-author-interviews.ts
 *   npx tsx --env-file=.env.local scripts/find-author-interviews.ts --top=40
 *   npx tsx --env-file=.env.local scripts/find-author-interviews.ts --books --top=20
 *   npx tsx --env-file=.env.local scripts/find-author-interviews.ts --include-existing
 *
 * Flags:
 *   --top=N            how many top-banned entities to scan (default 30)
 *   --books            also scan most-banned BOOKS (author-of-book queries)
 *   --authors-off      skip authors (use with --books for books-only)
 *   --per-query=N      candidates fetched per entity before scoring (default 10)
 *   --min-duration=S   drop clips shorter than S seconds (default 120 — no Shorts)
 *   --include-existing scan even entities already in featured-videos.ts
 *
 * Output (timestamped, in data/):
 *   data/interview-candidates-<date>.md    human review file (checkbox list)
 *   data/interview-candidates-<date>.json  machine-readable, all candidates
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { FEATURED_VIDEOS } from '../src/lib/featured-videos'

// ── Config / args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const num = (name: string, def: number) => {
  const a = args.find((x) => x.startsWith(`--${name}=`))
  return a ? Number(a.split('=')[1]) : def
}

const TOP = num('top', 30)
const PER_QUERY = num('per-query', 10)
const MIN_DURATION = num('min-duration', 120)
const SCAN_BOOKS = flag('books')
const SCAN_AUTHORS = !flag('authors-off')
const INCLUDE_EXISTING = flag('include-existing')

const API_KEY =
  process.env.YOUTUBE_API_KEY ||
  process.env.GOOGLE_BOOKS_API_KEY ||
  process.env.GOOGLE_AI_API_KEY ||
  ''

// Channels that reliably publish real, watchable author interviews / book-ban
// segments. A boost, NOT a gate — a strong title from an unknown channel still
// ranks. Matched as a case-insensitive substring of the channel title.
const REPUTABLE_CHANNELS = [
  'c-span', 'cspan', 'pbs', 'newshour', 'brief but spectacular', 'usa today',
  'ted', 'tedx', 'big think', 'talks at google', 'google', 'channel 4', 'bbc',
  'the guardian', 'npr', 'democracy now', 'vlogbrothers', 'the daily show',
  'cbs', 'abc news', 'nbc news', 'cnn', 'msnbc', 'the new yorker', 'wired',
  '92nd street y', '92ny', 'politics and prose', 'frontline', 'banned books',
  'pen america', 'american library association', 'national book', 'penguin',
  'macmillan', 'harpercollins', 'simon & schuster', 'amanpour', 'the view',
  'oprah', 'the late show', 'real time', 'louisiana channel', 'aspen ideas',
]

// Title/description signals that the clip is the author ON-TOPIC.
const GOOD_KEYWORDS = [
  'interview', 'in conversation', 'talks', 'discuss', 'on writing',
  'banned', 'book ban', 'book bans', 'censorship', 'censored', 'challenged',
  'freedom to read', 'q&a', 'q & a', 'speaks', 'reflects', 'on his book',
  'on her book', 'about the book',
]

// Signals it's NOT a primary-source author interview — exclude or penalise hard.
const BAD_KEYWORDS = [
  'audiobook', 'full audiobook', 'summary', 'book summary', 'sparknotes',
  'cliffsnotes', 'analysis', 'explained', 'review', 'reaction', 'trailer',
  'movie', 'full movie', 'lyrics', 'characters', 'plot', 'study guide',
  'animated', 'crash course', 'tiktok', '#shorts', 'ai ', 'asmr',
]

type Entity = { kind: 'author' | 'book'; id: number; name: string; slug: string; banBooks: number; query: string }
type Candidate = {
  videoId: string
  title: string
  channel: string
  publishedAt: string
  durationSec: number
  views: number
  url: string
  score: number
  clear: boolean
  reasons: string[]
}

// ── YouTube Data API helpers ─────────────────────────────────────────────────
async function yt(path: string, params: Record<string, string>) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('key', API_KEY)
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`YouTube ${path} ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

function parseDuration(iso: string): number {
  // ISO-8601 PT#H#M#S → seconds
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0))
}

function surnameOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (parts[parts.length - 1] || name).toLowerCase()
}

// ── Scoring: how "HEEL DUIDELIJK" is this candidate? ─────────────────────────
function score(c: Omit<Candidate, 'score' | 'clear' | 'reasons'>, authorName: string): Candidate {
  const reasons: string[] = []
  let s = 0
  const title = c.title.toLowerCase()
  const channel = c.channel.toLowerCase()
  const surname = surnameOf(authorName)
  const fullName = authorName.toLowerCase()

  if (title.includes(fullName)) { s += 4; reasons.push('full name in title') }
  else if (title.includes(surname)) { s += 2; reasons.push('surname in title') }

  const goodHits = GOOD_KEYWORDS.filter((k) => title.includes(k))
  if (goodHits.length) { s += Math.min(3, goodHits.length); reasons.push(`topic: ${goodHits.slice(0, 3).join(', ')}`) }

  if (REPUTABLE_CHANNELS.some((ch) => channel.includes(ch))) { s += 3; reasons.push(`channel: ${c.channel}`) }

  const badHits = BAD_KEYWORDS.filter((k) => title.includes(k))
  if (badHits.length) { s -= 4 * badHits.length; reasons.push(`⚠ negative: ${badHits.join(', ')}`) }

  if (c.durationSec >= 180 && c.durationSec <= 4800) { s += 1; reasons.push('interview-length') }
  if (c.durationSec < MIN_DURATION) { s -= 5; reasons.push('⚠ too short') }

  if (c.views > 0) { s += Math.min(2, Math.log10(c.views) - 2) }

  // "Clear" = confidently the right person, on-topic, no disqualifier.
  const clear =
    (title.includes(surname) || title.includes(fullName)) &&
    goodHits.length > 0 &&
    badHits.length === 0 &&
    c.durationSec >= MIN_DURATION

  return { ...c, score: Math.round(s * 10) / 10, clear, reasons }
}

async function findFor(entity: Entity): Promise<Candidate[]> {
  const search = await yt('search', {
    part: 'snippet',
    q: entity.query,
    type: 'video',
    maxResults: String(PER_QUERY),
    order: 'relevance',
    safeSearch: 'none',
    relevanceLanguage: 'en',
  })
  const items: any[] = search.items || []
  const ids = items.map((i) => i.id?.videoId).filter(Boolean)
  if (!ids.length) return []

  const details = await yt('videos', {
    part: 'contentDetails,statistics,snippet',
    id: ids.join(','),
  })
  const byId = new Map<string, any>((details.items || []).map((v: any) => [v.id, v]))

  const authorName = entity.kind === 'author' ? entity.name : entity.name // name is author display name for both (see build)
  const cands = ids
    .map((id: string) => {
      const v = byId.get(id)
      if (!v) return null
      const durationSec = parseDuration(v.contentDetails?.duration || '')
      return score(
        {
          videoId: id,
          title: v.snippet?.title || '',
          channel: v.snippet?.channelTitle || '',
          publishedAt: (v.snippet?.publishedAt || '').slice(0, 10),
          durationSec,
          views: Number(v.statistics?.viewCount || 0),
          url: `https://www.youtube.com/watch?v=${id}`,
        },
        authorName,
      )
    })
    .filter((c): c is Candidate => !!c)
    .sort((a, b) => b.score - a.score)

  return cands
}

// ── Build the entity worklist from the canonical ranking views ───────────────
async function buildEntities(sb: ReturnType<typeof createClient>): Promise<Entity[]> {
  const existingAuthorSlugs = new Set(FEATURED_VIDEOS.map((v) => v.authorSlug).filter(Boolean))
  const existingBookSlugs = new Set(FEATURED_VIDEOS.map((v) => v.bookSlug).filter(Boolean))
  const entities: Entity[] = []

  if (SCAN_AUTHORS) {
    const { data: ranked } = await sb
      .from('v_top_banned_authors')
      .select('entity_id, banned_books')
      .order('banned_books', { ascending: false })
      .limit(TOP * 3)
    const { data: placeholders } = await sb.from('authors').select('id').eq('is_placeholder', true)
    const phIds = new Set((placeholders ?? []).map((a: any) => a.id))
    const ids = (ranked ?? []).map((r: any) => Number(r.entity_id)).filter((id) => !phIds.has(id))
    const { data: authors } = await sb.from('authors').select('id, display_name, slug').in('id', ids)
    const byId = new Map((authors ?? []).map((a: any) => [a.id, a]))
    const bbById = new Map((ranked ?? []).map((r: any) => [Number(r.entity_id), Number(r.banned_books)]))

    for (const id of ids) {
      const a: any = byId.get(id)
      if (!a) continue
      if (!INCLUDE_EXISTING && existingAuthorSlugs.has(a.slug)) continue
      entities.push({
        kind: 'author',
        id,
        name: a.display_name,
        slug: a.slug,
        banBooks: bbById.get(id) || 0,
        query: `"${a.display_name}" (interview OR "book ban" OR banned OR censorship)`,
      })
      if (entities.filter((e) => e.kind === 'author').length >= TOP) break
    }
  }

  if (SCAN_BOOKS) {
    const { data: ranked } = await sb
      .from('v_top_banned_books')
      .select('entity_id, banned_books')
      .order('banned_books', { ascending: false })
      .limit(TOP * 3)
    const ids = (ranked ?? []).map((r: any) => Number(r.entity_id))
    const { data: books } = await sb
      .from('books')
      .select('id, title, slug, authors(display_name)')
      .in('id', ids)
    const byId = new Map((books ?? []).map((b: any) => [b.id, b]))
    let added = 0
    for (const id of ids) {
      const b: any = byId.get(id)
      if (!b) continue
      if (!INCLUDE_EXISTING && existingBookSlugs.has(b.slug)) continue
      const author = b.authors?.display_name || ''
      entities.push({
        kind: 'book',
        id,
        name: author || b.title,
        slug: b.slug,
        banBooks: 0,
        query: author
          ? `"${author}" "${b.title}" (interview OR banned OR censorship)`
          : `"${b.title}" (interview OR banned OR censorship)`,
      })
      if (++added >= TOP) break
    }
  }

  return entities
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!API_KEY) {
    console.error('No API key found (YOUTUBE_API_KEY / GOOGLE_BOOKS_API_KEY / GOOGLE_AI_API_KEY).')
    process.exit(1)
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const entities = await buildEntities(sb)
  console.log(`Scanning ${entities.length} entities (top=${TOP}, authors=${SCAN_AUTHORS}, books=${SCAN_BOOKS})…`)

  const results: { entity: Entity; candidates: Candidate[] }[] = []
  for (const [i, entity] of entities.entries()) {
    try {
      const candidates = await findFor(entity)
      results.push({ entity, candidates })
      const best = candidates[0]
      console.log(
        `[${i + 1}/${entities.length}] ${entity.kind} ${entity.name} → ` +
          (best ? `top "${best.title}" (score ${best.score}${best.clear ? ', CLEAR' : ''})` : 'no results'),
      )
    } catch (e: any) {
      console.error(`[${i + 1}/${entities.length}] ${entity.name} FAILED: ${e.message}`)
      // A quota/403 on the first call is fatal — stop rather than spam.
      if (String(e.message).includes('403') || String(e.message).toLowerCase().includes('quota')) {
        console.error('Stopping: API blocked or quota exhausted. Enable YouTube Data API v3 on the key project.')
        break
      }
    }
  }

  // ── Write outputs ───────────────────────────────────────────────────────────
  const date = new Date().toISOString().slice(0, 10)
  const jsonPath = `data/interview-candidates-${date}.json`
  const mdPath = `data/interview-candidates-${date}.md`

  writeFileSync(jsonPath, JSON.stringify(results, null, 2))

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const lines: string[] = [
    `# YouTube interview candidates — ${date}`,
    '',
    `Ranked discovery for ${results.length} most-banned ${SCAN_BOOKS ? 'entities' : 'authors'}. ` +
      `**Review-gate**: tick the clips that are genuinely the right person, on-topic, and watchable, ` +
      `then add the winners to \`src/lib/featured-videos.ts\`. "CLEAR" = high confidence; still eyeball it.`,
    '',
    `Sources tried per entity: top ${PER_QUERY} relevance hits, min duration ${MIN_DURATION}s.`,
    '',
  ]

  for (const { entity, candidates } of results) {
    const top = candidates.slice(0, 4)
    lines.push(`## ${entity.name}${entity.kind === 'author' ? ` · ${entity.banBooks} banned books` : ` · ${entity.slug}`}`)
    lines.push(`slug: \`${entity.slug}\` · query: \`${entity.query}\``)
    lines.push('')
    if (!top.length) {
      lines.push('_No candidates._', '')
      continue
    }
    for (const c of top) {
      const tag = c.clear ? '✅ CLEAR' : c.score >= 4 ? '🟡 maybe' : '⚪ weak'
      lines.push(
        `- [ ] **${tag}** (score ${c.score}) [${c.title}](${c.url}) — ${c.channel} · ${fmtDur(c.durationSec)} · ${c.views.toLocaleString()} views · ${c.publishedAt}`,
      )
      lines.push(`      videoId: \`${c.videoId}\` · ${c.reasons.join('; ')}`)
    }
    lines.push('')
  }

  writeFileSync(mdPath, lines.join('\n'))

  const clearCount = results.filter((r) => r.candidates[0]?.clear).length
  console.log(`\nDone. ${clearCount}/${results.length} have a CLEAR top candidate.`)
  console.log(`Review file: ${mdPath}`)
  console.log(`JSON:        ${jsonPath}`)
}

main()
