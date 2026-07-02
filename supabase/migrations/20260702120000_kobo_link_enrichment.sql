-- Per-book Kobo ebook deep links, resolved via the Rakuten Product Search
-- API (scripts/enrich-kobo-links.ts). Mirrors the bookshop_* pattern:
-- kobo_url is the plain Kobo product URL (www.kobo.com/...); the affiliate
-- wrapping (click.linksynergy.com deeplink + u1 sub-id) happens at render
-- time in src/lib/kobo.ts so the tracking tag never lives in the data.
-- kobo_checked_at is the sticky "already tried" marker: NULL url + set
-- timestamp means "searched, no match" — re-checked only via --stale-before.

alter table "public"."books"
  add column if not exists "kobo_url" text,
  add column if not exists "kobo_checked_at" timestamp with time zone;

comment on column "public"."books"."kobo_url" is
  'Kobo product-page URL for the ebook edition (plain www.kobo.com URL, no affiliate params), found via Rakuten Product Search API. NULL = no match found (see kobo_checked_at) or never checked.';
comment on column "public"."books"."kobo_checked_at" is
  'When enrich-kobo-links.ts last searched this book on Kobo. Sticky: rows with a timestamp are skipped unless --stale-before is passed.';
