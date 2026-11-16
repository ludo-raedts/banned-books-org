-- Track whether the download-link email actually went out, so the Stripe
-- webhook can re-send on retry instead of silently losing it (the order row
-- used to be inserted first, after which a retry hit the unique constraint
-- and returned without mailing).
--
-- Disk-IO: tiny table, one ADD COLUMN (nullable, no default = metadata-only)
-- and a one-off UPDATE over existing orders; no per-call aggregation.

ALTER TABLE public.dataset_orders
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

-- Every order that exists today predates the tracking and was mailed (or
-- handled manually); stamp them so a replayed old event does not re-mail.
UPDATE public.dataset_orders
   SET email_sent_at = COALESCE(paid_at, now())
 WHERE email_sent_at IS NULL;
