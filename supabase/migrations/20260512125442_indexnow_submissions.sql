-- IndexNow submission log
--
-- Tracks every IndexNow bulk/delta submission so the admin UI can show
-- "last submitted at" and the delta endpoint can compute "what's new since
-- the last successful submit".
--
-- Kinds:
--   'full'  — full sitemap re-submit ("Submit all to IndexNow" button)
--   'delta' — only URLs created since the previous successful submission

CREATE TABLE IF NOT EXISTS public.indexnow_submissions (
    id           bigserial PRIMARY KEY,
    submitted_at timestamptz NOT NULL DEFAULT now(),
    kind         text        NOT NULL,
    url_count    integer     NOT NULL,
    ok           boolean     NOT NULL,
    status       integer,
    error        text,
    CONSTRAINT indexnow_submissions_kind_check
        CHECK (kind IN ('full', 'delta'))
);

CREATE INDEX IF NOT EXISTS indexnow_submissions_submitted_at_idx
    ON public.indexnow_submissions (submitted_at DESC);

CREATE INDEX IF NOT EXISTS indexnow_submissions_ok_submitted_at_idx
    ON public.indexnow_submissions (submitted_at DESC) WHERE ok;

-- Admin-only access via service-role key. No public-read policy.
-- Matches the RLS posture of import_review_queue and ban_reason_links.
ALTER TABLE public.indexnow_submissions ENABLE ROW LEVEL SECURITY;
