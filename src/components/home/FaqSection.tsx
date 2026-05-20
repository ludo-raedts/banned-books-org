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

export default function FaqSection({ items }: { items: FaqItem[] }) {
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
    <SectionShell tone="white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldHtml }} />
      <Eyebrow>Questions readers ask</Eyebrow>
      <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 mb-6 pb-3 border-b border-black/80 dark:border-gray-200">
        Frequently asked.
      </h2>
      <div className="divide-y divide-neutral-200 dark:divide-gray-800">
        {items.map((item, i) => (
          <details key={i} className="group">
            <summary className="hover-faq-row flex items-center justify-between gap-4 px-4 md:px-5 py-4 list-none select-none font-serif text-base md:text-lg font-medium text-gray-900 dark:text-gray-50">
              <span>{item.q}</span>
              <span className="faq-chev shrink-0 text-neutral-500 group-open:rotate-90 text-base">
                ›
              </span>
            </summary>
            <div className="px-4 md:px-5 pb-5 text-sm leading-relaxed text-neutral-700 dark:text-gray-300 max-w-[600px]">
              {renderAnswer(item.a)}
            </div>
          </details>
        ))}
      </div>
    </SectionShell>
  )
}
