// BGN/PCGN-style Cyrillic → Latin (ASCII, no diacritics), keeping spacing,
// punctuation and casing so the result doubles as a human-readable display
// string. Same map as scripts/import-russia-bans.ts (slugs) and
// scripts/normalize-russia-titles.ts (title_transliterated), so a title
// imported through any of them lands on the same slug.
//
// slugify() drops Cyrillic entirely, so Russian-script titles and author names
// must go through transliterateCyrillic() before they can produce a slug.

import { slugify } from './slugify'

const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ѵ: 'i', ѳ: 'f', і: 'i', ѣ: 'ye', // pre-1918 Russian
  ї: 'yi', є: 'ye', ґ: 'g', // Ukrainian
  ў: 'w', // Belarusian
}

const isUpperLetter = (c: string | undefined) => !!c && c !== c.toLowerCase() && c === c.toUpperCase()

export function transliterateCyrillic(text: string): string {
  const chars = [...text.normalize('NFC')]
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const lower = ch.toLowerCase()
    const mapped = MAP[lower]
    if (mapped === undefined) {
      out += ch
      continue
    }
    if (ch === lower || mapped === '') {
      out += mapped
    } else if (isUpperLetter(chars[i - 1]) || isUpperLetter(chars[i + 1])) {
      out += mapped.toUpperCase() // inside an ALL-CAPS run → fully upper (СВЯЩ → SVYASHCH)
    } else {
      out += (mapped[0]?.toUpperCase() ?? '') + mapped.slice(1) // title-case (Х → Kh)
    }
  }
  return out.replace(/\s{2,}/g, ' ').trim()
}

export const hasCyrillic = (s: string) => /[Ѐ-ӿ]/.test(s)

/** slugify() that transliterates Cyrillic first instead of dropping it. */
export function slugifyMaybeCyrillic(s: string): string {
  return slugify(transliterateCyrillic(s))
}
