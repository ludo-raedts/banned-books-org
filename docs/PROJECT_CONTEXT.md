# banned-books.org — Project Context

> Stand-alone briefing for handing off to a Claude or ChatGPT project. Captures
> what the site is, what's built, the database, the services, the file layout,
> the public surface, the admin surface, the positioning, and the SEO model.
> Code is the source of truth — paths below are real and clickable.
>
> Repo root: `/Users/ludoraedts/projects/banned-books-org`
> Live site: <https://www.banned-books.org>
> Owner: Ludo Raedts (Groningen, NL) — solo project, started April 2026.
>
> **Last updated: 2026-06-16.** Live counts (prod, 2026-06-15): **15.888 boeken · 31.404 ban-records · 119 landen** (115 extant + 4 defunct). Sinds de 2026-05-22 snapshot: catalogus ~6× gegroeid (Russia FSEM, PEN 2021-23, Malaysia/HK/FR/AR batches); Zenodo open dataset live met concept-DOI (CC-BY-4.0) náást de betaalde versie; daily **Bluesky** "banned book of the day" bot gebouwd (dry-run, posting off by default); **awards**-laag (Nobel/Pulitzer) + `/award-winning-banned-books` hub; **CourtListener** live litigatie-feed op `/countries/us`; agent-ready markdown content-negotiation (`.md` twins via middleware); native-title enrichment (Wikidata) voor non-Engelse vindbaarheid; author/book **slug-aliases** + cross-language dedup-doctrine; grote enrichment- en data-quality-sweeps (cover/desc/bio de-contaminatie, OL/GB harvest split); books/[slug] prebuild **gecapt op top-2000** + ISR 24h (Vercel deploy-limiet + scraper-swarm DB-load). Mei core-update gaf een site-brede impressie-collapse (zie §14). Zie §12 voor de volledige changelog.
>
> ⚠ **Twee kopieën van dit bestand.** Dit (`docs/PROJECT_CONTEXT.md`) is de canonieke, onderhouden versie en de enige die elders gerefereerd wordt. De root-`PROJECT_CONTEXT.md` is een verweesde duplicaat (laatst 2026-05-18) en moet verwijderd worden.

---

## 1. What this project is

**banned-books.org** is an independent, international, open-data catalogue of
books that have been banned, challenged, or restricted by governments,
schools, and libraries — historical and contemporary, worldwide.

Editorial mission (in plain English):
- **Make censorship visible.** A ban that is not recorded is a ban that can
  be denied. Every entry traces back to a verifiable source.
- **One reference, global scope.** Replace the patchwork of US-centric
  reading lists with a single, structured, international source.
- **Document, not endorse.** The catalogue includes books many readers find
  offensive (e.g. *Mein Kampf*, *The Turner Diaries*); a catalogue of banned
  books that omits controversial titles isn't one. It documents what
  happened — not whether it was right.

Financial model: free public site, monetised via:
1. A paid downloadable dataset (`/dataset`, $19.99 via Stripe Checkout). The same catalogue is **also published as a free open dataset on Zenodo** (CC-BY-4.0, concept-DOI `10.5281/zenodo.20511553`) — the open core and the paid version are presented as two equal options; the paid version's value is the packaged CSV/JSON/SQLite bundle + commercial licence (one `Dataset` JSON-LD entity for the open core, the paid version as `Product`).
2. Bookshop.org affiliate links from each book page (Kobo affiliate program denied in 2026-05; references scrubbed from the site).
3. A `/support` page with Stripe Payment Link buttons (voluntary contributions; subtle support links also on `/dataset` and `/reading-club`).

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2** (App Router, React 19, server components by default) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + `@tailwindcss/typography` |
| Hosting | **Vercel** (Fluid Compute) |
| Database | **Supabase** (Postgres + RLS enabled, public-read policies on most tables; service-role for admin/cron) |
| Database tooling | **Supabase CLI** (v2.98.2+) for migration management; **Docker Desktop** for local Supabase stack via `supabase start` |
| AI | OpenAI (`gpt-4o`, `gpt-4o-mini`, `gpt-4.1-mini`, `text-embedding-3-small`) + Google Gemini (`gemini-2.5-pro`, `gemini-2.5-flash`) for two-pass extraction in the import pipeline |
| Payments | **Stripe** Checkout + webhook |
| Email | **Resend** (transactional) + **Zoho Mail** IMAP (inbox preview) |
| Analytics | Vercel Analytics + Speed Insights, plus a privacy-safe custom `pageviews` table; Cloudflare GraphQL Analytics for traffic dashboard |
| Forms | Formspree (contact form) |
| Search-engine ping | IndexNow (`/api/indexnow`, `indexnow.txt`) |
| Court rulings | CourtListener API — live book-ban litigation feed on `/countries/us` (`src/lib/courtlistener.ts`) |
| Social | **Bluesky** daily "banned book of the day" bot (`@banned-books.org`; built, posting off by default — see §6) |
| Open data | **Zenodo** open dataset (CC-BY-4.0, concept-DOI `10.5281/zenodo.20511553`) |
| Cron | Vercel Cron (**6 jobs**, see §6) |
| Image optimisation | `next/image` + `sharp`; whitelisted remote hosts in `src/lib/allowed-image-hosts.ts` |
| Testing | Vitest |

Local dev: `pnpm dev` → <http://localhost:3000>. Build runs the dataset
builder before `next build` (`build-dataset.ts && next build`).

Local Supabase: `supabase start` (requires Docker Desktop) → Postgres at `127.0.0.1:54322`, Studio at `127.0.0.1:54323`. Use `supabase db reset` to apply migrations against a fresh local DB.

> ⚠ **CLAUDE.md / AGENTS.md**: this Next.js has breaking changes vs. typical
> training data. Always check `node_modules/next/dist/docs/` before writing
> Next-specific code.

---

## 3. Database (Supabase Postgres)

### Migration management — post Sprint 0.5

Migration files live in `supabase/migrations/`. As of 2026-05-12:

- **`20260511150851_baseline.sql`** is the canonical starting point. Generated via `supabase db dump --schema public` from production, manually cleaned (stripped pg_dump session-config and ownership-clauses), validated in Docker, and registered as the only entry in production's `supabase_migrations.schema_migrations` via `supabase migration repair --status applied`.
- **`supabase/migrations/_archive/`** contains the 25 legacy migrations (001-023) that were active before the baseline. Kept for historical reference; not picked up by Supabase CLI.
- **All future schema changes go via Supabase CLI**, not Supabase Studio: `supabase migration new <name>` → write SQL → test locally via `supabase db reset` → `supabase db push` against production (or apply via Studio + `supabase migration repair`).
- **Diagnostic tool**: `scripts/diagnose-schema-drift.ts` compares production against migration files across seven dimensions (tables, columns, views, materialized views, indexes, policies, triggers). Zero drift was bevestigd na Sprint 0.5.
- See `docs/sprint-a/step-0-findings.md` for the nine findings that informed Sprint 0.5 (toSlug NFD bug, Cloudflare-blocked Wayback, schema drift, FranceArchives redirect-chain, genre vocabulary, missing extensions, PK type-drift, duplicate pageviews indexes, duplicate migration number prefixes).

### Core entities

| Table | Purpose |
|---|---|
| `countries` | Country dimension. `code` (char(2), unique), `name_en`, `description` (editorial). Includes defunct states (`SU`, `CS`, `DD`, `YU`). |
| `authors` | Author dimension. `slug`, `display_name`, `bio`, `birth_country`, `photo_url`, `name_native` / `name_transliterated` / `name_english` / `original_language` (multilingual ladder, migration `20260514191552`), `is_placeholder` (migration `20260516100951` — flags Anonymous / Unknown / Various Authors entries that aggregate unrelated books), `openlibrary_*` author fields (migration `20260608120000` — OL Authors API enrichment), `awards jsonb` default `'[]'` (Nobel Prize in Literature = author-level; migration `20260613100000`; partial GIN index on non-empty), `data_quality_status` (`confident` / `default` / `flagged`) + `data_quality_evaluated_at` (migration `20260518065314` — set by `score-data-quality.ts`), `photo_v2_checked_at`. ~46 Nobel authors carry an award (Naipaul dup merged 47→46). |
| `books` | The book catalogue. `slug`, `title`, `first_published_year`, `genres text[]`, `isbn13`, `openlibrary_work_id`, `cover_url`, `cover_status`, `bookshop_status` / `bookshop_isbn13`, `gutenberg_status` (migration `20260519184322`), `isbn_status` incl. `no_match` / `dup_collision` (migrations `20260520120000` / `20260601*`), `description_book`, `description_ban`, `censorship_context`, **`description_source_type`** incl. `ai_consensus` cross-model tier (migrations `20260528150000` / `20260605120000`), **`censorship_context_status`** + **`description_ban_status`** (migrations `20260529080000` / `20260529111240`), `ai_drafted`, `warning_level` (`none` / `context` / `extended`), `inclusion_rationale`, `extended_context`, `is_blanket_works` (migration `20260529130000` — isolates Liste Otto "Toutes ses œuvres" author-level bans from real titles), `original_language` (default `'en'`), `title_native` / `title_native_script` / `title_transliterated` / `title_english_meaningful`, **`awards jsonb`** default `'[]'` (Pulitzer = book-level; migration `20260613100000`), `data_quality_status` + `data_quality_evaluated_at`, `updated_at`. **Native-title enrichment (2026-06-15)**: `scripts/enrich-native-titles.ts` fills `title_native` + script for ~4.188 foreign books stored under English titles (Wikidata CC-0). Per 2026-06-15: 9.637 en-titels, 4.803 non-en, 1.448 NULL. |
| `book_authors` | M:N join `book_id` ↔ `author_id`. |
| `bans` | The act of censorship. `book_id`, `country_code`, `status` (`active` / `historical`), `action_type` (`banned` / `restricted` / `challenged`), `year_started`, `year_ended`, scope (school vs government), description. |
| `ban_sources` | Citation per ban — `source_name`, `source_url` (UNIQUE), `source_type`, `accessed_at`, `verification_status` (enum). Sprint A heeft de `[archive pending]`-conventie vervangen door een `verification_status` enum met vier waarden: `verified` (URL werkt + archive geslaagd), `pending` (URL werkt + archive faalde), `unverified` (nooit geverifieerd), `broken` (4xx/5xx). Backfill 2026-05-12: 2 `[archive pending]` → `pending`, 252 NULL → `unverified`. `verified` en `broken` zijn nog ongebruikt; toekomstige verificatie-runs zullen die vullen. |
| `ban_source_links` | M:N join `bans` ↔ `ban_sources` with `locator` (e.g. page number in source PDF). |
| `ban_reason_links` | M:N join `bans` ↔ `reasons`. RLS enabled but no public policies (admin-only access). |
| `reasons` | The taxonomy of "why" — `slug` (e.g. `lgbtq`, `political`, `religious`, `sexual`, `violence`, `racial`, `drugs`, `obscenity`, `moral`, `language`, `other`). **`blasphemy` werd samengevoegd in `religious` (2026-05-19)** — alle `ban_reason_links` zijn herwezen; slug bestaat niet meer. |
| `scopes` | Ban scope (`school`, `government`, `prison`, etc.) with display labels. |

### Pageview / analytics

| Table / view | Purpose |
|---|---|
| `pageviews` | Append-only event log. Fields: `entity_type` (`book` / `author` / page), `entity_id`, `viewed_at`, `country` (CF-IPCountry), `referrer_host`, `visitor_hash`. **Privacy-safe**: `visitor_hash = sha256(daily_salt ‖ ip ‖ ua)` — IP never stored, salt rotates daily. |
| `v_top_books_this_week` / `_last_week` / `_all_time` | Top books by `COUNT(DISTINCT visitor_hash)`. |
| `v_top_authors_this_week` / `_last_week` / `_all_time` | Same shape, for authors. |
| `v_top_banned_books` | Books ranked by total bans (not pageviews). |
| `v_top_banned_authors` | Authors ranked by total bans (not pageviews). |
| `v_top_countries_this_week` / `_last_week` | Visitor country breakdown. |
| `v_top_referrers_this_week` / `_last_week` | Referrer hostnames. |
| `v_weekly_totals` | Site-wide weekly visitor / pageview counters. |
| `mv_ban_counts` | Materialized: bans per country. Telt **distinct books**, niet raw ban-rows — zie §13 distinct-books doctrine. |
| `mv_country_reason_counts` | Materialized: bans per (country × reason). |
| `mv_book_scope_counts` | **Nieuw 2026-05-21.** Per (book × scope) split tussen `district_events` (PEN per-district, institution NOT NULL), `state_events` (region NOT NULL + institution NULL), `aggregate_events` (Wikipedia/ALA/legacy, beide NULL) en `total_events` (backwards-compat sum). Ranking-bron voor `/scope/[slug]`. Reden: PEN 2024-25 schrijft 1 boek × N districts = N rijen, terwijl Wikipedia/ALA per titel aggregeert — sommatie inflated `/scope/school` met +1 op ~94% van US-school boeken en herschudde top-N. |
| `mv_top_books_rising` / `mv_top_authors_rising` | Materialized rolling 14-day "rising" snapshots; refreshed hourly. |
| `mv_reason_top_books` | **Nieuw 2026-05-25.** Per-reason top-books MV (feeds `/reasons/[slug]` + homepage reason rail without a full scan). |
| `book_ban_counts_view` | **Nieuw 2026-06-13.** Per-book ban tally (drives book-of-day pool, top-100 ranking without a full-table scan). |
| `v_ban_counts_by_era` | **Nieuw 2026-05-29.** Bans bucketed by era (powers the era split on /stats + /timeline). |
| `mv_refresh_log` | Tracks `data_last_changed`, `last_refreshed`, `dataset_built_at`. Triggers on `bans` and `ban_reason_links` keep `data_last_changed` current. |
| `v_top_banned_books` / `v_top_banned_authors` | Sprint A: extra kolommen `granular_events` + `aggregate_events` aan de staart (CREATE OR REPLACE VIEW kan niet reorderen). Ranking key blijft `distinct_countries` / `banned_books`. |
| `admin_db_stats()` RPC | Returns DB size + pageviews-table size for the admin "DB usage" gauge. |
| `refresh_all_materialized_views()` RPC | Refreshes all 5 matviews concurrently (incl. `mv_book_scope_counts`). |

Cleanup cron caps `pageviews` at ~90 days (see §6).

### Editorial / CMS tables

| Table | Purpose |
|---|---|
| `content_blocks` | Slug-keyed editorial CMS. `body_markdown` + cached `body_html`, status `placeholder` / `draft` / `published`. Public pages hide sections until the block is `published`; pages refuse to publish themselves while a required block is still a placeholder. Seeded with ~20 blocks for BBW + Reading Club hubs. |
| `bbw_featured_selections` | Per-year (1..10 headline + 11..25 alternates) Banned Books Week picks. Draft = `published_at IS NULL`. |
| `reading_club_currently_challenged` | ALA OIF Top-N per year, manual entry (titles aren't always matchable to our books DB). |
| `reading_club_international` | Engine-curated international set (suggester output, see §5). One active set, evergreen. |
| `reading_club_classics` | Manual evergreen list. |
| `reading_club_themes` + `reading_club_theme_books` | Five seed themes — `lgbtq`, `political-dissent`, `religious-censorship`, `race-and-racism`, `sexuality`. |
| `editorial_publish_log` | Single audit trail across all editorial publishes. |
| `bbw_config` | Singleton row (id=1). DB-backed kill switch, year, `start_date`, `end_date`, `promo_start`. Editor flips from admin UI; no deploy. |
| `news_config` | Singleton. `auto_publish` flag + `dedup_threshold` (cosine, default 0.85) + `dedup_window_days`. |

### Import pipeline tables

| Table | Purpose |
|---|---|
| `import_jobs` | Lifecycle-tracking voor één URL door de pipeline. 19 kolommen: `source_url` (UNIQUE), `source_type`, `tier`, `status` (enum `import_job_status`: `pending` / `fetching` / `extracting` / `verifying` / `gated` / `queued` / `committed` / `failed`), `current_phase`, plus per-fase payloads `raw_html`, `archive_url`, `archive_service`, `extraction` (jsonb), `verification` (jsonb), `gate_decision` (jsonb), terminal velden `committed_at`, `error`, `attempts`, en `review_row_id` FK naar `import_review_queue` met `on delete set null`. Twee indexes (`idx_import_jobs_status`, partial `idx_import_jobs_batch`). RLS enabled, geen public policies. Migratie `20260512173457`. |
| `import_review_queue` | Schema gelegd in Taak 2A: 18 kolommen, 3 partial indexes, RLS enabled zonder public policies. Bijbehorende enum `import_review_status` met waarden `pending_review` / `approved` / `rejected` / `deferred`. Wordt gevuld door de pipeline (Taak 3) wanneer de gate auto-approve weigert: `pass_a_output` en `pass_b_output` bevatten de twee LLM-extracties apart, `agreement_details` bevat gate-decision + verification + archive-resultaat. |

### Operational tables

| Table | Purpose |
|---|---|
| `news_items` | Aggregated censorship news. Fields incl. `embedding vector(1536)` (pgvector), `auto_published` flag (audit), `status` (`draft` / `published`), `source_language` (char(2), default `'en'`), `original_title`, `original_summary` (raw pre-translation feed content). |
| `dataset_orders` | Stripe Checkout sessions. `stripe_session_id`, `email`, `amount_cents`, `paid_at`, `download_token` (UUID), `download_token_expires_at` (now + 30d), `downloads_count`. Webhook is sole writer for `paid_at`/token; download endpoint is sole writer for `downloads_count`. |
| `inbox_preview` | Last 5 inbox messages from Zoho Mail (TRUNCATE+INSERT every hour). Powers the dashboard inbox card. |
| `cover_search_attempts` | Throttles cover-enrichment retries per book. RLS enabled, no public policies. |
| `description_search_attempts` | Same, for descriptions. |
| `affiliate_partners`, `purchase_links` | Bookshop / Kobo affiliate metadata + per-book link cache. |
| `indexnow_submissions` | Tracking tabel voor IndexNow submissions: welke URLs zijn wanneer gesubmit + `static_urls jsonb` snapshot voor de delta-diff. Migratie `20260512125442` / `20260517100000`. RLS enabled, geen public policies. |
| `book_slug_aliases` | Oude book-slugs → huidige slug (308-redirect fallback op de book-page). Gevuld bij elke slug-change of dup-merge. Migraties `20260514111827` / `20260520160000`. |
| `author_slug_aliases` | **Nieuw 2026-06-13.** Spiegel van `book_slug_aliases` voor authors (308-redirect fallback op de author-page). Introduced by de V. S. Naipaul dup-merge. Toekomstige author-merges/slug-changes **moeten** een alias-rij invoegen. Migratie `20260613110000`. |
| `bluesky_excluded_books` | **Nieuw 2026-06-16.** Books die een editor handmatig uit de Bluesky daily-rotation heeft gehaald (via `/admin/bluesky` "skip"). De picker rerollt elke datum die op een excluded book landt; service-role only (RLS enabled, geen policy). Migratie `20260616120000`. |

### Extensions & important indexes

- `pg_trgm` — trigram indexes on `books.title` and `authors.display_name` (search).
- `vector` (pgvector) — for `news_items.embedding` (dedup).
- `unaccent` — added in Taak 1 to support the `toSlug` NFD-fix (accent-folding without character-stripping).
- `pgcrypto`, `pg_stat_statements`, `uuid-ossp`, `supabase_vault` — Supabase-managed extensions.
- Composite `(entity_type, entity_id)` and `(entity_type, viewed_at)` on `pageviews` for the rising/trending widgets.
- Partial indexes for `cover_url IS NULL`, `description_book IS NULL` (admin enrichment queues).
- `idx_bans_scope_id` — added 2026-05-21 voor de `/scope/[slug]` sweep tegen `mv_book_scope_counts`.
- **Resolved 2026-06-16**: the duplicate `idx_pageviews_entity` / `idx_pageviews_entity_type_id` pair (old findings #8) was dropped in migration `20260616130000` (same migration adds RLS to `author_slug_aliases`).
- **Fuzzy-match RPCs voor de import-pipeline** (migratie `20260512175331`): `find_book_candidates_by_title(q text, threshold real)` doet `pg_trgm`-similarity tegen `books.title` en returnt de top-10 kandidaten. `find_author_candidates_by_name(q text, threshold real)` doet hetzelfde voor `authors.display_name`. Beide worden aangeroepen door `src/lib/imports/verifier.ts` als de exact slug-lookup mist.

### RLS posture

14 tables have RLS enabled:
- 12 with public-read SELECT policies (`true` qual, except `news_items` which filters on `status = 'published'`).
- 2 without policies (`ban_reason_links`, `cover_search_attempts`) — admin-only access via service-role key. Documented with SQL comments in the baseline.

**2026-05-20 anon-lockdown.** Supabase security advisor flagde meerdere anon-leesbare surfaces die alleen via service-role hadden mogen lopen. Anon-access naar de getroffen tabellen/views is gesloten; admin/cron blijven via `adminClient()`. Memory-doctrine: lees singleton config-rijen (`news_config`, `bbw_config`, etc.) altijd via `adminClient()` — anon ziet stille default-fallback.

No fine-grained row-level access yet; this is binary public-or-nobody. Future features (user accounts, submissions) will require more nuanced RLS.

---

## 4. File layout

```
src/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Header / footer / nav / analytics
│   ├── page.tsx                      # Homepage — book browser, highlights, trending, news preview
│   ├── globals.css
│   ├── robots.ts                     # robots.txt (allow all)
│   ├── sitemap.xml/ + sitemap-*.xml/ # Split sitemaps: static / books / authors / countries / reasons
│   ├── feed.xml/                     # RSS feed of latest news
│   ├── opengraph-image.tsx + icon.svg + apple-icon.png + favicon.ico
│   ├── indexnow.txt                  # IndexNow key file
│   ├── llms.txt/                     # LLM-discoverability index (see §10)
│   ├── about.md/ + history.md/       # .md long-form prose exports for AI citation
│   ├── methodology.md/ + data-quality.md/
│   │
│   ├── books/[slug]/                 # Per-book page (canonical; rich metadata, schema.org)
│   ├── authors/[slug]/               # Author bio + their banned books
│   ├── countries/                    # Index + [code]/ per country
│   ├── reasons/                      # Index + [slug]/ per reason
│   ├── scope/[slug]/                 # /scope/school, /scope/government
│   ├── search/                       # Full-text search (server) + client interactivity
│   ├── stats/ + methodology/         # Stats dashboard + "why the US dominates" essay
│   ├── top-100-banned-books/         # Static-revalidating SEO landing (24h)
│   ├── most-banned-authors/          # Author-ranked SEO landing
│   ├── rising-banned-books/          # 14-day rolling rising-list SEO landing
│   ├── trending-banned-books/        # All-time/this-week trending SEO landing
│   ├── non-english-banned-books/     # Multilingual catalogue SEO landing
│   ├── banned-classics/              # Pre-1970 SEO landing (24h)
│   ├── banned-childrens-books/       # Children's/YA-scope SEO landing (new)
│   ├── challenged-books/             # School-scope SEO landing
│   ├── award-winning-banned-books/   # Nobel/Pulitzer hub w/ prize citations (new 2026-06-13)
│   ├── banned-books/[year]/          # Year-archive SEO landings (2022..2026, generateStaticParams)
│   ├── discover/                     # Faceted discovery surface (discover-engine.ts) (new)
│   ├── timeline/ + timeline/pdf/     # Censorship timeline + printable PDF (new)
│   ├── film/                         # Documentary page — lazy YouTube embed + VideoObject JSON-LD (new)
│   ├── laws/loi-gayssot/             # Per-law explainer (Loi Gayssot; FR Otto/arrêtés context) (new)
│   ├── support/                      # Stripe Payment Link contributions (new)
│   ├── accessibility/                # Accessibility statement (canonical explainer layout) (new)
│   ├── banned-books-week/ + archive/[year]/  # BBW hub + per-year archive
│   ├── reading-club/                 # Hub (featured cover strip + 5 tracks)
│   │   ├── currently-challenged/     # ALA OIF list — per-position [year]/[position]/ + /pdf
│   │   ├── international/            # Engine-curated — per-book [slug]/ + [slug]/pdf
│   │   ├── classics/                 # Manual evergreen — per-book [slug]/ + [slug]/pdf
│   │   ├── young-readers/            # NEW track (migration 20260526120000) — [slug]/ + [slug]/pdf
│   │   └── by-theme/[slug]/          # Five themes — per-book [bookSlug]/ + [bookSlug]/pdf
│   ├── essays/ + essays/feed.xml/    # Index + dedicated essays RSS feed
│   │   ├── what-we-document/         # (each essay has a .md twin — see §10)
│   │   ├── forbidden-knowledge-iceberg/
│   │   ├── in-whose-name/            # Anatomy of ban reasons
│   │   ├── the-grey-zone/
│   │   ├── the-line-we-pretend-not-to-draw/
│   │   └── first-amendment-paradox/
│   ├── history/                      # Long-form essay (legacy flat URL)
│   ├── why-not-amazon/               # Essay (legacy flat URL)
│   ├── data-quality/                 # Explainer for 3-level record classification
│   ├── press/                        # Media kit — short factual founder bio, live stats, story angles, Org JSON-LD
│   ├── about/ + privacy/ + sources/ + dataset/ + reading-list/ + news/  # /about = personal "why I built this" narrative
│   │
│   ├── admin/                        # Cookie-gated admin UI (see §8)
│   │   ├── page.tsx                  # Dashboard (stats, inbox, dataset KPIs, DB gauge)
│   │   ├── admin-tabs.tsx            # Overview / Stats / BBW / Reading Club / Content blocks
│   │   ├── books/ + books/[slug]/    # Book browser + edit form
│   │   ├── authors/ + authors/[slug]/
│   │   ├── news/                     # Triage drafts → publish
│   │   ├── content-blocks/           # CMS editor
│   │   ├── banned-books-week/        # BBW config + featured picks editor
│   │   ├── reading-club/             # Reading club editor (5 tracks)
│   │   ├── bluesky/                  # Bluesky bot: status, today's post preview, queue, skip/restore (new)
│   │   ├── zenodo/                   # Zenodo re-deposit guide + external links (new)
│   │   ├── import-review/ + [id]/    # Import review queue triage (approve/reject/defer/merge)
│   │   ├── stats/ + sitemap/         # Cloudflare traffic dash + sitemap & IndexNow tools
│   │   ├── scripts/                  # Reference cards for every CLI script
│   │   └── login/
│   │
│   └── api/
│       ├── cron/                     # Vercel Cron endpoints (Bearer-protected) — 6 jobs, see §6
│       │   ├── fetch-news/ fetch-mail/ cleanup-pageviews/
│       │   ├── refresh-views/        # hourly MV refresh
│       │   ├── indexnow-delta/       # daily incremental IndexNow
│       │   └── post-bluesky/         # daily Bluesky post (dry-run unless BLUESKY_POST_ENABLED)
│       ├── dataset/                  # checkout / webhook / download (token-gated zip)
│       ├── indexnow/                 # POST URLs to IndexNow (admin/cookie or Bearer)
│       ├── books/ suggest/ pageview/ # public: catalogue JSON, search-suggest, pageview beacon
│       └── admin/                    # Cookie-gated REST: books, authors, news, content-blocks,
│                                     # BBW, reading-club, build-dataset, refresh-views, sync-inbox,
│                                     # indexnow-bulk, indexnow-delta, data-quality,
│                                     # generate-discussion-questions, bluesky-exclude,
│                                     # revalidate (bust a single book/author ISR slot),
│                                     # enrich/{dispatch,run,status} (in-app enrichment runner),
│                                     # login/logout (signed session token + rate limit)
│
├── components/                       # Reusable UI: book browser, trending widget,
│                                     # rising widget, share buttons, contact form,
│                                     # dataset-checkout-button, tracked-outbound-link,
│                                     # ban-timeline, …
├── config/
│   ├── banned-books-week.ts          # DB-backed runtime config (60s in-memory cache)
│   └── news.ts                       # DB-backed news pipeline config
├── lib/                              # Pure logic — see §5
│   ├── imports/                      # Two-pass LLM extraction + pipeline orchestration
│   │   ├── llm-extraction.ts         # extractBothPasses + compareExtractions
│   │   ├── extraction-prompt.ts      # Shared system prompt for Gemini + OpenAI
│   │   ├── extraction-types.ts       # Zod schemas + ExtractionResult / PassesAudit
│   │   ├── slugify.ts                # Canonical slug helper (consolidated in Taak 1)
│   │   ├── source-registry.ts        # Per-source config: tier, default_country_code,
│   │   │                             # archive_strategy, default_scope, default_action_type
│   │   ├── fetcher.ts                # HTTP GET with redirect-chain logging
│   │   ├── archiver.ts               # Wayback + archive.today fallback chain
│   │   ├── normalize-extraction.ts   # Consolidates two-pass output → ExtractionResult,
│   │   │                             # preserves passes_audit for the review queue
│   │   ├── verifier.ts               # Fuzzy matching against books / authors / countries /
│   │   │                             # reasons via RPCs + exact slug-lookups
│   │   ├── gate.ts                   # Auto-approve conjunction (pure function)
│   │   ├── committer.ts              # DB transaction for direct-write or queued branch
│   │   └── run-import-job.ts         # Orchestrator: seven phases with retry-safe phase gates
│   └── migration-parser.ts           # Parser for both pg_dump and hand-written migration SQL
└── middleware.ts                     # Gate /admin/* on `admin_session` cookie

supabase/
├── config.toml                       # Supabase CLI configuration
├── migrations/                       # Active migration files
│   ├── 20260511150851_baseline.sql   # Post-Sprint-0.5 baseline (pg_dump derived)
│   └── _archive/                     # Historical 001-023 migrations (gitignored from CLI scope)
└── .branches/                        # Local CLI working state (gitignored)

scripts/                              # ~180+ maintenance scripts (TSX). See /admin/scripts
├── diagnose-schema-drift.ts          # Seven-dimensions production vs migrations comparator
├── seed-local-from-prod.ts           # Seedt lokale Supabase Docker-container met productie-data via docker exec. Vereist voor data-touching migraties; zie §13 doctrines.
├── test-llm-extraction.ts            # CLI test for the two-pass extraction module
├── test-pipeline-end-to-end.ts       # Eindvalidatie pipeline: één URL door alle fases (fetched → committed/queued); purgt eerst stale state per source_url
├── test-pipeline-fetcher.ts          # Smoke-test voor de fetcher-module alleen (geen LLM-calls)
├── add-books-french-validation.ts    # Step-0 Model 3 validation script
└── _check_*.ts                       # Convention: exploratory verification scripts

private/dataset.zip                   # Generated artefact, served only via /api/dataset/download
public/                               # Static assets (brand, og default, indexnow placeholder)
data/                                 # Local CSVs from one-off enrichment / audit runs
└── sources/                          # Import-source test fixtures (e.g. test-fixture-extraction.csv)

docs/
└── sprint-a/
    └── step-0-findings.md            # Nine findings from Step 0 + Sprint 0.5
```

---

## 5. Services & libraries (`src/lib/`)

| File | Responsibility |
|---|---|
| `supabase.ts` (+ `.js`) | Two clients: `serverClient()` (anon, SSR for public pages) and `adminClient()` (service-role, used by admin + cron + heavy reads). |
| `admin-auth.ts` | `requireAdmin()` shared check for `/api/admin/*` route handlers (verifies the `admin_session` cookie === `ADMIN_SECRET`). The middleware only protects the page routes. |
| `book-search.ts` | Server-side full-text search using `pg_trgm`. |
| `bookshop.ts` | Bookshop.org affiliate URL builder. Affiliate ID `123844`, shop `Banned-books`. Uses `/a/{aid}/{isbn13}` deep links when `bookshop_status='valid'` (verified by probe), otherwise falls back to `/shop/Banned-books` (still sets the 48-h cookie). `getBookshopLinkType` classifies clicks for analytics. |
| `cloudflare-analytics.ts` | Cloudflare GraphQL Analytics fetch (24h totals, 24h-vs-prev-24h deltas, top IPs, status buckets). Cached via `unstable_cache`. |
| `known-bots.ts` (+ test) | Curated CIDR ranges for Googlebot, Bingbot, GPTBot, ChatGPT-User, OAI-SearchBot, PerplexityBot, Applebot, Meta. Used by traffic dashboard to tag bot vs human. **Refreshed 2026-05-09.** |
| `trackPageview.ts` | Inserts a row into `pageviews` from server components — extracts referrer host, computes `visitor_hash = sha256(VISITOR_SALT_SECRET ‖ today ‖ ip ‖ ua)`. |
| `fetch-news.ts` | RSS pipeline: fetches PEN America, Index on Censorship, Publishers Weekly, Freedom to Read Canada, Google News (`banned books`); normalises Google News titles; calls OpenAI to summarise (40–70 words, banned-phrase list); embeds with `text-embedding-3-small`; cosine-dedupes against last `dedup_window_days` items; inserts as `draft` (or `published` if `news_config.auto_publish`). |
| `inbox-sync.ts` | Connects to Zoho IMAP, fetches last 5 messages, TRUNCATE+INSERT into `inbox_preview` (5 rows max). |
| `email.ts` | Resend wrapper. `sendDownloadEmail` (post-purchase), contact-form forwarder. |
| `stripe.ts` | Stripe SDK init. Used by checkout / webhook / download. |
| `indexnow.ts` + `app/api/indexnow/route.ts` | Submits up to 10 000 URLs per call to <https://api.indexnow.org/indexnow>. Used after publishing news / content-blocks / BBW / Reading Club, plus a "submit-all" admin button. |
| `bbw-suggester.ts` (+ test) | Deterministic ranker: weights `recencyOfBans 0.25 / totalBanCount 0.20 / geographicSpread 0.15 / topListPresence 0.15 / diversityBonus 0.25`; previous-2-year penalty 0.40 unless pinned; diversity rules: ≥4 non-US, ≥3 reasons, ≤2 per author. |
| `reading-club-international-suggester.ts` (+ test) | Same pattern, weighted toward geographic + regime spread (≥5 distinct countries, all non-US, regime buckets `west` / `authoritarian` / `theocratic` / `hybrid` / `transitional`). |
| `reading-club-questions.ts`, `discussion-questions.ts` | Anthropic-powered generation of per-book discussion questions. |
| `essays-data.ts` | Single source of truth for essay registry (slug, href, title, dek, publishedAt, readingTimeMin, relatedBookSlugs, draft). Drives essay index, footer, sitemap. |
| `reading-club-data.ts` | Theme→reason mapping (THEME_REASON_MAP) + reading-club helpers. |
| `bbw-data.ts` | DB queries for BBW page (published vs preview-as-admin paths; live stats). |
| `content-blocks.ts` | `getPublishedBlockMap`, `REQUIRED_BLOCKS_BY_PAGE` map; rendering + publish-time validation. |
| `markdown.ts` (+ test) | `marked` + `sanitize-html` to compute `body_html` at save time so reads stay cheap. |
| `sitemap-xml.ts` + `sitemap-static-entries.ts` + `site-urls.ts` | Sitemap helpers; `getAllCanonicalUrls` aggregates static + book + author + country + reason URLs for IndexNow bulk submit. |
| `news-display.ts` | Helpers for rendering news lists. |
| `allowed-image-hosts.ts` | Whitelist of image hostnames; used by `next.config.ts` `remotePatterns` and admin cover-URL validation. |
| `imports/llm-extraction.ts` | **Two-pass extraction** for the import pipeline. Runs identical prompts through Gemini 2.5 Pro/Flash and GPT-4o/4o-mini in parallel; classifies agreement (`full` / `partial` / `conflict` / `single-pass-only`); tolerates year ±1 and transliteration punctuation variants. Tier-configurable (`high-volume` / `high-stakes`). |
| `imports/extraction-prompt.ts` | Shared system prompt that instructs both models on Model 3 multilingual title extraction (latin-script: native primary; non-latin: meaningful English primary + transliteration). |
| `migration-parser.ts` | Parses both pg_dump style (`"public"."authors"`) and hand-written migration SQL (`CREATE TABLE authors`). Used by `diagnose-schema-drift.ts` to compare production introspection against declared schema across seven dimensions. Sprint A: gefixt voor multi-column `ALTER TABLE` statements. |
| `awards.ts` | Reads/renders the `awards jsonb` on books (Pulitzer) + authors (Nobel); drives badges, schema.org `award`, and the `/award-winning-banned-books` hub. Populated by `scripts/enrich-awards.ts`. |
| `bluesky.ts` + `bluesky-post.ts` | AT-Protocol client (`createSession`, `uploadImageBlob`, `createPost`, `latestPostCreatedAt`) + the daily-pick logic (`pickDailyBook`, `buildPost`). Notability gate: ≥2 bans OR any non-US ban. Deterministic per calendar date, reads `bluesky_excluded_books`, UTM links + per-book OG image. Handle `@banned-books.org`. |
| `courtlistener.ts` | CourtListener API client for the live book-ban court-rulings feed on `/countries/us`. The tuned query is load-bearing (only ~5 decided opinions exist). |
| `discover-engine.ts` + `discover-data.ts` | Faceted discovery surface logic for `/discover`. |
| `markdown-twins.ts` | `MARKDOWN_TWINS` map + `prefersMarkdown(accept)`. Middleware rewrites prose URLs to their `.md` twin on a markdown-preferring `Accept`, and advertises the twin via a `Link: rel=alternate` header otherwise (agent-ready content negotiation). The route `matcher` in `middleware.ts` must mirror every key here. |
| `markdown-pages/*.ts` | Source-of-truth markdown for the `.md` long-form exports (about, essays, etc.). |
| `timeline-events.ts` | Curated event list backing `/timeline` (+ PDF). |
| `zenodo.ts` | Concept-DOI constant + citation blocks (APA/MLA/BibTeX) for the open dataset. **Must hold the live concept DOI** (`10.5281/zenodo.20511553`). |
| `indexnow-delta.ts` | Incremental IndexNow submit logic (books/authors `created_at > last submission` + static-URL diff). |
| `admin-session.ts` | Signed session token (`SESSION_COOKIE`, `verifySessionToken`) — hardened auth replacing the plain cookie-equals-secret check. |
| `censorship-context-quality.ts` | QA gate for `censorship_context` text (grounding / contamination checks). |

External SaaS connected:
- **Supabase** (DB)
- **Vercel** (hosting + cron + analytics + speed insights)
- **Cloudflare** (DNS + analytics; `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`)
- **Stripe** (payments)
- **Resend** (transactional email)
- **Zoho Mail** (inbox via IMAP)
- **Formspree** (contact form)
- **Bookshop.org** (affiliate)
- **OpenAI + Google Gemini** (two-pass extraction for the import pipeline)
- **OpenAI + Anthropic** (enrichment / summarisation / discussion questions)
- **Open Library, Google Books, Wikipedia** (free enrichment data sources, used by scripts)
- **PEN America, ALA, Index on Censorship, Freedom to Read Canada, Google News** (news RSS)

---

## 6. Cron jobs (`vercel.json`)

Six jobs (`vercel.json`):

| Path | Schedule | What it does |
|---|---|---|
| `/api/cron/fetch-news` | `0 6 * * *` (daily 06:00 UTC) | Pulls all RSS feeds, summarises with OpenAI, dedupes via embeddings, inserts as `draft` (or `published` when `news_config.auto_publish=true`). |
| `/api/cron/fetch-mail` | `0 * * * *` (hourly) | Connects to Zoho IMAP, replaces the 5 rows in `inbox_preview` so the admin dashboard shows recent inbox at a glance. |
| `/api/cron/cleanup-pageviews` | `0 3 * * 1` (Mondays 03:00 UTC) | Deletes `pageviews` rows older than 90 days. Caps DB size and keeps the visitor-hash distinct counts meaningful. |
| `/api/cron/refresh-views` | `30 * * * *` (hourly) | Refreshes the materialized views (ban counts, rising lists, reason-top, etc.) concurrently. |
| `/api/cron/indexnow-delta` | `0 5 * * *` (daily 05:00 UTC) | Pings IndexNow with books/authors created since the last submission + any newly-added static URLs. |
| `/api/cron/post-bluesky` | `0 14 * * *` (daily 14:00 UTC) | Posts the "banned book of the day" to Bluesky. **DRY-RUN by default** — only ships a live post when `BLUESKY_POST_ENABLED === 'true'`; `?dryrun=1` / `?live=1` override for manual testing. |

All six are protected by `Authorization: Bearer ${CRON_SECRET}`.

---

## 7. What the public site can do

### Top-level navigation
Header: Search · Dataset · Countries · Stats · Reasons · History · Essays · News · About · Reading list.
Footer also surfaces: Challenged books · School bans · Government bans · Sources · Reading club · Banned Books Week · Classics · Privacy · RSS.

### Pages

**Homepage `/` — topical hub (ISR 30 min, `revalidate = 1800`; not force-dynamic anymore)**
Section components live under `src/components/home/`, composed in `src/app/page.tsx` in this order:
- `HeroSection` — hero callout + live total counts (books × countries) in the H1 sub-line + search.
- `BookOfDaySection` — **Book of the day**, deterministic per calendar date (`seed = today's ISO`), pool = top-banned + Latin-script + has-description + `cover_status = valid`, richer card with `description_ban` summary. (This pool also feeds the Bluesky daily bot.)
- `StartHereSection` — "Use this catalogue" intent band (collapsed into one cream band with Book-of-day).
- `HappeningNowSection` — latest published news items.
- `TrendingSection` / `MostBannedAuthorsSection` / `RisingSection` / `WhyBooksGetBannedSection` / `NonEnglishSection` — the five top-lists, each linking to its destination page (`/trending-banned-books`, `/most-banned-authors`, `/rising-banned-books`, `/reasons/{slug}`, `/non-english-banned-books`).
- `FaqSection` — `FaqAccordion` (visible `<details>` + FAQPage JSON-LD from one items array; built by `homepage-faq.ts`).
- `FinalCtaSection` — `Browse all N books →` to `/search`.

**Per-book page `/books/{slug}`**
- Cover (with `BookCoverPlaceholder` fallback), title, author(s), first published year, genres, ISBN.
- `description_book` (synopsis) and `description_ban` ("why it was banned").
- Per-ban list **geclusterd op `(country, year, scope, source)`** (2026-05-21) zodat PEN per-district entries niet meer N regels herhalen voor dezelfde maatregel; granular count zichtbaar wanneer relevant.
- Optional `censorship_context` and `extended_context` (for sensitive titles like *Mein Kampf*; `warning_level` = `none` / `context` / `extended`).
- Affiliate links: Bookshop.org (deep link if probed valid; 308-redirects worden ook als valid behandeld, anders storefront). **Geen Kobo** (affiliate denied 2026-05) en **geen Amazon** — zie `/why-not-amazon`.
- Free Project Gutenberg link when available; archive.org "Read free"-knop wanneer beschikbaar (separate check in `enrich-all`).
- Share buttons; tracked outbound links (logged for Bookshop / Kobo / dataset purchase).
- Schema.org `Book` JSON-LD with `inLanguage` set from `original_language` and `additionalProperty` carrying the record's `data_quality_status` (propertyID `dataQualityStatus`, link to `/data-quality`) so AI-citation crawlers see the provenance signal.
- `lang="fr"` (or other ISO 639-1) attribute on the h1 when `original_language ≠ 'en'`.
- `BanTimeline` component (horizontal SVG timeline) when a book has ≥3 bans.
- **Data-quality indicators** (driven by `books.data_quality_status`): subtle green check next to the title on `confident` records, amber "Limited verification" notice above the lead on `flagged`, neutral provenance line in the footer on every page — all link to `/data-quality`.
- Triggers `trackPageview('book', id)`.

**Model 3 rendering doctrine** (post Step-0):
- Latin-script originals (French, Spanish, German, etc.): native title is primary (h1); English translation secondary.
- Non-Latin originals (Russian, Chinese, Arabic, etc.): English meaningful translation is primary; native + transliteration secondary.
- See `docs/sprint-a/step-0-findings.md` and the `imports/extraction-prompt.ts` for the doctrine in full.

**Per-author page `/authors/{slug}`** — bio, photo, birth country, all banned books. Same data-quality indicators as the book page (driven by `authors.data_quality_status`); flagged-notice copy switches to author-specific facts (biographical dates, nationality, name spelling). `Person` JSON-LD carries the same `additionalProperty` shape as `Book`.
**Country pages `/countries` and `/countries/{code}`** — flag, description, all bans for that country split by status, plus a per-country `FaqAccordion` (data-only for every country, editorial Q&As for US/GB/RU/CN/IR). `/countries/us` additionally renders a **live "In the courts" book-ban litigation feed** from CourtListener (`src/lib/courtlistener.ts`). DoDEA bans (`region='Nation'`, the 583 PEN 24-25 rows) are labelled "U.S. Department of Defense schools (worldwide)" via `nationInstitutionLabel()` — not "Nationwide / statewide".
**Reason pages `/reasons` and `/reasons/{slug}`** — index + book lists per reason.
**Scope pages `/scope/school`, `/scope/government`** — books banned in that scope.

**SEO landing pages** (`revalidate = 86400` — 24h ISR):
- `/top-100-banned-books` — ranked list by `distinct_countries` / `banned_books` (distinct-books metric, niet raw events — zie §13).
- `/most-banned-authors` — author leaderboard (placeholder-auteurs zoals "Anonymous" / "Various Authors" gefilterd).
- `/rising-banned-books` — 14-day rolling rising window, gespiegeld van `mv_top_books_rising`.
- `/non-english-banned-books` — boeken met `original_language ≠ 'en'`; benadrukt Model 3 multilinguale dekking.
- `/banned-classics` — pre-1970 published books still banned.
- `/banned-childrens-books` — children's / YA titles.
- `/challenged-books` — school-scope challenges.
- `/award-winning-banned-books` — Nobel/Pulitzer hub with prize citations (driven by the `awards` JSONB; built 2026-06-13).
- `/banned-books/[year]` — `2022..2026` archives, with `generateStaticParams`.
- `/scope/school` en `/scope/government` ranken nu via `mv_book_scope_counts` (district vs aggregate split, zie §3 + §13).

**Other public surfaces (newer):**
- `/discover` — faceted discovery surface (`discover-engine.ts`).
- `/timeline` (+ `/timeline/pdf`) — censorship timeline, curated via `timeline-events.ts`.
- `/film` — documentary page (lazy YouTube embed + `VideoObject` JSON-LD).
- `/laws/loi-gayssot` — per-law explainer (FR Otto-list vs arrêtés context).
- `/support` — voluntary contributions via Stripe Payment Links.
- `/accessibility` — accessibility statement.

**Stats `/stats`** — interactive charts; **/methodology** — long-form "why the US dominates this data" essay (bevat ook de distinct-books-vs-raw-events uitleg — PEN America 2024-25 telt per district, Wikipedia/ALA per titel; canonical metric = distinct books). **/data-quality** — explainer for the three-level record classification (confident / default / flagged), the signals behind it, and what flagged-status means for a reader. Linked from every quality indicator on book/author pages and from the methodology page.

**Search `/search`** — server-rendered FTS with client filters.

**Essays** — `/essays` index (+ dedicated `/essays/feed.xml` RSS) plus:
- `/history` (legacy flat URL) — 14-min history of censorship.
- `/why-not-amazon` (legacy flat URL).
- `/essays/what-we-document` — editorial choices.
- `/essays/forbidden-knowledge-iceberg` — debunks viral "forbidden knowledge" pyramid lists.
- `/essays/in-whose-name` — anatomy of ban reasons.
- `/essays/the-grey-zone`.
- `/essays/the-line-we-pretend-not-to-draw`.
- `/essays/first-amendment-paradox`.

Each essay declares `relatedBookSlugs` in `essays-data.ts`; an `EssayRelatedBooks` block looks them up. Long-form essays + the editorial prose pages have `.md` twins for AI citation (see §10).

**Banned Books Week `/banned-books-week` + `/banned-books-week/archive`**
- DB-flag `bbw_config.enabled` controls whether the homepage tile + hub are promoted.
- Editorial content blocks (hero subtitle, "what is BBW", "why it matters", "the other side", "what you can do") gate visibility — the page hides each section until its block is `published`.

**Reading Club `/reading-club`**
- Editor-curated featured cover-strip op de hub.
- **Five tracks**: `currently-challenged`, `international`, `classics`, `young-readers` (new, migration `20260526120000`), `by-theme/{slug}` (LGBTQ+, political dissent, religious censorship, race & racism, sexuality).
- Per-book HTML-pagina per track (`/reading-club/{track}/{slug}/`) plus PDF-download (`/{slug}/pdf`) — gratis printbare leesclub-gids. Sitemap + IndexNow includeren deze per-book guide pages.
- Alle 110 discussion-question sets opnieuw gegenereerd 2026-06 (grounded in DB-content, niet vrij geconfabuleerd).
- Tracks zijn cross-linked vanuit Reading list en gebruiken de editorial design language uit de homepage v2 rollout.
- Each book has a custom blurb and (optional) discussion questions stored as JSONB.

**Dataset `/dataset` + `/dataset/success`**
- $19.99 one-time → Stripe Checkout → webhook inserts `dataset_orders` row, mints a 30-day download token, emails it via Resend.
- `/api/dataset/download?token=…` validates token, increments `downloads_count`, streams `private/dataset.zip` (containing `books.csv`, `bans.csv`, `sources.csv`, `countries.csv`, `authors.csv`, `reasons.csv`, `dataset.json`, `dataset.sqlite`).
- License: perpetual personal/research use; commercial requires a separate license.

**News `/news`** — published items from the pipeline. RSS at `/feed.xml`.

**About / Privacy / Sources** — about page lists current stats live; sources page lists every source used. Founder-narrative is gesplitst (2026-05-19): persoonlijk "why I built this" op `/about`, kort feitelijk bio + media kit op `/press`.

**Press `/press`** — media kit: boilerplate, live stats, logos, story angles, `Organization` JSON-LD. Doel: journalisten en citation-tools krijgen feiten direct, lezers op `/about` krijgen motivatie.

### Privacy posture
- No third-party trackers, no sponsored content alongside the catalogue.
- Visitor IP is never stored; only `sha256(daily_salt ‖ ip ‖ ua)`.
- Cookies declined automatically (privacy-by-default) — except `admin_session`.
- AI crawlers (GPTBot, ClaudeBot, OAI-SearchBot, PerplexityBot, etc.) are **welcome** — the project's strategy treats AI traffic as desirable; don't propose blocking them.

### Theme
- **Light mode wordt site-wide geforceerd** (2026-05-20). `dark:`-variants in Tailwind zijn class-based (niet `prefers-color-scheme`); UI honoreert geen OS dark-mode. Reden: editorial design language is op één lichte palette gekalibreerd.

---

## 8. What the admin can do

`/admin` is gated by an `admin_session` cookie set on `/admin/login` (compared
to `ADMIN_SECRET`). Page routes are protected by `src/middleware.ts`; API
routes under `/api/admin/*` re-check via `requireAdmin()`.

### Dashboard (`/admin`)
- Counts: books / draft news / bans / countries.
- Cards: Books · Writers · News · Inbox · Database (with a coloured DB-size gauge against `SUPABASE_DB_LIMIT_GB`, default 8 GB) · Quick actions (links to Supabase, Vercel, Cloudflare, Resend, Formspree, Stripe, Bookshop dashboards) · Data quality · Materialized views (timestamps + "Refresh now") · Dataset sales (paid orders, revenue, total downloads, suspicious-download flag if any order > 10 downloads, "Rebuild now" button) · Essay prompt.
- Cloudflare 24h traffic snapshot (`cloudflare-cards.tsx`) — totals, cached %, status buckets, deltas vs previous 24h, top IPs (tagged home/work/bot via `known-bots.ts`).

### Tabs
Overview · Stats · BBW · Reading Club · Content blocks.

### Books admin
- `/admin/books` — paginated, searchable list.
- `/admin/books/[slug]` — edit form: title, year, genres (csv), cover URL (live preview, host-whitelist warning), book description, ban description, censorship context, AI-drafted flag, warning level, inclusion rationale, extended context.

### Authors admin — bios, photos, birth country.

### News admin
- Triage drafts → publish (single Publish button per row).
- Toggle `news_config.auto_publish` (so daily cron auto-publishes vs. parks as draft).
- Tune `dedup_threshold` and `dedup_window_days`.

### Banned Books Week admin
- Toggle `bbw_config.enabled`, set year, start/end, promo-start dates.
- Run the suggester for a year → preview top 10 + 15 alternates → swap, pin, edit blurb → publish.

### Reading Club admin
- Per-track editor (currently-challenged / international / classics / young-readers / themes).
- Generate discussion questions via Anthropic (per book).

### Bluesky admin `/admin/bluesky`
- Status, today's generated post preview (text, grapheme count, link facet, card metadata), upcoming-queue, and recent feed (engagement counts).
- **Skip / restore** a title from the daily rotation → writes/deletes a `bluesky_excluded_books` row (`/api/admin/bluesky-exclude`). The picker rerolls any date that lands on an excluded book, so skipping changes only that day.

### Zenodo admin `/admin/zenodo`
- Re-deposit guide + external links (Zenodo record, ORCID). The deposit-diff tooling (`scripts/`) decides when a new dataset version is warranted.

### Import review `/admin/import-review` (+ `[id]`)
- Triage the `import_review_queue`: approve / reject / defer / merge (single + bulk). Each row has a "Google ↗" lookup button. Fed by the import pipeline when the auto-approve gate declines.

### In-app enrichment runner `/api/admin/enrich/{dispatch,run,status}`
- Server-side enrichment dispatcher (covers/descriptions/ISBN/bios) callable from the admin UI, complementing the CLI scripts.

### Content blocks admin
- Edit any of the seeded slugs (BBW, Reading Club). Markdown → HTML at save time. Status workflow: `placeholder` → `draft` → `published`. Public pages won't render unpublished blocks.

### Sitemap & IndexNow `/admin/sitemap`
- View counts per sitemap.
- Bulk-submit all canonical URLs to IndexNow.
- Submit new pages — incremental submit van URLs sinds laatste submission, via `/api/admin/indexnow-delta`.

### Scripts reference `/admin/scripts`
A curated catalogue of the ~180+ TSX scripts in `scripts/`, grouped by purpose
(adders, enrichers, fixers, audits, builders) with cost tags (`free APIs`,
`OpenAI cost`, `Anthropic cost`, `destructive`, `read-only`) and the exact
command lines.

### Inbox
Last 5 Zoho Mail messages in a card; "Sync now" hits `/api/admin/sync-inbox`; a deep link opens Zoho mail.

---

## 9. Positioning

**Tagline.** "An open catalogue of censored literature."
**H1 on home.** *The World's Books Under Censorship.*

**Differentiation vs. ALA / PEN America / Index on Censorship:**
1. **Global scope** including defunct states (USSR, East Germany, Czechoslovakia, Yugoslavia) — not US-school-only.
2. **Per-book context** — a "why it was banned" paragraph and a censorship-context block, not just a list.
3. **Browsable along three axes** — country, reason, author (plus genre, scope, year).
4. **Source citations on every ban** — PEN, ALA, Index on Censorship, Freedom to Read Canada, Wikipedia, court records.
5. **Free public-domain reading links** — Project Gutenberg where applicable.
6. **Honest about coverage gaps.** `/methodology` and the About page openly say: the US dominates because the US *counts*, not because the US bans more — Iran/China/Russia/NK ban much more, document much less.
7. **Engages with counter-arguments seriously.** The BBW "Other side" content block (≥250 words) takes parental-rights / age-appropriateness / curriculum-vs-ban distinctions seriously. This is part of the editorial brief.
8. **No-Amazon stance** — explained in `/why-not-amazon`. Bookshop only (Kobo affiliate program denied 2026-05; geen actieve framing rond Kobo-rejection).
9. **Independent.** No funding from publishers, governments, advocacy. One-person project + open-source tools.
10. **AI discovery is desirable, not adversarial.** AI crawlers worden actief verwelkomd; de site publiceert `.md` long-form prose exports, een `/llms.txt` index, en draagt `Banned Books` als page-author/publisher in metadata zodat citation-tools de bron correct toeschrijven. Zie §10 voor de techniek.

**Editorial line.** Documents censorship; doesn't endorse it; doesn't endorse the books either. Includes morally objectionable titles (e.g. *The Turner Diaries*, *The Anarchist Cookbook*, *Mein Kampf*) with extended context and warning labels rather than excluding them.

---

## 10. SEO model

The site is heavily optimised for organic discovery — both classic SEO and
LLM-driven traffic.

### Indexable surface
- `robots.ts` — `User-agent: *`, `Allow: /`, sitemap pointer.
- `next.config.ts` — `X-Robots-Tag: noindex` on `/_next/image/*` only (transformed images shouldn't be indexed; the canonical book page should).
- AI crawlers explicitly allowed (project policy).

### AI-citation surface
- `/llms.txt` — discoverability index voor LLM-crawlers; punt naar de canonieke long-form prose.
- `.md`-exports van editorial long-form pagina's: `/about.md`, `/history.md`, `/methodology.md`, `/data-quality.md`, `/why-not-amazon.md`, plus elke essay (`/essays/*.md`). **Content-negotiation via middleware**: een markdown-preferring `Accept`-header krijgt de `.md` twin op dezelfde URL (rewrite + `Vary: Accept`), HTML-requests krijgen een `Link: rel=alternate; type=text/markdown` header zodat agents de twin ontdekken. Map = `src/lib/markdown-twins.ts`; de middleware `matcher` moet elke key spiegelen. (isitagentready.com Level 4.)
- **`Banned Books` als named page-author/publisher** in metadata + JSON-LD zodat citation-tools de bron correct toeschrijven (i.p.v. anonieme web-content).
- `Dataset` JSON-LD op `/dataset` voor Google Dataset Search indexing.
- `Book` / `Person` JSON-LD dragen `additionalProperty[dataQualityStatus]` zodat AI-crawlers het provenance-signaal zien (`confident` / `default` / `flagged`).

### Sitemaps
Index at `/sitemap.xml` references five split sitemaps so each stays small:
- `sitemap-static.xml` — homepage, top-100, banned-classics, year archives, countries hub, stats, reasons, news, essays, reading-list, methodology, dataset, privacy, challenged-books, scope/{school,government}, reading-club hub + 4 tracks + 5 themes, BBW hub.
- `sitemap-books.xml` — every book slug.
- `sitemap-authors.xml` — every author slug.
- `sitemap-countries.xml` — every country with at least one ban.
- `sitemap-reasons.xml` — every reason slug.

`changefreq` and `priority` are tuned per route in `sitemap-static-entries.ts`. BBW gets a higher changefreq/priority while `bbw_config.enabled = true`.

### IndexNow
- `/indexnow.txt` carries the verification key.
- `lib/indexnow.ts` submits up to 10 000 URLs per call.
- Hooks: every editorial publish (news, content blocks, BBW, Reading Club) and a manual "submit all canonical URLs" button at `/admin/sitemap` ping IndexNow so Bing / Yandex / Naver pick changes up immediately.
- `getAllCanonicalUrls()` aggregates static + book + author + country (with bans) + reason URLs.
- Sprint A heeft een incremental submit-pad toegevoegd via `indexnow_submissions` tracking-tabel en `/api/admin/indexnow-delta`. Bugfix: `lib/site-urls.ts` `fetchAllSlugs` had gaps/duplicates boven 1000 rijen door paginated reads zonder `.order()` — gefixt.

### On-page
- `metadataBase` + per-page `generateMetadata`. Every page sets `alternates.canonical`.
- Open Graph: `siteName: 'Banned Books'`, `type: 'website'`, locale `en_US`. Default OG image at `app/opengraph-image.tsx`.
- Twitter: `summary` card.
- Schema.org JSON-LD: `Organization` on `/about` + `/press`, `Book` on `/books/[slug]` with `inLanguage` + `award` (when the book/author carries one) + `additionalProperty[dataQualityStatus]`, `Person` on `/authors/[slug]`, `FAQPage` on `/` + each `/countries/[code]`, `VideoObject` on `/film`, `Dataset` (open core) on `/dataset`. One FAQPage per URL.
- RSS at `/feed.xml` linked from `<head>`.
- Canonical pages: `/books/{slug}` and `/authors/{slug}` are the indexable canonicals; pages like `/top-100-banned-books`, `/banned-classics`, `/banned-books/{year}`, `/challenged-books`, `/scope/{school|government}` exist as **second-tier landing pages** that link inward.

### Page weight & rendering
- Mostly server components; SEO landings use 24h ISR (`revalidate = 86400`).
- Homepage: ISR 30 min (`revalidate = 1800`) — no longer `force-dynamic`.
- **`/books/[slug]` + `/authors/[slug]`: `revalidate = 86400` (24h ISR), prebuild gecapt op top-2000** by ban-tally (`PREBUILD_LIMIT = 2000` in `generateStaticParams`). Reden (2026-06-16): de volledige ~15.9k-route prebuild bóuwt prima maar **crasht Vercel deploy-finalisation** ("Maximum call stack size exceeded") rond ~16k routes; de tail wordt verdedigd door goedkope renders + 24h-ISR + Cloudflare-challenge. Per-render DB-load gehalveerd (React `cache()` shared book+blocklist fetch). Enrichment propageert via deploy / 24h-ISR / `POST /api/admin/revalidate` (bust één slot). Drijfveer was een gedistribueerde scraper-swarm die de DB overbelastte.
- `next/image` with `formats: ['image/webp']`, `minimumCacheTTL: 31536000` and immutable cache header on `/_next/image/*`.
- Vercel Speed Insights enabled.
- **Lever-noot**: `adminClient()` = PostgREST (NIET pgbouncer); de 6543-pooler is een dead-end lever voor render-load. ISR Writes zijn de grootste Vercel-line — vandaar 24h i.p.v. 1h.

### Performance levers (already in place)
- Materialized views for ban counts (per-country, per-(country×reason)) and rolling rising lists.
- `pg_trgm` indexes for free-text search.
- Composite pageview indexes for trending/rising.
- 60s in-memory cache for `bbw_config` and `news_config` (keeps the DB cold for the homepage tile check).

---

## 11. Environment variables

Required (see `.env.example` + actually used):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL                  # Pooled connection (port 6543), for app code via pgbouncer
DIRECT_URL                    # Direct connection (port 5432, session mode), required for schema-introspection scripts
NEXT_PUBLIC_BASE_URL          # https://www.banned-books.org
ADMIN_SECRET                  # session cookie value + Bearer for IndexNow / API
CRON_SECRET                   # Bearer for /api/cron/*
VISITOR_SALT_SECRET           # daily-salt seed for visitor_hash
OPENAI_API_KEY                # Used for enrichment + GPT-4o in two-pass extraction
GOOGLE_AI_API_KEY             # Gemini 2.5 Pro/Flash for two-pass extraction
ANTHROPIC_API_KEY             # Optional, for Anthropic-powered discussion-question generation
STRIPE_SECRET_KEY
STRIPE_PRICE_ID
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
EMAIL_FROM
EMAIL_REPLY_TO
ZOHO_IMAP_HOST
ZOHO_IMAP_USER
ZOHO_IMAP_PASS
CLOUDFLARE_ZONE_ID
CLOUDFLARE_API_TOKEN
INDEXNOW_KEY
ADMIN_HOME_IPS                # comma-separated, used to tag IPs in the traffic dash
ADMIN_WORK_IPS                # comma-separated
SUPABASE_DB_LIMIT_GB          # optional; defaults to 8 (Pro plan)
BLUESKY_HANDLE                # @banned-books.org (daily bot)
BLUESKY_APP_PASSWORD          # AT-Protocol app password
BLUESKY_POST_ENABLED          # 'true' to ship live posts; otherwise the cron dry-runs
```

---

## 12. Achievements to date

### Snapshot 2026-06-16 (since the 2026-05-22 entry below)

**Catalogue grew ~6× to 15.888 books / 31.404 bans / 119 countries.** Major imports + cleanups:
- **Russia FSEM batch (2026-06-05)** — 372 bans, RU 138 → 510 (418 FSEM minjust entries); ~326 flagged editor-review; full ~5500-entry crawl still open. `scripts/import-russia-bans.ts`.
- **PEN 2021-22 + 2022-23 import support**; **3.399 vague PEN aggregate roll-ups deleted** (`institution=null`, source `pen.org/book-bans/`) via `cleanup-vague-pen-rollups.ts` — 310 keepers kept; DoDEA 583-row typo fixed.
- **Dedup doctrine hardened** — institution-variant ban dedup (`normalizeInstitution`), multi-year PEN re-listing merges, cross-language/cross-script dupe merges (Anton LaVey, Li Hongzhi), parenthetical-suffix + ISBN-collision merges, PEN author-suffix collapse fix. The wiki-enrichment matcher root cause (wrong-row guard + variant-aware dedup) was fixed in `apply-wiki-enrichment.ts` (f38836d).
- **23 Canadian challenges** (Nipissing → Freedom to Read verified); **12 ZA apartheid bans** (Literature Police); **31 FR arrêtés** (Loi du 16 juillet 1949, hand-curated — Legifrance stays Cloudflare-403); Liste Otto "Toutes ses œuvres" blanket-works isolated.

**Bluesky daily bot (2026-06-16)** — `@banned-books.org` "banned book of the day" auto-post built end-to-end (AT-Proto client, notability gate ≥2 bans OR any non-US ban, UTM links, per-book OG image, upcoming-queue, engagement counts, `/admin/bluesky` skip/restore). **Posting OFF by default** (`BLUESKY_POST_ENABLED`); cron dry-runs in prod until flipped.

**Awards layer + hub (2026-06-13)** — `awards jsonb` on books (Pulitzer, book-level) + authors (Nobel, author-level); 47 Nobel authors + 27 Pulitzer books hand-verified (`data/award-overlap.md`); badges + schema.org `award`; `/award-winning-banned-books` hub with citations. `scripts/enrich-awards.ts`.

**CourtListener litigation feed (2026-06-10)** — live book-ban court-rulings feed on `/countries/us` (tuned query is load-bearing; ~5 decided opinions exist). ALA Top-100 fully covered (0 gaps).

**Native-title enrichment (2026-06-15)** — `scripts/enrich-native-titles.ts` fills `title_native` + script for ~4.188 foreign books stored under English titles (Wikidata CC-0; gate = written-work P31 + P50 author-match incl. aliases; non-Latin translit stays NULL, review-gated). Findability: search + schema `alternateName` + secondary title line.

**Author/book slug aliases + dedup (2026-06-13)** — new `author_slug_aliases` table (mirror of `book_slug_aliases`) + author-page alias fallback (308 redirect). Future author merges must insert an alias row.

**Agent-ready markdown content negotiation (2026-06-07)** — `.md` twins served via middleware on a markdown `Accept`, advertised via `Link: rel=alternate` otherwise. `/llms.txt` index. isitagentready.com Level 4.

**Enrichment + data-quality sweeps (2026-06)** — shared Google Books client (key + placeholder-safe covers); OL/GB harvest split (free exact-key OL harvest + GB orphan-only); author-bio contamination remediation (`remediate-author-bios.ts`, LLM-verified, root-cause gate on subject + writer-category); cover de-contamination (author guard + vision audit/remediation, study-guide work_id detection); AI-description QA phase 1 (2.409 ungrounded heavy-filler `description_book` wiped); cross-model `ai_consensus` description tier; `score-data-quality.ts` per-record classification (now 5151/8410/2327 confident/default/flagged books); `scripts/audit-integrity.ts` standing integrity gate (invariants exit 1, drift vs baseline) replacing ad-hoc `_audit_*` snapshots; scripts archive outflow + unified `--apply` convention (`scripts/lib/cli.ts`).

**Open dataset on Zenodo (CC-BY-4.0)** — separate open export (`scripts/build-zenodo-dataset.ts`), live concept-DOI `10.5281/zenodo.20511553`, citation blocks (APA/MLA/BibTeX) + homepage line; `/dataset` presents open + commercial as two equal options (one `Dataset` JSON-LD entity for the open core, paid = `Product`). `/support` Stripe Payment Links added.

**Books-page rendering hardened (2026-06-16)** — `/books/[slug]` + `/authors/[slug]` prebuild capped at top-2000 by ban-tally (full prebuild crashes Vercel deploy-finalisation at ~16k routes), ISR 1h → 24h, per-render DB load halved (shared `cache()` fetch). Driven by a distributed scraper-swarm overloading the DB.

**Admin hardening (2026-06)** — signed session token + consolidated guards + rate limit + logout (`admin-session.ts`); shared admin shell with toasts/confirm-modal/unsaved-changes guard/SPA nav; in-app enrichment runner (`/api/admin/enrich/*`); `/admin/bluesky` + `/admin/zenodo`.

**New public surfaces** — `/discover`, `/timeline` (+PDF), `/film`, `/laws/loi-gayssot`, `/accessibility`, `/banned-childrens-books`, reading-club `young-readers` track, four new essays (`in-whose-name`, `the-grey-zone`, `the-line-we-pretend-not-to-draw`, `first-amendment-paradox`), `/essays/feed.xml`.

**SEO/visibility context** — the May 2026 Google core update caused a site-wide ~95% **impressions** collapse (not a position demotion; pages still indexed, no manual action) on a 2-month-old site — algorithmic ranking-suppression; Bing/DDG rose simultaneously. Lever = content quality + authority, realised at the next core update. Edge-request "11×" spikes are benign Googlebot/Yandex recrawl waves. See §14.

---

### Snapshot 2026-05-22

**Editorial design language + homepage v2 (2026-05-19 → 2026-05-21)** — homepage redesign live (hero callout, search bar i.p.v. pills, richer Book of the day met `description_ban` als samenvatting, daily rotation + cross-section dedup + cover-valid filter). Editorial design language doorgetrokken naar `/reading-club`, `/reading-list`, `/press`, `/dataset`. Site-wide forced light mode (dark-mode variants nu class-based, niet system). Reading list hernoemd en cross-linked vanuit Reading Club.

**Reading Club uitgebreid (2026-05-21)** — Editor-curated featured cover-strip op `/reading-club` hub. Per-book HTML-pagina per track + per-book PDF-download (`/reading-club/{track}/{slug}/pdf` voor classics/international/by-theme, `/{year}/{position}/pdf` voor currently-challenged). Gratis printbare leesclub-gids.

**Press page + founder narrative split (2026-05-19)** — `/press` media kit (boilerplate, live stats, logos, story angles, `Organization` JSON-LD) gescheiden van persoonlijke "why I built this" narrative op `/about`. Journalisten krijgen feiten, lezers motivatie.

**AI-citation surface uitgebouwd (2026-05-19)** — `/llms.txt` index + `.md`-exports voor `/about`, `/history`, `/methodology`, `/data-quality`. `Banned Books` als named page-author/publisher in metadata + JSON-LD. `Dataset` JSON-LD op `/dataset` voor Google Dataset Search.

**District-vs-aggregate ban-event split (2026-05-21)** — PEN America 2024-25 import op school-district granularity (1 boek × N districts = N rijen), naast Wikipedia/ALA per-titel aggregaten. Nieuwe `mv_book_scope_counts` MV splitst `district_events` / `state_events` / `aggregate_events` / `total_events`; `v_top_banned_books` + `v_top_banned_authors` krijgen `granular_events` + `aggregate_events` aan de staart. Verdere doctrine: canonical metric blijft `distinct_books` / `distinct_countries`, niet raw events — anders inflatie van ~+1 op 94% van US-school boeken en top-N shuffle. `/scope/[slug]` consumeert MV.

**Kobo affiliate weggevallen (2026-05-22)** — Kobo wees affiliate-aanvraag af. Alle Kobo CTAs en references gescrubd uit codebase. Bookshop blijft de enige affiliate-partner.

**Bookshop affiliate-laag uitgebouwd (2026-05-21)** — affiliate-lijst per pagina uitgebreid naar 12; embedded op reason- en scope-pages. Cross-reference script resumable via state-file; 308-redirects als valid behandeld; 374 working alt-ISBN's gerapporteerd. Edition-level guard vangt translation/language collisions.

**Book-page bans clustering (2026-05-21)** — per-ban list groept nu op `(country, year, scope, source)` zodat PEN per-district entries niet meer N regels herhalen voor dezelfde maatregel; granular count zichtbaar wanneer relevant.

**Blasphemy → religious taxonomie-merge (2026-05-20)** — `blasphemy` slug uitgefaseerd, alle `ban_reason_links` herwezen naar `religious`. Twaalf reason-slugs i.p.v. dertien.

**147 dupe-books + 39 dupe-bans merged (2026-05-20)** — parenthetical-suffix en ISBN-collision dupes geconsolideerd; soft-duplicate bans op (book, country, scope) samengevoegd. Plus Gaie France Magazine → Gaie France auteur-merge.

**Anon-access lockdown (2026-05-20)** — Supabase security advisor flagde anon-leesbare surfaces; gesloten. Singleton config-rijen (`news_config`, `bbw_config`) lezen alleen nog via `adminClient()`.

**Permanent not_found stamps (2026-05-20)** — ISBN-13 / cover / description enrichment-lookups krijgen permanente `not_found` markering zodat retry-stormen niet de pipeline opvreten; auto-paginate voor Gutenberg + archive.org.

**Authors bio scrubbing (2026-05-21)** — HTML entities en IPA pronunciation gestript uit Wikipedia-bios.

**`/press` Organization JSON-LD + Dataset JSON-LD live** — voor citation-tools en Google Dataset Search.

---

### Earlier achievements (snapshot 2026-05-18)

- **Data-quality classification system (2026-05-18)** — three-level per-record status (`confident` / `default` / `flagged`) on books + authors, computed offline by `scripts/score-data-quality.ts` from canonical-id presence, ban evidence (≥3 landen of ≥5 totaal, of geverifieerde bans), editorial completeness, and author legitimacy. Drives UI indicators (subtle green check, amber "limited verification" notice, footer provenance line — all linking to `/data-quality`), the new `/data-quality` explainer page, and `additionalProperty` on Book + Person JSON-LD for AI-citation surfaces. Initial classification on production: 2545/2861/141 books (confident/default/flagged) and 998/2693/23 authors. Migration `20260518065314_data_quality_status.sql`; admin script reference in `/admin/scripts`.
- **A working catalogue** with thousands of books and bans across many countries (live counts on `/about` and the homepage).
- **Database baseline established (Sprint 0.5)** — schema-history consolidated into a single baseline migration generated from production via `supabase db dump`; legacy 001-023 migrations archived; Supabase CLI integrated as the canonical migration tooling; `supabase_migrations.schema_migrations` registered in production for the first time.
- **Seven-dimensions schema-drift diagnostic** — `scripts/diagnose-schema-drift.ts` compares production against migration files for tables, columns, views, materialized views, indexes, RLS policies, and triggers. Confirmed zero drift after Sprint 0.5.
- **Two-pass LLM extraction module (Step 0 + Sprint 0.5)** — Gemini 2.5 Pro/Flash + GPT-4o/4o-mini run in parallel on the same input; agreement-classification supports `full` / `partial` / `conflict` / `single-pass-only`; tier-configurable (~$10 vs ~$70 per 5000 entries). Validated on 10 fixture entries across 6 languages.
- **Three French books live as Model 3 validation** — *Suicide, mode d'emploi*, *Éden, Éden, Éden*, *La Question*. Confirms the rendering doctrine works for Latin-script non-English content.
- **A repeatable enrichment pipeline** — descriptions, censorship context, covers, ISBNs, author bios + photos, Bookshop ISBN cross-reference, Project Gutenberg detection, genre seeding. Roughly 180+ maintenance scripts catalogued in the admin Scripts page.
- **A privacy-safe analytics layer** (visitor_hash, 90-day retention) with trending / rising / top-by-country / top-referrer views and an admin dashboard for Cloudflare zone analytics.
- **Editorial CMS** for content blocks + Banned Books Week + 4-track Reading Club, with draft/publish workflow, audit log, and editor-controlled BBW kill switch + dates without code deploys.
- **News pipeline** with embeddings-based dedup, runtime auto-publish toggle, RSS ingestion from 5 sources, summarised by `gpt-4.1-mini`. Schema supports non-English feeds via `source_language` + `original_title` + `original_summary` columns (Sprint A delivers the actual non-EN feed integration).
- **Monetisation live** — paid dataset via Stripe + 30-day download tokens + Resend delivery; Bookshop / Kobo affiliate tracking with click-type analytics.
- **SEO infrastructure** — split sitemaps, IndexNow integration with bulk-submit, schema.org JSON-LD with `inLanguage` for multilingual books, open-graph + RSS, second-tier landings (top-100, banned-classics, year archives, scope, challenged).
- **Operational tooling** — admin dashboard with DB-size gauge, materialized-view refresh button, dataset-rebuild button, Zoho inbox preview, and a one-page reference for every CLI script.

**Sprint A taken 1, 1.5, 2A, 2B + IndexNow-feature afgerond (2026-05-12)**

- **Taak 1** — `toSlug()` NFD-normalisatiebug gefixt (finding #1); `unaccent` extension toegevoegd; 2 corrupte slugs hersteld. Commits `b52cbfb..25f0e7b` (4 commits).
- **Taak 1.5** — bulk NFD slug-fix: 49 slugs hersteld (21 books + 28 authors), 49 permanente redirects via `next.config.ts redirects()`, 4 duplicate-author collisions gedocumenteerd voor follow-up. Commits `a15474d..3dfecb7` (4 commits).
- **Taak 2A** — schema additions: 2 enums (`verification_status`, `import_review_status`), `verification_status` kolom op `ban_sources`, 4 Model 3 kolommen op `books`, `import_review_queue` tabel. Commits `75471ae..be055d6` (3 commits).
- **Taak 2B** — data backfill: 2 + 252 `ban_sources` rijen, 4099 en-books `title_native`, 49 fr-books `title_native`. 334 rijen non-en/non-fr verschoven naar Taak 4. Commits `9a52282..eb711cc` (3 commits).
- **IndexNow delta-feature** — `indexnow_submissions` tracking-tabel, `/api/admin/indexnow-delta` endpoint, admin UI "Submit new pages"-knop, `fetchAllSlugs` paginated-read bugfix.
- **Migratie-tooling** — `migration-parser.ts` ondersteunt nu multi-column `ALTER TABLE`; `scripts/seed-local-from-prod.ts` gebouwd als doctrine-tool voor data-migratie workflow.

**Review-queue triage helper (2026-05-14)** — `scripts/remap-unmapped-queue.ts` haalt de huidige `mapReason()` opnieuw over `import_review_queue`-rijen die nog de `unmapped_reason` quality-flag dragen. Strict-mapper hits (pass-1) verwijderen de flag en updaten `agreement_details.reason_mapping`; brede heuristiek (pass-2, geport vanuit `scripts/reclassify-other-reasons.ts`) vult een low-confidence slug in maar behoudt de flag zodat de editor de gok herkent. Eerste run patchte 19 van 181 unmapped rijen (1 strict + 18 broad). Tegelijk: word-boundary bug in `reason-mapper.ts` lèse-majesté-patroon gefixt — JS `\b` werkt niet op de trailing `é` (non-`\w`), waardoor "lese-majesté rules" niet matchte. Gedocumenteerd op `/admin/scripts#review-queue-helpers` en gelinkt vanaf de import-review banner.

**Review-queue Google-search knop (2026-05-14)** — kleine UX-toevoeging voor boeken die vast zitten in review. Elke rij in `/admin/import-review` toont nu een "Google ↗"-knop naast "Open →"; de detailpagina-header heeft dezelfde knop naast de status-badge. Klik opent `google.com/search?q=` met `"titel" auteur1 auteur2` in een nieuw tabblad (`target="_blank"` + `rel="noopener noreferrer"`) zodat de editor snel achtergrond-info kan opzoeken zonder handmatig te kopiëren. Implementatie: helper `googleSearchUrl()` lokaal in `src/app/admin/import-review/list-client.tsx` en `[id]/detail-client.tsx`. Commit `c73ce28`.

**Reason-mapper ALA-corpus expansion (2026-05-14)** — Naast de eerdere master-aggregator (international-corpus) patterns nu ook ALA-challenge-cell phrasings toegevoegd aan `src/lib/wikipedia/reason-mapper.ts`: zeven nieuwe pattern-blokken voor `sexual` / `religious` / `political` / `violence` / `racial` / `moral` / `language`. Pakt ALA-boilerplate zoals "sexual references", "sex education", "witchcraft", "supernatural themes", "political viewpoint", "un-American content", "gang violence", "stereotypes of [ethnicity]", "anti-family", "unsuited to age group", "offensive language", "slurs" — die de eerdere Wikipedia-georiënteerde patterns niet dekten. Bestaande blokken uitgebreid: LGBTQ + `gay marriage` / `gender identity`; drugs + `drug use` / `drug references`. Doel: nieuwe ALA-imports leveren minder rijen met `unmapped_reason` af; reeds binnengekomen rijen worden retroactief opgepakt door `scripts/remap-unmapped-queue.ts`.

**Queue-clearing operatie (2026-05-15)** — `import_review_queue` van 1099 → 307 pending (−72%) in één sessie, 792 commits naar production books + bans. Vier nieuwe mechanismen + zes scripts. **Geen DB-schema-wijzigingen**; alleen JSONB `agreement_details` + nieuwe enum-waarden in `QualityFlag` (TS-only).

*Mechanismen:*

1. **Source-level `fallback_reason_slug`** (`src/lib/wikipedia/types.ts`, `config.ts`, `reason-mapper.ts`). Nieuwe optionele `SectionConfig.fallback_reason_slug`. `mapReason(notes, fallback?)` retourneert die slug + nieuwe flag `source_default_reason` (blauw badge) wanneer notes leeg/triviaal zijn (HK matrix-`✓`, Index Librorum lege citatie-cellen). Geconfigureerd: HK → `political`, Index Librorum → `religious`, NZ per-sectie (IPT eras → `obscenity`, WW1/WW2 → `political`). Plus HK section krijgt `original_language: 'zh'` zodat review-form auto-fills. Wired in `import-wikipedia-list.ts`, `replay-dedup-on-queue.ts`, `remap-unmapped-queue.ts`.
2. **Reason-mapper pattern-uitbreiding** — NZ R-rating: `restricted N in YYYY` → `obscenity`. China political corpus: `critical of (the )?CCP`, `cultural revolution`, `mao zedong`, `propaganda department`, `chinese communist (party|rule)`, etc → `political`.
3. **Year-extractie** uit titel + notes. `src/lib/wikipedia/parser.ts` krijgt `TRAILING_YEAR_RANGE_PAREN` (`(YYYY – YYYY)` / `(YYYY or YYYY)`, eerste jaar wint) — gespiegeld in `scripts/backfill-year-from-title.ts` voor bestaande queue-rows (33 hits: China + Index). `scripts/backfill-year-from-notes.ts` haalt het eerste 4-digit jaar uit `notes_raw` voor rows die ook geen jaar in de titel hebben — tag met nieuwe flag `year_inferred_from_notes` (amber, niet-blokkerend) zodat de reviewer weet dat het een best-guess is. NZ-scope eerste run: 87 hits.
4. **Bulk auto-accept + auto-merge** — `scripts/bulk-auto-accept-queue.ts` keurt rijen goed via het bestaande `approveQueueRow` pad. Acceptcriteria: `reason_mapping.slug` gevuld, year + authors[0] + title aanwezig, `dedup_check.kind` in `{null, 'none'}`, geen civil/defamation/possible_duplicate flags. **Operator-decision 2026-05-15: `model_3_review_needed` is voor de wiki-parser géén blokker meer** — de bilingual `/` splitter levert stabiele Latin-transliteraties als canonical title. Non-Latin filter (`[\p{Script=Han}\p{Script=Cyrillic}…]`) blijft als safety net voor de ~15 HK rows waar de parser op `=` separator faalt. Idempotent: `approveQueueRow` werkt SELECT-then-INSERT op `(slug)` en `(book,country,year,scope)`. `scripts/auto-merge-confirmed-duplicates.ts` doet hetzelfde via `mergeQueueRowIntoBook` voor `dedup_check.kind === 'duplicate'`. `scripts/auto-merge-slug-collisions.ts` vangt het edge case waar year-backfill een titel opschoont en de gestripe slug ineens met een bestaand book bottst — wordt automatisch via merge-pad afgehandeld.

*Resultaten per laag:*
- Phase 1 (source-default reasons): 701 reasons pre-filled (611 HK + 90 Index)
- Phase 2 (patterns + NZ fallbacks): 82 extra mappings (NZ R-rated + China politics + 12 NZ wartime/IPT)
- Phase 3 (confirmed duplicates merge): 4 nieuwe bans op bestaande books
- Phase 4a (bulk auto-accept, Latin-only): 183 nieuwe books
- Phase 4b (bulk auto-accept met model_3 versoepeld): 518 nieuwe books (allemaal HK Pinyin)
- Year-from-title backfill: 33 rows (China + Index range-jaren)
- Year-from-notes backfill: 87 NZ rows
- Bulk-accept op de nieuw eligible rows: 75 extra (10 + 64 + 1)
- Slug-collision auto-merge: 9 extra merges

*Wat de 307 nog vasthoudt:* ~62 Iran (geen jaar in titel of notes), ~80 essay-style notes zonder pattern, ~70 `possible_duplicate` fuzzy-dedup, ~38 `no_author`, ~15 HK met CJK in canonieke titel (parser `=`-separator bug — open follow-up), 13 NZ zonder bruikbaar jaar, 5 civil/defamation editorial, q#1250 (puur-CJK author slug).

*Nieuwe scripts in `scripts/`:* `_check_auto_approve_candidates.ts` (queue-gate histogram), `_check_unmapped_patterns.ts` (notes-text clustering per source), `backfill-year-from-title.ts`, `backfill-year-from-notes.ts`, `auto-merge-confirmed-duplicates.ts`, `auto-merge-slug-collisions.ts`, `bulk-auto-accept-queue.ts`. Allemaal dry-run by default; `--write` voor commit. Pre-existing `remap-unmapped-queue.ts` uitgebreid naar 3-pass (strict-patterns → source-fallback → broad-heuristic).

*Open follow-ups:* (a) parser-fix voor HK `=`-separator zodat de 15 mangled rijen alsnog bilingual splitten; (b) year-from-notes draaien op niet-NZ sources; (c) enrichment-pipeline (covers/descriptions/ISBN) op de ~860 nieuwe books die kaal in de DB staan.

**Sprint A Taak 3 afgerond (2026-05-13)** — pipeline plumbing operationeel. Negen modules onder `src/lib/imports/` implementeren een zeven-fasen-pipeline (fetched → archived → extracted → verified → gated → committed) die LLM-extractie van Gemini 2.5 Pro en GPT-4o parallel draait en consolideert tot één `ExtractionResult` met audit-trail van beide passes intact. Twee migraties toegevoegd: de `import_jobs` tabel voor lifecycle-tracking, plus twee fuzzy-match RPCs (`find_book_candidates_by_title`, `find_author_candidates_by_name`). Eindtest geslaagd met de Wikipedia-pagina over *Suicide, mode d'emploi* als manual-source bron: verifier matched bestaande auteurs (Claude Guillon, Yves Le Bonniec) exact, country zacht `no_match` (manual-source heeft geen `default_country_code`), gate weigerde auto-approve wegens conflict + high-stakes tier, review-queue rij correct gevuld met beide model-outputs apart bewaard. Commits `9843075..74e8c66`.

---

## 13. Working agreements (carry these forward)

- **Edit in `/Users/ludoraedts/projects/banned-books-org`. Do not use git worktrees.**
- **Test on `localhost:3000` before pushing.**
- **AI crawlers are welcome** — never propose blocking GPTBot/ClaudeBot/etc.
- **Supabase paginated reads need `.order(...)`** — `.range()` without ordering produces duplicates once a table exceeds page size.
- **This Next.js (16.2) deviates from training-data defaults.** Always check `node_modules/next/dist/docs/` before writing Next-specific code.
- **The `bbw_config` and `news_config` are DB-singletons** — flip from admin UI, not from the seed file.
- **Dataset is paid; the underlying CSV/JSON/SQLite live in `private/`** — `outputFileTracingIncludes` makes Vercel bundle the zip with the download function.
- **Admin auth is a single shared password** (`ADMIN_SECRET`). No per-user system yet — `editorial_publish_log.admin_user` is a forward-compat field.
- **All schema changes go via Supabase CLI migration files**, not via Supabase Studio. Studio is for data-inspection and queries only. Workflow: `supabase migration new <name>` → write SQL → test locally via `supabase db reset` → `supabase db push` to production. Run `scripts/diagnose-schema-drift.ts` after to confirm zero drift.
- **Local Supabase requires Docker Desktop running.** `supabase start` brings up the full local stack on ports 54321/54322/54323. `supabase stop` to release.
- **Database backups are not Supabase-managed on the Free plan.** Manual backup via `supabase db dump --data-only` before any risky operation. Store in `~/Documents/banned-books-backups/`.
- **Two doctrines from Sprint 0.5** (project memory):
  - **Transliteration tiebreaker is convention-based, not model-based.** Per script-type (cyrillic, han, arabic, etc.) the canonical output follows a fixed convention (BGN/PCGN for Cyrillic, Hanyu Pinyin without tones for Han, simplified ALA-LC for Arabic, etc.), not "whichever model produced it."
  - **Permanent review-gate for non-Latin titles without established English editions.** Auto-import is never enabled for entries where `title_english_meaningful` differs between Gemini and OpenAI AND `original_language` is non-Latin script. Requires editorial decision.
- **Data-touching migraties seeden productie-data lokaal** via `scripts/seed-local-from-prod.ts`. Tool gebruikt `docker exec` direct, niet libpq.
- **Migratie-apply op een geseede DB gebeurt via `docker exec`**, niet via `supabase db reset` — die laatste wist de seed.
- **Pre-flight collision-check verplicht** vóór elke bulk-UPDATE op een kolom met UNIQUE-constraint.
- **Pre-flight surveys draaien tegen productie, niet tegen spec.** Als Claude Code andere getallen vindt dan de spec aangeeft, corrigeert Claude Code de spec — niet andersom.
- **Drift-diagnostic acceptance blijft "zero drift".** Als tooling drift rapporteert die geen echte drift is, fix je de tooling, niet het criterium.
- **301/308 redirects via `next.config.ts redirects()`**, niet via middleware.
- **Manual-source `country_code` = zacht falen.** De verifier returnt `no_match` in plaats van een exception wanneer een bron geen `default_country_code` heeft. De editor lost dit op in de review queue; geen pipeline-blocker.
- **Pipeline audit-trail blijft intact.** De twee LLM-outputs worden apart bewaard in `import_review_queue` (`pass_a_output`, `pass_b_output`, `pass_a_provider`, `pass_b_provider`). Verification + archive + gate-decision verhuizen naar `agreement_details`. De geconsolideerde `ExtractionResult` draagt een `passes_audit`-veld zodat de audit-trail ook persisteert op `import_jobs.extraction`.
- **Rank op distinct books / distinct countries, niet raw ban-rows.** PEN America 2024-25 importeert per district (1 boek × N districts = N rijen), Wikipedia/ALA per titel. Sommatie inflated US ~2.6× en herschudt top-N. Canonieke rank-bronnen: `mv_ban_counts.distinct_books`, `v_top_banned_books.distinct_countries`, `mv_book_scope_counts` (district/state/aggregate split). Raw events alleen als ondersteunende copy, nooit als ranking key.
- **Gate alle `photo_url` / `cover_url` writes door `isAllowedImageUrl()`.** `next/image` 500't op hosts buiten `ALLOWED_IMAGE_HOSTS`. Helper in `src/lib/allowed-image-hosts.ts`; bestaande slechte URLs te scrubben via `scripts/_cleanup-bad-image-hosts.ts`.
- **Light mode wordt geforceerd**, ook in nieuwe componenten. `dark:` Tailwind-variants alleen class-based, nooit `prefers-color-scheme`. Reden: editorial design language is op één lichte palette gekalibreerd.
- **Author-merges/slug-changes MOETEN een alias-rij invoegen** in `author_slug_aliases` (en `book_slug_aliases` voor books) — anders breekt de oude URL i.p.v. 308-redirect. Beware cold PostgREST schema cache vlak na een nieuwe-tabel db push.
- **Cross-language DROP-doctrine.** Bij het mergen van een foreign-language dup-rij: de DROP geeft alleen ban + slug-alias + language-neutral velden door, **nooit** name/title/original_language/description. Importer match-before-create blijft de echte preventie.
- **`/books/[slug]` prebuild blijft gecapt op top-2000.** Volledige prebuild crasht Vercel deploy-finalisation (~16k routes → "Maximum call stack size exceeded"); de tail draait via 24h-ISR. `adminClient()` = PostgREST, NIET pgbouncer — de 6543-pooler is geen render-load-lever. Enrichment propageert via deploy / 24h-ISR / `POST /api/admin/revalidate`.
- **Native-title translit blijft review-gated.** Non-Latin transliteraties auto-accepten nooit; `title_native` non-Latin laat translit NULL tot editorial review.
- **Bluesky posting blijft OFF tot expliciet aangezet** (`BLUESKY_POST_ENABLED`); de cron dry-runt veilig in prod.
- **Geen non-book media.** Periodicals/films/audio buiten scope; geen `media_type` kolom, dus non-books glippen erin met gehallucineerde descriptions — audit via `scripts/_audit_non_book_media.ts`. (`/film` is een editorial documentary-pagina, geen catalogus-entry.)
- **Nieuwe scripts gebruiken `isApply()` uit `scripts/lib/cli.ts`** (`--apply` conventie); check `scripts/README.md` (decision-guide) vóór een import/dedup/merge-taak.

---

## 14. Pending work and known issues

Tracked in `docs/sprint-a/step-0-findings.md`:

1. **Cloudflare blocks Wayback for Legifrance** — archive fallback chain needed in Sprint A: Wayback → archive.today → flag-manual.
2. **RLS design is binary** — 12 public-read tables + 2 admin-only (no policies). Future features requiring fine-grained access will need richer RLS.
3. **FranceArchives has 32-step redirect chains** — citation source unusable; Sprint A archiving must detect and exclude redirect chains.
4. **Genre vocabulary should be DB-table**, not hardcoded `GENRES` map. Sprint A doctrine.
5. **PK type-drift uuid vs bigint** — legacy migration declared uuid PKs; production uses bigint identity. Baseline reflects production.
6. ~~**Duplicate pageviews indexes**~~ — **RESOLVED 2026-06-16** (dropped in migration `20260616130000`).
7. **4 duplicate-author paren in productie** — Saenz, García Márquez, Saramago, Aguilar Zeleny. Editorial follow-up; merge-strategie te bepalen. Zie `docs/sprint-a/duplicate-authors-followup.md`.
8. **Language-misclassification subset** — grotendeels opgelost door native-title enrichment (4.188 boeken gevuld); per 2026-06-15 resteren 1.448 boeken met `original_language = NULL`. Admin language-filter feature nog open.

### Current open threads (2026-06-16)

- **May core-update visibility collapse** — site-brede ~95% impressies-collapse door de mei-2026 core-update (2-maanden-oude thin/AI-content site, honeymoon-reset). Pages geïndexeerd, geen manual action. Lever = content-kwaliteit + autoriteit (OL/GB, AI-desc-QA, bio-remediation), gerealiseerd bij de volgende core-update. Nooit concluderen uit weekend/frontier-dagen.
- **Scraper-swarm DB-load** — verdedigd via top-2000 prebuild + 24h-ISR + Cloudflare-challenge + gehalveerde per-render queries; geen verdere lever op de pooler.
- **Russia FSEM full crawl** — ~5500-entry minjust-crawl nog open (510/~5500 geïmporteerd); ~326 rijen editor-review-flag.
- **Bluesky go-live** — wacht op flippen `BLUESKY_POST_ENABLED` (account + app-password aangemaakt; `/.well-known/atproto-did` indien custom-handle-verificatie nodig).
- **Editorial/data residu** — diverse kleinere dup-residuen (KDN title-collision, Iran-1979 placeholder ~33 rijen, split-authors 45 clusters in `data/hk-split-authors-review.md`, HK `=`-separator parser-bug ~15 rijen). Niet-blokkerend; opgepakt via `scripts/audit-integrity.ts` drift + de stappenplan.
- **Werkvolgorde** — `data/stappenplan-2026-06-11.md` is de afvinkbare kwaliteit/SEO/scripts-lijst; pak het bovenste open item.

---

## 15. Sprint A (historical) — superseded by the stappenplan

> **Note (2026-06-16):** Sprint-framing is no longer how work is tracked — open work lives in `data/stappenplan-2026-06-11.md` (afvinkbaar) + the `scripts/audit-integrity.ts` drift metrics + §14 above. The block below is retained for history. Taak 5 (Frankrijk) bleef hand-curatie wegens de Legifrance Cloudflare-403; Taak 4 (language admin-filter) is grotendeels opgelost door de native-title enrichment (zie §14 #8).

**Sprint A status na 2026-05-22.** Taken 1, 1.5, 2A, 2B, 3 en de IndexNow delta-feature zijn afgerond. **Taak 5 is inhoudelijk begonnen** terwijl de Legifrance Cloudflare-blok-workaround in uitvoering blijft:

- **Taak 4 — Language admin-filter + backfill.** 334 NULL `title_native` rijen verwerken; 67 fout-geklasseerde `original_language` corrigeren. Status: nog open.
- **Taak 5 — Eerste echte source: Frankrijk + bredere source-debt backfill.** Voortgang sinds 2026-05-18:
  - **31 FR arrêtés** geïmporteerd onder Loi du 16 juillet 1949 via Legifrance/JORF (handmatige route — directe pipeline-fetch op Legifrance blijft Cloudflare-403).
  - **12 ZA bans** uit The Literature Police (apartheid-era).
  - **AU/GB source-debt backfill** afgerond.
  - Légifrance + The Literature Police entries toegevoegd aan `sources`-tabel.
  - LLM reason classifier + Iran default ban-year fallback aan import-review pipeline toegevoegd.
  - Slug fallback naar transliteratie voor non-Latin titels in import-review.
  - Bron-specifieke fetch-strategie voor Legifrance (browser-headers / headless / proxy) **blijft openstaan**; tot dan blijft hand-curatie de werkroute. Plus eerder gedocumenteerde Wayback-fallback chain (finding #1) en redirect-chain-detectie (finding #3).
