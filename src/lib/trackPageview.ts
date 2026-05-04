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
  'googlebot', 'bingbot', 'slurp', 'duckduckbot',
  'baiduspider', 'yandexbot', 'facebot', 'ia_archiver',
  'twitterbot', 'linkedinbot', 'whatsapp', 'telegrambot',
  'applebot', 'semrushbot', 'ahrefsbot', 'mj12bot',
  'dotbot', 'seznambot', 'petalbot', 'bytespider',
  'gptbot', 'claudebot', 'ccbot', 'anthropic-ai',
  'headlesschrome', 'phantomjs', 'selenium', 'puppeteer',
  'curl/', 'wget/', 'python-requests', 'axios/',
  'vercel-screenshot', 'lighthouse',
]

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
    const isBot = BOT_PATTERNS.some(pattern => ua.includes(pattern))
    if (isBot || ua.length < 10) return

    const country = request.headers.get('x-vercel-ip-country') ?? null
    const referrer = request.headers.get('referer') ?? null

    await adminClient().from('pageviews').insert({
      path: `/${entityType}s/${entityId}`,
      entity_type: entityType,
      entity_id: entityId,
      country,
      referrer_host: extractReferrerHost(referrer),
    })
  } catch {
    // Never let tracking errors surface to the user
  }
}
