// Exempt AI search / assistant user agents from the datacenter managed-challenge
// WAF rule (#5, id 04b151c9…, phase http_request_firewall_custom).
//
// Why (audit 2026-10-25, Cloudflare GraphQL, 7 days): rule #5 challenges every
// non-verified client on cloud ASNs (AWS, GCP, Azure, OVH, Hetzner, DO …). A bot
// cannot solve a managed challenge, so it gets a 403. Cloudflare delisted
// PerplexityBot as a verified bot (Aug 2025) and the user-triggered fetchers
// (Perplexity-User, Claude-User, DuckAssistBot, MistralAI-User, ChatGPT-User)
// were never on the verified list — all of them run from AWS/GCP/Azure:
//   PerplexityBot    403 ×204 (90 of them on /robots.txt)  vs 200 ×3
//   Perplexity-User  403 ×43                               vs 200 ×0
//   Claude-User      403 ×75                               vs 200 ×9
//   Claude-SearchBot 403 ×65                               vs 200 ×28
//   DuckAssistBot    403 ×64                               vs 200 ×24
// That contradicts docs/cloudflare-waf.md §2 ("AI-verkeer is welkom") and
// robots.txt (ai-input=yes). Googlebot/Bingbot are verified and unaffected
// (their 403s are vulnerability scanners spoofing the UA on /.env paths).
//
// Trade-off: a scraper swarm could spoof one of these UAs from a cloud ASN to
// skip the challenge. Spoofers are visible in GraphQL (userAgent_like) and the
// rule can be tightened to UA+ASN pairs if that ever happens.
//
// Usage (dry-run prints the before/after expression, --apply PATCHes):
//   pnpm tsx --env-file=.env.local scripts/cf-waf-exempt-ai-agents.ts
//   pnpm tsx --env-file=.env.local scripts/cf-waf-exempt-ai-agents.ts --apply
// Needs CLOUDFLARE_API_TOKEN with Zone → Zone WAF → Edit.

import { isApply } from './lib/cli'

const RULE_PREFIX = '04b151c9'
const AI_AGENT_UAS = [
  'PerplexityBot',
  'Perplexity-User',
  'Claude-User',
  'Claude-SearchBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'DuckAssistBot',
  'MistralAI-User',
  'Meta-ExternalFetcher',
]
const MARKER = 'AI search/assistant UAs exempt'

type Rule = { id: string; action: string; expression: string; description?: string; enabled?: boolean }
type Ruleset = { id: string; rules: Rule[] }

async function cf<T>(method: string, path: string, body?: unknown): Promise<{ success: boolean; result: T; errors: { message: string }[] }> {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

async function main() {
  const zone = process.env.CLOUDFLARE_ZONE_ID
  if (!zone || !process.env.CLOUDFLARE_API_TOKEN) throw new Error('CLOUDFLARE_ZONE_ID / CLOUDFLARE_API_TOKEN not set')
  const apply = isApply()

  const rs = await cf<Ruleset>('GET', `/zones/${zone}/rulesets/phases/http_request_firewall_custom/entrypoint`)
  if (!rs.success) throw new Error(`read ruleset: ${rs.errors.map(e => e.message).join('; ')}`)
  const rule = rs.result.rules.find(r => r.id.startsWith(RULE_PREFIX))
  if (!rule) throw new Error(`rule ${RULE_PREFIX}… not found (${rs.result.rules.length} rules)`)

  console.log(`Rule #${rs.result.rules.indexOf(rule) + 1} [${rule.action}] ${rule.id}`)
  console.log(`BEFORE: ${rule.expression}`)
  if (rule.description?.includes(MARKER) || AI_AGENT_UAS.every(ua => rule.expression.includes(`"${ua}"`))) {
    console.log('Already exempted — nothing to do.')
    return
  }

  const exempt = AI_AGENT_UAS.map(ua => `http.user_agent contains "${ua}"`).join(' or ')
  const expression = `(${rule.expression}) and not (${exempt})`
  const description = `${rule.description ?? ''} — 2026-10-25: ${MARKER} (Perplexity delisted as verified bot; *-User fetchers never verified; they were 403'd on robots.txt)`
  console.log(`AFTER:  ${expression}`)

  if (!apply) {
    console.log('\nDry-run. Re-run with --apply to PATCH the rule.')
    return
  }
  const res = await cf<Rule>('PATCH', `/zones/${zone}/rulesets/${rs.result.id}/rules/${rule.id}`, {
    action: rule.action, expression, description, enabled: rule.enabled ?? true,
  })
  if (!res.success) throw new Error(`PATCH failed: ${res.errors.map(e => e.message).join('; ')}`)

  const after = await cf<Ruleset>('GET', `/zones/${zone}/rulesets/phases/http_request_firewall_custom/entrypoint`)
  const r2 = after.result.rules.find(r => r.id.startsWith(RULE_PREFIX))
  console.log(`\nVERIFIED: ${r2?.expression}`)
  console.log(`rules in phase: ${after.result.rules.length} (expect 5)`)
  console.log('\nMeasure in ~24h: GraphQL httpRequestsAdaptiveGroups, userAgent_like "%PerplexityBot%" by edgeResponseStatus — 403s should drop to the scanner noise (/.env paths).')
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
