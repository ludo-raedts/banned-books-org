import { zenodoCitations, ZENODO_DOI_URL, ZENODO_CONCEPT_DOI } from '@/lib/zenodo'
import CitationCopyButton from './citation-copy-button'

/**
 * Copy-paste-friendly academic citation for the open Zenodo dataset (APA / MLA /
 * BibTeX). Mirrors CitationBlock's <details> + copy-button UI for consistency,
 * but is DOI-based rather than page-based. Renders nothing until a concept DOI
 * is set in src/lib/zenodo.ts.
 */
export default function ZenodoCitation({ heading = 'Cite this dataset' }: { heading?: string }) {
  const citations = zenodoCitations()
  if (!citations || !ZENODO_DOI_URL) return null

  return (
    <section aria-labelledby="cite-dataset" className="not-prose">
      <h3
        id="cite-dataset"
        className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3"
      >
        {heading}
      </h3>
      <p className="text-sm text-gray-600 mb-3 leading-relaxed">
        The open dataset is archived on Zenodo under CC-BY-4.0. Cite the concept DOI{' '}
        <a
          href={ZENODO_DOI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-oxblood font-medium hover:underline"
        >
          {ZENODO_CONCEPT_DOI}
        </a>{' '}
        — it always resolves to the latest version.
      </p>
      <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-200">
        {citations.map((c, idx) => (
          <details key={c.id} {...(idx === 0 ? { open: true } : {})} className="group">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3 select-none">
              <span className="text-sm font-semibold text-gray-800">{c.label}</span>
              <span className="flex items-center gap-3">
                <CitationCopyButton text={c.text} label={`${c.label} dataset`} />
                <span className="text-[11px] text-gray-400 group-open:hidden">Show</span>
                <span className="hidden text-[11px] text-gray-400 group-open:inline">Hide</span>
              </span>
            </summary>
            <div className="px-4 pb-4 -mt-1">
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-700 font-sans">
                {c.text}
              </pre>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
