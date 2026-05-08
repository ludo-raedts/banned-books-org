-- ─────────────────────────────────────────────────────────────────────────────
-- 016 — Banned Books Week + Reading Club + Content Blocks
--
-- Adds the schema for:
--   • content_blocks                    — editorial CMS, slug-keyed
--   • bbw_featured_selections           — yearly BBW featured-books picks
--   • reading_club_currently_challenged — yearly ALA OIF Top-N (manual)
--   • reading_club_international        — engine-driven, evergreen
--   • reading_club_classics             — manual, evergreen
--   • reading_club_themes               — five themes (LGBTQ+ etc.)
--   • reading_club_theme_books          — books per theme
--   • editorial_publish_log             — single audit trail for publishes
--
-- Draft / publish convention used everywhere: a row with `published_at IS NULL`
-- is the working draft; setting `published_at` makes it visible on the public
-- pages. This avoids a separate “publish to staging” table per content type.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── content_blocks ────────────────────────────────────────────────────────────
-- Slug-keyed editorial CMS. body_html is rendered server-side at save time
-- (marked + sanitize-html) so reads stay cheap. status governs visibility:
--   placeholder → never on public; brief shows in admin only
--   draft       → never on public; admin can iterate
--   published   → body_html is rendered on the public page
-- A page that depends on a block must hide its section when the block isn't
-- yet `published`, AND must refuse to publish itself if any required block is
-- still in placeholder. Enforced in app code (see lib/content-blocks.ts).

CREATE TABLE IF NOT EXISTS content_blocks (
  slug              text PRIMARY KEY,
  title             text NOT NULL,
  placeholder_brief text NOT NULL,
  body_markdown     text,
  body_html         text,
  status            text NOT NULL DEFAULT 'placeholder'
                       CHECK (status IN ('placeholder', 'draft', 'published')),
  notes             text,
  last_edited_by    text,
  last_edited_at    timestamptz NOT NULL DEFAULT now(),
  published_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_blocks_status ON content_blocks(status);

-- ── bbw_featured_selections ───────────────────────────────────────────────────
-- One row per (year, book_id). Position 1..10 are the headline picks; 11..25
-- are alternates surfaced in the admin “alternatives” pane. Suggester output
-- is staged here as drafts (published_at NULL) until the editor publishes.

CREATE TABLE IF NOT EXISTS bbw_featured_selections (
  year         int     NOT NULL,
  book_id      bigint  NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  position     int     NOT NULL,
  custom_blurb text,
  pinned       boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, book_id)
);

CREATE INDEX IF NOT EXISTS idx_bbw_featured_year_position ON bbw_featured_selections(year, position);
CREATE INDEX IF NOT EXISTS idx_bbw_featured_published     ON bbw_featured_selections(year) WHERE published_at IS NOT NULL;

-- ── reading_club_currently_challenged ─────────────────────────────────────────
-- Manual entry from the ALA OIF annual list. ALA periodically reports ties so
-- the table allows up to 12 entries per year (positions 1..12). title/author
-- are stored verbatim (the ALA list isn't always matchable to our books DB);
-- book_id is set when an editor confirms the link.

CREATE TABLE IF NOT EXISTS reading_club_currently_challenged (
  year                 int     NOT NULL,
  position             int     NOT NULL,
  title                text    NOT NULL,
  author               text    NOT NULL,
  challenge_count      int,
  book_id              bigint  REFERENCES books(id) ON DELETE SET NULL,
  bookshop_url         text,
  discussion_questions jsonb,
  source_url           text,
  published_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, position)
);

CREATE INDEX IF NOT EXISTS idx_rc_cc_published ON reading_club_currently_challenged(year) WHERE published_at IS NOT NULL;

-- ── reading_club_international ────────────────────────────────────────────────
-- Engine-curated international set. Evergreen — only one active set at a time
-- (no year column). Re-running the suggester replaces the draft rows.

CREATE TABLE IF NOT EXISTS reading_club_international (
  book_id              bigint  PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  position             int     NOT NULL,
  custom_blurb         text,
  discussion_questions jsonb,
  pinned               boolean NOT NULL DEFAULT false,
  published_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rc_intl_position  ON reading_club_international(position);
CREATE INDEX IF NOT EXISTS idx_rc_intl_published ON reading_club_international(book_id) WHERE published_at IS NOT NULL;

-- ── reading_club_classics ─────────────────────────────────────────────────────
-- Manually curated, evergreen.

CREATE TABLE IF NOT EXISTS reading_club_classics (
  book_id              bigint  PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  position             int     NOT NULL,
  custom_blurb         text,
  discussion_questions jsonb,
  published_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rc_classics_position  ON reading_club_classics(position);
CREATE INDEX IF NOT EXISTS idx_rc_classics_published ON reading_club_classics(book_id) WHERE published_at IS NOT NULL;

-- ── reading_club_themes + theme books ─────────────────────────────────────────
-- Five themes, each with a book set. Theme slug is the route segment under
-- /reading-club/by-theme/[slug]. Books auto-populate via tag-matching but the
-- admin can override the featured set and order.

CREATE TABLE IF NOT EXISTS reading_club_themes (
  slug         text PRIMARY KEY,
  display_name text NOT NULL,
  sort_order   int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reading_club_theme_books (
  theme_slug           text    NOT NULL REFERENCES reading_club_themes(slug) ON DELETE CASCADE,
  book_id              bigint  NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  position             int     NOT NULL,
  custom_blurb         text,
  discussion_questions jsonb,
  published_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (theme_slug, book_id)
);

CREATE INDEX IF NOT EXISTS idx_rc_theme_books_position  ON reading_club_theme_books(theme_slug, position);
CREATE INDEX IF NOT EXISTS idx_rc_theme_books_published ON reading_club_theme_books(theme_slug) WHERE published_at IS NOT NULL;

-- ── editorial_publish_log ─────────────────────────────────────────────────────
-- Single audit table for every publish action across content blocks, BBW,
-- and Reading Club tracks. content_type is one of:
--   'content_block', 'bbw_featured', 'rc_currently_challenged',
--   'rc_international', 'rc_classics', 'rc_theme'
-- content_key is a free-form locator (slug, year, theme_slug, etc.).
-- admin_user defaults to NULL because the existing admin auth is a single
-- shared password, not a per-user system; future per-user upgrades can fill it.

CREATE TABLE IF NOT EXISTS editorial_publish_log (
  id            bigserial PRIMARY KEY,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  admin_user    text,
  content_type  text NOT NULL,
  content_key   text NOT NULL,
  action        text NOT NULL,
  notes         text
);

CREATE INDEX IF NOT EXISTS idx_editorial_log_occurred  ON editorial_publish_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_editorial_log_type_key  ON editorial_publish_log(content_type, content_key);

-- ── Seed: five themes ─────────────────────────────────────────────────────────

INSERT INTO reading_club_themes (slug, display_name, sort_order) VALUES
  ('lgbtq',                'LGBTQ+',                10),
  ('political-dissent',    'Political dissent',     20),
  ('religious-censorship', 'Religious censorship',  30),
  ('race-and-racism',      'Race and racism',       40),
  ('sexuality',            'Sexuality',             50)
ON CONFLICT (slug) DO NOTHING;

-- ── Seed: required content blocks ─────────────────────────────────────────────
-- All start as 'placeholder'. Each carries a written brief describing intent;
-- the editorial team replaces these via /admin/content-blocks. Public pages
-- hide sections until the corresponding block is `published`.

INSERT INTO content_blocks (slug, title, placeholder_brief) VALUES
  ('bbw-hero-subtitle',
   'BBW hub — hero subtitle',
   'One short sentence (max ~25 words) framing the page. Should communicate that this is an independent, international knowledge resource that complements the official BBW initiative without claiming affiliation. Plain text only — no links, no markdown headings.'),

  ('bbw-tile-tagline',
   'Homepage tile — BBW tagline',
   'Two-to-six word tagline shown under "Banned Books Week [year]" on the homepage tile during the configured window. Editorial — invites the visitor in. No punctuation at the end.'),

  ('bbw-what-is',
   'BBW hub — What is Banned Books Week',
   '3 short paragraphs. Factual. Cover: 1982 origin in the US library community, role of librarians and First-Amendment framing, international expansion since, and the distinction between "challenged" and "banned". ~150–200 words. No advocacy language.'),

  ('bbw-why-matters',
   'BBW hub — Why it still matters',
   '2–3 paragraphs of editorial prose explaining why book censorship still matters in the year of the page. Live stats (total bans, countries, recent growth) are auto-rendered by the page below this block — do not duplicate numbers; instead, set the interpretive frame for them. ~150–250 words.'),

  ('bbw-other-side',
   'BBW hub — The other side',
   'Minimum 250 words. Engage seriously with: removal from school curriculum vs. outright ban; parental-rights arguments in school contexts; age-appropriateness vs. censorship; and the qualitative difference between US "challenges" and authoritarian state bans (Iran, China, Russia, Belarus). Goal: showing that we take counter-arguments seriously is what differentiates this page from ALA / Coalition pages.'),

  ('bbw-reading-intro',
   'BBW hub — Reading and discussing banned books (intro)',
   '1–2 short paragraphs introducing the four Reading Club tracks below. The four track links are auto-rendered by the page — keep this block to the framing only ("Reading these books is one of the most direct responses to censorship…"). ~80–120 words.'),

  ('bbw-what-you-can-do',
   'BBW hub — What you can do',
   '4–7 concrete actions as a markdown list. Should include: read; donate to libraries; show up at school-board meetings; contact representatives; tell people the international story. Avoid US-only framing. ~120–180 words including list items.'),

  ('reading-club-intro',
   'Reading Club hub — intro',
   '2 short paragraphs introducing the Reading Club concept. Evergreen, not pinned to any particular week or year. State plainly: pick a track, read at your own pace, optional discussion questions provided. No registration, no email capture. ~120–160 words.'),

  ('reading-club-why',
   'Reading Club hub — Why read banned books together',
   'The "why" of the Reading Club. 3–4 paragraphs (~250–350 words) covering: (1) reading a banned book together turns private reading into a small civic act — you''re engaging with exactly the speech someone tried to silence; (2) discussion adds a dimension a solo reader can''t reach — other readers see what you missed, especially across generations and backgrounds; (3) banned books force the reader to think about freedom, authority, and which values are worth defending — and which lines they themselves would or wouldn''t draw; (4) the international dimension matters: the same book that''s a "school challenge" in the US can carry prison time elsewhere, and reading both contexts together changes the conversation. Editorial, slightly literary in voice, but specific — avoid platitudes.'),

  ('reading-club-how-to-start',
   'Reading Club hub — How to start',
   '3–5 numbered steps as a markdown list explaining how to actually use this resource — pick a track, get the book (library / bookshop), set a pace, optionally meet to discuss. Practical and friendly. ~100–140 words.'),

  ('reading-club-universal-questions',
   'Reading Club hub — Universal discussion questions',
   '5–8 generic discussion prompts as a markdown list, applicable to any banned book. Not track-specific. Examples should probe: why this book threatened authority, what the ban reveals about the banner, how the book reads now, what the reader''s own context adds. ~150–200 words.'),

  ('track-currently-challenged-intro',
   'Reading Club — Currently Challenged track intro',
   '2 short paragraphs introducing the ALA OIF list and what "currently challenged" means in the US school-library context. Be precise: this is challenges, not bans; the count reflects formal complaints. Refer the reader to the page''s ALA attribution box for sourcing. ~120–160 words.'),

  ('track-international-intro',
   'Reading Club — International track intro',
   '2–3 short paragraphs explaining why an international track exists and how this differs from the US-focused Currently Challenged track. Note geographic and regime diversity. The book list is engine-curated; mention that briefly. ~140–180 words.'),

  ('track-classics-intro',
   'Reading Club — Classics track intro',
   '2 short paragraphs introducing classic banned books — books still on shelves today that were once aggressively suppressed. Cross-link the existing /banned-classics page. Frame as: history is the long view on what censorship gets wrong. ~120–160 words.'),

  ('track-themes-intro',
   'Reading Club — By Theme track intro',
   '1–2 short paragraphs introducing thematic reading paths. The five theme cards are auto-rendered by the page below this block — keep this block to the framing only. ~80–120 words.'),

  ('theme-lgbtq-intro',
   'Theme — LGBTQ+',
   '2 short paragraphs introducing LGBTQ+-themed bans. Cover both contemporary US challenges (school libraries) and international cases (criminalisation in 60+ countries). Avoid US-only framing. ~120 words.'),

  ('theme-political-dissent-intro',
   'Theme — Political dissent',
   '2 short paragraphs on political-dissent bans. Cover both Cold-War-era and contemporary cases (Russia, Belarus, China, Hong Kong, Iran), and US "anti-CRT" school challenges where applicable. ~120 words.'),

  ('theme-religious-censorship-intro',
   'Theme — Religious censorship',
   '2 short paragraphs on religious censorship — both bans driven by religious authority (theocratic states, sectarian courts) and bans of books on religion (atheism, comparative religion, religious satire). ~120 words.'),

  ('theme-race-and-racism-intro',
   'Theme — Race and racism',
   '2 short paragraphs on bans of books about race — both books restricted because they discuss racism (US school-board challenges) and books restricted because they were judged racist by later standards. Do not equate the two; explain the distinction. ~140 words.'),

  ('theme-sexuality-intro',
   'Theme — Sexuality',
   '2 short paragraphs on bans of books with sexual content. Cover: the recurring conflation of LGBTQ+ content with "sexual content" in school challenges; the long literary history of obscenity trials (Lawrence, Joyce); contemporary international cases. ~140 words.')
ON CONFLICT (slug) DO NOTHING;
