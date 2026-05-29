-- Storage bucket for mirrored book covers. The Gemini-grounded cover-search
-- pipeline (enrich-covers-gemini-*) finds book covers on Chinese-language
-- sites (douban.com, books.com.tw, hkpl.gov.hk, etc.) that are not in
-- ALLOWED_IMAGE_HOSTS and which routinely hot-link-block foreign IPs anyway.
-- We mirror them into this bucket so the rendered URL lives on our own
-- Supabase host and survives the upstream link rotting.
--
-- Sister-bucket of author-photos with identical config — public read, 5 MB
-- file size cap, image MIME types only. Service role bypasses RLS for writes.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'book-covers',
  'book-covers',
  true,
  5242880,                                                     -- 5 MB cap
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
