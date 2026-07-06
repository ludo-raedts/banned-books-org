-- Sticky check-stamp for the Wikidata native-title lookup, mirroring the
-- isbn_checked_at / cover_checked_at pattern (20260520120000_books_isbn_status).
--
-- Why: enrich-native-titles.ts re-ran its FULL candidate pool (~4.6k
-- non-English books with title_native NULL) against Wikidata on every
-- enrich-all run. The pool is exhausted — the 2026-07-06 run ended
-- 0 matched / 4626 unconfirmed (3752 no-search-hit + 874
-- no-confirmed-work-match) — so every run repeated the exact same misses.
-- With this stamp a miss is recorded too, and the candidate query skips rows
-- checked within the recheck window (default 90 days), after which they get
-- one fresh attempt in case Wikidata coverage improved.
--
-- No backfill here: which rows were already checked is not derivable from the
-- DB (hits set title_native and drop out of the pool by themselves). The
-- known misses of the latest full sweep are stamped separately from
-- data/native-title-enrichment-2026-07-06.json.

ALTER TABLE "public"."books"
    ADD COLUMN "native_title_checked_at" timestamp with time zone;

COMMENT ON COLUMN "public"."books"."native_title_checked_at" IS
    'When the Wikidata native-title lookup (enrich-native-titles.ts) last ran for this book — stamped on hit AND on sticky misses (no-search-hit / no-confirmed-work-match). Transient search-errors stay unstamped so they retry next run. NULL means never checked.';
