import Link from 'next/link'
import { Fragment } from 'react'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'
import type { FaqItem } from '@/components/faq-accordion'

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
          className="text-oxblood hover:underline"
          target="_blank"
          rel="noopener"
        >
          {label}
        </a>
      )
    }
    return (
      <Link key={i} href={href} className="text-oxblood hover:underline">
        {label}
      </Link>
    )
  })
}

function stripMarkdown(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
}

export default function FaqSection({
  items,
  // Optional overrides so the same component renders both the homepage FAQ
  // and per-page FAQs (countries, scopes, reasons) with the same visual
  // language while still letting each page set its own context line.
  eyebrow = 'Questions readers ask',
  title = 'Frequently asked.',
  tone = 'white',
}: {
  items: FaqItem[]
  eyebrow?: string
  title?: string
  tone?: 'white' | 'cream'
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
    <SectionShell tone={tone}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldHtml }} />
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-black/80">
        {title}
      </h2>
      <div className="divide-y divide-neutral-200">
        {items.map((item, i) => (
          <details key={i} className="group">
            <summary className="hover-faq-row flex items-center justify-between gap-4 px-4 md:px-5 py-4 list-none select-none font-serif text-base md:text-lg font-medium text-gray-900">
              <span>{item.q}</span>
              <span className="faq-chev shrink-0 text-neutral-500 group-open:rotate-90 text-base">
                ›
              </span>
            </summary>
            <div className="px-4 md:px-5 pb-5 text-sm leading-relaxed text-neutral-700 max-w-[600px]">
              {renderAnswer(item.a)}
            </div>
          </details>
        ))}
      </div>
    </SectionShell>
  )
}
