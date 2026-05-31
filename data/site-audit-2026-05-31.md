# Site Audit — banned-books.org

**Date:** 2026-05-31
**Scope:** Full audit — performance, SEO/discoverability, UI/UX & accessibility, code & data integrity, security.
**Method:** Read-only code review across the whole repo (5 parallel deep-dives), a clean production build (exit 0), live HTTP probes against `www.banned-books.org`, 28-day Google Search Console export, and read-only Supabase data-integrity queries.
**Stack:** Next.js 16.2.4 (App Router) · React 19.2.4 · Tailwind v4 · TypeScript 5 · Supabase (Postgres) · Stripe · Vercel.

---

## 0. Executive summary

The codebase is **mature and well-engineered** — thoughtful ISR intent, extensive inline rationale, strong JSON-LD, a clean image-host allowlist (0 violations found across ~12,800 images), proper Stripe signature verification, and every `/api/admin/*` route correctly authenticated. The build is green.

But the audit surfaced **one severe, system-wide performance defect that is live in production right now**, plus a cluster of high-leverage SEO consolidation issues, and a content-coverage gap that caps the site's ceiling. The good news: the three biggest problems are concrete and fixable.

**The three things that matter most:**

1. **🔴 Detail pages are not cached at all in production.** `/books/[slug]`, `/authors/[slug]`, `/countries/[code]`, `/reasons/[slug]`, `/scope/[slug]` all return `x-vercel-cache: MISS` + `cache-control: private, no-cache, no-store` on every request. Their `export const revalidate = 3600` never takes effect because the routes render fully dynamically (no `generateStaticParams`). Every single visit to the bulk of the 13,695-book catalogue pays a full server render + multiple Supabase round-trips. Proven live (see §1).

2. **🟠 Search Console shows a 0.14% site-wide CTR** (25 clicks / 17,297 impressions / 28 days). The site *ranks* — dozens of queries sit at positions 3–10 — but almost nobody clicks. Compounded by a still-active **www/apex duplication** (738 apex pages still indexed) and **country-code case duplication** (`/countries/IL` and `/countries/il` both serve 200). Signals are split across duplicate URLs and snippets aren't converting.

3. **🟠 92% of books have no description** (12,545 of 13,695) and **42% have no cover** (5,704). Author coverage is similar (32% no bio, 43% no photo). This is the content ceiling: thin pages rank but don't compel clicks, and limit the depth AI crawlers can ingest.

Severities below: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low.

---

## 1. Performance & caching

### 🔴 P1 — Dynamic detail pages are never edge-cached (live in prod)
**Evidence (live HTTP, 2026-05-31):**

```
/banned-books/2023   (has generateStaticParams) → x-vercel-cache: PRERENDER  cache-control: public  ✓
/top-100-banned-books (static)                   → x-vercel-cache: PRERENDER                          ✓
/  (homepage, static)                            → x-vercel-cache: HIT (age 406)                      ✓
/books/deenie                                    → x-vercel-cache: MISS  cache-control: private,no-store  ✗
/countries/kp                                    → x-vercel-cache: MISS  cache-control: private,no-store  ✗
/authors/judy-blume                              → x-vercel-cache: MISS  cache-control: private,no-store  ✗
/reasons/sexual                                  → x-vercel-cache: MISS  cache-control: private,no-store  ✗
```

The pages that declare `revalidate = 3600` but have **no `generateStaticParams`** (`books/[slug]`, `authors/[slug]`, `countries/[code]`, `reasons/[slug]`, `scope/[slug]`) are classified `ƒ Dynamic` at build and render on-demand with uncached Supabase fetches → Next emits `no-store` and Vercel never caches them. The `revalidate=3600` is dead code on these routes. The `/banned-books/[year]` route, which *does* have `generateStaticParams`, is correctly `PRERENDER`.

**Impact:** Every visit to a book/author/country/reason page = full SSR + Supabase queries. The `countries/[code]` page is a **~7-query sequential waterfall plus a full-ban pagination loop** (`src/app/countries/[code]/page.tsx:125,131,140,168,208,236,278`) — build-time logs measured 3.3 s for similar batches, so cold TTFB is plausibly 1–3 s on *every* hit. This defeats the documented "50 ms TTFB" goal (`books/[slug]/page.tsx:1-6`), hurts Core Web Vitals (TTFB/LCP), and burns Supabase/Vercel function quota.

**Fix:** Add `generateStaticParams` to these routes — return at least the top-N slugs by traffic/ban-count (all of them if the build budget allows). This flips them to `PRERENDER` + ISR (proven to work via `/banned-books/[year]`). For the long tail, on-demand ISR will then cache the first render. Pair with the `countries/[code]` waterfall fix below.

### 🟠 P2 — `/countries/[code]` sequential query waterfall
`src/app/countries/[code]/page.tsx` runs ~7 dependent queries one after another; steps 1–3 (country / `mv_ban_counts` / books) are independent and should be a single `Promise.all`. The per-country ban aggregation (full pagination loop over `bans`) is a materialized-view candidate (`mv_country_related` or extend `mv_country_reason_counts`). Combined with P1, this is paid on every request today.

### 🟡 P3 — `/countries` list is `force-dynamic` for no reason
`src/app/countries/page.tsx:1` is `force-dynamic` only because it reads `searchParams` for sort/filter, yet all data comes from materialized views. Move sort/filter into the existing client `CountriesControls` and switch to `revalidate = 1800`. Saves a full server round-trip + 4 aggregate queries per visit on a hub page.

### 🟡 P4 — Homepage `count: 'exact'` full scans
`src/app/page.tsx:180-181` does exact COUNT scans on `books` + `bans` inside the 12-query batch (measured 3.3 s). `generateMetadata` already uses `count: 'estimated'` — use it in the batch too.

### ⚪ P5 — Font `display` inconsistency
`Geist` / `Geist_Mono` omit `display: "swap"` while `Source_Serif_4` sets it (`layout.tsx:11-24`). next/font mitigates CLS via fallback metrics, but add it for consistency; verify `Geist_Mono` is actually used on public pages (drop its subset from the global layout if it's admin-only).

### ⚪ P6 — `middleware` convention deprecated in Next 16
Build warns `middleware` → rename to `proxy`. Low urgency but will eventually break. (Per AGENTS.md, check `node_modules/next/dist/docs/` first.)

**Already excellent (no action):** `@react-pdf/renderer`, `marked`, `sanitize-html`, `stripe` are all strictly server-side and never reach client bundles; markdown is rendered to `body_html` at save-time; LCP `priority` is correctly set on all hero images (book/home/laws); next/image WebP + responsive sizes + 1-yr cache everywhere; pageview tracking is fully idle (`sendBeacon`); analytics gated to production + non-internal + non-admin.

---

## 2. SEO & AI-discoverability

### 🟠 S1 — Site-wide CTR is 0.14% (the conversion problem)
GSC 28-day (2026-05-01 → 2026-05-29): **25 clicks / 17,297 impressions**. The site ranks but doesn't convert clicks. Two structural causes (S2, S3) plus thin snippets (S4). This is the highest-leverage *outcome* metric to move.

### 🟠 S2 — www/apex duplication still splitting signals
The apex→www **308 redirect works correctly live** (verified: apex root and apex book pages both 308 → www). But GSC still shows **738 apex pages indexed (147 clicks)** vs 262 www pages (402 clicks) — Google hasn't consolidated two weeks post-redirect. The flagship `/books/aztec-inca-maya` earns 30 clicks on www **and** 18 on apex simultaneously — its true rank signal is split across two URLs. This is now a *monitoring* item (the redirect is correct; Google needs time), but it directly depresses S1. Re-check is already planned for 2026-06-08; confirm apex impressions are decaying.

### 🟠 S3 — Country-code case duplication (live, fixable now)
`/countries/IL` (uppercase) and `/countries/il` (lowercase) **both return 200** — no redirect. The sitemap emits uppercase `country_code` (`sitemap-countries.xml/route.ts:20`) while the page self-canonicals to lowercase (`countries/[code]/page.tsx:76`), so **every** country URL in the sitemap is non-self-canonical. Internal links are inconsistent too (`books/[slug]/page.tsx:619` lowercases, `:1196` uppercases). GSC confirms both casings indexed (`/countries/SA` appears as apex + www + uppercase = triple fragmentation).
**Fix:** Normalize to lowercase everywhere — sitemap, all internal links — and add a 308 uppercase→lowercase redirect.

### 🟠 S4 — Orphaned indexable pages missing from sitemaps
Not in any sitemap and not in IndexNow:
- **`/laws/loi-gayssot`** — brand-new Article page, discoverable only via FR-book cross-links.
- **`/search`** — the canonical catalogue-browse page (it's the "Books" breadcrumb target on every book page).
- **`/data-quality`** (HTML route — only the `.md` twin is listed).
- **`/banned-books-week/archive/[year]`**.

Add to `src/lib/sitemap-static-entries.ts`.

### 🟡 S5 — IndexNow delta is books/authors only
`src/lib/indexnow-delta.ts:96-104` submits only new books/authors + static-page diffs — never countries/reasons, and keys off `created_at` so **content updates to existing pages** (enrichment, new bans) are never re-pushed even though sitemap `lastmod` reflects them. Extend to `updated_at`-based deltas for high-value pages.

### 🟡 S6 — Deenie: 12,532 impressions, 0.1% CTR, position 7.3
A single query — "why is deenie a banned book" — accounts for ~72% of all impressions, at near-zero CTR. Live title/meta:
> *Deenie by Judy Blume – Banned in United States for sexual content* / *…See the year, the scope, and the full source citations on this page.*

The snippet doesn't directly answer "why" in a compelling way for a high-volume question, and position 7.3 is below the fold. Worth a targeted experiment: a question-led title/description and an FAQ/answer block above the fold. (Many other high-impression/0-click queries are quoted exact-title "challenged banned" searches — likely low-intent/scripted — so don't over-index on raw impression totals; Deenie is the genuine opportunity.)

### ⚪ S7 — Structured-data polish
- Organization `logo` is an SVG (`page.tsx:458`) — Google wants raster; point at a PNG and add `sameAs`.
- Essay/Laws `Article` schema lacks `image`, `dateModified`, and `publisher.logo` ImageObject — add for rich-result eligibility.
- `/llms.txt` claims book/author pages emit `CollectionPage` (they emit it on country/reason/scope) — minor accuracy fix.

**Already excellent:** unique programmatic titles/descriptions with anti-vague-suffix logic; param-stripping self-canonicals on all filterable pages; comprehensive JSON-LD (Book, Person, FAQPage, CollectionPage, ItemList, Dataset, WebSite+SearchAction, Organization, Article, BreadcrumbList); sitemap index; curated `/llms.txt`; two valid RSS feeds; robots correctly welcomes AI crawlers; all public content is server-rendered (only `/admin/login` is client-only).

---

## 3. UI/UX & accessibility

### 🔴 A1 — Dark mode is dead code that can never activate
`globals.css:4` defines `@custom-variant dark (&:where(.dark, .dark *))` and **91 files** carry hundreds of `dark:` classes — but **nothing ever sets the `.dark` class** (no `next-themes`, no provider, no toggle, no `prefers-color-scheme` script), and `globals.css:27` hardcodes `color-scheme: light`. Users on dark-mode OS get forced light; meanwhile every page ships dead dark-variant CSS, and any contributor will assume dark mode works. The homepage components (`src/components/home/*`) have **zero** `dark:` support, so even if enabled it would render half-broken.
**Fix — decide:** (a) ship dark mode (theme provider + no-FOUC inline script + toggle + port the homepage tokens), or (b) strip the `dark:` classes. Either is fine; the current half-state is the single biggest UI inconsistency.

### 🟠 A2 — No `error.tsx` / `not-found.tsx` / `global-error.tsx` / `loading.tsx` anywhere
Confirmed zero across `src/app`, yet `notFound()` is called in 17 route files. Every 404 (book/author/country slug misses) renders Next's **bare unbranded default**; any data error shows a blank error page; no route-level loading fallback. For a content/SEO site where deep slugs get crawled and shared, this is a real bounce/UX problem.
**Fix:** Add branded `not-found.tsx` (with search box + popular links), `error.tsx` (client, reset button), `global-error.tsx`; consider `loading.tsx` on data-heavy routes.

### 🟠 A3 — No skip link
No skip-to-content link anywhere (`layout.tsx:60-90`); keyboard/SR users tab through 10 nav links on every page. WCAG 2.4.1. Add `<a href="#main" class="sr-only focus:not-sr-only">` + `id="main"` on `<main>`.

### 🟠 A4 — Missing visible focus indicators
Only 4 files use `focus-visible`; no global focus style; several `<select>`s use bare `focus:outline-none` with no replacement ring (`book-browser.tsx:528`, `search-client.tsx:469,493`); filter pills and suggestion rows have none. WCAG 2.4.7. Add a global `:focus-visible { outline: 2px solid var(--color-oxblood); outline-offset: 2px; }`.

### 🟠 A5 — `trending-tabs.tsx` is not an accessible tab widget
No `role="tablist"`/`tab"`/`tabpanel`, no `aria-selected`, no arrow-key nav; active state is color-only; labels are `text-[10px]`. Add proper ARIA tab semantics + keyboard handling. (Note: `admin-tabs.tsx` is link-nav and correctly uses `aria-current` — leave it.)

### 🟠 A6 — Two parallel design systems
Homepage (serif, `--color-oxblood #5C1010`, `neutral-*` ramp, light-only, editorial) vs the app (sans, `--color-brand #8B2020` — a *different* red one shade off, `gray-*` ramp, dark-aware). Two reds, two gray ramps, serif vs sans. Crossing from home to `/search` is a visible style boundary. Consolidate tokens (pick one red, one gray ramp; document serif scope) and add semantic tokens (`--color-text`, `--color-surface`, `--color-border`, `--color-danger`).

### 🟡 A7 — Autocomplete combobox missing ARIA
`search-client.tsx` / `book-browser.tsx` inputs have `role="combobox"` but the dropdown has no `role="listbox"`, options no `role="option"`/`aria-selected`, and no `aria-activedescendant`. SR users get no suggestion announcements.

### 🟡 A8 — `book-browser.tsx` ≈ 80% duplicate of `search-client.tsx`
Same autocomplete/debounce/infinite-scroll/grid logic, diverged subtly — which is *why* a11y attributes exist in one and not the other. Extract shared grid/card/pill/dropdown so fixes apply once.

### 🟡 A9 — `share-buttons.tsx` clipboard write has no try/catch
Unlike `copy-button.tsx` (which does it right) — throws an unhandled rejection on permission denial, no feedback. Wrap in try/catch.

### 🟡 A10 — No `prefers-reduced-motion` handling
`fade-in` + `.hover-lift-*` transforms always run. Add a global reduced-motion media query.

### ⚪ A11 — Mobile grid density & fixed cover sizes
Book-of-day cover is a hard `180×270` at all breakpoints with a `6px` offset box-shadow (`BookOfDaySection.tsx:48`) — latent overflow class on ≤320px (same family as recent mobile-overflow fixes). 3-up grids on mobile (`grid-cols-3`) give ~100px cards — verify titles clamp and tap targets are adequate. Make covers responsive (`aspect-[2/3] w-full max-w-[180px]`).

**Already good:** descriptive `cover-alt.ts` alt text + correct decorative `alt=""` on thumbnails; `author-avatar` initials fallback; native `<details>` FAQ with matching JSON-LD; `mobile-nav.tsx` has a real focus trap + Escape + focus restore + `aria-expanded`; `breadcrumb.tsx` semantics; `contact-form.tsx` proper labels.

---

## 4. Code quality & architecture

### 🔴 C1 — Unordered paginated reads silently mis-count on indexed pages
The project's own doctrine ("paginated reads need `.order()`") is violated in several accumulate-then-aggregate loops with `.range(offset, offset+999)` and **no `.order()`**:
- `stats/page.tsx:82` (bans) & `:99` (book_authors) — sums/counts → wrong decade histograms & author leaderboard on a public page.
- `top-100-banned-books/page.tsx:36` — corrupts the flagship ranking.
- `banned-classics/page.tsx:58`, `banned-childrens-books/page.tsx:73` — same.
- `data-quality/route.ts:18`, `countries/[code]:168`, `reasons/[slug]:148` — dedupe into a Set, so only undercount-on-skip risk.

Also unbounded single-page `.range(0, 9999)` (`stats:23`, `news:129`, `bbw-data:227`) silently drops the tail past 10k rows. **Fix:** add `.order('id')` to every paginating loop; prefer `mv_ban_counts` over count-by-Set. (Both `bans` at 28,337 rows and `book_authors` at 14,158 exceed 1000, so this is active today.)

### 🟠 C2 — Supabase clients are untyped → ~85 `as unknown as` casts
`createClient` is called with no `Database` generic; no generated types file exists. A column rename in a migration would pass TypeScript silently and break the page at runtime. Run `supabase gen types typescript` → `src/types/database.ts` and parameterize `createClient<Database>(...)`.

### 🟠 C3 — Supabase errors swallowed silently
104 `?? []` / `?? null` data reads vs only 9 that check `error`. On a DB error, `data` is null and the page renders as **empty** — e.g. `stats/page.tsx:25` would publish "0 countries" on a transient error. Destructure `error` and throw into an error boundary (once A2 adds one), or fall back explicitly + log.

### 🟡 C4 — Public + money API routes lack try/catch
`api/suggest`, `api/dataset/checkout` (Stripe), and most `api/cron/*` have no error handling → Next default 500s. Wrap handlers, return JSON error envelopes.

### 🟡 C5 — `src/lib/supabase.js` is a hand-synced duplicate of `supabase.ts`
A checked-in compiled CJS artifact exists only because `scripts/enrich.js` does `require()`. Delete it; run `enrich.js` via `tsx` (already a dependency) so it imports the `.ts`.

### 🟡 C6 — Large files
`books/[slug]/page.tsx` is **1,658 lines** (data fetch + ban-summary + FAQ + JSON-LD + JSX); also `admin/scripts/page.tsx` (1,434), reading-club admin client (1,251). Extract the pure transforms into tested lib modules.

### 🟡 C7 — `: any` / `as any` concentrated in `data-quality/route.ts`
6 of 14 `: any` live here (`from(table as any)`, `applyFilter(q: any)`). Admin-only, but type the dynamic table name as a string union.

### 🟡 C8 — Test coverage gaps
21 test files cover the genuinely tricky pure logic well (slugify, gate, parsers, rotation) — but `book-search.ts` (the most-hit data path), all API routes incl. the Stripe money path, and the pagination loops (C1) are untested. A >1000-row fixture would have caught C1.

**Positives:** `strict: true`; zero `@ts-ignore`/`@ts-expect-error`; only 3 TODO/FIXME markers; homepage batches 12 queries in one `Promise.all`; correct MV usage matching the `distinct_books` doctrine; `dataset/download/route.ts` is exemplary (token + expiry + soft-fail).

---

## 5. Security

Auth is the strongest part of the codebase: **every `/api/admin/*` route and method is authenticated** (verified all 37 route files), cron uses `Bearer CRON_SECRET`, the Stripe webhook verifies signatures on the raw body, the service-role key never reaches a client component, no untrusted HTML reaches `dangerouslySetInnerHTML` (marked→sanitize-html allowlist at save-time), no SSRF surface (hardcoded feed list + image allowlist), and `sameSite=lax` adequately blocks CSRF on state-changing methods.

### 🟠 SEC1 — No security headers
`next.config.ts` sets no CSP, `X-Frame-Options`, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`. The admin panel is **frameable → clickjacking** against the logged-in owner. Add a global `/:path*` headers block: `X-Frame-Options: DENY` (priority), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, and a `Content-Security-Policy` (start report-only; JSON-LD uses inline `<script>` so needs `'unsafe-inline'` or a nonce).

### 🟡 SEC2 — No rate limiting anywhere
Sharpest on `admin/login` (unlimited password guesses against `ADMIN_SECRET`). Also `checkout` (Stripe session spam), `suggest`/`books` (multi-query amplification, cache-bypassed by unique `q`), `pageview` (inflates public "trending" rankings). Add IP rate limiting (Vercel KV/Upstash) — strict on login + checkout, looser elsewhere.

### 🟡 SEC3 — Admin session cookie value IS the raw `ADMIN_SECRET`
Same secret authenticates the admin panel and `/api/indexnow` Bearer; no rotation/revocation; timing-unsafe `!==`; and `fetch-news/route.ts:9-10` logs secret prefixes. Issue a random opaque token at login, store its hash with expiry, compare with `crypto.timingSafeEqual`, and decouple from `CRON_SECRET`/IndexNow. Remove the prefix logging.

### ⚪ SEC4 — PostgREST `.or()` filter built from unescaped `q`
`book-search.ts:138` / `suggest/route.ts:35` interpolate user input into a `.or('title.ilike.%q%,…')` string; commas/parens are filter syntax. Low exploitability (public tables only, gated rows re-filtered) but worst case is a 500 or malformed filter — escape PostgREST reserved chars.

### ⚪ SEC5 — `.env.example` drift
Omits secrets actually used (`STRIPE_*`, Resend/IMAP, `INDEXNOW_KEY`, `GITHUB_DISPATCH_TOKEN`). Document to prevent misconfigured deploys.

---

## 6. Data integrity

Read-only Supabase audit (2026-05-31):

| Table | Rows |
|---|---|
| books | 13,695 |
| authors | 8,379 |
| bans | 28,337 |
| book_authors | 14,158 |
| countries | 103 |
| reasons | 11 |

**Coverage gaps (the content ceiling — D1):**
- Books **no description: 12,545 (92%)** · no cover: 5,704 (42%) · no isbn13: 6,336 (46%).
- Authors **no bio: 2,668 (32%)** · no photo: 3,572 (43%).
- Gated: 2 · warning_level ≠ none: 22 (both as expected).

**Image hosts: 0 violations** across 7,991 covers + 4,807 author photos — the `isAllowedImageUrl()` allowlist enforcement is working perfectly. ✅

### 🟠 D1 — Description coverage is the growth ceiling
Only ~8% of books have a real description. Pages aren't empty (ban-summary text + FAQ are generated), but the thin content limits both SERP-snippet quality (feeding S1's low CTR) and the depth AI crawlers can ingest. Prioritized enrichment of the **highest-traffic** slugs (cross-reference the GSC `pages` export) is far higher-leverage than uniform backfill. The enrichment pipeline already exists (`/api/admin/enrich/*`); the lever is *targeting*.

---

## 7. Suggested prioritization for the roadmap

Ordered by impact-to-effort. Grouped, not time-boxed.

**Do first — high impact, contained:**
1. **P1 — `generateStaticParams` on `books/[slug]`, `authors/[slug]`, `countries/[code]`, `reasons/[slug]`, `scope/[slug]`.** Fixes the live no-cache defect; flips the whole catalogue to PRERENDER/ISR. Biggest single win.
2. **C1 — add `.order('id')` to every unordered pagination loop.** Stops public pages showing wrong counts. One-line fixes.
3. **S3 — normalize country-code case** (lowercase sitemap + internal links + 308 upper→lower). Stops live URL duplication.
4. **S4 — add `/laws/loi-gayssot`, `/search`, `/data-quality`, BBW archive to sitemaps.** Trivial; unblocks discovery.
5. **SEC1 — security headers** (at least `X-Frame-Options: DENY` + nosniff + Referrer-Policy + HSTS).

**Do next — high value, more work:**
6. **A2 — error/not-found/loading boundaries** (branded 404 with search recovery).
7. **P2 — `countries/[code]` waterfall → `Promise.all` + materialized view.**
8. **A1 — resolve dark mode** (ship it or strip it).
9. **A3/A4/A5/A7 — accessibility baseline** (skip link, focus ring, tab ARIA, combobox ARIA).
10. **D1 — targeted description enrichment of top-traffic slugs** (GSC-driven).
11. **C3 — stop swallowing Supabase errors** (pairs with A2).

**Then — durability & polish:**
12. C2 (typed Supabase) · C4 (API try/catch) · SEC2 (rate limiting) · SEC3 (session token) · S5 (IndexNow updated_at) · A6 (design-system consolidation) · A8 (dedupe browsers) · P3/P4 (countries-list ISR, estimated counts).

**Monitor (no code change):**
- S2 — apex/www consolidation; re-check GSC 2026-06-08, confirm apex impressions decaying.
- S6 — Deenie CTR experiment (question-led title/meta + above-fold answer block).

---

## Appendix — evidence

- **Build:** `npm run build` → exit 0; 91 static pages generated; 2 low warnings (custom `/_next/image` Cache-Control [intentional], `middleware`→`proxy` deprecation). Turbopack build omits per-route First-Load-JS sizes — run `@next/bundle-analyzer` if KB numbers are needed (source analysis found no heavy lib leaking to the client).
- **GSC 28-day:** 25 clicks / 17,297 impressions / **0.14% CTR**. Top query "why is deenie a banned book" = 12,532 impr / 9 clicks / pos 7.3. Apex pages indexed: 738 (147 clicks); www: 262 (402 clicks). Exports at `data/gsc/queries-2026-05-29.json`, `data/gsc/pages-2026-05-29.json`.
- **Live cache headers (2026-05-31):** detail pages MISS+no-store; static/SSG pages PRERENDER/HIT (table in §1).
- **Live redirects:** apex→www 308 ✓; uppercase country path returns 200 (no redirect) ✗.
- **Supabase counts & coverage:** §6. Helper script: `scripts/_audit_site_health.ts` (read-only).
