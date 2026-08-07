-- Admin-portal load reduction: move data-quality counting/anti-joins/dup
-- detection from JS pagination loops (~158 PostgREST round-trips, ~3 MB egress
-- per /admin load) into two SQL functions, and give the Books/Authors admin
-- lists a server-side-pageable view (the pages previously fetched the whole
-- catalogue — 5-20 MB per view — to filter in the browser).
--
-- Disk-IO assessment (doctrine: check temp-spill risk):
--   * All queries run on-demand from the admin only, and the counts function
--     sits behind a 1h Next.js cache. Tables are small (books ~20k, bans ~36k,
--     ban_reason_links ~64k); hash anti-joins and the GROUP BY over
--     lower(trim(title)) fit comfortably in authenticator work_mem (8MB) —
--     no per-render aggregation, no spill.
--   * Views are plain (not materialized): admin needs fresh rows after edits,
--     and page-size reads (50 rows) keep the per-call cost trivial.

-- ---------------------------------------------------------------------------
-- 1. Data-quality counts — one call replaces 14 head-counts + 4 JS pagination
--    loops (ban_reason_links, ban_sources, book_authors, all book titles).
-- ---------------------------------------------------------------------------

create or replace function public.admin_data_quality_counts()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'total_bans',      (select count(*) from bans),
    'no_ban_year',     (select count(*) from bans where year_started is null),
    'total_books',     (select count(*) from books),
    'no_cover',        (select count(*) from books where cover_url is null),
    'no_description',  (select count(*) from books where description_book is null),
    'no_ban_desc',     (select count(*) from books where description_ban is null),
    'no_isbn',         (select count(*) from books where isbn13 is null),
    'no_genre',        (select count(*) from books where genres = '{}'::text[]),
    'unclassified',    (select count(*) from books
                         where warning_level = 'none' and inclusion_rationale is null),
    'total_authors',   (select count(*) from authors),
    'author_no_bio',   (select count(*) from authors where bio is null),
    'author_no_photo', (select count(*) from authors where photo_url is null),
    'no_ban_reason',   (select count(*) from bans b
                         where not exists (select 1 from ban_reason_links l where l.ban_id = b.id)),
    'no_source',       (select count(*) from bans b
                         where not exists (select 1 from ban_source_links s where s.ban_id = b.id)),
    'no_author',       (select count(*) from books bk
                         where not exists (select 1 from book_authors ba where ba.book_id = bk.id)),
    'duplicates',      (select coalesce(sum(c), 0) from (
                          select count(*) as c from books
                          group by lower(trim(title)) having count(*) > 1
                        ) d)
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Data-quality detail — one call per metric, LIMIT applied in SQL (the old
--    route fetched full tables with 3-level joins and sliced afterwards:
--    10-15 MB per click).
-- ---------------------------------------------------------------------------

create or replace function public.admin_data_quality_detail(metric text, max_rows int default 100)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  lim int := least(greatest(coalesce(max_rows, 100), 1), 500);
  out_rows jsonb;
  out_total bigint;
begin
  -- Ban-level metrics ------------------------------------------------------
  if metric in ('no_ban_reason', 'no_source', 'no_ban_year') then
    select count(*) into out_total
    from bans b
    where case metric
      when 'no_ban_reason' then not exists (select 1 from ban_reason_links l where l.ban_id = b.id)
      when 'no_source'     then not exists (select 1 from ban_source_links s where s.ban_id = b.id)
      else b.year_started is null
    end;

    select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into out_rows from (
      select
        b.id as ban_id,
        coalesce(bk.title, '') as book_title,
        coalesce(bk.slug, '') as book_slug,
        coalesce((select string_agg(a.display_name, ', ' order by a.display_name)
                  from book_authors ba join authors a on a.id = ba.author_id
                  where ba.book_id = bk.id), '') as author,
        b.country_code,
        b.year_started
      from bans b
      left join books bk on bk.id = b.book_id
      where case metric
        when 'no_ban_reason' then not exists (select 1 from ban_reason_links l where l.ban_id = b.id)
        when 'no_source'     then not exists (select 1 from ban_source_links s where s.ban_id = b.id)
        else b.year_started is null
      end
      order by b.id
      limit lim
    ) r;

    return jsonb_build_object('rows', out_rows, 'total', out_total, 'type', 'ban');
  end if;

  -- Book-level metrics -----------------------------------------------------
  if metric in ('no_author', 'no_ban_desc', 'no_genre', 'no_cover',
                'no_description', 'no_isbn', 'unclassified') then
    select count(*) into out_total
    from books bk
    where case metric
      when 'no_ban_desc'    then bk.description_ban is null
      when 'no_genre'       then bk.genres = '{}'::text[]
      when 'no_cover'       then bk.cover_url is null
      when 'no_description' then bk.description_book is null
      when 'no_isbn'        then bk.isbn13 is null
      when 'unclassified'   then bk.warning_level = 'none' and bk.inclusion_rationale is null
      else not exists (select 1 from book_authors ba where ba.book_id = bk.id)
    end;

    select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into out_rows from (
      select
        bk.id as book_id,
        bk.title,
        bk.slug,
        coalesce((select string_agg(a.display_name, ', ' order by a.display_name)
                  from book_authors ba join authors a on a.id = ba.author_id
                  where ba.book_id = bk.id), '') as author,
        (select count(*) from bans bn where bn.book_id = bk.id) as ban_count,
        bk.created_at
      from books bk
      where case metric
        when 'no_ban_desc'    then bk.description_ban is null
        when 'no_genre'       then bk.genres = '{}'::text[]
        when 'no_cover'       then bk.cover_url is null
        when 'no_description' then bk.description_book is null
        when 'no_isbn'        then bk.isbn13 is null
        when 'unclassified'   then bk.warning_level = 'none' and bk.inclusion_rationale is null
        else not exists (select 1 from book_authors ba where ba.book_id = bk.id)
      end
      order by bk.title
      limit lim
    ) r;

    return jsonb_build_object('rows', out_rows, 'total', out_total, 'type', 'book');
  end if;

  -- Author-level metrics (reuse the book row shape: book_id = author id) ----
  if metric in ('author_no_bio', 'author_no_photo') then
    if metric = 'author_no_bio' then
      select count(*) into out_total from authors where bio is null;
    else
      select count(*) into out_total from authors where photo_url is null;
    end if;

    select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into out_rows from (
      select
        a.id as book_id,
        a.display_name as title,
        coalesce(a.slug, '') as slug,
        coalesce(a.birth_year::text, '') as author,
        0 as ban_count,
        null::timestamptz as created_at
      from authors a
      where case when metric = 'author_no_bio' then a.bio is null else a.photo_url is null end
      order by a.display_name
      limit lim
    ) r;

    return jsonb_build_object('rows', out_rows, 'total', out_total, 'type', 'book');
  end if;

  -- Duplicate titles ---------------------------------------------------------
  if metric = 'duplicates' then
    select count(*) into out_total from (
      select 1 from books group by lower(trim(title)) having count(*) > 1
    ) g;

    select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into out_rows from (
      with grp as (
        select lower(trim(title)) as k, count(*) as c, min(created_at) as first_created
        from books
        group by lower(trim(title))
        having count(*) > 1
      ),
      rep as (
        select distinct on (g.k)
          g.k, g.c, g.first_created, b.title, b.slug,
          coalesce((select string_agg(a.display_name, ', ' order by a.display_name)
                    from book_authors ba join authors a on a.id = ba.author_id
                    where ba.book_id = b.id), '') as author
        from grp g
        join books b on lower(trim(b.title)) = g.k
        order by g.k, b.id
      )
      select title, slug, author, c as count, first_created as first_created_at
      from rep
      order by c desc, title
      limit lim
    ) r;

    return jsonb_build_object('rows', out_rows, 'total', out_total, 'type', 'duplicates');
  end if;

  return jsonb_build_object('rows', '[]'::jsonb, 'total', 0, 'type', 'unknown');
end;
$$;

-- Admin-only: the service_role client is the sole caller.
revoke all on function public.admin_data_quality_counts() from public, anon, authenticated;
revoke all on function public.admin_data_quality_detail(text, int) from public, anon, authenticated;
grant execute on function public.admin_data_quality_counts() to service_role;
grant execute on function public.admin_data_quality_detail(text, int) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Admin list views — server-side search + pagination for /admin/books and
--    /admin/authors. `author` is aggregated so one ilike covers title+author;
--    `has_bio`/`has_photo` replace shipping longtext bios for a checkmark.
-- ---------------------------------------------------------------------------

drop view if exists public.admin_books_list;
create view public.admin_books_list
with (security_invoker = true) as
select
  b.id,
  b.slug,
  b.title,
  b.cover_url,
  b.first_published_year,
  b.ai_drafted,
  b.warning_level,
  (b.inclusion_rationale is not null) as has_rationale,
  coalesce((select string_agg(a.display_name, ', ' order by a.display_name)
            from book_authors ba join authors a on a.id = ba.author_id
            where ba.book_id = b.id), '') as author
from books b;

drop view if exists public.admin_authors_list;
create view public.admin_authors_list
with (security_invoker = true) as
select
  a.id,
  a.slug,
  a.display_name,
  (a.bio is not null) as has_bio,
  (a.photo_url is not null) as has_photo,
  a.birth_year
from authors a;

revoke select on public.admin_books_list from anon, authenticated;
revoke select on public.admin_authors_list from anon, authenticated;
grant select on public.admin_books_list to service_role;
grant select on public.admin_authors_list to service_role;
