-- The `original_language` column held one row tagged `cn` (not a valid ISO
-- 639-1 code; Chinese is `zh`). It surfaced via the homepage non-English
-- top-list because the book — "Chong gou er er ba" by Cuilian Chen — was
-- gated against the Latin-script exclusion list correctly, but rendered
-- the raw "CN" string in the context line. Standardise to `zh`. Idempotent.

update public.books
   set original_language = 'zh'
 where original_language = 'cn';
