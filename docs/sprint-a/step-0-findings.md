# Step 0 — Findings to address in Sprint A

This document captures concrete, reproducible breakages discovered during the
three-French-books rendering-validation pass (Step 0 of the multilingual import
plan). Each item below is something Sprint A's design must actively handle, not
something to hand-wave. Verify status before closing each item.

Date of findings: 2026-05-11.
Reference commits: see git log around `add-books-french-validation.ts` and the
`page.tsx` rendering changes that prompted these findings.

---

## 1. `toSlug()` strips Unicode combining marks instead of normalising them

**What is broken.** The current `toSlug()` implementation (duplicated across
`scripts/import-pen.ts:74`, `scripts/import-wikipedia-countries.ts:194`, and
`scripts/import-seed-countries.ts:33`) is:

```ts
function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/['`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

It has no Unicode-normalisation step. Accented characters such as `é`, `á`, `ñ`,
`ü` are not in `[a-z0-9]`, so they collapse to the hyphen-fill, producing slugs
like `juli-n-is-a-mermaid` for the title `Julián Is a Mermaid`.

**Corrupt records in production at time of writing.** A survey of the 1 000
existing books on 2026-05-11 found exactly **one** corrupt slug: book id
referenced as `juli-n-is-a-mermaid` (title `Julián Is a Mermaid`). The other 16
non-ASCII titles in the catalogue have correct slugs because they were authored
by hand in `add-books-batch*.ts` scripts, not generated via `toSlug()`. Any
future bulk-import that calls `toSlug()` will start polluting the table.

**Fix.** Replace every `toSlug()` call site with a single shared helper, e.g.
`src/lib/imports/slugify.ts`:

```ts
export function slugify(s: string): string {
  return s
    .normalize('NFD')                  // decompose accented chars into base + combining mark
    .replace(/[̀-ͯ]/g, '')   // strip combining marks
    .toLowerCase()
    .replace(/['`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

For non-Latin scripts (Cyrillic, Han, Arabic, etc.) NFD does nothing and the
output would be empty. The Sprint A pipeline must therefore slug from
`title_transliterated` (Latin-script romanisation) rather than `title_native`
for non-Latin entries — see also the Model 3 design.

**One-off backfill.** Update the single corrupt slug. Either an `UPDATE books`
statement or a TSX one-off:

```sql
update books set slug = 'julian-is-a-mermaid' where slug = 'juli-n-is-a-mermaid';
```

Verify no inbound links to the old slug from sitemaps or cached pages before
flipping it; if any exist, add a permanent redirect.

**Sprint A acceptance.** Three test cases that must pass for the new helper:

- `slugify('Julián Is a Mermaid')` → `julian-is-a-mermaid`
- `slugify("Éden, Éden, Éden")` → `eden-eden-eden`
- `slugify('Les Misérables')` → `les-miserables`

---

## 2. Wayback Save-Page-Now fails for Cloudflare-protected origins

**What is broken.** Three of the four primary-source URLs in the Step 0
fact-sheet sit behind Cloudflare's JS challenge. Wayback's Save-Page-Now crawler
cannot resolve the challenge and returns HTTP 520 from the save endpoint.
Verified on 2026-05-11:

| URL | Wayback save result |
| --- | --- |
| `https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000874092` (loi 1987) | HTTP 520 |
| `https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000878175` (loi 1949) | HTTP 520 |
| `https://francearchives.gouv.fr/findingaid/...` (Guyotat dossier) | HTTP 302, see finding 4 |
| `https://www.senat.fr/comptes-rendus-seances/4eme/pdf/1958/03/...` | HTTP 302 → 200, snapshot succeeded |

The implication: any future French legislative source, and most modern French
state portals (DGCCRF, Conseil d'État, etc., which all use Cloudflare), cannot
be archived through Wayback alone. This is a hard constraint on the Sprint A
archiving pipeline — not an exotic edge case.

**Attempted fallback.** `archive.today` (archive.ph) is designed to defeat
Cloudflare's challenge by executing the JS in a real browser. From the dev
machine on 2026-05-11, `archive.ph` did not resolve via DNS (`curl` exit 6).
The cause was not investigated; could be temporary, could be ISP-level. Either
way, archive.ph cannot be relied on as a single-point fallback.

**Required Sprint A behaviour.** The archiving function must implement a
chain, not a single endpoint:

```
attempt #1: Wayback Save-Page-Now
  on HTTP 520 / 4xx / 5xx → continue
attempt #2: archive.today /submit/ endpoint
  on network failure or 4xx → continue
attempt #3: leave the source unarchived, but flag the source row with
  archive_status = 'unarchivable' so the admin UI and the public site can
  surface "no independent snapshot available" instead of silently linking
  to a Cloudflare-protected origin.
```

The `ban_sources` row gets an extra column: `archive_url text` and
`archive_status text` (one of `archived`, `unarchivable`, `not_attempted`).

**Editorial implication.** For unarchivable sources, the methodology essay
must explicitly say so. A French ban citation that points only at Légifrance
with no Wayback snapshot is not less credible — but the catalogue should be
honest that the citation is single-origin.

---

## 3. `books.original_language` exists in production but not in `supabase/migrations/`

**What is broken.** The column is referenced by `add-books-batch5.ts:80`,
`add-books-batch42.ts:90`, and is selected by the production runtime path on
the book detail page (after this Step 0 work, at
`src/app/books/[slug]/page.tsx`). Yet `grep "original_language" supabase/`
returns nothing — none of the 24 committed migrations adds the column. It was
added directly in Supabase Studio at some earlier date and committed only via
TypeScript writes against the live schema.

**Why this matters.** When Sprint A adds the Model 3 columns
(`title_native`, `title_native_script`, `title_transliterated`,
`title_english_meaningful`, plus parallel columns on `authors`) in migration
`021_model_3.sql` (or similar), the migration file will be the authoritative
record of how the schema was built. If `original_language` is invisible at
the migration level, anyone re-creating the DB from scratch (CI test
databases, future contributor's local Supabase, disaster recovery) gets a
schema without it, and the runtime queries silently fail with "column does
not exist".

**Fix in Sprint A.** Before adding new Model 3 columns, write a
`020_repair_original_language.sql` that codifies the existing column:

```sql
alter table books add column if not exists original_language text;
-- Existing rows default to English; backfill is a no-op for fresh installs
-- but matches production state for legacy installs.
update books set original_language = 'en' where original_language is null;
```

Run it against production (idempotent — `if not exists`), then commit it. This
brings migration history in line with reality. Only after that should Sprint
A's Model 3 migration land.

**Survey before flagging more drift.** While running the Step 0 schema check,
spot-check a few more columns referenced by TypeScript that may also be
missing from migrations: `description_book`, `description_ban`,
`censorship_context`, `warning_level`, `inclusion_rationale`,
`extended_context`, `bookshop_status`, `bookshop_isbn13`, `ai_drafted`,
`openlibrary_work_id`. Migration `001_initial_schema.sql` only declares
`id`, `title`, `author_id`, `created_at` on `books` — so most of the
column-set was added out-of-band. The repair migration may need to be much
larger than just `original_language`.

**The diagnostic confirmed it on 2026-05-11.** 55 columns across 10 tracked
tables exist in production but not in migrations. 9 entire tables are
undeclared (`affiliate_partners`, `ban_reason_links`, `ban_source_links`,
`book_authors`, `news_items`, `pageviews`, `purchase_links`, `reasons`,
`scopes`). The first repair migration is `020_repair_schema.sql`, written
2026-05-11 — pure-additive (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF
NOT EXISTS`, three-step NOT NULL pattern, slug backfill via the corrected
`app_slugify()` Postgres function).

**Stale relational model in `001_initial_schema.sql`.** Beyond missing
columns, the original schema reflects an *older data model* that production
no longer uses:

- `books.author_id` (single author) → replaced by `book_authors` M:N table
- `bans.country_id` (uuid FK) → replaced by `bans.country_code` (char(2))
- `ban_sources.ban_id` (1:N) → replaced by `ban_source_links` M:N table

These are not just dead columns — they encode an obsolete relational
structure. Sprint A must decide whether `020_repair_schema.sql` is enough
("legacy columns dangle, app ignores them") or whether a full baseline
rewrite is needed. **See finding #7** for the three options; this is the
same architectural question, viewed from a different angle.

---

## 4. FranceArchives URLs are redirect chains, not citation-grade

**What is broken.** The fact-sheet's secondary source for the Guyotat case
was `https://francearchives.gouv.fr/findingaid/...`. When archived via
Wayback Save-Page-Now, it returns HTTP 302 with a `Location:` header that
chains through approximately 32 nested `/redirect_<base32>=====/` segments
before resolving to the underlying findingaid. The eventual archived URL is
buried in that chain and is impractical to cite cleanly.

**Why this is a Sprint A issue.** Many French and Spanish state archives use
this kind of opaque redirect-encoded URL. Other heritage portals (Gallica,
Patrimoine, some Italian and Portuguese state archives) have similar
patterns. The Sprint A archiving pipeline must:

1. **Detect redirect chains.** A source URL that, when fetched with `curl -L`,
   produces three or more 3xx hops, or whose final URL differs substantively
   from the submitted URL, should be flagged.
2. **Either resolve to the canonical end URL and archive that, or reject the
   URL as unsuitable for direct citation.** The canonical-URL approach is
   preferred where the end document is stable; otherwise prefer rejection
   and require the editor to find a more durable citation.
3. **Never store a redirect-encoded URL as the primary citation.** It is
   guaranteed to rot, since the encoding is derived from a session-bound
   internal routing scheme.

**Step 0 disposition.** The FranceArchives URL was dropped from the
`Éden, Éden, Éden` ban-sources insert. Only the Légifrance 1949 law remains
as the cited authority. Once Sprint A's archiving has a redirect-chain
detector, the FranceArchives URL can be re-evaluated against a canonical
end-URL.

---

## 5. Genre vocabulary lives in TypeScript, not in the DB; unknown slugs render raw

**What is broken.** `src/components/genre-badge.tsx` enumerates a fixed
`GENRES` map of seventeen slug → label/colour pairs. Any book row whose
`genres[]` column contains a slug not in that map renders as a grey fallback
badge with the raw kebab-case slug as the label.

**Reproduced on production 2026-05-11.** The three Step 0 imports used
genres reasonable for French ban-list literature: `essay`,
`controversial-non-fiction`, `experimental`, `political-non-fiction`. None
of these are in the GENRES map. Live HTML on
`/books/suicide-mode-demploi`:

```html
<span class="… bg-gray-100 text-gray-600">essay</span>
<span class="… bg-gray-100 text-gray-600">controversial-non-fiction</span>
```

The page does not visually break, but the badges look unfinished.

**Why this is a Sprint A issue.** The `reasons` and `scopes` vocabularies
both live in the DB and were queryable for the LLM extraction module. Genre
is the odd one out — frozen in TypeScript, requiring a code change + deploy
to add. As imports broaden to French / Spanish / Russian / Chinese / Arabic
works, the genre vocabulary needs to grow rapidly (poetry, samizdat,
political pamphlet, religious tract, war memoir, etc.) and waiting on a
deploy per genre is friction that will lead to inconsistent slugging.

**Fix.** One of:

- **Promote genres to a DB table** (`genres(slug, label_en, classes)`) and
  query at runtime, parallel to `reasons` and `scopes`. Preferred — matches
  the existing pattern. Lets future LLM-extraction prompts validate against
  a live vocabulary.
- **Or** keep the TypeScript map but extend it with the missing slugs and
  add a CI check that fails the build if any `books.genres[]` value in
  production isn't in the map.

The first option also enables author-facing admin tooling for genre
curation without a developer in the loop.

**Step 0 disposition.** The three French books stay with their non-standard
genre slugs. Once Sprint A's genre vocabulary is in place, run a one-off
backfill that maps each free-form slug to a canonical one (or adds them to
the new table).

---

## 6. Required Postgres extensions are not declared in migrations

**What is broken.** Production runs with at least two non-default
extensions installed: `vector` (pgvector — used by the news embeddings
pipeline) and `pg_trgm` (trigram similarity — used by the book-search
and reading-club suggesters). Both expose ~70-100 SQL functions that the
schema-drift diagnostic counts as "missing from migrations". Filtering
those extension-functions out leaves zero genuine user-function drift, so
this is not a user-code issue — it's a missing-declaration issue.

The diagnostic on 2026-05-11 saw 148 functions in `public`; only 3 are
user-defined (`admin_db_stats`, `fn_touch_data_changed`,
`refresh_all_materialized_views`) and all 3 are declared. The other 145
all originate from `vector` (`vector_*`, `halfvec_*`, `sparsevec_*`,
`cosine_distance`, `l2_distance`, `inner_product`, `hnsw*`, `ivfflat*`,
`array_to_vector`, etc.) or `pg_trgm` (`similarity*`, `word_similarity*`,
`gtrgm_*`, `gin_*`, `set_limit`, `show_*`).

**Why this matters.** A developer running `pnpm db:reset` against a fresh
Postgres without these extensions will see indexes fail to create,
matviews fail to refresh, and runtime queries on `news_items` or
`book_search` return cryptic "function does not exist" errors. They'll
spend hours not realising that the production DB silently relies on
extensions that no migration installs.

**Fix.** Make `CREATE EXTENSION IF NOT EXISTS ...` the very first
statements of the repair migration:

```sql
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";  -- needed for slug backfill, see finding #1
```

On Supabase, all three are managed extensions and `CREATE EXTENSION IF
NOT EXISTS` is a no-op on production while bootstrapping a fresh dev DB.

**Verification.** After running 020_repair_schema.sql against a fresh
Docker Supabase, the diagnostic should show extension-functions present
(not "missing"). If any are still missing, find the extension that
provides them via:

```sql
SELECT extname FROM pg_extension WHERE oid IN (
  SELECT refobjid FROM pg_depend WHERE objid = '<function_oid>'::regproc
);
```

---

## 7. PK type drift — diagnostic blind spot, blocks fresh dev-DB

**What is broken.** The schema-drift diagnostic
(`scripts/diagnose-schema-drift.ts`) checks column *existence by name*, not
column *types*. While running it on 2026-05-11 a deeper drift surfaced
that the diagnostic does **not** detect:

| Table          | Declared in `001`                       | Production                              |
| -------------- | --------------------------------------- | --------------------------------------- |
| `books.id`     | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | `bigint GENERATED ALWAYS AS IDENTITY`   |
| `authors.id`   | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | `bigint GENERATED ALWAYS AS IDENTITY`   |
| `bans.id`      | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | `bigint GENERATED ALWAYS AS IDENTITY`   |
| `ban_sources.id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | `bigint GENERATED ALWAYS AS IDENTITY`  |

Confirmed via `information_schema.columns` query: all four tables now use
`bigint identity` PKs. The application code throughout (`add-books-*.ts`,
the book detail page, the join queries) treats these as `number`.

**The consequence.** A developer who runs `001` through `020` against a
fresh Postgres gets a database where `books.id` is `uuid` while the app
expects `number`. The app crashes at the first insert or join. `pnpm
db:reset` does not produce a working dev-DB.

**Why `020` does not fix this.** Per Sprint A doctrine, `020` is
pure-additive (`ADD COLUMN IF NOT EXISTS`, no destruction). `ALTER COLUMN
TYPE` is destructive (cast may fail, FKs cascade, sequences need
re-creation). Putting it in `020` would violate the additive-only rule.

**Sprint A must pick one of three resolutions.** They differ in cost,
risk, and what they leave behind.

**Option A — Accept, document, move on.**
Status quo: `001 + 020` produce a dev-DB with `uuid` PKs that the app
cannot use. Solo development continues to work because the only "dev DB"
is the live production one accessed through Supabase Studio. `pnpm
db:reset` remains aspirational.
- Cost: zero.
- Risk: the next contributor onboarding, or future-you returning after a
  break, debugs migrations for hours before realising the baseline is
  broken.
- Leaves: the legacy uuid columns dangling on every fresh DB forever.

**Option B — Targeted `021_pk_type_migration.sql`.**
Destructive migration that runs `ALTER COLUMN id TYPE bigint USING
nextval('...')` plus identity re-establishment on the four tables. Each
step must drop and recreate dependent FKs, indexes, and any RLS policies
referencing the column. Roughly 80-150 lines of careful SQL with `DO`
blocks to handle production-vs-fresh-DB differences (on production the
columns are already `bigint`; the migration is a no-op via conditional
checks).
- Cost: ~half a day to write, ~half a day to verify against Docker
  Supabase.
- Risk: medium. Production no-op is conditional on the existence checks
  being correct. One missed detail and prod DDL fires.
- Leaves: `001-019` intact in history, `020` additive-only, `021` does
  the destructive type fix. Clean separation.

**Option C — `001_baseline_v2.sql` snapshot.**
Replace `001_initial_schema.sql` and most of `002-019` with a single
hand-curated SQL file that captures the current production state
verbatim: tables, columns, PKs, FKs, indexes, constraints, RLS policies,
triggers, sequences, MV definitions, function definitions. Archive
`001-019` under `supabase/migrations/_archive/` for historical
provenance. `020` and onwards live on top of the new baseline.
- Cost: 1-3 days. The 1-2 day estimate assumes a clean `pg_dump`
  produces a usable starting point. The longer end accounts for: RLS
  policy audit, trigger audit, index review, MV definition checks, and
  testing that `001_baseline_v2 + 020` against Docker produces zero drift
  in the diagnostic.
- Risk: low-medium. The risk is mostly in the audit completeness:
  anything the diagnostic doesn't yet check (indexes, RLS, triggers)
  could go missing in the baseline. Mitigations: extend the diagnostic
  to cover these before writing baseline_v2.
- Leaves: a clean, working migration history. `pnpm db:reset` produces a
  dev-DB that mirrors production. Sprint A iterates safely against fresh
  dev DBs.

**Cross-reference.** This is the same architectural question as the
stale-relational-model paragraph at the end of finding #3. Both ask:
"How much of the existing migration history reflects reality?" The
answer for finding #3 alone (legacy columns dangle) is acceptable. The
answer for finding #7 alone (PK types differ) is not — it breaks the
app. So choosing C resolves both; A resolves neither; B resolves only
#7 and leaves #3's columns dangling.

---

## What is explicitly NOT in this document

- **Cover-detection problems for non-English titles.** No actual breakage
  observed in Step 0 — Open Library found at least one cover for two of the
  three French books. A real-world non-Latin script test (Russian, Chinese,
  Arabic) is still ahead in Sprint A and will surface its own findings.
- **JSON-LD `alternateName`.** Not relevant to Step 0 because Latin-script
  Latin-language titles don't need both native and transliterated forms.
  This becomes a Sprint A topic when the first Cyrillic / Han / Arabic book
  is rendered.
- **Methodology-essay updates for French ban-law specifics.** Drafted in the
  fact-sheet but deferred to a dedicated essay task. The `La Question`
  saisie-vs-formal-ban distinction is the most important methodology point
  to capture.
