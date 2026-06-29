-- ----------------------------------------------------------------------------
-- authors: external identity links (website / social / authority files)
-- ----------------------------------------------------------------------------
--
-- The `authors` table stores name, bio, photo and birth details, but no links
-- to the author's presence elsewhere. We add them to:
--   1. emit schema.org `sameAs` on the Person JSON-LD (the primary win — it lets
--      Google/AI crawlers fuse this page with the author's Wikipedia/VIAF/social
--      entity, an authority signal a banned-books site can legitimately add
--      without manufacturing thin content), and
--   2. optionally surface a small link row in the author hero for living authors.
--
-- All values are sourced from Wikidata (CC-0), namesake-guarded against the
-- author's stored birth_year — see scripts/enrich-author-links.ts. We never
-- scrape or guess social handles (a wrong handle points visitors at a real
-- person's private account — worse than a wrong bio).
--
--   wikidata_id    canonical QID (e.g. "Q6826"); resolved once, reused by every
--                  future Wikidata enrichment so we stop re-matching by name.
--   website_url    P856 official website.
--   social_links   JSONB map platform -> full URL, e.g.
--                  {"twitter":"https://x.com/...","instagram":"https://instagram.com/...",
--                   "facebook":"https://facebook.com/...","viaf":"https://viaf.org/viaf/..."}
--                  A map (not a column per platform) keeps adding a platform a
--                  data change, not a schema change.
--   links_checked_at  sticky gate, parallel to ol_checked_at / photo_v2_checked_at:
--                  set on every probe (hit or miss) so re-runs skip resolved rows.

alter table authors add column if not exists wikidata_id text;
alter table authors add column if not exists website_url text;
alter table authors add column if not exists social_links jsonb;
alter table authors add column if not exists links_checked_at timestamptz;

comment on column authors.wikidata_id is
  'Canonical Wikidata QID (e.g. "Q6826"), resolved name->entity via the '
  'birth_year namesake gate in scripts/enrich-author-links.ts. Reused by all '
  'future Wikidata enrichment to avoid re-matching by name.';
comment on column authors.website_url is
  'Author official website (Wikidata P856). Emitted as schema.org Person.url '
  'context / sameAs and optionally shown in the author hero.';
comment on column authors.social_links is
  'JSONB map of platform -> full profile URL (twitter/instagram/facebook/viaf), '
  'sourced from Wikidata (P2002/P2003/P2013/P214). Drives Person.sameAs. '
  'A map so adding a platform is a data change, not a schema change.';
comment on column authors.links_checked_at is
  'Sticky skip-gate: timestamp of the last scripts/enrich-author-links.ts probe '
  '(set on hit or miss). Null = never checked.';

-- Skip-cache index: re-runs scan only never-checked authors (mirrors the
-- ol_checked_at / photo_v2_checked_at partial indexes already on this table).
create index if not exists idx_authors_links_checked_at
  on authors (links_checked_at)
  where links_checked_at is null;

-- PostgREST caches the schema; new columns are invisible to the API until it
-- reloads. (Auto-reloads shortly, but nudge it so the enrichment script's
-- writes don't fail against a stale cache.)
notify pgrst, 'reload schema';
