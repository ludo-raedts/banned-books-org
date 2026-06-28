// Source of truth for which HTML pages have a `.md` twin, plus the Accept-based
// content negotiation that serves that twin at the *same* URL.
//
// The HTML pages live at e.g. /about and /essays/the-grey-zone; the markdown
// twins at /about.md and /essays/the-grey-zone.md. An agent that GETs the HTML
// URL with `Accept: text/markdown` is rewritten to the twin by the middleware,
// so it never has to know the `.md` naming convention. The homepage maps to
// /llms.txt, which is the curated markdown entry point for the whole site.
//
// IMPORTANT: keep these keys in sync with the `matcher` in src/middleware.ts.
// Next.js requires the matcher to be a static literal, so it cannot import this
// map — any path added here must also be added there, or negotiation silently
// won't run for it.

export const MARKDOWN_TWINS: Record<string, string> = {
  '/': '/llms.txt',
  '/about': '/about.md',
  '/data-quality': '/data-quality.md',
  '/history': '/history.md',
  '/methodology': '/methodology.md',
  '/why-not-amazon': '/why-not-amazon.md',
  '/essays/first-amendment-paradox': '/essays/first-amendment-paradox.md',
  '/essays/forbidden-knowledge-iceberg': '/essays/forbidden-knowledge-iceberg.md',
  '/essays/in-whose-name': '/essays/in-whose-name.md',
  '/essays/the-grey-zone': '/essays/the-grey-zone.md',
  '/essays/what-we-document': '/essays/what-we-document.md',
  '/essays/who-hates-beetles': '/essays/who-hates-beetles.md',
}

// True when the client's Accept header expresses a preference for markdown that
// is at least as strong as its preference for HTML. Browsers send
// `text/html,...` (and never `text/markdown`), so they always fall through to
// the HTML page; only clients that explicitly ask for `text/markdown` get the
// twin. Wildcards (`*/*`) deliberately do not count as wanting markdown.
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false
  const md = mediaQuality(accept, 'text/markdown')
  if (md <= 0) return false
  const html = mediaQuality(accept, 'text/html')
  return md >= html
}

// The q-value (0..1) an Accept header assigns to an exact media type, or 0 if
// it isn't listed. A media type with no explicit `q=` defaults to 1.
function mediaQuality(accept: string, type: string): number {
  for (const part of accept.split(',')) {
    const [media, ...params] = part.trim().split(';')
    if (media.trim().toLowerCase() !== type) continue
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
    if (!q) return 1
    const value = Number.parseFloat(q.slice(2))
    return Number.isFinite(value) ? value : 1
  }
  return 0
}
