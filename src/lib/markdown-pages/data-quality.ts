import type { MarkdownFrontmatter } from '@/lib/markdown-response'

export const frontmatter: MarkdownFrontmatter = {
  title: 'Data quality — how we classify records',
  url: 'https://www.banned-books.org/data-quality',
  description:
    'Every book and author entry is rated for data quality. This page explains the three levels — confident, default, and limited — and the automated signals behind them.',
  published_at: '2026-05-18',
}

export const body = `# How we classify what we know

This catalogue is built mostly by automated import from public sources, then enriched and reviewed. Not every entry has been checked by a human, and we don't pretend otherwise — every record carries a quality label so you can tell at a glance how much weight to put on it.

## Three levels

Every book and author entry falls into one of three buckets, computed from the data we hold:

**High-confidence record.** The work is well-attested: we have a canonical external identifier (OpenLibrary, ISBN, or Project Gutenberg), full editorial descriptions, and at least one further signal — a documented author, multiple ban records, or source citations. *1984*, *Animal Farm*, and *The Satanic Verses* sit here.

**Automated import — not individually verified.** The default state for most entries. The record was created from an automated import pipeline and nothing in our quality checks raised a problem — but no one has manually cross-checked the specific facts. Treat broad strokes (title, author, ban country) as reliable; treat narrower details as provisional.

**Limited verification.** At least one quality signal failed: the cover is a placeholder, the entry was AI-drafted without a description, no source citations are linked to its bans, or the author attribution is missing. These records are still shown because they document a real ban that someone might be searching for — but the specifics are unconfirmed.

## The signals we use

We don't hand-grade five thousand books. Classification is computed from signals already present in the data:

- **Canonical identifiers** — an OpenLibrary work ID, a valid ISBN-13 confirmed via Bookshop.org, or a Project Gutenberg ID. Any of these means we know exactly which work we're talking about.
- **Editorial completeness** — both the work description and the ban-context description are filled in with more than a sentence each. This signals that an enrichment pass has actually produced usable copy, not placeholder text.
- **Ban evidence** — bans in three or more countries, or five or more total ban records, or any ban marked as verified. This catches both globally-banned canon and US-only canon (where a single title might have dozens of school-district records).
- **Source citations** — bans linked to at least one ban-source record (PEN America, the ALA, Reporters Without Borders, Wikipedia with archived URL, etc.).
- **Author legitimacy** — at least one named author with a known birth year, not a generic placeholder like *Anonymous* or *Various Authors*. Genuinely anonymous canonical works (the Bible, the Quran, *One Thousand and One Nights*) bypass this signal because they have other evidence.

## What triggers limited verification

A record is flagged when any of the following holds:

- The book cover is a known placeholder (we couldn't find a real cover image).
- The record was drafted by an AI enrichment pass but no description was produced.
- None of the book's bans have any source citation attached.
- The work has no author or only placeholder authors *and* no canonical external identifier (so the work itself isn't externally anchored).
- The publication or birth year is implausibly outside the range we can sanity-check (before 3000 BCE or after 2030).

## How often this is recomputed

The classifier runs periodically against the full catalogue. The label on a page reflects the most recent evaluation — when you see a date in the page footer, that's when the rules were last applied to that specific record. If the underlying data changes (a description gets filled in, a source citation gets added, a cover gets corrected), the status will update on the next run.

## Why we publish this at all

A common pattern for automatically-imported databases is to present everything as if it were equally trustworthy and hope no one notices. We'd rather be explicit. AI search engines and human readers both benefit from knowing which records have been cross-checked and which are still provisional — and flagging our weak entries openly is what lets us be confident about the strong ones.

If you spot a record that looks misclassified — either a flagged record that's clearly fine, or a confident record with a real problem — [open an issue on GitHub](https://github.com/ludo-raedts/banned-books-org/issues) or use the contact form on the [About page](https://www.banned-books.org/about).

## Related reading

For context on the catalogue as a whole, the country rankings, and how we treat school bans vs. national bans, see the [methodology page](https://www.banned-books.org/methodology). For the policy on which works we include and why, see [What we document — and why that is a choice](https://www.banned-books.org/essays/what-we-document).
`
