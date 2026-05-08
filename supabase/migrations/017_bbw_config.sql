-- ─────────────────────────────────────────────────────────────────────────────
-- 017 — Banned Books Week runtime config
--
-- Moves the BBW config from src/config/banned-books-week.ts into the database
-- so editors can flip the kill switch + adjust dates from the admin UI without
-- a code deploy. Singleton row (id = 1, enforced by CHECK constraint).
--
-- The TypeScript file remains as the source of seed defaults for new
-- environments — but at runtime, the DB row wins.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bbw_config (
  id           int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled      boolean     NOT NULL DEFAULT false,
  year         int         NOT NULL,
  start_date   date        NOT NULL,
  end_date     date        NOT NULL,
  promo_start  date,                                       -- nullable; null means no lead-up
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text                                         -- audit field; nullable
);

-- Seed the singleton with sensible defaults if it doesn't already exist.
-- Editors can change every field from the admin UI; the seed is just so the
-- table is queryable from day one.
INSERT INTO bbw_config (id, enabled, year, start_date, end_date, promo_start)
VALUES (1, false, 2026, DATE '2026-09-27', DATE '2026-10-03', DATE '2026-09-01')
ON CONFLICT (id) DO NOTHING;
