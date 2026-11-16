/**
 * Bot identification for the admin Cloudflare cards.
 *
 *   1. By User-Agent (`identifyBotByUA`) — the primary signal. Most of our bot
 *      traffic (SemrushBot, ShapBot, LinkupBot, meta-webindexer, bingbot, …)
 *      comes from cloud IPs no static list can cover, but names itself.
 *   2. By Cloudflare's `verifiedBotCategory` (done in cloudflare-analytics.ts).
 *   3. By IP range (`identifyBot`, below) — a small curated list, kept only as a
 *      fallback for crawlers that send a browser UA.
 *
 * Curated CIDR ranges for well-known crawlers and AI bots (fallback).
 *
 * Sourced from each vendor's official JSON, last refreshed: 2026-05-09.
 *
 *   - Googlebot:    https://developers.google.com/static/search/apis/ipranges/googlebot.json
 *   - Bingbot:      https://www.bing.com/toolbox/bingbot.json
 *   - GPTBot:       https://openai.com/gptbot.json
 *   - ChatGPT-User: https://openai.com/chatgpt-user.json
 *   - OAI-SearchBot:https://openai.com/searchbot.json
 *   - PerplexityBot:https://www.perplexity.ai/perplexitybot.json
 *   - Perplexity-User: https://www.perplexity.ai/perplexity-user.json
 *   - Applebot:     https://support.apple.com/en-us/119829
 *   - Meta crawler: lives on Facebook AS32934 (2a03:2880::/29)
 *
 * Deliberately NOT included:
 *   - ClaudeBot — Anthropic doesn't publish IP ranges (uses cloud-provider IPs,
 *     identifies via User-Agent). IP-based detection isn't possible.
 *   - Amazonbot / DuckDuckBot — both publish hundreds of /32 ephemeral cloud IPs
 *     that rotate frequently. Not maintainable in a static list. If you need
 *     them, switch to a runtime fetch with a weekly cache.
 *
 * To refresh: re-run the WebFetches and replace the arrays below.
 */

export type KnownBot = { name: string; ranges: string[] }

export const KNOWN_BOTS: KnownBot[] = [
  {
    name: 'Googlebot',
    ranges: [
      '66.249.64.0/19',
      '64.233.160.0/19',
      '74.125.0.0/16',
      '216.58.192.0/19',
      '2001:4860:4801::/48',
    ],
  },
  {
    name: 'Bingbot',
    ranges: [
      '13.66.139.0/24',
      '40.77.167.0/24',
      '157.55.39.0/24',
      '199.30.24.0/24',
      '207.46.13.0/24',
    ],
  },
  {
    name: 'Meta crawler',
    ranges: [
      // Facebook AS32934 — covers meta-externalagent and other Meta UAs.
      '2a03:2880::/29',
    ],
  },
  {
    name: 'Applebot',
    ranges: [
      '17.58.96.0/19',
      '17.241.224.0/19',
    ],
  },
  {
    name: 'GPTBot',
    ranges: [
      '4.227.36.0/25',
      '20.125.66.80/28',
      '20.171.206.0/24',
      '20.171.207.0/24',
      '52.230.152.0/24',
      '74.7.175.128/25',
      '74.7.227.0/25',
      '74.7.227.128/25',
      '74.7.228.0/25',
      '74.7.230.0/25',
      '74.7.241.0/25',
      '74.7.241.128/25',
      '74.7.242.0/25',
      '74.7.243.128/25',
      '74.7.244.0/25',
      '132.196.86.0/24',
      '172.182.202.0/25',
      '172.182.204.0/24',
      '172.182.207.0/25',
      '172.182.214.0/24',
      '172.182.215.0/24',
    ],
  },
  {
    name: 'ChatGPT-User',
    ranges: [
      '4.151.71.176/28', '4.151.119.48/28', '4.151.241.240/28', '4.189.118.208/28', '4.189.119.48/28',
      '4.196.118.112/28', '4.196.198.80/28', '4.197.19.176/28', '4.197.22.112/28', '4.197.64.0/28',
      '4.197.64.16/28', '4.197.64.48/28', '4.197.64.64/28', '4.197.115.112/28', '4.198.72.16/28',
      '4.205.128.176/28', '4.226.226.32/28',
      '9.160.163.224/28', '9.160.164.128/28',
      '13.65.138.96/28', '13.65.138.112/28', '13.67.72.16/28', '13.70.107.160/28', '13.71.2.208/28',
      '13.76.32.208/28', '13.76.115.224/28', '13.76.115.240/28', '13.76.116.80/28', '13.83.167.128/28',
      '13.83.237.176/28',
      '20.0.53.96/28', '20.17.108.96/28', '20.27.94.128/28', '20.42.250.32/28', '20.45.178.144/28',
      '20.55.229.144/28', '20.63.221.64/28', '20.97.189.96/28', '20.102.212.144/28', '20.113.218.16/28',
      '20.113.225.112/28', '20.125.112.224/28', '20.125.144.144/28', '20.161.75.208/28', '20.168.7.192/28',
      '20.168.7.240/28', '20.169.72.96/28', '20.169.72.112/28', '20.169.73.32/28', '20.169.73.64/28',
      '20.169.73.176/28', '20.169.78.48/28', '20.169.78.64/28', '20.169.78.80/28', '20.169.78.96/28',
      '20.169.78.112/28', '20.169.78.128/28', '20.169.78.144/28', '20.169.78.160/28', '20.169.78.176/28',
      '20.169.78.192/28', '20.169.78.208/28', '20.169.86.224/28', '20.169.86.240/28', '20.169.87.112/28',
      '20.172.29.32/28', '20.193.50.32/28', '20.193.233.240/28', '20.194.0.208/28', '20.194.1.0/28',
      '20.194.157.176/28', '20.198.67.96/28', '20.199.211.160/28', '20.203.245.32/28', '20.204.24.240/28',
      '20.206.107.192/28', '20.210.154.128/28', '20.210.174.208/28', '20.210.211.192/28',
      '20.215.187.208/28', '20.215.188.192/28', '20.215.214.16/28', '20.215.219.128/28',
      '20.215.219.160/28', '20.215.219.208/28', '20.215.220.64/28', '20.215.220.80/28',
      '20.215.220.96/28', '20.215.220.112/28', '20.215.220.128/28', '20.215.220.144/28',
      '20.215.220.160/28', '20.215.220.176/28', '20.215.220.192/28', '20.215.220.208/28',
      '20.226.32.80/28', '20.227.140.32/28', '20.228.106.176/28', '20.235.75.208/28',
      '20.235.87.224/28', '20.249.63.208/28',
      '23.97.109.224/28', '23.98.142.176/28', '23.98.179.16/28', '23.98.186.64/28',
      '23.98.186.96/28', '23.98.186.176/28', '23.98.186.192/28', '23.102.140.144/28', '23.102.141.32/28',
      '40.67.183.160/28', '40.67.183.176/28', '40.75.14.224/28', '40.81.134.128/28',
      '40.81.134.144/28', '40.81.234.144/28', '40.84.181.32/28', '40.84.221.208/28',
      '40.84.221.224/28', '40.116.73.208/28', '40.122.235.112/28',
      '51.8.155.48/28', '51.8.155.64/28', '51.8.155.80/28', '51.107.70.192/28', '51.116.2.64/28',
      '51.116.2.80/28',
      '52.148.129.32/28', '52.154.22.48/28', '52.156.77.144/28', '52.159.227.32/28',
      '52.159.249.96/28', '52.165.212.16/28', '52.165.212.32/28', '52.165.212.48/28',
      '52.172.129.160/28', '52.172.251.112/28', '52.173.123.0/28', '52.173.219.96/28',
      '52.173.219.112/28', '52.173.221.16/28', '52.173.221.176/28', '52.173.221.208/28',
      '52.173.234.16/28', '52.173.234.80/28', '52.173.235.80/28', '52.176.139.176/28',
      '52.187.246.128/28', '52.190.137.16/28', '52.190.137.144/28', '52.190.139.48/28',
      '52.190.142.64/28', '52.190.190.16/28', '52.225.75.208/28', '52.230.163.32/28',
      '52.230.164.176/28', '52.231.30.48/28', '52.231.34.176/28', '52.231.39.144/28',
      '52.231.39.192/28', '52.231.49.48/28', '52.231.50.64/28', '52.236.94.144/28',
      '52.242.132.224/28', '52.242.132.240/28', '52.242.245.208/28', '52.252.113.240/28',
      '52.255.109.80/28', '52.255.109.96/28', '52.255.109.112/28', '52.255.109.128/28',
      '52.255.109.144/28', '52.255.111.0/28', '52.255.111.16/28', '52.255.111.32/28',
      '52.255.111.48/28', '52.255.111.80/28', '52.255.111.112/28',
      '57.151.131.224/28', '57.154.174.112/28', '57.154.175.0/28', '57.154.187.32/28',
      '68.154.28.96/28', '68.218.30.112/28', '68.220.57.64/28', '68.221.67.160/28',
      '68.221.67.192/28', '68.221.67.224/28', '68.221.67.240/28', '68.221.75.16/28',
      '74.226.253.160/28', '74.249.86.176/28',
      '85.211.241.128/28',
      '104.210.139.192/28', '104.210.139.224/28',
      '132.196.82.48/28', '135.119.134.128/28', '135.119.134.192/28',
      '135.220.73.208/28', '135.220.73.240/28', '135.237.131.208/28', '135.237.133.48/28',
      '137.135.191.176/28', '138.91.30.48/28', '138.91.46.96/28',
      '168.63.252.240/28',
      '172.178.140.144/28', '172.178.141.112/28', '172.178.141.128/28',
      '172.183.143.224/28', '172.183.222.128/28',
      '172.196.40.208/28', '172.202.102.112/28', '172.204.16.64/28', '172.204.27.16/28',
      '172.212.159.64/28', '172.213.11.144/28', '172.213.12.112/28', '172.213.21.16/28',
      '172.213.21.112/28', '172.213.21.144/28', '172.215.218.96/28',
      '191.233.1.112/28', '191.233.1.128/28', '191.233.1.224/28', '191.233.2.0/28',
      '191.233.194.32/28', '191.233.196.112/28', '191.233.199.160/28', '191.234.167.128/28',
      '191.235.66.16/28', '191.235.98.144/28', '191.235.99.80/28', '191.237.249.64/28',
      '191.239.245.16/28',
    ],
  },
  {
    name: 'OAI-SearchBot',
    ranges: [
      '4.227.36.0/25',
      '20.14.99.96/28', '20.25.151.224/28', '20.42.10.176/28',
      '20.168.18.32/28', '20.169.6.224/28', '20.169.7.48/28', '20.169.77.0/25',
      '20.171.53.224/28', '20.171.123.64/28',
      '40.67.175.0/25', '40.90.214.16/28',
      '51.8.102.0/24',
      '74.7.175.128/25', '74.7.228.0/25', '74.7.228.128/25', '74.7.229.0/25',
      '74.7.229.128/25', '74.7.230.0/25', '74.7.241.128/25', '74.7.242.128/25',
      '74.7.243.0/25', '74.7.244.0/25',
      '104.210.140.128/28',
      '135.234.64.0/24',
      '172.182.193.80/28', '172.182.193.224/28', '172.182.194.32/28', '172.182.194.144/28',
      '172.182.195.48/28', '172.182.209.208/28', '172.182.211.192/28', '172.182.213.192/28',
      '172.182.224.0/28', '172.203.190.128/28',
    ],
  },
  {
    name: 'PerplexityBot',
    ranges: [
      '3.211.124.183/32',
      '3.222.232.239/32',
      '3.224.62.45/32',
      '3.231.139.107/32',
      '18.97.1.228/30',
      '18.97.9.96/29',
      '18.210.92.235/32',
      '107.20.236.150/32',
    ],
  },
  {
    name: 'Perplexity-User',
    ranges: [
      '18.97.21.0/30',
      '18.97.43.80/29',
      '34.193.163.52/32',
      '44.208.221.197/32',
    ],
  },
]

// ────────────────────────────────────────────────────────────────────────────────
// CIDR matcher

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(p => parseInt(p, 10))
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return -1
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

const SIXTEEN = BigInt(16)
const ONE_TWENTY_EIGHT = BigInt(128)

function expandIPv6(ip: string): bigint | null {
  const parts = ip.toLowerCase().split('::')
  if (parts.length > 2) return null
  const head = parts[0] ? parts[0].split(':') : []
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if (missing < 0) return null
  const all = [...head, ...new Array(missing).fill('0'), ...tail]
  if (all.length !== 8) return null
  let n = BigInt(0)
  for (const h of all) {
    const v = parseInt(h || '0', 16)
    if (Number.isNaN(v)) return null
    n = (n << SIXTEEN) | BigInt(v)
  }
  return n
}

function matchCidr(ip: string, cidr: string): boolean {
  const slash = cidr.indexOf('/')
  if (slash === -1) return false
  const base = cidr.slice(0, slash)
  const bits = parseInt(cidr.slice(slash + 1), 10)
  if (Number.isNaN(bits)) return false

  const ipIsV6 = ip.includes(':')
  const baseIsV6 = base.includes(':')
  if (ipIsV6 !== baseIsV6) return false

  if (ipIsV6) {
    const ipN = expandIPv6(ip)
    const baseN = expandIPv6(base)
    if (ipN === null || baseN === null) return false
    if (bits >= 128) return ipN === baseN
    if (bits <= 0) return true
    const shift = ONE_TWENTY_EIGHT - BigInt(bits)
    return (ipN >> shift) === (baseN >> shift)
  } else {
    const ipN = ipv4ToInt(ip)
    const baseN = ipv4ToInt(base)
    if (ipN === -1 || baseN === -1) return false
    if (bits >= 32) return ipN === baseN
    if (bits <= 0) return true
    const mask = (~0 << (32 - bits)) >>> 0
    return (ipN & mask) === (baseN & mask)
  }
}

export function identifyBot(ip: string): string | null {
  for (const bot of KNOWN_BOTS) {
    for (const cidr of bot.ranges) {
      if (matchCidr(ip, cidr)) return bot.name
    }
  }
  return null
}


// ── User-Agent identification ────────────────────────────────────────────────
// Ordered: the first match wins, so specific names come before generic ones
// (e.g. "Googlebot-Image" before "Googlebot", "bingbot" inside a Chrome-like UA).
// A UA is spoofable; that's fine here — this labels traffic on an admin card,
// it never gates anything.
const UA_BOTS: Array<[RegExp, string]> = [
  [/googlebot-image/i, 'Googlebot Image'],
  [/google-extended|googleother|google-inspectiontool|storebot-google/i, 'Google (other)'],
  [/adsbot-google|mediapartners-google/i, 'Google Ads'],
  [/googlebot/i, 'Googlebot'],
  [/bingbot|bingpreview|msnbot/i, 'Bingbot'],
  [/meta-webindexer|meta-externalagent|meta-externalfetcher/i, 'Meta crawler'],
  [/facebookexternalhit|facebot/i, 'Facebook preview'],
  [/shapbot/i, 'ShapBot'],
  [/semrushbot/i, 'SemrushBot'],
  [/ahrefsbot|ahrefssiteaudit/i, 'AhrefsBot'],
  [/linkupbot/i, 'LinkupBot'],
  [/exabot|exasearch/i, 'Exa'],
  [/perplexity/i, 'Perplexity'],
  [/oai-searchbot/i, 'OAI-SearchBot'],
  [/chatgpt-user/i, 'ChatGPT-User'],
  [/gptbot/i, 'GPTBot'],
  [/claudebot|claude-web|claude-user|claude-searchbot|anthropic-ai/i, 'Anthropic (Claude)'],
  [/applebot/i, 'Applebot'],
  [/duckassistbot/i, 'DuckAssistBot'],
  [/duckduckbot/i, 'DuckDuckBot'],
  [/amazonbot/i, 'Amazonbot'],
  [/bytespider/i, 'Bytespider'],
  [/yandex/i, 'Yandex'],
  [/baiduspider/i, 'Baiduspider'],
  [/petalbot/i, 'PetalBot'],
  [/mj12bot/i, 'MJ12bot'],
  [/dotbot/i, 'DotBot'],
  [/dataforseobot/i, 'DataForSeoBot'],
  [/blexbot/i, 'BLEXBot'],
  [/serpstatbot/i, 'Serpstatbot'],
  [/ccbot/i, 'CCBot'],
  [/twitterbot/i, 'Twitterbot'],
  [/linkedinbot/i, 'LinkedInBot'],
  [/slackbot|slack-imgproxy/i, 'Slackbot'],
  [/discordbot/i, 'Discordbot'],
  [/whatsapp/i, 'WhatsApp'],
  [/telegrambot/i, 'Telegrambot'],
  [/pinterestbot|pinterest\//i, 'Pinterest'],
  [/redditbot/i, 'Redditbot'],
  [/bluesky|cardyb/i, 'Bluesky'],
  [/uptimerobot|pingdom|statuscake|betterstack|better-uptime|site24x7/i, 'Uptime monitor'],
  [/vercel-screenshot|vercel-favicon|vercel-og/i, 'Vercel'],
  [/curl\/|wget\/|python-requests|python-urllib|aiohttp|go-http-client|node-fetch|undici|okhttp|axios\/|libwww-perl|scrapy|httpx/i, 'HTTP script'],
  [/headlesschrome|phantomjs|puppeteer|playwright|selenium/i, 'Headless browser'],
]

// Anything else that calls itself a bot: pull out "<name>bot", "…crawler", etc.
const GENERIC_BOT = /([A-Za-z0-9][A-Za-z0-9._-]*(?:bot|crawler|spider|fetcher|indexer|scraper))/i

export function identifyBotByUA(ua: string | null | undefined): string | null {
  if (!ua) return null
  for (const [re, name] of UA_BOTS) if (re.test(ua)) return name
  const m = GENERIC_BOT.exec(ua)
  return m ? m[1] : null
}
