import {
  buildMarkdownDocument,
  type MarkdownFrontmatter,
} from '@/lib/markdown-response'

export const frontmatter: MarkdownFrontmatter = {
  title: 'About — Banned Books',
  url: 'https://www.banned-books.org/about',
  description:
    'Banned Books is an independent open catalogue of books banned by governments and schools worldwide. Mission, methodology, editorial principles, and contact.',
  published_at: '2026-04-01',
}

export type AboutStats = {
  books: number
  bans: number
  countries: number
  activeBans: number
  sources: number
}

export function buildAboutDocument(stats: AboutStats): string {
  const n = (v: number) => v.toLocaleString('en')
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const body = `# About this project

Banned Books is an independent, open catalogue of books banned, challenged, or removed by governments, schools, and libraries worldwide. We document the who, where, when, and why of literary censorship — from Cold War prohibitions to today's classroom removals.

## Mission

Banned Books started in April 2026 as a personal project by Ludo Raedts, a Dutch entrepreneur based in Groningen, the Netherlands. Frustrated by the lack of a single, structured, international reference for book censorship data, he built one from scratch — using open data sources, public records, and AI-assisted tooling.

The mission is simple: make censorship visible. A ban that is not recorded is a ban that can be denied. Every entry in this catalogue represents a documented act of suppression — a government, school board, or institution that decided a book was too dangerous for its citizens or students to read.

The catalogue currently documents **${n(stats.books)} books** and **${n(stats.bans)} bans** across **${stats.countries} countries and territories**, from the Vatican's Index Librorum Prohibitorum (1559) to school board removals in 2025. The site is free, non-commercial, and built in the open.

## By the numbers

- ${n(stats.books)} books catalogued
- ${n(stats.bans)} bans documented
- ${stats.countries} countries and territories
- ${n(stats.activeBans)} currently active bans
- ${n(stats.sources)} source citations
- 1559 — earliest ban recorded (Index Librorum Prohibitorum)

## What counts as a ban

We use "ban" as a broad umbrella for three related phenomena. A **formal ban** is a legal prohibition: a government law or court order that makes possessing or distributing a book a criminal act. A **restriction** is an institutional removal — a school district pulling a title from its library, a prison service blocking access, a public library system withdrawing a book under political pressure. A **challenge** is a documented formal complaint that resulted in removal or restriction, typically reported through PEN America or the American Library Association.

We do not record unsuccessful challenges (complaints that were rejected), informal social pressure, or self-censorship by publishers. Every entry requires a verifiable source: a court judgment, a government decree, a news report, a PEN America data export, or an ALA challenged books report. Entries without sources are not published.

Books are selected for inclusion when there is credible documented evidence of a ban, restriction, or challenge. We do not make editorial judgments about whether a ban was justified — we document what happened.

See the [full methodology](https://www.banned-books.org/methodology) and the [challenged books page](https://www.banned-books.org/challenged-books) for more.

## Data transparency

The database is updated continuously. This page was last rendered on **${today}**. There are currently **${n(stats.sources)} source citations** attached to bans in the catalogue, drawn primarily from PEN America, the American Library Association, Index on Censorship, Freedom to Read Canada, and Wikipedia's lists of banned books. See the [full list of sources](https://www.banned-books.org/sources) for details.

**Coverage gaps we acknowledge openly:** The data is heavily skewed toward the United States, the United Kingdom, Canada, and Western Europe — countries with active civil society organisations that systematically track censorship. Bans in authoritarian states (China, Russia, Iran, North Korea, Saudi Arabia) are far more common but far less documented. We record what we can verify; we do not extrapolate. The United States appearing prominently in our data reflects systematic reporting, not uniquely American censorship.

We do not have comprehensive coverage of non-English-language sources. A book banned in Uzbekistan in 2019 is unlikely to appear in our catalogue unless it generated coverage in an English-language source we index. This is a structural limitation we are working to address.

## What makes it different

- **Global scope** — ${stats.countries} countries including defunct states like the Soviet Union, Czechoslovakia, and East Germany.
- **Per-book context** — each title has a "Why it was banned" section explaining who banned it, why, and what happened next.
- **Browsable by country, reason, and author** — not just a flat list; filter by geography, ideology, or the people behind the books.
- **Free reading links** — where a book is in the public domain, we link to the free text on Project Gutenberg.
- **Source citations on every ban** — PEN America, ALA, Index on Censorship, Freedom to Read Canada — every ban traces back to a source.

## Editorial stance

This site documents censorship. It does not endorse it — and it does not endorse the books it catalogues either. Some of the titles in this database contain material that many readers will find offensive, disturbing, or morally objectionable. That is not a reason to exclude them. A catalogue of banned books that omits controversial titles is not a catalogue of banned books.

We link to legal purchase options for every book (Bookshop.org, Kobo). We deliberately do not link to Amazon, which has itself been involved in book removal decisions. We link to free Project Gutenberg texts where available.

Some outbound book links are Bookshop.org affiliate links. They help support independent bookstores and this project at no extra cost to you. We do not run tracking pixels, third-party scripts, or sponsored content alongside the catalogue, and the affiliate links never determine which books we include.

Banned Books is editorially independent. It receives no funding from publishers, governments, political organisations, or advocacy groups. Inclusion and exclusion decisions are made solely on the basis of documented evidence. The site is the work of one person and a growing set of open-source tools.

## Why I built this

I'm Ludo Raedts. I started Banned Books in April 2026, and I should be honest about what I bring to it.

In 2024 I visited the Bebelplatz Memorial in Berlin. It's a small underground room visible through a glass plate in the square — rows of empty white bookshelves, marking the spot where, on 10 May 1933, students of the Nazi German Student Union burned around 20,000 books they had branded "un-German." Inscribed on a bronze plaque nearby is a line from Heinrich Heine: *"Where they burn books, they will in the end also burn people."* Heine wrote it in 1820, in a play about the Spanish Inquisition's burning of the Quran. More than a century before the Nazis proved him right.

What struck me at Bebelplatz was not that this had happened. It was how unsurprising it now felt. Across democracies and authoritarian states alike, restricting what people can read, watch, or say is again being treated as a reasonable response to disagreement. Facts are routinely reframed as opinions; opinions someone disagrees with are reframed as harms that must be silenced. Public debate has become less a conversation between equals and more a contest over who is allowed to speak.

I'm of a generation, and from a country, that took the opposite for granted. The Netherlands was the first country in the world to legalise same-sex marriage, on 1 April 2001 — not because everyone agreed it was right, but because a long, slow public conversation had moved the consensus. That conversation depended on people being free to read, write, and argue badly without being shut down. The freedom that lets a country change its mind is the same freedom that lets censorship be challenged when it happens. Both are weakening.

Banned Books is my response to that — not an answer, but a record. A catalogue cannot stop a ban, but it can make it harder to deny one happened.

The principle of the project is to document, not endorse: to include books I disagree with, bans I find justified, and bans I find indefensible, with the same citation standard for each. I do not get to decide which forms of censorship history will judge most harshly. Future readers can — but only if someone keeps a record.

— Ludo Raedts, Groningen

## For press and researchers

We welcome media inquiries, data requests, and collaboration proposals. If you are writing about book censorship, literary freedom, or library policy, we are happy to provide context, data, or a comment.

The catalogue is a work in progress. Coverage is strongest for the United States, Western Europe, and prominent historical cases. We say so explicitly wherever it matters.

For systematic analysis, the entire catalogue is available as a [downloadable dataset](https://www.banned-books.org/dataset) — CSV, JSON, and SQLite — under a personal/research-use license.

Boilerplate copy, live stats, logos, and story angles are collected on the [press and media kit page](https://www.banned-books.org/press).

## Get in touch

For press inquiries, data requests, corrections, or missing books, use the contact form on the [About page](https://www.banned-books.org/about#get-in-touch).
`
  const updatedFrontmatter: MarkdownFrontmatter = {
    ...frontmatter,
    updated_at: new Date().toISOString().slice(0, 10),
  }
  return buildMarkdownDocument(updatedFrontmatter, body)
}
