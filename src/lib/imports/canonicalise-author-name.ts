// Strip trailing academic / honorific credentials from a raw author
// display_name so "Geoffrey Lowndes" and "Geoffrey Lowndes P.H.D" produce
// the same canonical form. Without this step the slug-uniqueness check at
// upsert time silently accepts both as different authors and the bio
// enrichment script then matches them to the same Wikipedia page —
// breaking the data twice.
//
// Incident reference: 2026-05-27. The Malaysian KDN gazette import created
// 14 credential-suffix duplicate groups (incl. Lowndes). Retroactive
// cleanup lives in scripts/merge-credential-suffix-authors.ts; this helper
// stops new ones being created.
//
// Conservative on the credential pattern: dots are REQUIRED for 1-2-letter
// degrees (M.A. not "Ma", M.D. not "Md") because those collide with
// Chinese/Malay surname fragments. Parens are NOT stripped here — that
// would collapse "Ye" and "Ye (Editor)" which are usually different
// people; cluster-by-pen-name is left for one-off manual review.

const CREDENTIALS: RegExp[] = [
  /\bp\.?h\.?d\.?$/i,                        // P.H.D, Ph.D, PhD, P.H.D.
  /\bd\.?phil\.?$/i,                         // D.Phil
  /\bm\.d\.?$/i,                             // M.D. — dot required
  /\bm\.a\.?$/i,                             // M.A. — dot required
  /\bb\.a\.?$/i,                             // B.A. — dot required
  /\b(b|m)\.sc\.?$/i,                        // B.Sc / M.Sc
  /\bj\.p\.?$/i,                             // J.P.
  /\besq\.?$/i,
  /\b(jr|sr)\.?$/i,
  /\b(dr|prof|professor)\.$/i,               // dr. / prof. with dot
  /\b(hj\.|haji|hajjah|ust\.|ustaz|ustadz)$/i,
  /\b(dato'?|datin'?|tan sri|puan sri)$/i,
]

export function canonicaliseAuthorName(raw: string): string {
  let out = raw.trim()
  // Strip repeatedly so chained credentials ("Dr. X M.A. Ph.D") all peel off.
  for (let i = 0; i < 4; i++) {
    let changed = false
    for (const re of CREDENTIALS) {
      const stripped = out.replace(re, '').trim()
      if (stripped !== out) { out = stripped; changed = true }
    }
    if (!changed) break
  }
  // Drop dangling trailing comma / period left after stripping.
  out = out.replace(/[,.]+\s*$/, '').trim()
  return out
}
