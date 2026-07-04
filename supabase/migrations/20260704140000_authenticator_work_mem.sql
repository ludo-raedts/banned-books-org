-- Raise work_mem for PostgREST connections (login role: authenticator).
--
-- Follow-up to 20260704130000: after the v_top_banned_authors matview fix,
-- the remaining Disk-IO temp-spill source is PostgREST book queries with
-- bans/book_authors json_agg embeds, spilling ~1-2.5 MB per call — just
-- above the compute add-on default work_mem of 2184 kB (~30 GB total since
-- 2026-04-08). 8 MB lets those sorts/hashes complete in memory. Safe here:
-- the whole database is 152 MB and fully cached, and the PostgREST pool is
-- small, so worst-case extra memory is a few tens of MB.
--
-- Applies at connection time; existing pooled connections pick it up as
-- they recycle (idle ones are terminated right after this migration).

alter role authenticator set work_mem = '8MB';
