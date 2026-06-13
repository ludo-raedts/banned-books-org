// Shared helpers for the homepage top-lists and their /top-* destination
// pages. Centralises the book-row select, language-code → English name map,
// the Latin-script gate, and the small formatting helpers so all surfaces
// produce identical card context strings.

import type { TopListBook } from '@/components/top-list-card'

export const LATIN_SCRIPT_LANGS = [
  'en','es','fr','de','nl','it','pt','ca','gl','eu',
  'sv','da','no','nb','nn','fi','is',
  'pl','cs','sk','hu','ro','hr','sl','lv','lt','et','sq','bs',
  'tr','id','ms','vi','tl','sw','af','cy','ga','mt','lb','la',
] as const

export const LANG_NAMES: Record<string, string> = {
  // Non-Latin script
  ru: 'Russian', zh: 'Chinese', ja: 'Japanese', ar: 'Arabic', fa: 'Persian',
  he: 'Hebrew', hi: 'Hindi', ko: 'Korean', th: 'Thai', el: 'Greek',
  bn: 'Bengali', ur: 'Urdu', ta: 'Tamil', te: 'Telugu', uk: 'Ukrainian',
  bg: 'Bulgarian', sr: 'Serbian', mk: 'Macedonian', yi: 'Yiddish',
  hy: 'Armenian', ka: 'Georgian', am: 'Amharic', my: 'Burmese',
  km: 'Khmer', lo: 'Lao', si: 'Sinhala', gu: 'Gujarati', pa: 'Punjabi',
  ml: 'Malayalam', kn: 'Kannada', mr: 'Marathi', ne: 'Nepali',
  // Latin script, non-English — used by the "not written in English" section
  // for cards like "French · 5 countries" instead of "FR · 5 countries".
  fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', nl: 'Dutch',
  pt: 'Portuguese', sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish',
  pl: 'Polish', cs: 'Czech', sk: 'Slovak', hu: 'Hungarian', ro: 'Romanian',
  hr: 'Croatian', sl: 'Slovenian', bs: 'Bosnian', sq: 'Albanian',
  tr: 'Turkish', id: 'Indonesian', vi: 'Vietnamese', ms: 'Malay',
  ca: 'Catalan', gl: 'Galician', eu: 'Basque', is: 'Icelandic',
  la: 'Latin',
  // `sh` is the ISO 639-1 macro-code for Serbo-Croatian (now split into
  // sr/hr/bs); used in the catalogue for Yugoslav-era writers like Đilas
  // and Kiš who pre-date the split.
  sh: 'Serbo-Croatian',
  // `cn` is not a valid ISO 639-1 code (Chinese is `zh`); kept as a
  // defensive fallback for one historic import error which is also
  // corrected in migration 20260517091505_books_fix_cn_language. Drop
  // this line once the migration has run against prod.
  cn: 'Chinese',
}

// NB: no prose columns here. Top-list cards render only title/cover/author/
// context (see toBookCard) — `description_book` was fetched but never read,
// adding ~0.5 KB/row of dead payload to every list page. Detail pages fetch
// the prose separately. Keep this select lean.
export const TOP_LIST_BOOK_SELECT =
  'id, title, slug, cover_url, cover_status, original_language, first_published_year, ' +
  'book_authors(authors(display_name)), bans(country_code)'

export type TopListBookRow = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  /** 'valid' | 'rejected_placeholder' | 'manual_override' | null — null means "not audited yet". */
  cover_status: string | null
  original_language: string | null
  first_published_year: number | null
  /**
   * Optional: NOT in TOP_LIST_BOOK_SELECT (which is intentionally lean and
   * never renders prose). Present only when a caller opts in by appending
   * `description_book` to the select — currently just the homepage's
   * book-of-the-day presence filter. Undefined everywhere else.
   */
  description_book?: string | null
  book_authors: { authors: { display_name: string } | null }[]
  bans: { country_code: string }[]
}

export function authorNameOf(b: TopListBookRow): string {
  return b.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', ')
}

// Format the card context from pre-aggregated counts. Surfaces that read the
// counts from v_book_ban_counts (rather than embedding bans(country_code) and
// counting in JS) call this directly — see /trending-banned-books.
export function banContextFromCounts(total: number, countries: number): string {
  if (total === 0) return ''
  // Lead with country count — that's the meaningful "global reach" signal.
  // Append raw ban-event count only when it exceeds country count (mostly US
  // PEN-style per-district records), where it adds genuine information.
  const headline = `${countries} ${countries === 1 ? 'country' : 'countries'}`
  return total > countries ? `${headline} · ${total} bans` : headline
}

export function banContext(b: TopListBookRow): string {
  return banContextFromCounts(b.bans.length, new Set(b.bans.map(x => x.country_code)).size)
}

export function langName(code: string | null): string | null {
  if (!code) return null
  return LANG_NAMES[code] ?? code.toUpperCase()
}

export function langContext(b: TopListBookRow): string {
  const lang = langName(b.original_language)
  const ban = banContext(b)
  if (lang && ban) return `${lang} · ${ban}`
  return lang ?? ban
}

export function toBookCard(b: TopListBookRow, context?: string): TopListBook {
  return {
    id: b.id,
    title: b.title,
    slug: b.slug,
    cover_url: b.cover_url,
    author: authorNameOf(b),
    context,
  }
}

export function isNonLatin(code: string | null | undefined): code is string {
  return !!code && !(LATIN_SCRIPT_LANGS as readonly string[]).includes(code)
}

export function isNonEnglish(code: string | null | undefined): code is string {
  return !!code && code !== 'en'
}
