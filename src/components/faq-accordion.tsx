// Single-source FAQ block: renders a native <details>/<summary> accordion
// AND emits a Schema.org FAQPage JSON-LD payload from the same items, so
// the visible HTML and the structured data never drift apart. Native
// <details> = no JS needed, content stays in DOM (crawlable, accessible).
//
// Answers use a markdown-lite syntax for inline links — [label](url) — so
// editorial text remains plain strings while the rendered output gets real
// <a>/<Link> elements. JSON-LD strips the markdown so search engines see
// the bare answer text.

import Link from 'next/link'
import { Fragment } from 'react'

export type FaqItem = { q: string; a: string }

function renderAnswer(text: string): React.ReactNode {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (!m) return <Fragment key={i}>{part}</Fragment>
    const label = m[1]
    const href = m[2]
    const isExternal = /^https?:\/\//.test(href)
    if (isExternal) {
      return (
        <a
          key={i}
          href={href}
          className="text-brand hover:underline"
          target="_blank"
          rel="noopener"
        >
          {label}
        </a>
      )
    }
    return (
      <Link key={i} href={href} className="text-brand hover:underline">
        {label}
      </Link>
    )
  })
}

function stripMarkdown(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
}

export default function FaqAccordion({
  title = 'Frequently asked questions',
  subtitle,
  items,
  defaultOpenCount = 0,
}: {
  title?: string
  subtitle?: string
  items: FaqItem[]
  // Number of items rendered with the `open` attribute. Keeps the first N
  // items expanded by default so the section doesn't look empty when the
  // user lands on it; the rest collapse to save vertical space.
  defaultOpenCount?: number
}) {
  if (items.length === 0) return null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: stripMarkdown(item.a),
      },
    })),
  }
  const ldHtml = JSON.stringify(jsonLd).replace(/</g, '\\u003c')

  return (
    <section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldHtml }} />
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-200 bg-white">
        {items.map((item, i) => (
          <details key={i} open={i < defaultOpenCount} className="group">
            <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer select-none list-none font-medium text-sm text-gray-900 hover:bg-gray-50 transition-colors">
              {item.q}
              <span className="shrink-0 text-gray-400 group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">
              {renderAnswer(item.a)}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
