-- ─────────────────────────────────────────────────────────────────────────────
-- 018 — News pipeline: embeddings-based dedup + auto-publish config
--
-- Adds two pieces:
--   1. An `embedding` column on news_items (pgvector, 1536 dims for
--      OpenAI's text-embedding-3-small) so the fetch pipeline can skip
--      near-duplicate stories — the Google News aggregator feed often
--      surfaces the same story under multiple publishers.
--   2. A `news_config` singleton mirroring the bbw_config pattern so an
--      editor can flip auto-publish + tune the dedup threshold from the
--      admin UI without a code deploy.
--
-- The `auto_published` flag on news_items is for audit only — distinguishes
-- items that went live without human review from items the admin pressed
-- Publish on. Useful when triaging a complaint or rolling back an auto run.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE news_items
  ADD COLUMN IF NOT EXISTS embedding      vector(1536),
  ADD COLUMN IF NOT EXISTS auto_published boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS news_config (
  id               int         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auto_publish     boolean     NOT NULL DEFAULT false,
  -- Cosine similarity threshold above which a new item is treated as a
  -- duplicate of an existing one. 0.85 is conservative enough that genuinely
  -- different stories slip through; lower it if dupes still leak in.
  dedup_threshold  float8      NOT NULL DEFAULT 0.85,
  -- Lookback window (days) for the dedup comparison. 14 is enough to catch
  -- slow-moving Google News reposts without scanning the whole archive.
  dedup_window_days int        NOT NULL DEFAULT 14,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       text
);

INSERT INTO news_config (id, auto_publish)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;
