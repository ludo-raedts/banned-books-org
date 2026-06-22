// Reason-explainer registry.
//
// Sibling to the ban-context registry (`ban-contexts.ts`), but keyed on the
// *reason* a book was challenged rather than the *event*. The problem it solves:
// ~3,200 catalogue pages are a single ban in a single country with no citable
// book description and no per-book "Why it was banned" narrative. The one fact
// we hold (banned in X for reason R) already appears in the hero and the bans
// table, so re-stating it as prose adds nothing. What those pages genuinely lack
// is *context the row does not contain*: what a challenge of this kind generally
// involves, and how it sits in the longer history of censorship.
//
// So we write that context ONCE per reason — hand-authored, source-cited, and
// framed about the *category*, never asserting anything specific about the book
// in front of the reader. Reused across every book carrying the reason. This is
// new, non-templated information (unlike a per-row restatement), which is the
// distinction that matters for "helpful content".
//
// Cost model: zero queries, zero columns. The book page already loads each ban's
// reason slugs; we match against this static map in memory. Prose lives in code.
//
// Doctrine: every `body` claim must be defensible against `source`, and a `body`
// must stay general — it describes the reason category worldwide, so it reads
// correctly whether the book was banned in Lahore, Lagos, or a U.S. school board.

export type ReasonExplainer = {
  /** Matches `reasons.slug`. */
  slug: string
  /** Section heading on the book page. */
  heading: string
  /** One paragraph of cited, category-level context. Never book-specific. */
  body: string
  /** Citation backing the body's contemporary claim. */
  source: { name: string; url: string }
  /** Optional internal link to a matching /contexts hub, for grounding + crawl depth. */
  relatedContextSlug?: string
  relatedContextLabel?: string
}

// Shared citation. The ALA Office for Intellectual Freedom is the authoritative
// tracker of the *reasons* books are challenged in the United States and
// publishes them with its annual most-challenged lists; every reason slug below
// appears in its reporting. Each body adds its own historical/legal anchors —
// verifiable facts stated in prose — so the boxes are not interchangeable.
const ALA_OIF = {
  name: 'American Library Association, Office for Intellectual Freedom',
  url: 'https://www.ala.org/bbooks/frequentlychallengedbooks/top10',
} as const

export const REASON_EXPLAINERS: Readonly<Record<string, ReasonExplainer>> = {
  religious: {
    slug: 'religious',
    heading: 'About religious-grounds challenges',
    body:
      'Religious objection is among the oldest and most widespread grounds for ' +
      'restricting books. Challenges of this kind target works seen as blasphemous, ' +
      'sacrilegious, or hostile to a faith — and, conversely, works said to promote a ' +
      'rival religion or the occult. The Catholic Church maintained a formal register ' +
      'of forbidden books, the Index Librorum Prohibitorum, from 1559 until it was ' +
      'discontinued in 1966; today many states retain blasphemy laws, and in the ' +
      'United States the American Library Association records “religious viewpoint” ' +
      'among the reasons books are challenged each year.',
    source: ALA_OIF,
    relatedContextSlug: 'index-librorum-prohibitorum',
    relatedContextLabel: 'the Index Librorum Prohibitorum',
  },

  lgbtq: {
    slug: 'lgbtq',
    heading: 'About LGBTQ+ content challenges',
    body:
      'Books with LGBTQ+ characters or themes have been the single most frequently ' +
      'challenged category in the United States in recent years; the American Library ' +
      'Association reports that titles representing LGBTQIA+ lives have dominated its ' +
      'most-challenged lists since 2021. Objections range from age-appropriateness to ' +
      'the claim that such content is inherently sexual. The pattern is neither new nor ' +
      'only American: the United Kingdom’s Section 28 (1988–2003) barred schools from ' +
      '“promoting” homosexuality, and Russia’s 2013 “gay propaganda” law — extended to ' +
      'all ages in 2022 — has been used to remove LGBTQ+ books from sale.',
    source: ALA_OIF,
  },

  political: {
    slug: 'political',
    heading: 'About political challenges',
    body:
      'Political objection covers books suppressed for their ideology, their criticism ' +
      'of a government, or their links to a banned movement. It is above all the ' +
      'censorship of authoritarian states: the Nazi regime’s public book burnings of ' +
      'May 1933 targeted “un-German” and leftist writing, and the Soviet Union’s ' +
      'censorship agency Glavlit screened printed matter from 1922 until 1991. In ' +
      'democracies the same reason appears in milder form — the American Library ' +
      'Association records “political viewpoint” among the grounds cited in library ' +
      'and school challenges.',
    source: ALA_OIF,
  },

  sexual: {
    slug: 'sexual',
    heading: 'About challenges over sexual content',
    body:
      'Sexual content is one of the oldest and most common grounds for restricting ' +
      'books. In the United States the distribution of material deemed “obscene” was ' +
      'criminalised by the Comstock Act of 1873, and for decades whole works were ' +
      'judged by isolated passages — until rulings such as the 1933 decision on James ' +
      'Joyce’s Ulysses established that a book must be judged as a whole. Today the ' +
      'American Library Association consistently finds “sexually explicit” among the ' +
      'most-cited reasons, frequently overlapping with objections to LGBTQ+ or ' +
      'sex-education content.',
    source: ALA_OIF,
  },

  violence: {
    slug: 'violence',
    heading: 'About challenges over violence',
    body:
      'Violent or graphic content is a recurring basis for challenges, usually raised ' +
      'alongside concerns about whether a book suits a particular age group rather than ' +
      'a claim that the work is unlawful. Titles ranging from war novels to ' +
      'young-adult fiction depicting abuse have been removed on this ground. The ' +
      'American Library Association lists violence among the reasons reported for ' +
      'challenges each year.',
    source: ALA_OIF,
  },

  racial: {
    slug: 'racial',
    heading: 'About race-related challenges',
    body:
      'Race-related objections pull in two opposite directions. Some challenges seek to ' +
      'remove books for racist language or stereotypes — Mark Twain’s Adventures of ' +
      'Huckleberry Finn and Harper Lee’s To Kill a Mockingbird are perennial examples. ' +
      'Others, especially since 2021, seek to remove books precisely because they teach ' +
      'about racism or centre Black and other marginalised experiences, often under ' +
      'state laws restricting so-called “divisive concepts.” The American Library ' +
      'Association reports both kinds under race, racism, and social-justice themes.',
    source: ALA_OIF,
  },

  drugs: {
    slug: 'drugs',
    heading: 'About challenges over drug references',
    body:
      'Depictions of drug or alcohol use are a long-standing reason for challenging ' +
      'books, particularly those written for young readers. The anonymously published ' +
      'Go Ask Alice (1971) is among the most-challenged titles on this ground. ' +
      'Objections usually argue that portraying substance use “promotes” it, even when ' +
      'the narrative is plainly cautionary. The American Library Association records ' +
      'drug use among the reasons cited in challenges.',
    source: ALA_OIF,
  },

  obscenity: {
    slug: 'obscenity',
    heading: 'About obscenity challenges',
    body:
      'Obscenity is a legal category, not merely a complaint. In the United States, ' +
      'material is obscene only if it meets the three-part test set out in Miller v. ' +
      'California (1973): that it appeals to a prurient interest, depicts sexual ' +
      'conduct in a patently offensive way, and lacks serious literary, artistic, ' +
      'political, or scientific value. Few challenged books actually meet that bar, ' +
      'which is why removals framed as fighting “obscenity” are often contested. The ' +
      'American Library Association notes that obscenity claims are frequently invoked ' +
      'against books written for minors.',
    source: ALA_OIF,
  },

  moral: {
    slug: 'moral',
    heading: 'About moral-grounds challenges',
    body:
      'Moral objections appeal to community standards, family values, or a book’s ' +
      'perceived effect on children rather than to any specific legal violation. ' +
      'Because the standard is subjective, the same title can be uncontroversial in one ' +
      'community and challenged in another. Such challenges often arrive framed as ' +
      'protecting age-appropriateness; the American Library Association records ' +
      'material judged “unsuited to age group” among the most common reasons reported.',
    source: ALA_OIF,
  },

  language: {
    slug: 'language',
    heading: 'About challenges over offensive language',
    body:
      'Offensive language — profanity, slurs, or crude dialogue — has for decades been ' +
      'one of the most frequently cited reasons in the book challenges tracked by the ' +
      'American Library Association. Such challenges often target realistic fiction for ' +
      'teenagers, where authors use vernacular speech, and they tend to accompany other ' +
      'objections rather than stand alone.',
    source: ALA_OIF,
  },
}

// Surface exactly ONE explainer for a book — the most frequent reason across its
// bans, with a deterministic slug tie-break (matching buildBanSummary), so a
// multi-reason title never stacks several boxes. Returns null when no reason the
// book carries has an explainer written yet.
export function explainerForReasonSlugs(slugs: string[]): ReasonExplainer | null {
  if (slugs.length === 0) return null
  const count = new Map<string, number>()
  for (const s of slugs) count.set(s, (count.get(s) ?? 0) + 1)
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  for (const [slug] of ranked) {
    if (REASON_EXPLAINERS[slug]) return REASON_EXPLAINERS[slug]
  }
  return null
}
