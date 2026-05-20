// Human-readable noun-phrase rendering of a reason slug, used in SEO
// surface text (direct-answer paragraphs, FAQ JSON-LD answers) on book,
// country, and reason detail pages. Mirrors the visible `ReasonBadge`
// labels but in prose form ("LGBTQ+ content" rather than the badge's
// "LGBTQ+" + icon).
//
// Falls back to the raw slug when no mapping is registered — better to
// emit a less-natural string than to drop the reason from the answer.

export const BOOK_REASON_PHRASE: Readonly<Record<string, string>> = {
  lgbtq: 'LGBTQ+ content',
  political: 'political content',
  religious: 'religious content',
  sexual: 'sexual content',
  violence: 'violent content',
  racial: 'racial content',
  drugs: 'drug references',
  obscenity: 'obscenity',
  moral: 'moral grounds',
  language: 'language reasons',
  other: 'other reasons',
}

export function reasonPhrase(slug: string): string {
  return BOOK_REASON_PHRASE[slug] ?? slug
}
