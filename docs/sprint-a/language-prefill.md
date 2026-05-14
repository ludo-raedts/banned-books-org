# Review-form `original_language` pre-fill (Sprint A taak 4, partial)

Shipped 2026-05-14. Editors no longer type the ISO-639-1 code for every
non-Latin queue row — the form arrives with it filled in, derived
deterministically from the title text plus the source country.

## What changed

1. **New module** `src/lib/imports/language-inference.ts`. Pure functions,
   no DB / no LLM:
   - `detectScript(text)` — Unicode-block detector. Returns one of `latin`,
     `cyrillic`, `han`, `hiragana`, `katakana`, `hangul`, `arabic`, `hebrew`,
     `devanagari`, `bengali`, `gurmukhi`, `gujarati`, `oriya`, `tamil`,
     `telugu`, `kannada`, `malayalam`, `sinhala`, `thai`, `lao`, `khmer`,
     `myanmar`, `tibetan`, `georgian`, `armenian`, `greek`, `ethiopic`,
     or `mixed` / `null`. Non-Latin presence dominates Latin; Japanese is
     disambiguated from Chinese by kana presence.
   - `inferLanguage(script, countryCode, state)` — maps to ISO-639-1.
     Unambiguous scripts (Tamil → ta, Hangul → ko, Hebrew → he, …) ignore
     country. Ambiguous ones use country as a tiebreaker:
     - Cyrillic: `RU→ru` `UA→uk` `BY→be` `BG→bg` `RS→sr` `MK→mk` `KZ→kk`
       `KG→ky` `MN→mn` `TJ→tg` `MD→ro`; default `ru`.
     - Arabic: `IR/AF/TJ→fa` `PK/IN→ur`; default `ar`.
     - Han: `CN/HK/TW/SG/MO/MY→zh`; default `zh`.
     - Devanagari: `NP→ne`; Indian state `Maharashtra`/`Marathi` → `mr`;
       default `hi`.
     - Bengali: Indian state `Assam`/`Assamese` → `as`; default `bn`.
   - `inferScriptAndLanguage(titleNative, country, state)` — convenience
     wrapper, used by the review page.
   - 29 unit tests in `src/lib/imports/__tests__/language-inference.test.ts`.

2. **Review detail page wiring** (`src/app/admin/import-review/[id]/page.tsx`).
   On every page load: resolve the source country via the existing
   `getQueueSourceContext()`, run `inferScriptAndLanguage()` on
   `parsed.title_native` + `parsed.state`, and pass the result through
   `DetailViewData.language_suggestion`. Wrapped in `try/catch` because
   `getQueueSourceContext()` throws when a queue row has neither a
   resolvable source-config nor stored `agreement_details.source_context` —
   those rows fall back to the empty-input behaviour we had before.

3. **Form seeding** (`src/app/admin/import-review/[id]/detail-client.tsx`).
   The `originalLanguage` useState initialiser reads
   `data.language_suggestion?.language ?? ''`. The hint under the field
   becomes
   `"ISO 639-1 two-letter code. Auto-filled from {script} + source country — overwrite if wrong."`
   when a suggestion is present, so editors immediately see this is a
   suggestion (not a hard value) and that the source country was the
   tiebreaker.

4. **Backfill `scripts/backfill-language-inference.ts`**. Five-category
   plan, ID-ordered pagination per the supabase-pagination memory rule.
   Categories:
   - **A**: `title_native` is non-Latin but `title_native_script` is NULL
     or wrong → set the detected script.
   - **B**: `title_native` NULL but `title` itself contains non-Latin
     chars → copy `title` → `title_native` + tag script.
   - **C**: `original_language` NULL with a detectable non-Latin script →
     infer from `(script, first-ban country)`.
   - **E**: `original_language` is a known Latin-script language and
     `title_native` is NULL → copy `title` → `title_native` only when the
     title contains a non-ASCII Latin diacritic (the safety filter; see
     "what's left" below).

   Dry-run by default; `--apply` to write; `--only=A,C,E` to filter.

## Backfill result (applied 2026-05-14)

Scanned 4720 books, 4719 with a country lookup.

| Category | Updated | Examples |
| --- | --- | --- |
| A | 1 | `[6325]` *Meendezhum Pandiyar Varalaru* → `title_native_script=tamil` |
| B | 0 | — (already covered by prior migrations) |
| C | 0 | All 240 books with NULL `original_language` have Latin-script titles |
| E | 12 | `Noli Me Tángere` (es), `El Señor Presidente` (es), `Gaibéus` (pt), `Até amanhã, camaradas` (pt), `Autobiografía de Federico Sánchez` (es), … |
| **total** | **13** | |

## What's still left (out of scope for this change)

`scripts/_inspect_residual.ts` shows 332 books with `title_native = NULL`,
broken down by `original_language`:

- **Latin-script languages without diacritics in the English-translation
  `title`** (the bulk of the 35 de + 17 pt + 14 it + 10 cs + 7 pl + 5 hu +
  etc. that the safety filter skipped). Example: `[58]` *The Trial* is
  tagged `de`, but Kafka's actual title is *Der Process*. The safety
  filter correctly refuses to write `title_native = "The Trial"`. Fix
  requires editorial work (curator decides the real native title) or an
  LLM round-trip — neither is deterministic.
- **Non-Latin-script languages** (zh=43, ru=28, ar=24, fa=12, ko=8, ja=5,
  he=4, …). The `title` is typically the Latin transliteration; we can't
  reconstruct the native script from it without an LLM or the source
  document.

These remain Sprint A taak 4 work; this change closes the editor-typing
side of the problem (queue pre-fill) and the easy slice of the backfill.

## What auto-approve does NOT change

The Sprint-0.5 review-gate doctrine is unchanged:
non-Latin title-translation partials still never auto-accept; the
cold-start gate per source still applies. The form arrives with a
suggested value but the editor must still click *Approve & commit* to
write it.

## Test commands

```sh
# unit tests
pnpm test src/lib/imports/__tests__/language-inference.test.ts

# backfill dry-run
pnpm tsx --env-file=.env.local scripts/backfill-language-inference.ts

# backfill apply
pnpm tsx --env-file=.env.local scripts/backfill-language-inference.ts --apply
```
