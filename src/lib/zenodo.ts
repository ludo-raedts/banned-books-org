/**
 * Zenodo open-dataset deposit.
 *
 * The open, CC-BY-4.0 core of the catalogue (built by
 * `scripts/build-zenodo-dataset.ts`, described by `docs/zenodo/data-descriptor.md`)
 * is deposited on Zenodo as a citeable research artifact with a DOI.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ TODO(zenodo): after the FIRST publish, paste the *concept* DOI below.     │
 * │ The concept DOI is version-independent — it always resolves to the latest │
 * │ version (e.g. '10.5281/zenodo.1234567'), as opposed to a per-version DOI. │
 * │ Until it is set, every consumer below renders NOTHING — no DOI link, no   │
 * │ JSON-LD identifier — so the site never claims a citeable version is live  │
 * │ before it actually is.                                                    │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export const ZENODO_CONCEPT_DOI: string | null = null

/** Resolvable DOI URL, or null while the DOI is still a placeholder. */
export const ZENODO_DOI_URL: string | null = ZENODO_CONCEPT_DOI
  ? `https://doi.org/${ZENODO_CONCEPT_DOI}`
  : null
