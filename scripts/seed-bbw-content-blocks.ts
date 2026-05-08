/**
 * Initial seed for the editorial content blocks introduced in migration 016.
 *
 * Writes a starting draft of markdown into every block, renders it through
 * the same marked + sanitize-html pipeline the admin save path uses, and
 * marks each block as `published` so the public BBW + Reading Club pages go
 * live immediately. Editorial team can then iterate via /admin/content-blocks.
 *
 * The prose is intentionally restrained — factual, calm, no advocacy — so the
 * editorial team can lift, replace, or refine without rewriting from scratch.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-bbw-content-blocks.ts
 *     → dry-run: prints what would be updated, no writes
 *   npx tsx --env-file=.env.local scripts/seed-bbw-content-blocks.ts --apply
 *     → upserts markdown + body_html, sets status to 'published'
 *
 * Idempotent: re-running --apply will overwrite existing markdown / HTML on
 * any block where the slug matches. Notes column is preserved.
 */

import { adminClient } from '../src/lib/supabase'
import { renderContentBlockHtml } from '../src/lib/markdown'

const APPLY = process.argv.includes('--apply')

// ── Initial editorial drafts ─────────────────────────────────────────────────
//
// Calibrated against the briefs in supabase/migrations/016_bbw_reading_club.sql.
// Each entry is read once, rendered to sanitized HTML, then UPSERTed.

const BLOCKS: Record<string, string> = {
  'bbw-hero-subtitle':
    `An independent knowledge resource for Banned Books Week — international context, data, and reading paths to complement the official events.`,

  'bbw-tile-tagline':
    `International context for the global readership`,

  'bbw-what-is':
    `Banned Books Week began in 1982, organised by a coalition of librarians, booksellers, and publishers in the United States in response to a sharp rise in challenges to books in school and public libraries. Its founders framed it as a defence of First-Amendment principles — the freedom to read, write, and choose what to read.

Since then the week has grown into a yearly observance held in late September or early October, marked by readings, displays, and educational events. Other countries have adopted parallel initiatives with similar messaging, though Banned Books Week itself remains a US-organised effort.

A note on terminology that often gets muddled: a *challenge* is a formal request to remove or restrict access to a book, usually filed in a school or public library. A *ban* is a successful challenge — a book that has been removed, restricted, or refused entry. Most reported numbers from the Banned Books Week period count challenges; banned-books.org documents both, and adds the international dimension that the US framing tends to miss.`,

  'bbw-why-matters':
    `Book censorship is not a curiosity from another century. It is happening now, at scale, and in places most people do not look.

In the past five years the rate at which books are formally challenged in US public and school libraries has reached its highest level in the four decades the American Library Association has tracked the data. Outside the United States the picture is sharper still: state-level book bans operate in several countries, and possessing the wrong book can carry years in prison.

The numbers below are drawn from our own dataset of documented bans across countries. They will not match what any single national source reports — they include both school-board removals and government decrees, both contemporary and historical, both well-documented and under-reported. Each row is sourced; each book is named.

What the numbers cannot show is the chilling effect on what is *not* written. That is the harder thing to measure, and the better reason to read.`,

  'bbw-other-side':
    `Book censorship debates often collapse into a binary that helps no one — every challenge framed as a clear act of authoritarianism, every defence framed as evidence of bad parenting. The truth is messier, and worth treating as such.

There is a meaningful difference between a parent objecting to a specific book in a specific school library and a state apparatus banning a book from an entire country. The first is a routine feature of how schools work; communities have always negotiated which texts are age-appropriate, which are required reading, and which sit on the shelf with no requirement to read. Reasonable people disagree on the answer, and that disagreement is not by itself censorship.

What turns a complaint into a ban — in the language we use here — is whether a book becomes harder to obtain *as a result of the objection*. Removing a single age-banded copy from an elementary library while keeping it stocked at the high school is one thing. Pulling the book from every school in a district, or from a state-wide approved-reading list, is another. The line is not always crisp, but it exists, and pretending it does not exist makes the conversation worse.

A second distinction: US challenges, even at their peak, are not equivalent to bans in Iran, China, Russia, or Belarus. In the latter, possessing the wrong book — Solzhenitsyn, Rushdie, a banned biography of a leader — has carried prison time within living memory and in some cases this year. Lumping these together flattens what is genuinely at stake.

We document both because both are real, and both belong on the same map. We try not to flatten them.`,

  'bbw-reading-intro':
    `The most direct response to a book ban is to read the book. There is no metaphor in this — the act that the censor specifically wanted to prevent is the act that, in aggregate, refutes the censorship.

Reading alone is fine. Reading with someone else, even casually, is more powerful: a banned book read together is a small civic act, and it tends to produce better conversations than the same book read in isolation.

We have organised four reading paths below, ranging from the current ALA challenged list to the deep international archive. Pick whichever fits your week.`,

  'bbw-what-you-can-do':
    `Concrete things that help, in roughly the order of how easy they are:

- **Read a banned book this week.** Any of the four tracks below work. If you only have one evening, [Currently Challenged](/reading-club/currently-challenged) has shorter entries.
- **Lend or recommend it.** Tell one person, in person, why the book matters. Most reading recommendations die at "I should read that"; specifics survive.
- **Donate to your local library.** Public libraries, not just school libraries — they are the front line of any defence of the freedom to read, and they are chronically underfunded.
- **Show up at a school-board meeting.** This is not glamorous but it is what tilts the outcome of most US challenges. Local meeting calendars are public.
- **Contact your representatives.** State legislators in particular — most book-removal laws are passed at the state level.
- **Tell the international story.** A US-only frame on book bans misses most of what is happening worldwide. Share data points from the [Stats](/stats) page or specific country pages.`,

  'reading-club-intro':
    `The Reading Club is a place to read banned books together. There is no registration, no email capture, and no fixed schedule.

Pick a track below. Each track has a curated list of titles, links to copies you can buy or borrow, and discussion questions designed to be useful whether you are reading on your own or with a group of three or thirty. The questions are optional, but most readers find that even a single conversation about a banned book changes how they read it. The four tracks differ in scope: contemporary US challenges, the international archive, classics still on shelves today, and thematic paths for deeper reading.

You can read at any pace. Most banned books read faster than you expect — that is one of the patterns that emerges once you start.`,

  'reading-club-why':
    `Reading a banned book is not about virtue signalling. It is about preserving the option of reading the book at all.

Every act of censorship — from a school-library removal to a state-level prohibition — works on the same principle: that the book in question is too dangerous, too corrupting, or too inconvenient to be read freely. Reading the book is the simplest, most direct response to that argument. It refuses the premise.

Reading with other people adds something a solo reader cannot reach. A discussion partner sees the parts you missed. A reader from another generation will notice things — assumptions, jokes, taboos — that look invisible to a reader of your own. A reader from another country reads the same passage against an entirely different baseline. None of this is unique to banned books, but banned books concentrate it: the very fact that the book was challenged signals that it touches something a society is uneasy with, and that unease tends to be where the most interesting reading lives.

There is also a freedom-of-conscience argument that this site takes seriously. To read a book is, briefly, to think someone else's thoughts. The freedom to do that — to enter, on your own time, the inside of a viewpoint you might never adopt — is one of the freedoms the censor most wants to remove. Practising it on a contested book is a small but real exercise of the freedom itself.

A banned book in the United States and a banned book in Iran or Belarus are not the same kind of object. Reading both, in the same week, is the cleanest way to understand how different the world's censorship regimes actually are. Statistics can show you the shape of the problem; the books themselves let you feel it.`,

  'reading-club-how-to-start':
    `1. **Pick a track.** Currently Challenged is the most accessible if you want a single book this week. International is the deepest. Classics is the most familiar. Themes are useful if you have a question you want to think about.
2. **Get the book.** Any public library should have most titles; if not, [Bookshop.org](https://bookshop.org) supports independent bookstores. Used copies on AbeBooks or your local secondhand shop also work.
3. **Set a pace.** Most banned books are shorter than you expect. A two-week window is generous; some can be done in an evening.
4. **Optional: meet to discuss.** A coffee, a video call, or a Sunday afternoon. Use the discussion questions on each track page as a starting point.
5. **Optional: read the next one.** Most readers who start one banned book in a year read three.`,

  'reading-club-universal-questions':
    `These questions work for any banned book, on any track. Use them as a starting point for a discussion or for your own notes.

- Why was this book banned, and by whom? What were they specifically afraid of?
- Reading it now, does the danger they feared still feel present, or does it feel dated?
- What does the ban reveal about the people who imposed it — their values, their fears, their politics?
- Is there anything in this book that you would not want a child to read? At what age does that change?
- If you were arguing the censor's case in good faith, what is the strongest version of their argument?
- Who is the book *for*? Whose absence in the conversation is the censor protecting?
- What in this book reads differently against your own time and country than it would have when it was written?
- What would be lost if this book were never written, or never read again?`,

  'track-currently-challenged-intro':
    `The American Library Association's Office for Intellectual Freedom (OIF) publishes an annual list of the books most challenged in US public and school libraries during the previous calendar year. The numbers count formal challenges — written requests to remove or restrict access — not removals or bans. Several of the books on the list remain on most US library shelves.

The list is a US-only signal, and it is biased toward what gets reported: many challenges are handled informally and never reach the OIF. It is also biased toward English-language, school-library titles. Even so, it is the most consistent annual record we have of where the contemporary US debate is, and what kinds of books are at its centre.

We document the list here as the editorial team enters it, with discussion questions per book and links to our deeper records. ALA's own source page is linked at the top.`,

  'track-international-intro':
    `The Currently Challenged track follows a single national signal — the US ALA list — well, but a single national signal is not the whole story. Outside the United States, book censorship looks different in shape and in stakes: state-level bans, theocratic restrictions, post-coup blacklistings, hereditary national taboos. Many of these are better documented elsewhere and worse documented in mainstream English-language coverage.

This track is curated by an automated diversity engine over our own dataset. The engine optimises for geographic spread, regime variety (authoritarian, theocratic, hybrid, Western-democratic), and topical breadth, with an editorial override available for individual picks. It deliberately does not duplicate the US-focused titles that already dominate Anglophone reading lists. It will surprise you — that is the point.

If you have only read banned books from the United States, this is the track that will most change how you think about the category.`,

  'track-classics-intro':
    `"Classic" here means a book widely read today that was, at some point in its lifetime, aggressively suppressed. Some were prosecuted as obscenity; some were burned by states; some were quietly dropped from school curricula and only later restored. All of them are now part of the canon.

The interesting thing about reading classics through the censorship lens is that the censors of the period almost always lost — the book is on the shelf today, the censor is a footnote. That is not a guarantee that contemporary censorship will play out the same way, but it is a useful reminder that the cultural memory of a book outlasts the people who tried to bury it.

For a deeper catalogue, see our [Banned classics](/banned-classics) page. The list below is a smaller, curated reading-order set with discussion questions.`,

  'track-themes-intro':
    `Five thematic reading paths through the dataset — useful when you want to dig into a specific question rather than read across categories. The themes were chosen to cover the most frequently cited reasons for book bans worldwide, including reasons the US debate alone tends to flatten.

Each theme card below leads to a list of books that intersect with it, drawn from our dataset and curated by the editorial team where useful.`,

  'theme-lgbtq-intro':
    `LGBTQ+ themes are the single most cited reason for book challenges in US public and school libraries since 2020, on the ALA's annual record. The pattern is recent, sharp, and concentrated in books for younger readers. Most of these challenges are about presence rather than content — that the book exists in the catalogue, not what it specifically depicts.

Internationally the picture is more severe. Around sixty countries criminalise same-sex relations to varying degrees, and many of those criminalise the publication or distribution of "homosexual content" alongside the conduct itself. A book that is a school-board challenge in one country can carry prison time in another. Both belong on this theme.`,

  'theme-political-dissent-intro':
    `Political censorship is the oldest form of book banning and the form with the highest stakes. Twentieth-century examples are easy to point to — Solzhenitsyn under the Soviet Union, banned writers under apartheid, the Pinochet-era Chilean blacklist — but the form is alive.

In the past decade, contemporary cases include Belarus's prosecution of independent publishers, China's ongoing crackdown on Hong Kong publishing, Russia's "extremist materials" registry, and Iran's book-licensing regime. In the United States, recent state-level laws restricting books on race or government history function as a softer version of the same impulse — an attempt to control which political accounts of the country are available to which readers.

This theme spans both extremes and what lies between them.`,

  'theme-religious-censorship-intro':
    `Two related but distinct categories of book sit under this theme. The first is books restricted by religious authorities — theocratic states, sectarian courts, religious-majority pressure on schools and publishers. Salman Rushdie's case is the most famous, but it is far from the only one.

The second is books *about* religion — works of comparative religion, atheist polemic, historical treatments of religious institutions, religious satire — restricted under blasphemy or anti-incitement laws across many countries. The two categories overlap but are not the same.

Both are well-represented worldwide; the distinction matters when reading individual cases. We document them together because the underlying mechanism — religious authority deciding which books are acceptable to read — is shared.`,

  'theme-race-and-racism-intro':
    `Two sharply different kinds of book sit under this theme, and the distinction matters.

The first is books restricted because they discuss racism — slave narratives, civil-rights histories, novels that frankly portray racial violence, and the contemporary US wave of "anti-CRT" school challenges. These books are typically restricted by people who would prefer the topic discussed less, or differently.

The second is books restricted because they were judged racist by later readers — older novels with caricatures, older travel writing, older children's books — sometimes shelved differently, sometimes withdrawn from school curricula, occasionally banned outright. These restrictions are typically made by people who consider the books harmful to readers.

These are not equivalent acts and should not be flattened into each other, even though both end up on this theme. The list below contains both; we mark which is which where it matters.`,

  'theme-sexuality-intro':
    `Three patterns recur in challenges to books with sexual content. The first is the school-library debate over age-appropriateness, which has been a steady undercurrent in the United States for decades and which has spiked sharply since 2020. The second is the recurring tendency in school challenges to conflate any LGBTQ+ presence with "sexual content" — a slippage that distorts both debates. The third is the long literary history of obscenity prosecutions: *Lady Chatterley's Lover*, *Ulysses*, *Tropic of Cancer*, *Lolita*, and many less canonical books.

Internationally, sexual content is one of the most consistent grounds for state-level book bans, often under "morality" or "decency" laws that vary widely in their reach. Books that are mainstream in one country are criminal to import in another. The titles below span all three patterns.`,
}

async function main() {
  const supabase = adminClient()

  // Sanity check: every slug we are about to write must already exist as a
  // placeholder. If something is missing, migration 016 didn't seed properly.
  const { data: existing, error: selErr } = await supabase
    .from('content_blocks')
    .select('slug, status')
    .in('slug', Object.keys(BLOCKS))
  if (selErr) {
    console.error('Failed to read content_blocks:', selErr.message)
    process.exit(1)
  }
  const existingSlugs = new Set((existing ?? []).map(r => r.slug))
  const missing = Object.keys(BLOCKS).filter(s => !existingSlugs.has(s))
  if (missing.length > 0) {
    console.error(`Missing block rows: ${missing.join(', ')}`)
    console.error('Run migration 016 first.')
    process.exit(1)
  }

  console.log(`Found ${existingSlugs.size}/${Object.keys(BLOCKS).length} blocks to seed.`)
  if (!APPLY) {
    console.log('Dry run — no writes. Pass --apply to commit.')
  }

  const now = new Date().toISOString()
  let updated = 0

  for (const [slug, markdown] of Object.entries(BLOCKS)) {
    const html = renderContentBlockHtml(markdown)
    if (!APPLY) {
      console.log(`  ${slug}: ${markdown.split(/\s+/).length} words, ${html.length} bytes HTML`)
      continue
    }
    const { error } = await supabase
      .from('content_blocks')
      .update({
        body_markdown: markdown,
        body_html: html,
        status: 'published',
        last_edited_at: now,
        published_at: now,
        last_edited_by: 'seed-script',
      })
      .eq('slug', slug)
    if (error) {
      console.error(`  ✗ ${slug}: ${error.message}`)
      continue
    }
    console.log(`  ✓ ${slug}`)
    updated++
  }

  if (APPLY) {
    await supabase.from('editorial_publish_log').insert({
      content_type: 'content_block',
      content_key: 'seed-bbw-content-blocks',
      action: 'bulk_publish',
      notes: `Seeded ${updated} blocks from scripts/seed-bbw-content-blocks.ts`,
    })
    console.log(`\nDone. Updated ${updated} block(s). Public pages will render the new content immediately.`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
