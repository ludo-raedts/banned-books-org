-- Sprint A — slug normalization
--
-- Two changes, both prerequisites for the upcoming French-books import:
--
-- 1. Install Postgres `unaccent` extension.
--    Lets server-side queries do diacritic-insensitive matching (e.g. for
--    fuzzy lookups by title/author during the LLM extraction pass) without
--    each caller reimplementing NFD-strip in SQL. Pairs with the new
--    `src/lib/imports/slugify.ts` helper which does the equivalent in JS.
--
-- 2. Repair the one corrupt production slug surfaced by Step 0 — book id
--    referenced as `juli-n-is-a-mermaid`, title `Julián Is a Mermaid`.
--    See docs/sprint-a/step-0-findings.md §1.
--
-- Other slug discrepancies discovered by scripts/audit-slugs.ts are NOT
-- repaired in this migration. They will be reviewed case-by-case with the
-- product owner — many existing slugs were deliberately disambiguated by
-- hand (e.g. `yellow-peril-wang-lixiong`) and changing them would break
-- inbound SEO links without benefit.

create extension if not exists unaccent;

update books
   set slug = 'julian-is-a-mermaid'
 where slug = 'juli-n-is-a-mermaid';
