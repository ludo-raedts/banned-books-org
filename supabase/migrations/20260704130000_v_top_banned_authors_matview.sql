-- v_top_banned_authors: plain view → materialized view.
--
-- The plain view re-aggregated book_authors × books × bans (GROUP BY +
-- count(DISTINCT)) on every call. It is queried on every author-page render
-- plus the homepage, /most-banned-authors and the highlights strip; at
-- work_mem ~2MB each call spilled ~1.2MB of sort/hash state to disk —
-- 106 GB of temp-file writes since 2026-04-08 and the top Disk-IO consumer.
-- As a materialized view it is ≤100 rows and refreshed alongside the other
-- ban-count matviews. Name kept so app call sites stay unchanged.

drop view if exists public.v_top_banned_authors;

create materialized view public.v_top_banned_authors as
select
  ba.author_id as entity_id,
  count(bn.id) as total_bans,
  count(distinct b.id) as banned_books,
  count(bn.id) filter (where bn.region is not null or bn.institution is not null) as granular_events,
  count(bn.id) filter (where bn.region is null and bn.institution is null) as aggregate_events
from book_authors ba
join books b on b.id = ba.book_id
join bans bn on bn.book_id = b.id
group by ba.author_id
order by count(distinct b.id) desc, count(bn.id) desc
limit 100;

-- unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
create unique index v_top_banned_authors_entity_id_idx
  on public.v_top_banned_authors (entity_id);

-- matviews don't inherit the dropped view's grants; PostgREST roles need read
grant select on public.v_top_banned_authors to anon, authenticated, service_role;

create or replace function public.refresh_ban_count_materialized_views()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  refresh materialized view concurrently mv_ban_counts;
  refresh materialized view concurrently mv_country_reason_counts;
  refresh materialized view concurrently mv_book_scope_counts;
  refresh materialized view concurrently v_top_banned_authors;
end;
$$;
