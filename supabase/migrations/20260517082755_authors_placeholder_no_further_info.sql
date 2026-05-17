-- Extend the placeholder-author vocabulary (see 20260516100951) with the
-- "No further information available" bucket. It surfaced via #1820 (21 books)
-- and #4235 (1 book) — same problem as Anonymous/Unknown: an aggregator
-- record that misleads ranking/SEO surfaces.

update public.authors set is_placeholder = true
  where is_placeholder = false
    and lower(trim(display_name)) in (
      'no further information',
      'no further information available',
      'no information',
      'no information available',
      'information not available',
      'not available',
      'unavailable'
    );
