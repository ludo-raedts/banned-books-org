import { describe, expect, it } from 'vitest'
import { createEmptyArtefacts, parseSql, type DeclaredArtefacts } from '../migration-parser'

function parse(sql: string): DeclaredArtefacts {
  const out = createEmptyArtefacts()
  parseSql(sql, out)
  return out
}

describe('migration-parser', () => {
  // ── Case A: human-written / bare-identifier style ─────────────────────────
  //
  // Mirrors the shape of the pre-baseline migrations under
  // supabase/migrations/_archive/ (e.g. 001_initial_schema.sql,
  // 007_indexes.sql, 011_top_banned_authors.sql).
  describe('case A — bare-identifier style', () => {
    const sql = `
      CREATE TABLE authors (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug        text NOT NULL,
        display_name text NOT NULL,
        created_at  timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS bans (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        country_code char(2) NOT NULL,
        CONSTRAINT bans_country_check CHECK (length(country_code) = 2)
      );

      ALTER TABLE books ADD COLUMN IF NOT EXISTS warning_level text DEFAULT 'none';

      CREATE OR REPLACE VIEW v_top_authors_all_time AS SELECT 1;
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ban_counts AS SELECT 1;

      CREATE OR REPLACE FUNCTION refresh_all_materialized_views() RETURNS void
        LANGUAGE plpgsql AS $$ BEGIN END $$;

      CREATE INDEX idx_bans_country_code ON bans(country_code);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_books_slug ON books(slug);

      CREATE POLICY public_read_books ON books FOR SELECT TO anon USING (true);

      CREATE TRIGGER trg_bans_data_changed AFTER INSERT OR DELETE OR UPDATE
        ON bans FOR EACH STATEMENT EXECUTE FUNCTION fn_touch_data_changed();
    `

    const a = parse(sql)

    it('captures tables', () => {
      expect(a.tables).toEqual(new Set(['authors', 'bans']))
    })
    it('captures columns from CREATE TABLE body, skipping constraints', () => {
      expect(a.columns.has('authors.id')).toBe(true)
      expect(a.columns.has('authors.slug')).toBe(true)
      expect(a.columns.has('authors.display_name')).toBe(true)
      expect(a.columns.has('authors.created_at')).toBe(true)
      expect(a.columns.has('bans.id')).toBe(true)
      expect(a.columns.has('bans.country_code')).toBe(true)
      // CONSTRAINT line must not be picked up as a column.
      expect([...a.columns].some(c => c.includes('constraint'))).toBe(false)
    })
    it('captures ALTER TABLE ADD COLUMN', () => {
      expect(a.columns.has('books.warning_level')).toBe(true)
    })
    it('captures views, matviews, functions, indexes, policies, triggers', () => {
      expect(a.views).toEqual(new Set(['v_top_authors_all_time']))
      expect(a.matviews).toEqual(new Set(['mv_ban_counts']))
      expect(a.functions).toEqual(new Set(['refresh_all_materialized_views']))
      expect(a.indexes).toEqual(new Set(['idx_bans_country_code', 'idx_books_slug']))
      expect(a.policies).toEqual(new Set(['books.public_read_books']))
      expect(a.triggers).toEqual(new Set(['bans.trg_bans_data_changed']))
    })
  })

  // ── Case B: pg_dump / quoted+schema-qualified style ───────────────────────
  //
  // Real fragments from the supabase db dump output that backs baseline_v2.
  describe('case B — pg_dump quoted+qualified style', () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS "public"."authors" (
          "id" bigint NOT NULL,
          "slug" "text" NOT NULL,
          "display_name" "text" NOT NULL,
          "created_at" timestamp with time zone DEFAULT "now"()
      );

      CREATE TABLE IF NOT EXISTS "public"."news_items" (
          "id" bigint NOT NULL,
          "status" "text" NOT NULL,
          "source_language" character(2) DEFAULT 'en'::"bpchar" NOT NULL,
          CONSTRAINT "news_items_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'rejected'::"text"])))
      );

      CREATE OR REPLACE VIEW "public"."v_top_banned_books" AS SELECT 1;

      CREATE MATERIALIZED VIEW "public"."mv_top_books_rising" AS SELECT 1
        WITH NO DATA;

      CREATE OR REPLACE FUNCTION "public"."refresh_all_materialized_views"() RETURNS "void"
          LANGUAGE "plpgsql" SECURITY DEFINER AS $$ BEGIN END $$;

      CREATE INDEX "idx_authors_display_name_trgm" ON "public"."authors"
        USING "gin" ("display_name" "public"."gin_trgm_ops");

      CREATE INDEX "news_items_source_language_idx" ON "public"."news_items"
        USING "btree" ("source_language");

      CREATE POLICY "public read authors" ON "public"."authors"
        FOR SELECT TO "anon" USING (true);

      CREATE POLICY "public read published news" ON "public"."news_items"
        FOR SELECT TO "anon" USING (("status" = 'published'::"text"));

      CREATE OR REPLACE TRIGGER "trg_bans_data_changed"
        AFTER INSERT OR DELETE OR UPDATE ON "public"."bans"
        FOR EACH STATEMENT EXECUTE FUNCTION "public"."fn_touch_data_changed"();
    `

    const a = parse(sql)

    it('captures schema-qualified tables, stripping public. prefix', () => {
      expect(a.tables).toEqual(new Set(['authors', 'news_items']))
    })
    it('captures quoted column names, skipping the CHECK constraint', () => {
      expect(a.columns.has('authors.id')).toBe(true)
      expect(a.columns.has('authors.display_name')).toBe(true)
      expect(a.columns.has('authors.created_at')).toBe(true)
      expect(a.columns.has('news_items.status')).toBe(true)
      expect(a.columns.has('news_items.source_language')).toBe(true)
      // The CHECK constraint with nested ARRAY[...] commas must not leak.
      expect(a.columns.has('news_items.news_items_status_check')).toBe(false)
    })
    it('captures views, matviews, functions', () => {
      expect(a.views).toEqual(new Set(['v_top_banned_books']))
      expect(a.matviews).toEqual(new Set(['mv_top_books_rising']))
      expect(a.functions).toEqual(new Set(['refresh_all_materialized_views']))
    })
    it('captures quoted indexes (extension-using and plain)', () => {
      expect(a.indexes).toEqual(new Set([
        'idx_authors_display_name_trgm',
        'news_items_source_language_idx',
      ]))
    })
    it('captures policies with spaces in their names', () => {
      expect(a.policies).toEqual(new Set([
        'authors.public read authors',
        'news_items.public read published news',
      ]))
    })
    it('captures triggers with quoted name and quoted+qualified table', () => {
      expect(a.triggers).toEqual(new Set(['bans.trg_bans_data_changed']))
    })
  })

  // ── Case C: mixed — bare and quoted in the same file ──────────────────────
  //
  // pg_dump's CREATE FUNCTION body holds bare identifiers (REFRESH
  // MATERIALIZED VIEW CONCURRENTLY mv_ban_counts;) while the function
  // signature itself is quoted. The parser must not treat the function
  // body's REFRESH statements as CREATE MATERIALIZED VIEW, and the bare
  // CREATE INDEX must be picked up alongside a quoted CREATE TABLE.
  describe('case C — mixed quoted and bare in the same file', () => {
    const sql = `
      CREATE OR REPLACE FUNCTION "public"."refresh_all_materialized_views"() RETURNS "void"
          LANGUAGE "plpgsql" SECURITY DEFINER
          AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ban_counts;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_country_reason_counts;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_books_rising;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_authors_rising;
      END;
      $$;

      -- Quoted table with bare index right after, schema-qualified.
      CREATE TABLE "public"."mixed_table" (
        "id" bigint NOT NULL,
        plain_column text
      );
      CREATE INDEX idx_mixed_plain ON public.mixed_table (plain_column);
      CREATE INDEX "idx_mixed_id" ON "public"."mixed_table" USING btree ("id");
    `

    const a = parse(sql)

    it('does not treat REFRESH MATERIALIZED VIEW inside a function as a CREATE', () => {
      expect(a.matviews).toEqual(new Set())
    })
    it('captures the function name from a quoted signature', () => {
      expect(a.functions).toEqual(new Set(['refresh_all_materialized_views']))
    })
    it('canonicalises both quoted and bare identifiers to the same name', () => {
      expect(a.tables).toEqual(new Set(['mixed_table']))
      expect(a.columns.has('mixed_table.id')).toBe(true)
      expect(a.columns.has('mixed_table.plain_column')).toBe(true)
      expect(a.indexes).toEqual(new Set(['idx_mixed_plain', 'idx_mixed_id']))
    })
  })

  // ── Case D: multi-column ALTER TABLE — comma-separated ADD COLUMN clauses ─
  //
  // Postgres allows a single ALTER TABLE to perform multiple ADD COLUMN
  // operations separated by commas. Before this case existed, the parser
  // only matched the first ADD COLUMN clause and silently dropped the rest,
  // which surfaced as a false-positive forward-drift report in
  // diagnose-schema-drift.ts after the Sprint A model3_and_import_queue
  // migration.
  describe('case D — multi-column ALTER TABLE ADD COLUMN', () => {
    it('captures every clause of a multi-column ALTER TABLE', () => {
      const sql = `
        ALTER TABLE books
          ADD COLUMN IF NOT EXISTS title_native             TEXT,
          ADD COLUMN IF NOT EXISTS title_native_script      TEXT,
          ADD COLUMN IF NOT EXISTS title_transliterated     TEXT,
          ADD COLUMN IF NOT EXISTS title_english_meaningful TEXT;
      `
      const a = parse(sql)
      expect([...a.columns].sort()).toEqual([
        'books.title_english_meaningful',
        'books.title_native',
        'books.title_native_script',
        'books.title_transliterated',
      ])
    })

    it('handles a mix of single- and multi-column ALTERs in one file', () => {
      const sql = `
        ALTER TABLE ban_sources ADD COLUMN IF NOT EXISTS verification_status verification_status_enum;
        ALTER TABLE books
          ADD COLUMN IF NOT EXISTS a TEXT,
          ADD COLUMN IF NOT EXISTS b TEXT;
      `
      const a = parse(sql)
      expect([...a.columns].sort()).toEqual([
        'ban_sources.verification_status',
        'books.a',
        'books.b',
      ])
    })

    it('does not split on commas inside DEFAULT expressions (arrays, calls, strings)', () => {
      const sql = `
        ALTER TABLE books
          ADD COLUMN IF NOT EXISTS arr  TEXT[] DEFAULT ARRAY['a', 'b'],
          ADD COLUMN IF NOT EXISTS fn   TEXT   DEFAULT concat('x', 'y'),
          ADD COLUMN IF NOT EXISTS lit  TEXT   DEFAULT 'has, a, comma',
          ADD COLUMN IF NOT EXISTS tail TEXT;
      `
      const a = parse(sql)
      expect([...a.columns].sort()).toEqual([
        'books.arr',
        'books.fn',
        'books.lit',
        'books.tail',
      ])
    })

    it('ignores non-ADD-COLUMN clauses but still picks up the ADD COLUMNs', () => {
      const sql = `
        ALTER TABLE books
          DROP COLUMN IF EXISTS legacy,
          ADD COLUMN IF NOT EXISTS modern TEXT;
      `
      const a = parse(sql)
      expect([...a.columns]).toEqual(['books.modern'])
    })

    it('handles quoted identifiers and the public. schema prefix in multi-column form', () => {
      const sql = `
        ALTER TABLE "public"."books"
          ADD COLUMN IF NOT EXISTS "Mixed Case" TEXT,
          ADD COLUMN IF NOT EXISTS plain TEXT;
      `
      const a = parse(sql)
      expect([...a.columns].sort()).toEqual(['books.mixed case', 'books.plain'])
    })
  })

  // ── Cross-style equivalence check ─────────────────────────────────────────
  //
  // The same logical statement written in two different styles must
  // produce identical entries — proving the canonicalisation works.
  describe('cross-style equivalence', () => {
    it('produces the same set for "CREATE TABLE foo" and \'CREATE TABLE "public"."foo"\'', () => {
      const bare = parse('CREATE TABLE foo ( id bigint, name text );')
      const quoted = parse('CREATE TABLE "public"."foo" ( "id" bigint, "name" "text" );')
      expect(bare.tables).toEqual(quoted.tables)
      expect(bare.columns).toEqual(quoted.columns)
    })
    it('matches CREATE INDEX in both forms', () => {
      const bare = parse('CREATE INDEX idx_x ON foo(name);')
      const quoted = parse('CREATE INDEX "idx_x" ON "public"."foo" USING "btree" ("name");')
      expect(bare.indexes).toEqual(quoted.indexes)
    })
  })
})
