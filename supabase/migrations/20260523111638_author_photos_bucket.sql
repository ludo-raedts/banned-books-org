-- Storage bucket for mirrored author photos. enrich-author-photos-v2 finds
-- photos on hosts outside ALLOWED_IMAGE_HOSTS (Squarespace, Jetpack, author
-- personal CDNs) — we mirror them into this bucket so the rendered URL lives
-- on our own Supabase host and survives the upstream site going away.
--
-- Public bucket so anonymous browser requests can fetch the images directly
-- (next/image still wraps them, but origin reads need to be open). Service
-- role bypasses RLS for writes from the enrichment script, so no extra
-- INSERT/UPDATE policies are needed.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'author-photos',
  'author-photos',
  true,
  5242880,                                                     -- 5 MB cap
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
