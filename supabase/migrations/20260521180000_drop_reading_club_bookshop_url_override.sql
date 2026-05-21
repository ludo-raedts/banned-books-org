-- Drop the bookshop_url override column from reading_club_currently_challenged.
--
-- Why: this column let admins paste an arbitrary bookshop URL per card,
-- bypassing the canonical getBookshopUrl() helper. In practice the entries
-- that ever got written were bookshop.org/beta-search?keywords=... search
-- URLs — which silently break when Bookshop changes their search routing
-- (which has happened). Reading-club cards now always go through the same
-- helper as the rest of the site: per-ISBN deeplink when bookshop_status
-- is 'valid', storefront fallback otherwise.
--
-- See: /reading-club/currently-challenged feedback 2026-05-21.

ALTER TABLE "public"."reading_club_currently_challenged"
  DROP COLUMN IF EXISTS "bookshop_url";
