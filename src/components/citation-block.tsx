import {
  CITATION_FORMATS,
  formatCitation,
  type CitationEntity,
  type EntityType,
} from '@/lib/citations'
import CitationCopyButton from './citation-copy-button'

type Props = {
  entityType: EntityType
  entity: CitationEntity
  url: string
}

export default function CitationBlock({ entityType, entity, url }: Props) {
  const accessedAt = new Date()

  // The first <details> opens by default so APA is visible without JS.
  return (
    <section
      aria-labelledby="cite-this-page"
      className="mt-10 mb-10 border-t border-gray-200 pt-6"
    >
      <h2
        id="cite-this-page"
        className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3"
      >
        Cite this page
      </h2>
      <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-200">
        {CITATION_FORMATS.map((fmt, idx) => {
          const text = formatCitation({ entityType, entity, url, accessedAt }, fmt.id)
          return (
            <details
              key={fmt.id}
              {...(idx === 0 ? { open: true } : {})}
              className="group"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3 select-none">
                <span className="text-sm font-semibold text-gray-800">
                  {fmt.label}
                </span>
                <span className="flex items-center gap-3">
                  <CitationCopyButton text={text} label={fmt.label} />
                  <span className="text-[11px] text-gray-400 group-open:hidden">
                    Show
                  </span>
                  <span className="hidden text-[11px] text-gray-400 group-open:inline">
                    Hide
                  </span>
                </span>
              </summary>
              <div className="px-4 pb-4 -mt-1">
                <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-700 font-sans">
                  {text}
                </pre>
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
