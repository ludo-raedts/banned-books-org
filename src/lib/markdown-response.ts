// Helpers for serving `.md` versions of long-form prose pages.
//
// The HTML pages live in /methodology, /history, /essays/<slug>, etc. The .md
// twins exist so an LLM crawler can grab clean markdown without parsing JSX
// or stripping nav chrome. JSON-LD already handles structured citation for
// book / author pages, so this is intentionally limited to editorial prose.

export type MarkdownFrontmatter = {
  title: string
  url: string
  description: string
  published_at?: string
  updated_at?: string
}

function quoteYaml(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function buildMarkdownDocument(
  frontmatter: MarkdownFrontmatter,
  body: string,
): string {
  const lines: string[] = ['---']
  // Emit fields in a deterministic, human-friendly order rather than insertion
  // order so the frontmatter is stable across regenerations.
  const order: (keyof MarkdownFrontmatter)[] = [
    'title',
    'url',
    'description',
    'published_at',
    'updated_at',
  ]
  for (const key of order) {
    const value = frontmatter[key]
    if (value === undefined) continue
    lines.push(`${key}: ${quoteYaml(value)}`)
  }
  lines.push('---', '', body.trim(), '')
  return lines.join('\n')
}

export function markdownResponse(doc: string): Response {
  return new Response(doc, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
