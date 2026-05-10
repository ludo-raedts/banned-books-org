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
      className="mt-10 mb-10 border-t border-gray-200 dark:border-gray-800 pt-6"
    >
      <h2
        id="cite-this-page"
        className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3"
      >
        Cite this page
      </h2>
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 divide-y divide-gray-200 dark:divide-gray-800">
        {CITATION_FORMATS.map((fmt, idx) => {
          const text = formatCitation({ entityType, entity, url, accessedAt }, fmt.id)
          return (
            <details
              key={fmt.id}
              {...(idx === 0 ? { open: true } : {})}
              className="group"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3 select-none">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {fmt.label}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 group-open:hidden">
                  Show
                </span>
                <span className="hidden text-[11px] text-gray-400 dark:text-gray-500 group-open:inline">
                  Hide
                </span>
              </summary>
              <div className="px-4 pb-4 -mt-1 flex flex-col gap-2">
                <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-700 dark:text-gray-300 font-sans">
                  {text}
                </pre>
                <div>
                  <CitationCopyButton text={text} label={fmt.label} />
                </div>
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
