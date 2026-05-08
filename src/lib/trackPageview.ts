import { createHash } from 'node:crypto'
import { adminClient } from './supabase'

function extractReferrerHost(referer: string | null): string | null {
  if (!referer) return null
  try {
    const url = new URL(referer)
    const host = url.hostname.replace(/^www\./, '')
    if (host.includes('banned-books.org')) return null
    if (!host || host === 'localhost') return null
    return host
  } catch {
    return null
  }
}

const BOT_PATTERNS = [
  // Search-engine crawlers
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
  'yandexbot', 'seznambot', 'petalbot', 'applebot', 'kagibot',
  'youbot', 'mojeekbot', 'archive.org_bot',
  // Social / link-preview crawlers
  'facebot', 'twitterbot', 'linkedinbot', 'whatsapp', 'telegrambot',
  'discordbot', 'slackbot', 'pinterestbot', 'redditbot',
  // SEO / scraping crawlers
  'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot', 'serpstatbot',
  'dataforseobot', 'blexbot', 'screaming frog',
  // AI-training & AI-search crawlers
  'gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-web',
  'anthropic-ai', 'ccbot', 'cohere-ai', 'perplexitybot', 'youbot',
  'meta-externalagent', 'meta-externalfetcher', 'bytespider', 'imagesiftbot',
  'omgilibot', 'amazonbot', 'mistralai-user', 'diffbot', 'duckassistbot',
  // Headless browsers & automation
  'headlesschrome', 'phantomjs', 'selenium', 'puppeteer', 'playwright',
  'cypress',
  // HTTP clients / scripts
  'curl/', 'wget/', 'python-requests', 'python-urllib', 'aiohttp',
  'axios/', 'node-fetch', 'got/', 'undici', 'okhttp', 'java/',
  'apache-httpclient', 'go-http-client', 'libwww-perl',
  // Monitoring / probes
  'vercel-screenshot', 'lighthouse', 'pagespeed', 'gtmetrix',
  'pingdom', 'uptimerobot', 'datadog', 'newrelic', 'better-uptime',
  'statuscake', 'site24x7',
  // Generic catch-alls (run last; safe — none appear in major-browser UAs)
  'bot/', 'spider', 'crawler', 'scraper', 'fetcher',
]

// Per-day salt: rotates every 24h so a visitor_hash is only useful within
// a single day. Privacy-safe: the IP is never persisted, only the SHA-256
// digest, and yesterday's hashes can't be matched against today's.
function dailySalt(): string {
  const day = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC
  const secret = process.env.VISITOR_SALT_SECRET
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? ''
  return createHash('sha256').update(`${day}|${secret}`).digest('hex')
}

function visitorHash(headers: Headers): string | null {
  const fwd =
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for') ??
    headers.get('x-real-ip') ?? ''
  const ip = fwd.split(',')[0].trim()
  if (!ip) return null
  const ua = headers.get('user-agent') ?? ''
  return createHash('sha256').update(`${dailySalt()}|${ip}|${ua}`).digest('hex')
}

// Headers that virtually all real browsers send. Bots commonly omit them.
function looksLikeBrowser(headers: Headers, ua: string): boolean {
  // Major browsers (Chrome, Safari, Firefox, Edge, Opera) all start with "Mozilla/".
  // Most simple HTTP clients do not.
  if (!ua.includes('mozilla/')) return false
  // Real browsers always send Accept-Language. Bots and scripts usually don't.
  if (!headers.get('accept-language')) return false
  // Real browsers always send Accept with text/html on a navigation. Bots often send */* or nothing.
  const accept = headers.get('accept') ?? ''
  if (!accept.includes('text/html') && !accept.includes('*/*')) return false
  return true
}

export async function trackPageview(
  entityType: 'book' | 'author',
  entityId: number,
  request: Request
): Promise<void> {
  try {
    if (process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production') return

    const cookie = request.headers.get('cookie') ?? ''
    if (cookie.includes('bb_internal=true')) return

    const ua = (request.headers.get('user-agent') ?? '').toLowerCase()
    if (ua.length < 10) return
    if (BOT_PATTERNS.some(pattern => ua.includes(pattern))) return
    if (!looksLikeBrowser(request.headers, ua)) return

    const country =
      request.headers.get('cf-ipcountry') ??
      request.headers.get('x-vercel-ip-country') ?? null
    const referrer = request.headers.get('referer') ?? null

    await adminClient().from('pageviews').insert({
      path: `/${entityType}s/${entityId}`,
      entity_type: entityType,
      entity_id: entityId,
      country,
      referrer_host: extractReferrerHost(referrer),
      visitor_hash: visitorHash(request.headers),
    })
  } catch {
    // Never let tracking errors surface to the user
  }
}
