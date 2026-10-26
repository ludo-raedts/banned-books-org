// Theme registry — what banned BOOKS feature, as opposed to why a ban happened.
//
// Ban reasons (ban_reason_links) are what a source records; for US school bans
// (PEN America, Magnusson) that is usually nothing. PEN's own analyses instead
// report what share of banned titles feature certain people and topics. A theme
// page lists the books in our catalogue that feature the theme (book_themes,
// evidence-verified by scripts/classify-book-themes.ts) and puts PEN's figures
// next to them — without claiming the theme was the stated reason for any ban.
//
// PEN figures verified on pen.org 2026-10-26:
//   2024–25 (Facts & Fiction): 3,743 unique titles; 39% LGBTQ+ characters or
//     people; 44% characters or people of color
//   (2023–24 deliberately not shown: PEN's Cover to Cover press release says
//   29% LGBTQ+, while Facts & Fiction calls the prior year 25% — conflicting.)

export type ThemeSlug = 'lgbtq' | 'people-of-color'
export type ThemeKey = 'lgbtq' | 'poc'

/** `measure` = PEN's own wording of what was counted (quoted as-is). */
export type PenStat = { year: string; pct: number; titles: string; measure: string; source: { name: string; url: string } }

export type ThemeDef = {
  slug: ThemeSlug
  key: ThemeKey
  /** H1 / <title> base. */
  title: string
  /** Small eyebrow above the H1. */
  eyebrow: string
  /** Short label for chips on book pages. */
  chip: string
  icon: string
  /** Noun phrase for prose: "books featuring {phrase}". */
  phrase: string
  penStats: PenStat[]
  /** Why a theme page, not a reason page — shown under the stats. */
  explainer: string
  /** How books get on the list. */
  method: string
  /** Related reason hub, if any. */
  reasonSlug?: string
}

const FACTS_FICTION = { name: 'PEN America, Facts & Fiction (2024–25)', url: 'https://pen.org/report/facts-fiction/' }

export const THEMES: ThemeDef[] = [
  {
    slug: 'lgbtq',
    key: 'lgbtq',
    title: 'Banned LGBTQ+ books',
    eyebrow: 'Theme · Rainbow books',
    chip: 'LGBTQ+ characters or themes',
    icon: '🏳️‍🌈',
    phrase: 'LGBTQ+ characters, people or themes',
    penStats: [
      { year: '2024–25', pct: 39, titles: '3,743', measure: 'LGBTQ+ characters or people', source: FACTS_FICTION },
    ],
    explainer:
      'The reason given for removing a book is rarely “LGBTQ+ content”. Districts cite sexual content, age-appropriateness or a review policy — and for most US school removals no reason is recorded at all: PEN America’s index notes where, when and how a book was removed, not why. What the books have in common is visible in the books themselves.',
    method:
      'A book is listed here when its own description or library subject headings explicitly show LGBTQ+ characters, people or themes (for example “a transgender teen” or “Gay teenagers — Fiction”). The author’s identity does not count. Because we only list what the material states, the list is conservative: some banned books with LGBTQ+ characters are not on it yet.',
    reasonSlug: 'lgbtq',
  },
  {
    slug: 'people-of-color',
    key: 'poc',
    title: 'Banned books featuring people of color',
    eyebrow: 'Theme',
    chip: 'Characters or people of color',
    icon: '✊🏾',
    phrase: 'characters or people of color',
    penStats: [
      { year: '2024–25', pct: 44, titles: '3,743', measure: 'characters or people of color', source: FACTS_FICTION },
    ],
    explainer:
      'Books are seldom removed with race as the stated reason. Challenges cite violence, language, “divisive concepts” or sexual content, and most US school removals carry no recorded reason at all. Yet PEN America’s analyses find that books featuring characters or people of color make up the largest share of titles banned in US schools — 44% in the 2024–25 school year, the highest share PEN has recorded for this category.',
    method:
      'A book is listed here when its own description or library subject headings explicitly show that its protagonist, a major character or its main subject is a person or people of color, or that it is centrally about racism (for example “African American teenagers” or “a 12-year-old Chicana girl”). The author’s identity does not count, and neither does a setting alone. The list is conservative: some banned books featuring people of color are not on it yet.',
    reasonSlug: 'racial',
  },
]

export function getTheme(slug: string): ThemeDef | undefined {
  return THEMES.find((t) => t.slug === slug)
}

export function themeByKey(key: string): ThemeDef | undefined {
  return THEMES.find((t) => t.key === key)
}
