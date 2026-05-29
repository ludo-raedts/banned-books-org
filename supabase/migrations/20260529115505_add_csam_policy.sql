-- CSAM-adjacent editorial policy: Bucket A (blocklist) + Bucket B (gated).
-- See docs/editorial/csam-adjacent-policy.md.
--
-- Minimal footprint: no bucket state-machine, no review-flag column, no admin UI.
-- Bucket B is marked by a single boolean on books; Bucket A lives in blocked_works.

-- ── Bucket B marker on books ──────────────────────────────────────────────
ALTER TABLE "public"."books"
  ADD COLUMN IF NOT EXISTS "is_gated" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "gating_country" text;

-- ── Bucket A blocklist ────────────────────────────────────────────────────
-- Slug is held here so the book-route renders a content-free tombstone and the
-- import pipeline refuses re-import. title/reason are admin-only, never public.
CREATE TABLE IF NOT EXISTS "public"."blocked_works" (
  "slug"       text PRIMARY KEY,
  "title"      text NOT NULL,
  "reason"     text,
  "blocked_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "public"."blocked_works" ENABLE ROW LEVEL SECURITY;
-- No public policy on purpose: RLS is row- not column-level, so a public SELECT
-- would expose title/reason. The book-route reads this table via adminClient()
-- (server-side), consistent with the singleton-config doctrine. The public page
-- only ever learns *that* a slug is blocked, never the title/reason.

-- ── Gate the two Bucket B titles ──────────────────────────────────────────
-- Show Me (648): bans are AU/NZ "indecent" — not a documented "child
-- pornography" classification, so gating_country stays NULL and the overlay
-- uses the "...in at least one jurisdiction" fallback wording.
UPDATE "public"."books" SET "is_gated" = true, "gating_country" = NULL
  WHERE "id" = 648;

-- The Raped Little Runaway (1000): IE 2016 ban, text states "child sexual
-- abuse material" — Ireland is the supported gating jurisdiction.
UPDATE "public"."books" SET "is_gated" = true, "gating_country" = 'Ireland'
  WHERE "id" = 1000;
