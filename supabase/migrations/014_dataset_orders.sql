-- ─────────────────────────────────────────────────────────────────────────────
-- dataset_orders — one row per Stripe Checkout Session for the dataset product.
--
-- Lifecycle:
--   1. POST /api/dataset/checkout creates a Stripe Checkout Session.
--      We do NOT insert a row here — Stripe is the source of truth until paid.
--   2. Stripe webhook checkout.session.completed inserts a row with:
--        stripe_session_id, email, amount_cents, currency, paid_at,
--        download_token (random UUID), download_token_expires_at (now + 30d).
--   3. GET /api/dataset/download?token=... validates the token, increments
--      downloads_count, sets last_downloaded_at, then streams/redirects.
--
-- The webhook is the only writer for paid_at/download_token; the download
-- endpoint is the only writer for downloads_count/last_downloaded_at.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE dataset_orders (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id           text UNIQUE NOT NULL,
  email                       text,
  amount_cents                int,
  currency                    text,
  paid_at                     timestamptz,
  download_token              text UNIQUE,
  download_token_expires_at   timestamptz,
  downloads_count             int NOT NULL DEFAULT 0,
  last_downloaded_at          timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dataset_orders_token   ON dataset_orders(download_token);
CREATE INDEX idx_dataset_orders_email   ON dataset_orders(email);
CREATE INDEX idx_dataset_orders_paid_at ON dataset_orders(paid_at DESC);
