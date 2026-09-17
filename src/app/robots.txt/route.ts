import { SITE_URL } from '@/lib/canonical-host'

// Served as a Route Handler rather than Next's `robots.ts` metadata
// convention, because `MetadataRoute.Robots` only models userAgent / allow /
// disallow / crawlDelay — it cannot emit a `Content-Signal:` directive.
//
// Until 2026-09 that signal came from Cloudflare's "Managed robots.txt"
// feature. Cloudflare replaced its AI-bot controls with separate Search /
// Training / Agent settings, and the managed block stopped being served.
// Hosting the signal here makes the policy independent of that dashboard
// toggle, and keeps it visible in review alongside the rest of the site.
export const dynamic = 'force-static'
export const revalidate = false

// Policy: AI may READ + CITE the catalogue, but not ingest it to TRAIN
// language models. These are the training / bulk-ingest crawlers, told
// politely to stay out. Enforcement for those that ignore robots lives in the
// Cloudflare WAF (custom firewall, "Block scrapers + AI training crawlers").
// Search / citation agents — OAI-SearchBot, ChatGPT-User, Claude-User,
// Claude-SearchBot, PerplexityBot, Googlebot, Bingbot, Applebot — are
// deliberately NOT listed here and remain fully allowed.
const TRAINING_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'CCBot',
  'Google-Extended',
  'meta-externalagent',
  'Applebot-Extended',
  'Bytespider',
  'Amazonbot',
  'Omgilibot',
  'Diffbot',
]

// The Content Signals Policy (https://contentsignals.org/, IETF draft
// draft-romm-aipref-contentsignals). Verbatim preamble: the signals are only
// meaningful if the stated terms travel with them, and the Article 4 clause is
// the express reservation of rights that makes an opt-out from the EU
// text-and-data-mining exception effective.
const CONTENT_SIGNALS_PREAMBLE = `# As a condition of accessing this website, you agree to
# abide by the following content signals:

# (a)  If a content-signal = yes, you may collect content
# for the corresponding use.
# (b)  If a content-signal = no, you may not collect content
# for the corresponding use.
# (c)  If the website operator does not include a content
# signal for a corresponding use, the website operator
# neither grants nor restricts permission via content signal
# with respect to the corresponding use.

# The content signals and their meanings are:

# search: building a search index and providing search
# results (e.g., returning hyperlinks and short excerpts
# from your website's contents).  Search does not include
# providing AI-generated search summaries.
# ai-input: inputting content into one or more AI models
# (e.g., retrieval augmented generation, grounding, or other
# real-time taking of content for generative AI search
# answers).
# ai-train: training or fine-tuning AI models.

# ANY RESTRICTIONS EXPRESSED VIA CONTENT-SIGNALS ARE EXPRESS
# RESERVATIONS OF RIGHTS UNDER ARTICLE 4 OF THE EUROPEAN
# UNION DIRECTIVE 2019/790 ON COPYRIGHT AND RELATED RIGHTS
# IN THE DIGITAL SINGLE MARKET.`

function buildRobotsTxt(): string {
  const trainingGroup = TRAINING_CRAWLERS.map((ua) => `User-Agent: ${ua}`).join('\n')

  return `${CONTENT_SIGNALS_PREAMBLE}

User-Agent: *
Allow: /
Disallow: /_next/image/
Content-Signal: search=yes, ai-input=yes, ai-train=no

${trainingGroup}
Disallow: /

Sitemap: ${SITE_URL}/sitemap.xml
`
}

export function GET() {
  return new Response(buildRobotsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=14400, must-revalidate',
    },
  })
}
