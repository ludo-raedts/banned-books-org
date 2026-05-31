// Legacy Google News rows were stored as
//   title:        "<headline> - <Publisher>"
//   source_name:  "Google News — banned books"
// Newer ingests already split these. This helper restores them at display time.
const LEGACY_GOOGLE_NEWS = 'Google News — banned books'

export function normalizeNewsDisplay(title: string, sourceName: string): { title: string; sourceName: string } {
  if (sourceName !== LEGACY_GOOGLE_NEWS) return { title, sourceName }
  const idx = title.lastIndexOf(' - ')
  if (idx <= 0) return { title, sourceName }
  const publisher = title.slice(idx + 3).trim()
  if (!publisher || publisher.length > 60) return { title, sourceName }
  return { title: title.slice(0, idx).trim(), sourceName: publisher }
}

// ── Language badges ─────────────────────────────────────────────────────────
//
// Public-facing rendering for source_language on news_items. Pipeline always
// stores ISO-639-1 (two letters); summaries are English so non-en items are
// translated. The badge is what tells the reader they're not looking at the
// original.

type LanguageInfo = { label: string; flag: string }

const LANGUAGES: Record<string, LanguageInfo> = {
  en: { label: 'English',    flag: '🇬🇧' },
  ru: { label: 'Russian',    flag: '🇷🇺' },
  fa: { label: 'Persian',    flag: '🇮🇷' },
  zh: { label: 'Chinese',    flag: '🇨🇳' },
  ar: { label: 'Arabic',     flag: '🇸🇦' },
  es: { label: 'Spanish',    flag: '🇪🇸' },
  fr: { label: 'French',     flag: '🇫🇷' },
  de: { label: 'German',     flag: '🇩🇪' },
  it: { label: 'Italian',    flag: '🇮🇹' },
  pt: { label: 'Portuguese', flag: '🇵🇹' },
  nl: { label: 'Dutch',      flag: '🇳🇱' },
  tr: { label: 'Turkish',    flag: '🇹🇷' },
  uk: { label: 'Ukrainian',  flag: '🇺🇦' },
  pl: { label: 'Polish',     flag: '🇵🇱' },
  ja: { label: 'Japanese',   flag: '🇯🇵' },
  ko: { label: 'Korean',     flag: '🇰🇷' },
  hi: { label: 'Hindi',      flag: '🇮🇳' },
  he: { label: 'Hebrew',     flag: '🇮🇱' },
}

export function languageInfo(code: string | null | undefined): LanguageInfo {
  if (!code) return LANGUAGES.en
  const key = code.toLowerCase().slice(0, 2)
  return LANGUAGES[key] ?? { label: key.toUpperCase(), flag: '🌐' }
}

/** True when an item should display a "translated from" badge. */
export function isTranslated(code: string | null | undefined): boolean {
  if (!code) return false
  return code.toLowerCase().slice(0, 2) !== 'en'
}

/** "🇷🇺 Translated from Russian" — the canonical badge text. */
export function translatedFromLabel(code: string): string {
  const { label, flag } = languageInfo(code)
  return `${flag} Translated from ${label}`
}

/**
 * Reusable badge that renders nothing when the item is in English. `compact`
 * shrinks padding for the homepage news preview where vertical space is
 * tight; default suits /news article meta.
 */
export function TranslatedBadge({
  code,
  size = 'default',
}: {
  code: string | null | undefined
  size?: 'default' | 'compact'
}) {
  if (!isTranslated(code)) return null
  const text = translatedFromLabel(code as string)
  const cls = size === 'compact'
    ? 'inline-flex items-center px-1 py-0 rounded text-[10px] font-medium bg-blue-50 text-blue-700'
    : 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-blue-50 text-blue-700'
  return <span className={cls}>{text}</span>
}

/**
 * "Original (Language): <original_title>" — italic line shown under the
 * English title on /news and in the admin preview, so the editor (or reader)
 * can sanity-check the translation. Renders nothing for English items or
 * when there's no original on file.
 */
export function OriginalTitleLine({
  code,
  originalTitle,
  className,
}: {
  code: string | null | undefined
  originalTitle: string | null | undefined
  className?: string
}) {
  if (!isTranslated(code) || !originalTitle) return null
  const { label } = languageInfo(code)
  return (
    <p className={`text-xs italic text-gray-500 ${className ?? ''}`}>
      Original ({label}): {originalTitle}
    </p>
  )
}
