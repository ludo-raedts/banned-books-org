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
    version: '1.0',
    date: '2026-06-02',
    doi: '10.5281/zenodo.20511554',
    summary:
      'Initial public release: the verifiable censorship core — every published ban with at least one source citation, plus the reason taxonomy, country dimensions, and author records — as CSV under CC-BY-4.0.',
  },
]
