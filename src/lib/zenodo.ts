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
