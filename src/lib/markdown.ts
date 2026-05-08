// Markdown rendering for editorial content blocks.
//
// Pipeline: marked → sanitize-html. Allowed tags map exactly to the spec
// (headings, paragraphs, links, lists, blockquotes, emphasis). No raw HTML in
// source, no images, no tables — markdown that produces a disallowed tag has
// that tag stripped on the way out.
//
// renderContentBlockHtml() is invoked at *save* time (in the admin write path)
// so that public reads serve precomputed body_html and never run the markdown
// pipeline at request time. See lib/content-blocks.ts.

import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  // Headings start at h2: a content block is always rendered inside a page
  // that already has its own h1 (and often an h2 section heading).
  allowedTags: [
    'h2', 'h3', 'h4',
    'p', 'br', 'hr',
    'a',
    'ul', 'ol', 'li',
    'blockquote',
    'strong', 'em', 'b', 'i', 'code',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel', 'target'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  // Force safe rel attrs on all links. We don't auto-set target="_blank":
  // the editor opts in by writing it in markdown.
  transformTags: {
    a: (tagName, attribs) => {
      const rel = new Set((attribs.rel ?? '').split(/\s+/).filter(Boolean))
      rel.add('noopener')
      rel.add('noreferrer')
      return {
        tagName: 'a',
        attribs: {
          ...attribs,
          rel: Array.from(rel).join(' '),
        },
      }
    },
  },
}

marked.setOptions({
  gfm: true,
  breaks: false,
})

// Render markdown → sanitized HTML. Synchronous (marked.parse can return a
// Promise when async extensions are configured; we don't use any).
export function renderContentBlockHtml(markdown: string): string {
  if (!markdown.trim()) return ''
  const rawHtml = marked.parse(markdown, { async: false }) as string
  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS)
}
