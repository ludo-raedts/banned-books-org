-- ─────────────────────────────────────────────────────────────────────────────
-- inbox_preview — last N (default 5) inbox messages from Zoho Mail (IMAP).
--
-- Populated by the hourly /api/cron/fetch-mail job: each run REPLACES all rows
-- (TRUNCATE + INSERT) so this table is a small, ephemeral mirror of the most
-- recent inbox state — not a durable mail store. The admin dashboard reads
-- from it to show "do I need to log in to Zoho?" at a glance.
--
-- No PII exfiltration concern beyond what's already in the user's own inbox:
-- only service-role (cron + admin SSR) reads this table.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE inbox_preview (
  id            bigserial PRIMARY KEY,
  uid           bigint    NOT NULL,
  from_name     text,
  from_address  text,
  subject       text,
  snippet       text,
  received_at   timestamptz,
  is_unread     boolean   NOT NULL DEFAULT false,
  fetched_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbox_preview_received_at ON inbox_preview(received_at DESC);
