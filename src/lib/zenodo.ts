/**
 * Zenodo open-dataset deposit.
 *
 * The open, CC-BY-4.0 core of the catalogue (built by
 * `scripts/build-zenodo-dataset.ts`, described by `docs/zenodo/data-descriptor.md`)
 * is deposited on Zenodo as a citeable research artifact with a DOI.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ This is the *concept* DOI — version-independent, always resolves to the   │
 * │ latest version (the Zenodo "Cite all versions" DOI), NOT the per-version  │
 * │ DOI (…554) which pins to v1. Stored as the BARE DOI; ZENODO_DOI_URL below │
 * │ derives the resolvable https://doi.org/… form that the consumers use.     │
 * │ When null, every consumer renders NOTHING (no DOI link, no JSON-LD        │
 * │ identifier), so the site never claims a citeable version before there is  │
 * │ one.                                                                       │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export const ZENODO_CONCEPT_DOI: string | null = '10.5281/zenodo.20511553'

/** Resolvable DOI URL, or null while the DOI is still a placeholder. */
export const ZENODO_DOI_URL: string | null = ZENODO_CONCEPT_DOI
  ? `https://doi.org/${ZENODO_CONCEPT_DOI}`
  : null

/**
 * Published release history of the open dataset — the single source for the
 * changelog rendered on /dataset. Newest first. Each release is its own Zenodo
 * version with a version-specific DOI (distinct from the always-latest concept
 * DOI above). Append a new entry here when build-zenodo-dataset.ts output is
 * deposited as a new version; do not edit past entries.
 */
export type ZenodoVersion = {
  version: string
  /** ISO date the version was published on Zenodo. */
  date: string
  /** Version-specific DOI (pins this exact snapshot), bare form. */
  doi: string
  /** What this release added or changed, in one or two plain sentences. */
  summary: string
}

export const ZENODO_VERSIONS: ZenodoVersion[] = [
  {
    version: '2026-06-06',
    date: '2026-06-06',
    doi: '10.5281/zenodo.20569551',
    summary:
      'Refreshed open core: ~14,400 books, ~29,060 ban events, ~29,300 source citations (+~325 bans and +~460 citations vs. the initial release). Descriptor coverage figures and verification distribution updated.',
  },
  {
    version: '1.0',
    date: '2026-06-02',
    doi: '10.5281/zenodo.20511554',
    summary:
      'Initial public release: the verifiable censorship core — every published ban with at least one source citation, plus the reason taxonomy, country dimensions, and author records — as CSV under CC-BY-4.0.',
  },
]

// ─── Academic citation ─────────────────────────────────────────────────────
// Always cite the CONCEPT DOI (resolves to the latest version), never a
// per-version DOI. Single source for the citation strings rendered site-wide.
export const ZENODO_DATASET_TITLE = 'Banned Books — Open Censorship Core'
export const ZENODO_FIRST_PUBLISHED_YEAR = 2026
export const ZENODO_ORCID_URL = 'https://orcid.org/0009-0006-8358-7119'

export type ZenodoCitationFormat = { id: 'apa' | 'mla' | 'bibtex'; label: string; text: string }

/**
 * APA, MLA, and BibTeX citation strings for the open dataset, built from the
 * concept DOI. Returns null while no DOI is set, so every consumer renders
 * nothing until the deposit is live.
 */
export function zenodoCitations(): ZenodoCitationFormat[] | null {
  if (!ZENODO_CONCEPT_DOI || !ZENODO_DOI_URL) return null
  const y = ZENODO_FIRST_PUBLISHED_YEAR
  const t = ZENODO_DATASET_TITLE
  const url = ZENODO_DOI_URL
  return [
    // Full given name (not the strict-APA "Raedts, L.") to match the Zenodo
    // creator field and ORCID published name across the site.
    { id: 'apa', label: 'APA', text: `Raedts, Ludo. (${y}). ${t} [Data set]. Zenodo. ${url}` },
    { id: 'mla', label: 'MLA', text: `Raedts, Ludo. ${t}. Zenodo, ${y}, ${url}.` },
    {
      id: 'bibtex',
      label: 'BibTeX',
      text: `@dataset{raedts_${y}_banned_books,
  author    = {Raedts, Ludo},
  title     = {${t}},
  year      = {${y}},
  publisher = {Zenodo},
  doi       = {${ZENODO_CONCEPT_DOI}},
  url       = {${url}}
}`,
    },
  ]
}
