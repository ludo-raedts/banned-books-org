-- Reading Club "By Theme" auto-pull: rank theme books in SQL.
--
-- getThemeBooks() gathered candidate ids in JS: ban_reason_links for the
-- theme's reasons WITHOUT a limit (PostgREST silently caps at 1000 rows, so
-- broad themes ranked over an arbitrary subset), then bans → 200 book ids →
-- a 3-level join over 200 books, only to keep the top 12 by ban count.
-- This function returns the correctly ranked top ids directly; the caller
-- hydrates just those 12 books.
--
-- Disk-IO: on-demand only (admin page + theme hub render), small tables,
-- hash joins + one sort over a few thousand grouped rows — no spill risk.

create or replace function public.admin_theme_top_books(reason_slugs text[], max_rows int default 12)
returns table (book_id bigint, ban_count bigint)
language sql
stable
set search_path = public
as $$
  with matching_books as (
    select distinct bn.book_id
    from bans bn
    join ban_reason_links l on l.ban_id = bn.id
    join reasons r on r.id = l.reason_id
    where r.slug = any(reason_slugs)
  )
  select mb.book_id, count(bn.id) as ban_count
  from matching_books mb
  join bans bn on bn.book_id = mb.book_id
  group by mb.book_id
  order by count(bn.id) desc, mb.book_id
  limit least(greatest(coalesce(max_rows, 12), 1), 100);
$$;

revoke all on function public.admin_theme_top_books(text[], int) from public, anon, authenticated;
grant execute on function public.admin_theme_top_books(text[], int) to service_role;
