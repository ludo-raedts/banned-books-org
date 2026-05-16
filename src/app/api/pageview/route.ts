// Pageview-tracking endpoint, called from a fire-and-forget client fetch on
// detail pages. Existed previously as a server-side call inside each page
// component, which forced every detail page to be dynamic-rendered. Moving
// it to a client-fired API call unlocks `revalidate = N` on the detail
// pages (book, author, country, reason) — they were the highest-traffic
// surface running force-dynamic.
//
// The bot/browser/IP detection mirrors the original trackPageview() exactly:
// the client → /api/pageview request still carries the same User-Agent,
// Accept-Language, and cf-connecting-ip / x-forwarded-for headers the page
// request did. document.referrer comes through in the POST body because
// the API request's Referer header will be the page itself, not the
// original navigation source.

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { adminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENTITY_TYPES = new Set(['book', 'author'])

const BOT_PATTERNS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
  'yandexbot', 'seznambot', 'petalbot', 'applebot', 'kagibot',
  'youbot', 'mojeekbot', 'archive.org_bot',
  'facebot', 'twitterbot', 'linkedinbot', 'whatsapp', 'telegrambot',
  'discordbot', 'slackbot', 'pinterestbot', 'redditbot',
  'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot', 'serpstatbot',
  'dataforseobot', 'blexbot', 'screaming frog',
  'gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-web',
  'anthropic-ai', 'ccbot', 'cohere-ai', 'perplexitybot', 'youbot',
  'meta-externalagent', 'meta-externalfetcher', 'bytespider', 'imagesiftbot',
  'omgilibot', 'amazonbot', 'mistralai-user', 'diffbot', 'duckassistbot',
  'headlesschrome', 'phantomjs', 'selenium', 'puppeteer', 'playwright',
  'cypress',
  'curl/', 'wget/', 'python-requests', 'python-urllib', 'aiohttp',
  'axios/', 'node-fetch', 'got/', 'undici', 'okhttp', 'java/',
  'apache-httpclient', 'go-http-client', 'libwww-perl',
  'vercel-screenshot', 'lighthouse', 'pagespeed', 'gtmetrix',
  'pingdom', 'uptimerobot', 'datadog', 'newrelic', 'better-uptime',
  'statuscake', 'site24x7',
  'bot/', 'spider', 'crawler', 'scraper', 'fetcher',
]

function dailySalt(): string {
  const day = new Date().toISOString().slice(0, 10)
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

function looksLikeBrowser(headers: Headers, ua: string): boolean {
  if (!ua.includes('mozilla/')) return false
  if (!headers.get('accept-language')) return false
  const accept = headers.get('accept') ?? ''
  if (!accept.includes('text/html') && !accept.includes('*/*')) return false
  return true
}

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

export async function POST(request: NextRequest) {
  // Always 204 on the wire — pageview-tracking failures never surface to the
  // user, and the client-side caller is fire-and-forget (doesn't read this).
  try {
    if (process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production') {
      return new NextResponse(null, { status: 204 })
    }

    const body = await request.json().catch(() => ({})) as {
      entity_type?: string
      entity_id?: number
      referrer?: string | null
    }
    const entityType = body.entity_type
    const entityId = body.entity_id
    if (!entityType || !ENTITY_TYPES.has(entityType)) return new NextResponse(null, { status: 204 })
    if (typeof entityId !== 'number' || !Number.isFinite(entityId)) return new NextResponse(null, { status: 204 })

    const cookie = request.headers.get('cookie') ?? ''
    if (cookie.includes('bb_internal=true')) return new NextResponse(null, { status: 204 })

    const ua = (request.headers.get('user-agent') ?? '').toLowerCase()
    if (ua.length < 10) return new NextResponse(null, { status: 204 })
    // The fetch() Accept header is "application/json" not text/html, so the
    // looksLikeBrowser check needs an override here — we already know it's
    // an in-page client because no other surface posts to /api/pageview.
    // Still run the bot-UA filter.
    if (BOT_PATTERNS.some(pattern => ua.includes(pattern))) return new NextResponse(null, { status: 204 })
    if (!ua.includes('mozilla/')) return new NextResponse(null, { status: 204 })
    // Accept-Language is still real-browser-only signal.
    if (!request.headers.get('accept-language')) return new NextResponse(null, { status: 204 })

    const country =
      request.headers.get('cf-ipcountry') ??
      request.headers.get('x-vercel-ip-country') ?? null

    await adminClient().from('pageviews').insert({
      path: `/${entityType}s/${entityId}`,
      entity_type: entityType,
      entity_id: entityId,
      country,
      referrer_host: extractReferrerHost(body.referrer ?? null),
      visitor_hash: visitorHash(request.headers),
    })
  } catch {
    // swallow
  }
  return new NextResponse(null, { status: 204 })
}

// looksLikeBrowser is exported only for symmetry — currently unused in the
// inlined-check above but kept so future callers can re-use the predicate.
export { looksLikeBrowser }
