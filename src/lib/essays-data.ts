// Single source of truth for essay metadata.
// Used by /essays index, "More essays" footers, sitemap, and (future) RSS.
// Add a new essay here AND create src/app/essays/<slug>/page.tsx using <EssayLayout>.

export type Essay = {
  slug: string                  // Stable identifier. For new essays this is also the URL segment.
  href: string                  // Where the essay actually lives. Legacy essays keep their flat URL.
  title: string                 // Used for nav, cards, og:title fallback.
  dek: string                   // Short standfirst shown on cards and in the hero.
  publishedAt: string           // ISO date (YYYY-MM-DD). Used for sorting and og:article meta.
  readingTimeMin: number        // Manually set. Roughly words / 200, rounded up.
  relatedBookSlugs: string[]    // Curated. Looked up in books table by EssayRelatedBooks.
  draft?: boolean               // If true, hidden from index/footer/sitemap.
}

export const ESSAYS: Essay[] = [
  {
    slug: 'who-hates-beetles',
    href: '/essays/who-hates-beetles',
    title: 'Who hates beetles?',
    dek: 'Banning a novel polices a feeling. Banning a book of facts polices reality itself. What a children’s book about insects — pulled from Florida school libraries — reveals about a censorship movement that no longer needs anyone to object.',
    publishedAt: '2026-06-28',
    readingTimeMin: 7,
    relatedBookSlugs: ['insect', 'gender-queer', 'the-bluest-eye', 'to-kill-a-mockingbird', 'maus', 'and-tango-makes-three'],
  },
  {
    slug: 'the-line-we-pretend-not-to-draw',
    href: '/essays/the-line-we-pretend-not-to-draw',
    title: 'The line we pretend not to draw',
    dek: 'Every school library is already censored — someone always chooses. So the honest fight was never “ban or freedom.” It is who decides, by what standard, and what happens when they get it wrong. Why the line that matters is drawn by process, not by content.',
    publishedAt: '2026-06-16',
    readingTimeMin: 13,
    relatedBookSlugs: ['night', 'the-handmaids-tale', '1984', 'the-bluest-eye', 'the-rape-of-nanking'],
  },
  {
    slug: 'in-whose-name',
    href: '/essays/in-whose-name',
    title: 'In whose name: the reasons people give for banning books',
    dek: 'Nobody bans a book and says they want to hide it — there is always a reason, and the reason always names someone who must be protected. What the catalogue’s reason data reveals about the vocabulary of censorship.',
    publishedAt: '2026-06-03',
    readingTimeMin: 11,
    relatedBookSlugs: ['1984', 'the-satanic-verses', 'the-decameron', 'and-tango-makes-three', 'gender-queer', 'brave-new-world'],
  },
  {
    slug: 'history',
    href: '/history',
    title: 'The long shadow of censorship: a history of banned books',
    dek: 'Censorship is less a tool of control than a confession of fear. A 2,000-year arc, from Qin Shi Huang to school-board challenges.',
    publishedAt: '2025-08-01',
    readingTimeMin: 14,
    relatedBookSlugs: ['1984', 'mein-kampf', 'rights-of-man'],
  },
  {
    slug: 'why-not-amazon',
    href: '/why-not-amazon',
    title: 'Why we don’t link to Amazon',
    dek: 'A platform that quietly removes, restricts, or hides books is shaping access in practice. Here’s why we link elsewhere.',
    publishedAt: '2025-09-12',
    readingTimeMin: 5,
    relatedBookSlugs: ['1984', 'animal-farm'],
  },
  {
    slug: 'what-we-document',
    href: '/essays/what-we-document',
    title: 'What we document — and why that is a choice',
    dek: 'Every catalogue draws a line. What counts as a ban, what doesn’t, and the editorial choices baked into this project.',
    publishedAt: '2026-05-07',
    readingTimeMin: 8,
    relatedBookSlugs: ['the-satanic-verses', 'mein-kampf', 'lolita', 'the-turner-diaries', 'the-anarchist-cookbook'],
  },
  {
    slug: 'forbidden-knowledge-iceberg',
    href: '/essays/forbidden-knowledge-iceberg',
    title: 'Why “forbidden knowledge” iceberg lists collapse important distinctions',
    dek: 'Banned, suppressed, esoteric, and dangerous get bundled into one viral pyramid. The categories matter — here’s why.',
    publishedAt: '2026-05-07',
    readingTimeMin: 8,
    relatedBookSlugs: ['the-gulag-archipelago', 'the-satanic-verses', 'the-diary-of-a-young-girl', 'mein-kampf', 'the-turner-diaries', 'the-anarchist-cookbook'],
  },
  {
    slug: 'the-grey-zone',
    href: '/essays/the-grey-zone',
    title: 'The grey zone where censorship debates actually live',
    dek: 'A Belgian school removed a Dutch graphic novel after one parent complained — and the author of the book agrees with the decision. The case is not censorship. It is the messier conversation about institutional responsibility that sits underneath every reading list.',
    publishedAt: '2026-05-10',
    readingTimeMin: 5,
    relatedBookSlugs: ['gender-queer', 'maus', 'fun-home', 'this-one-summer', 'looking-for-alaska', 'the-perks-of-being-a-wallflower'],
  },
  {
    slug: 'first-amendment-paradox',
    href: '/essays/first-amendment-paradox',
    title: 'The First Amendment paradox: when “free speech” is invoked to remove books from schools',
    dek: 'The same coalition that loudest invokes “free speech” has built a movement to remove thousands of books from US school libraries. The contradiction is not incidental — it is the argument. A look at how the rhetoric collides with the First Amendment doctrine it claims to uphold.',
    publishedAt: '2026-05-24',
    readingTimeMin: 12,
    relatedBookSlugs: ['slaughterhouse-five', 'gender-queer', 'all-boys-arent-blue', 'beloved', 'the-bluest-eye', 'looking-for-alaska'],
  },
]

export function publishedEssays(): Essay[] {
  return ESSAYS.filter(e => !e.draft).sort((a, b) =>
    a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0
  )
}

export function essayBySlug(slug: string): Essay | undefined {
  return ESSAYS.find(e => e.slug === slug)
}

export function otherEssays(currentSlug: string, limit = 3): Essay[] {
  return publishedEssays().filter(e => e.slug !== currentSlug).slice(0, limit)
}
