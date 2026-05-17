# banned-books.org — Project Context

> Stand-alone briefing for handing off to a Claude or ChatGPT project. Captures
> what the site is, what's built, the database, the services, the file layout,
> the public surface, the admin surface, the positioning, and the SEO model.
> Code is the source of truth — paths below are real and clickable.
>
> Repo root: `/Users/ludoraedts/projects/banned-books-org`
> Live site: <https://www.banned-books.org>
> Owner: Ludo Raedts (Groningen, NL) — solo project, started April 2026.

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
1. A paid downloadable dataset (`/dataset`, $19.99 via Stripe Checkout).
2. Bookshop.org and Kobo affiliate links from each book page.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2** (App Router, React 19, server components by default) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + `@tailwindcss/typography` |
| Hosting | **Vercel** (Fluid Compute) |
| Database | **Supabase** (Postgres + RLS not used; service-role on server) |
| AI | OpenAI (`gpt-4.1-mini`, `text-embedding-3-small`) and Anthropic (`@anthropic-ai/sdk`) for description/bio enrichment |
| Payments | **Stripe** Checkout + webhook |
| Email | **Resend** (transactional) + **Zoho Mail** IMAP (inbox preview) |
| Analytics | Vercel Analytics + Speed Insights, plus a privacy-safe custom `pageviews` table; Cloudflare GraphQL Analytics for traffic dashboard |
| Forms | Formspree (contact form) |
| Search-engine ping | IndexNow (`/api/indexnow`, `indexnow.txt`) |
| Cron | Vercel Cron (3 jobs, see §6) |
| Image optimisation | `next/image` + `sharp`; whitelisted remote hosts in `src/lib/allowed-image-hosts.ts` |
| Testing | Vitest |

Local dev: `pnpm dev` → <http://localhost:3000>. Build runs the dataset
builder before `next build` (`build-dataset.ts && next build`).

> ⚠ **CLAUDE.md / AGENTS.md**: this Next.js has breaking changes vs. typical
> training data. Always check `node_modules/next/dist/docs/` before writing
> Next-specific code.

---

## 3. Database (Supabase Postgres)

Migration files live in `supabase/migrations/` (001–020).

### Core entities

| Table | Purpose |
|---|---|
| `countries` | Country dimension. `code` (char(2), unique), `name_en`, `description` (editorial). Includes defunct states (`SU`, `CS`, `DD`, `YU`). |
| `authors` | Author dimension. `slug`, `display_name`, `bio`, `birth_country`, `photo_url`. |
| `books` | The book catalogue. `slug`, `title`, `first_published_year`, `genres text[]`, `isbn13`, `openlibrary_work_id`, `cover_url`, `cover_status` (`valid` / `rejected_placeholder` / `manual_override`), `bookshop_status` (`valid` / `not_found`), `bookshop_isbn13` (alternative ISBN that resolves on Bookshop), `description_book`, `description_ban`, `censorship_context`, `ai_drafted` (boolean), `warning_level` (`none` / `context` / `extended`), `inclusion_rationale`, `extended_context`. |
| `book_authors` | M:N join `book_id` ↔ `author_id`. |
| `bans` | The act of censorship. `book_id`, `country_code`, `status` (`active` / `historical`), `action_type` (`banned` / `restricted` / `challenged`), `year_started`, `year_ended`, scope (school vs government), description. |
| `ban_sources` | Citation per ban — `source_name`, `url`. |
| `ban_reason_links` | M:N join `bans` ↔ `reasons`. |
| `reasons` | The taxonomy of "why" — `slug` (e.g. `lgbtq`, `political`, `religious`, `sexual`, `violence`, `racial`, `drugs`, `obscenity`, `blasphemy`, `moral`, `language`, `other`). |
| `scopes` | Ban scope (`school`, `government`, `prison`, etc.) with display labels. |

### Pageview / analytics

| Table / view | Purpose |
|---|---|
| `pageviews` | Append-only event log. Fields: `entity_type` (`book` / `author` / page), `entity_id`, `viewed_at`, `country` (CF-IPCountry), `referrer_host`, `visitor_hash`. **Privacy-safe**: `visitor_hash = sha256(daily_salt ‖ ip ‖ ua)` — IP never stored, salt rotates daily. |
| `v_top_books_this_week` / `_last_week` / `_all_time` | Top books by `COUNT(DISTINCT visitor_hash)`. |
| `v_top_authors_this_week` / `_last_week` / `_all_time` | Same shape, for authors. |
| `v_top_banned_authors` | Authors ranked by total bans (not pageviews). |
| `v_top_countries_this_week` / `_last_week` | Visitor country breakdown. |
| `v_top_referrers_this_week` / `_last_week` | Referrer hostnames. |
| `v_weekly_totals` | Site-wide weekly visitor / pageview counters. |
| `mv_ban_counts` | Materialized: bans per country. |
| `mv_country_reason_counts` | Materialized: bans per (country × reason). |
| `mv_refresh_log` | Tracks `data_last_changed`, `last_refreshed`, `dataset_built_at`. Triggers on `bans` and `ban_reason_links` keep `data_last_changed` current. |
| `admin_db_stats()` RPC | Returns DB size + pageviews-table size for the admin "DB usage" gauge. |
| `refresh_all_materialized_views()` RPC | Refreshes `mv_ban_counts` and `mv_country_reason_counts` concurrently. |

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

### Operational tables

| Table | Purpose |
|---|---|
| `news_items` | Aggregated censorship news. Fields incl. `embedding vector(1536)` (pgvector), `headline` (short attention-grabbing kop above the bron-titel), `auto_published` flag (audit), `status` (`draft` / `published`). |
| `dataset_orders` | Stripe Checkout sessions. `stripe_session_id`, `email`, `amount_cents`, `paid_at`, `download_token` (UUID), `download_token_expires_at` (now + 30d), `downloads_count`. Webhook is sole writer for `paid_at`/token; download endpoint is sole writer for `downloads_count`. |
| `inbox_preview` | Last 5 inbox messages from Zoho Mail (TRUNCATE+INSERT every hour). Powers the dashboard inbox card. |
| `cover_search_attempts` | Throttles cover-enrichment retries per book. |
| `description_search_attempts` | Same, for descriptions. |

### Important indexes / extensions

- `pg_trgm` enabled — trigram indexes on `books.title` and `authors.display_name` (search).
- `vector` enabled — for `news_items.embedding` (dedup).
- Composite `(entity_type, entity_id)` and `(entity_type, viewed_at)` on `pageviews` for the rising/trending widgets.
- Partial indexes for `cover_url IS NULL`, `description_book IS NULL` (admin enrichment queues).

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
│   │
│   ├── books/[slug]/                 # Per-book page (canonical; rich metadata, schema.org)
│   ├── authors/[slug]/               # Author bio + their banned books
│   ├── countries/                    # Index + [code]/ per country
│   ├── reasons/                      # Index + [slug]/ per reason
│   ├── scope/[slug]/                 # /scope/school, /scope/government
│   ├── search/                       # Full-text search (server) + client interactivity
│   ├── stats/ + methodology/         # Stats dashboard + "why the US dominates" essay
│   ├── top-100-banned-books/         # Static-revalidating SEO landing (24h)
│   ├── banned-classics/              # Pre-1970 SEO landing (24h)
│   ├── challenged-books/             # School-scope SEO landing
│   ├── banned-books/[year]/          # Year-archive SEO landings (2022..2026, generateStaticParams)
│   ├── banned-books-week/ + archive/ # BBW hub + per-year archive
│   ├── reading-club/                 # Hub
│   │   ├── currently-challenged/     # ALA OIF list
│   │   ├── international/            # Engine-curated
│   │   ├── classics/                 # Manual evergreen
│   │   └── by-theme/[slug]/          # Five themes
│   ├── essays/                       # Index + per-essay pages
│   │   ├── what-we-document/
│   │   └── forbidden-knowledge-iceberg/
│   ├── history/                      # Long-form essay (legacy flat URL)
│   ├── why-not-amazon/               # Essay (legacy flat URL)
│   ├── about/ + privacy/ + sources/ + dataset/ + reading-list/ + news/
│   │
│   ├── admin/                        # Cookie-gated admin UI (see §7)
│   │   ├── page.tsx                  # Dashboard (stats, inbox, dataset KPIs, DB gauge)
│   │   ├── admin-tabs.tsx            # Overview / Stats / BBW / Reading Club / Content blocks
│   │   ├── books/ + books/[slug]/    # Book browser + edit form
│   │   ├── authors/ + authors/[slug]/
│   │   ├── news/                     # Triage drafts → publish
│   │   ├── content-blocks/           # CMS editor
│   │   ├── banned-books-week/        # BBW config + featured picks editor
│   │   ├── reading-club/             # Reading club editor (4 tracks)
│   │   ├── stats/ + sitemap/         # Cloudflare traffic dash + sitemap & IndexNow tools
│   │   ├── scripts/                  # Reference cards for every CLI script
│   │   └── login/
│   │
│   └── api/
│       ├── cron/                     # Vercel Cron endpoints (Bearer-protected)
│       │   ├── fetch-news/           # daily 08:00 UTC
│       │   ├── fetch-mail/           # hourly
│       │   └── cleanup-pageviews/    # weekly Mon 03:00
│       ├── dataset/
│       │   ├── checkout/             # Stripe Checkout session creation
│       │   ├── webhook/              # Stripe webhook → insert order, mint token, email link
│       │   └── download/             # token-gated stream of /private/dataset.zip
│       ├── indexnow/                 # POST URLs to IndexNow (admin/cookie or Bearer)
│       └── admin/                    # Cookie-gated REST: books, authors, news,
│                                     # content-blocks, BBW, reading-club, build-dataset,
│                                     # refresh-views, sync-inbox, indexnow-bulk,
│                                     # data-quality, generate-discussion-questions
│
├── components/                       # Reusable UI: book browser, trending widget,
│                                     # rising widget, share buttons, contact form,
│                                     # dataset-checkout-button, tracked-outbound-link, …
├── config/
│   ├── banned-books-week.ts          # DB-backed runtime config (60s in-memory cache)
│   └── news.ts                       # DB-backed news pipeline config
├── lib/                              # Pure logic — see §5
└── middleware.ts                     # Gate /admin/* on `admin_session` cookie

supabase/migrations/                  # Numbered SQL files, run-once
scripts/                              # ~180 maintenance scripts (TSX). See /admin/scripts
private/dataset.zip                   # Generated artefact, served only via /api/dataset/download
public/                               # Static assets (brand, og default, indexnow placeholder)
data/                                 # Local CSVs from one-off enrichment / audit runs
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
| `fetch-news.ts` | RSS pipeline: fetches PEN America, Index on Censorship, Publishers Weekly, Freedom to Read Canada, Google News (`banned books`); normalises Google News titles; calls OpenAI in JSON-mode to produce `{ headline (4–8 words, Title Case), summary (40–70 words, banned-phrase list) }`; embeds with `text-embedding-3-small`; cosine-dedupes against last `dedup_window_days` items; inserts as `draft` (or `published` if `news_config.auto_publish`). Backfill of pre-headline rows: `scripts/backfill-news-headlines.ts`. |
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

External SaaS connected:
- **Supabase** (DB)
- **Vercel** (hosting + cron + analytics + speed insights)
- **Cloudflare** (DNS + analytics; `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`)
- **Stripe** (payments)
- **Resend** (transactional email)
- **Zoho Mail** (inbox via IMAP)
- **Formspree** (contact form)
- **Bookshop.org** (affiliate)
- **OpenAI + Anthropic** (enrichment / summarisation / discussion questions)
- **Open Library, Google Books, Wikipedia** (free enrichment data sources, used by scripts)
- **PEN America, ALA, Index on Censorship, Freedom to Read Canada, Google News** (news RSS)

---

## 6. Cron jobs (`vercel.json`)

| Path | Schedule | What it does |
|---|---|---|
| `/api/cron/fetch-news` | `0 8 * * *` (daily 08:00 UTC) | Pulls all RSS feeds, summarises with OpenAI, dedupes via embeddings, inserts as `draft` (or `published` when `news_config.auto_publish=true`). |
| `/api/cron/fetch-mail` | `0 * * * *` (hourly) | Connects to Zoho IMAP, replaces the 5 rows in `inbox_preview` so the admin dashboard shows recent inbox at a glance. |
| `/api/cron/cleanup-pageviews` | `0 3 * * 1` (Mondays 03:00 UTC) | Deletes `pageviews` rows older than 90 days. Caps DB size and keeps the visitor-hash distinct counts meaningful. |

All three are protected by `Authorization: Bearer ${CRON_SECRET}`.

---

## 7. What the public site can do

### Top-level navigation
Header: Search · Dataset · Countries · Stats · Reasons · History · Essays · News · About · Reading list.
Footer also surfaces: Challenged books · School bans · Government bans · Sources · Reading club · Banned Books Week · Classics · Privacy · RSS.

### Pages

**Homepage `/`**
- Live total counts (books × countries) in the H1 sub-line.
- `BookBrowser` — paged catalogue (initial 48 books, infinite scroll), filters by country, genre, reason, author. Server-rendered first paint.
- `HighlightsStrip` — three book + three author cards: most-banned, trending (this week), all-time; deduped against each other.
- `TrendingTabs` — toggles between Trending (all-time pageviews) and Rising (rolling 14-day window).
- "Book of the day" — deterministic per calendar date (`seed = today's ISO`).
- Latest 3 news items.

**Per-book page `/books/{slug}`**
- Cover (with `BookCoverPlaceholder` fallback), title, author(s), first published year, genres, ISBN.
- `description_book` (synopsis) and `description_ban` ("why it was banned").
- Per-ban list grouped by country, with status, year, scope, reasons, and source citations.
- Optional `censorship_context` and `extended_context` (for sensitive titles like *Mein Kampf*; `warning_level` = `none` / `context` / `extended`).
- Affiliate links: Bookshop.org (deep link if probed valid, otherwise storefront), Kobo. **No Amazon links** — see `/why-not-amazon`.
- Free Project Gutenberg link when available.
- Share buttons; tracked outbound links (logged for Bookshop / Kobo / dataset purchase).
- Schema.org `Book` JSON-LD.
- Triggers `trackPageview('book', id)`.

**Per-author page `/authors/{slug}`** — bio, photo, birth country, all banned books.
**Country pages `/countries` and `/countries/{code}`** — flag, description, all bans for that country split by status.
**Reason pages `/reasons` and `/reasons/{slug}`** — index + book lists per reason.
**Scope pages `/scope/school`, `/scope/government`** — books banned in that scope.

**SEO landing pages** (`revalidate = 86400` — 24h ISR):
- `/top-100-banned-books` — ranked list by ban count.
- `/banned-classics` — pre-1970 published books still banned.
- `/challenged-books` — school-scope challenges.
- `/banned-books/[year]` — `2022..2026` archives, with `generateStaticParams`.

**Stats `/stats`** — interactive charts; **/methodology** — long-form "why the US dominates this data" essay.

**Search `/search`** — server-rendered FTS with client filters.

**Essays** — `/essays` index plus:
- `/history` (legacy flat URL) — 14-min history of censorship.
- `/why-not-amazon` (legacy flat URL).
- `/essays/what-we-document` — editorial choices.
- `/essays/forbidden-knowledge-iceberg` — debunks viral "forbidden knowledge" pyramid lists.

Each essay declares `relatedBookSlugs` in `essays-data.ts`; an `EssayRelatedBooks` block looks them up.

**Banned Books Week `/banned-books-week` + `/banned-books-week/archive`**
- DB-flag `bbw_config.enabled` controls whether the homepage tile + hub are promoted.
- Editorial content blocks (hero subtitle, "what is BBW", "why it matters", "the other side", "what you can do") gate visibility — the page hides each section until its block is `published`.

**Reading Club `/reading-club`**
- Four tracks: `currently-challenged`, `international`, `classics`, `by-theme/{slug}` (LGBTQ+, political dissent, religious censorship, race & racism, sexuality).
- Each book has a custom blurb and (optional) discussion questions stored as JSONB.

**Dataset `/dataset` + `/dataset/success`**
- $19.99 one-time → Stripe Checkout → webhook inserts `dataset_orders` row, mints a 30-day download token, emails it via Resend.
- `/api/dataset/download?token=…` validates token, increments `downloads_count`, streams `private/dataset.zip` (containing `books.csv`, `bans.csv`, `sources.csv`, `countries.csv`, `authors.csv`, `reasons.csv`, `dataset.json`, `dataset.sqlite`).
- License: perpetual personal/research use; commercial requires a separate license.

**News `/news`** — published items from the pipeline. RSS at `/feed.xml`.

**About / Privacy / Sources** — about page lists current stats live; sources page lists every source used.

### Privacy posture
- No third-party trackers, no sponsored content alongside the catalogue.
- Visitor IP is never stored; only `sha256(daily_salt ‖ ip ‖ ua)`.
- Cookies declined automatically (privacy-by-default) — except `admin_session`.
- AI crawlers (GPTBot, ClaudeBot, OAI-SearchBot, PerplexityBot, etc.) are **welcome** — the project's strategy treats AI traffic as desirable; don't propose blocking them.

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
- Inline edit per row: both `headline` (the eyebrow) and `summary` — API action `update_text`. Save merges in-place into local state so the row stays put.
- Toggle `news_config.auto_publish` (so daily cron auto-publishes vs. parks as draft). Reads via service-role: anon can't see `news_config` despite the migration's GRANTs, so an anon read would silently fall back to defaults.
- Tune `dedup_threshold` and `dedup_window_days`.

### Banned Books Week admin
- Toggle `bbw_config.enabled`, set year, start/end, promo-start dates.
- Run the suggester for a year → preview top 10 + 15 alternates → swap, pin, edit blurb → publish.

### Reading Club admin
- Per-track editor (currently-challenged / international / classics / themes).
- Generate discussion questions via Anthropic (per book).

### Content blocks admin
- Edit any of the seeded slugs (BBW, Reading Club). Markdown → HTML at save time. Status workflow: `placeholder` → `draft` → `published`. Public pages won't render unpublished blocks.

### Sitemap & IndexNow `/admin/sitemap`
- View counts per sitemap.
- Bulk-submit all canonical URLs to IndexNow.

### Scripts reference `/admin/scripts`
A curated catalogue of the ~180 TSX scripts in `scripts/`, grouped by purpose
(adders, enrichers, fixers, audits, builders) with cost tags (`free APIs`,
`OpenAI cost`, `Anthropic cost`, `destructive`, `read-only`) and the exact
command lines. Highlights: `add-books-batch{1..47}.ts`, `enrich-covers-v2.ts`,
`enrich-isbn.ts`, `enrich-author-bios.ts`, `enrich-author-photos-v2.ts`,
`enrich-descriptions-gpt.ts`, `enrich-ban-descriptions-gpt.ts`,
`rewrite-descriptions-grounded.ts`, `strip-filler-sentences.ts`,
`audit-covers-for-placeholders.ts`, `audit-quality.ts`, `audit-db.ts`,
`build-dataset.ts`, `cross-reference-bookshop-isbn.ts`,
`probe-bookshop-isbn.ts`, `seed-bbw-content-blocks.ts`,
`seed-country-descriptions.ts`, `seed-genres.ts`.

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
8. **No-Amazon stance** — explained in `/why-not-amazon`. Bookshop and Kobo only.
9. **Independent.** No funding from publishers, governments, advocacy. One-person project + open-source tools.

**Editorial line.** Documents censorship; doesn't endorse it; doesn't endorse the books either. Includes morally objectionable titles (e.g. *The Turner Diaries*, *The Anarchist Cookbook*, *Mein Kampf*) with extended context and warning labels rather than excluding them.

---

## 10. SEO model

The site is heavily optimised for organic discovery — both classic SEO and
LLM-driven traffic.

### Indexable surface
- `robots.ts` — `User-agent: *`, `Allow: /`, sitemap pointer.
- `next.config.ts` — `X-Robots-Tag: noindex` on `/_next/image/*` only (transformed images shouldn't be indexed; the canonical book page should).
- AI crawlers explicitly allowed (project policy).

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

### On-page
- `metadataBase` + per-page `generateMetadata`. Every page sets `alternates.canonical`.
- Open Graph: `siteName: 'Banned Books'`, `type: 'website'`, locale `en_US`. Default OG image at `app/opengraph-image.tsx`.
- Twitter: `summary` card.
- Schema.org JSON-LD: `Organization` on `/about`, `Book` on `/books/[slug]`.
- RSS at `/feed.xml` linked from `<head>`.
- Canonical pages: `/books/{slug}` and `/authors/{slug}` are the indexable canonicals; pages like `/top-100-banned-books`, `/banned-classics`, `/banned-books/{year}`, `/challenged-books`, `/scope/{school|government}` exist as **second-tier landing pages** that link inward.

### Page weight & rendering
- Mostly server components; SEO landings use 24h ISR (`revalidate = 86400`).
- Homepage and admin: `dynamic = 'force-dynamic'` (live counts).
- `next/image` with `formats: ['image/webp']`, `minimumCacheTTL: 31536000` and immutable cache header on `/_next/image/*`.
- Vercel Speed Insights enabled.

### Performance levers (already in place)
- Materialized views for ban counts (per-country, per-(country×reason)).
- `pg_trgm` indexes for free-text search.
- Composite pageview indexes for trending/rising.
- 60s in-memory cache for `bbw_config` (keeps the DB cold for the homepage tile check). `news_config` is read uncached via service-role on each call — module caches split across Fluid Compute instances and caused the auto-publish toggle to look like it wasn't saving.

---

## 11. Environment variables

Required (see `.env.example` + actually used):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL                  # used by scripts that talk to Postgres directly
NEXT_PUBLIC_BASE_URL          # https://www.banned-books.org
ADMIN_SECRET                  # session cookie value + Bearer for IndexNow / API
CRON_SECRET                   # Bearer for /api/cron/*
VISITOR_SALT_SECRET           # daily-salt seed for visitor_hash
OPENAI_API_KEY
# Anthropic key for discussion-question generation (key name varies; check the script)
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
```

---

## 12. Achievements to date (snapshot 2026-05-09)

- **A working catalogue** with thousands of books and bans across many countries (live counts on `/about` and the homepage). The recent commit history adds:
  - `feat(admin): show 24h-vs-prev-24h deltas on Cloudflare cards`
  - `feat(scripts): grounded rewrite + filler strip for ban descriptions`
  - `feat(analytics): track Bookshop/Kobo clicks and dataset purchases`
  - `feat(admin): restructure scripts reference page`
- **20 schema migrations** covering core entities + materialized views + dataset orders + inbox preview + BBW & Reading Club CMS + news embeddings + Bookshop probe state.
- **A repeatable enrichment pipeline** — descriptions, censorship context, covers, ISBNs, author bios + photos, Bookshop ISBN cross-reference, Project Gutenberg detection, genre seeding. Roughly 180 maintenance scripts catalogued in the admin Scripts page.
- **A privacy-safe analytics layer** (visitor_hash, 90-day retention) with trending / rising / top-by-country / top-referrer views and an admin dashboard for Cloudflare zone analytics.
- **Editorial CMS** for content blocks + Banned Books Week + 4-track Reading Club, with draft/publish workflow, audit log, and editor-controlled BBW kill switch + dates without code deploys.
- **News pipeline** with embeddings-based dedup, runtime auto-publish toggle, RSS ingestion from 5 sources, summarised by `gpt-4.1-mini` which also generates a short attention-grabbing `headline` (eyebrow on /news + admin, card title on homepage, `<title>` in /feed.xml).
- **Monetisation live** — paid dataset via Stripe + 30-day download tokens + Resend delivery; Bookshop / Kobo affiliate tracking with click-type analytics.
- **SEO infrastructure** — split sitemaps, IndexNow integration with bulk-submit, schema.org JSON-LD, open-graph + RSS, second-tier landings (top-100, banned-classics, year archives, scope, challenged).
- **Operational tooling** — admin dashboard with DB-size gauge, materialized-view refresh button, dataset-rebuild button, Zoho inbox preview, and a one-page reference for every CLI script.

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
