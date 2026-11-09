'use client'

import { useState } from 'react'
import { track } from '@vercel/analytics'
import {
  CITATION_FORMATS,
  formatCitation,
  type CitationEntity,
  type CitationFormat,
  type EntityType,
} from '@/lib/citations'
import CitationCopyButton from './citation-copy-button'

type Props = {
  entityType: EntityType
  entity: CitationEntity
  url: string
}

// One collapsed row at the foot of detail pages. Citation strings are built
// client-side (on open / on copy) so the "Retrieved <date>" is the reader's
// real access date, not the ISR render date — and the templated text stays
// out of the server HTML on ~16k pages. Scholar/Zotero read the
// citation_* meta tags (src/lib/citation-meta.ts), not this block.
export default function CitationBlock({ entityType, entity, url }: Props) {
  const [openedAt, setOpenedAt] = useState<Date | null>(null)

  const cite = (format: CitationFormat, at = new Date()) =>
    formatCitation({ entityType, entity, url, accessedAt: at }, format)
  const onCopy = (format: CitationFormat) => () =>
    track('Citation Copy', { format, entityType, slug: entity.slug })

  return (
    <section aria-label="Cite this page" className="mt-10 mb-10 border-t border-gray-200 pt-4">
      <details
        className="group"
        onToggle={e => {
          if ((e.currentTarget as HTMLDetailsElement).open) setOpenedAt(new Date())
        }}
      >
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3 py-1 select-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
              fill="currentColor"
            >
              <path d="M7 5l6 5-6 5V5z" />
            </svg>
            Cite this page
            <span className="font-normal normal-case tracking-normal text-gray-400">
              APA · MLA · Chicago
            </span>
          </span>
          <CitationCopyButton text={() => cite('apa')} label="APA" onCopy={onCopy('apa')}>
            Copy APA
          </CitationCopyButton>
        </summary>
        {openedAt && (
          <dl className="mt-3 space-y-3 text-xs">
            {CITATION_FORMATS.map(fmt => (
              <div key={fmt.id} className="flex items-start gap-3">
                <dt className="w-14 shrink-0 pt-0.5 font-semibold text-gray-700">{fmt.label}</dt>
                <dd className="flex-1 min-w-0 leading-relaxed text-gray-600 break-words">
                  {cite(fmt.id, openedAt)}
                </dd>
                <dd className="shrink-0">
                  <CitationCopyButton
                    text={() => cite(fmt.id)}
                    label={fmt.label}
                    onCopy={onCopy(fmt.id)}
                  />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </details>
    </section>
  )
}
