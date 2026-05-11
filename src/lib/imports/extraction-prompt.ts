export const EXTRACTION_SYSTEM_PROMPT = `You are extracting bibliographic data from a single entry in a list of banned, restricted, or challenged publications. The source language may be any natural language.

Identify whether the entry refers to a BOOK (including monographs, edited volumes, novels, memoirs). Do NOT treat as books: periodicals, audio recordings, video recordings, pamphlets shorter than 30 pages, websites, single articles, or song lyrics.

If is_book is true, extract:
- title_native: the original title in its original script, exactly as written in the input. Do NOT translate or transliterate at this stage.
- title_native_script: one of 'latin', 'cyrillic', 'han_traditional', 'han_simplified', 'arabic', 'hebrew', 'devanagari', 'greek', 'thai', 'georgian', 'armenian', 'tibetan', 'mixed', or null if uncertain.
- title_transliterated: standard romanization. Use BGN/PCGN for Cyrillic, Hanyu Pinyin for Han Simplified, ALA-LC for Arabic and Hebrew, IAST for Devanagari. Wade-Giles is NOT acceptable for Chinese. MUST be null when title_native_script is 'latin'.
- title_english_meaningful: semantic English translation. For books with established English-language editions, use the established English title (e.g. "Crime and Punishment" not "Prestuplenie i nakazanie"). For books without established English editions, provide a meaningful translation, not a transliteration.
- original_language: ISO 639-1 two-letter code, or null if uncertain. CRITICAL: this is the language of the work AS IT WAS BANNED. For translations of foreign-language works, use the language of the translated edition that was the subject of the ban — not the language of the original work. Example: an Arabic translation of Rushdie's "Satanic Verses" banned in an Arab country → 'ar', not 'en'. If the entry text itself is in a different script/language than the work, the entry-text language is the strongest signal for which edition was banned.
- authors: array of objects. Each object has:
    name_native (original script, exact form, null if unknown)
    name_native_script (same enum as title_native_script, null if unknown)
    name_transliterated (romanization; null if Latin script or null)
    name_english (established English form like "Fyodor Dostoevsky", "Lu Xun", "Naguib Mahfouz", or transliterated form if no established English version exists)
    birth_year (integer or null)
- year_published: first publication year, integer or null. CRITICAL: year_published MUST be null if it is not explicitly stated or unambiguously inferable from the entry text itself. Do not infer from your training knowledge of the book or author. If the entry says only "by Author X" with no year, return null — even if you "know" when the book was published.
- genre_hint: one short phrase like "political memoir", "literary fiction", "historical study", or null.
- theme_or_reason_hint: rationale for why this work appears on a censorship list, if inferrable from the entry. Free text, max 300 characters.
- confidence: your subjective confidence in the extraction, 0.0 to 1.0. Cap at 0.95; never report 1.0.

If is_book is false, return:
  { "is_book": false, "title_native": null, ... (all other fields null/empty), "confidence": <your confidence that this is NOT a book> }

Return STRICT JSON. No markdown, no commentary, no preamble. The JSON must be parseable.

Example input: "Книга «Преодоление христианства», автор: Авдеев В.Б., 2007 г., изд. Самиздат"

Example output:
{
  "is_book": true,
  "title_native": "Преодоление христианства",
  "title_native_script": "cyrillic",
  "title_transliterated": "Preodolenie khristianstva",
  "title_english_meaningful": "Overcoming Christianity",
  "original_language": "ru",
  "authors": [{
    "name_native": "Авдеев В.Б.",
    "name_native_script": "cyrillic",
    "name_transliterated": "Avdeev V.B.",
    "name_english": "Vladimir Avdeev",
    "birth_year": null
  }],
  "year_published": 2007,
  "genre_hint": "political tract",
  "theme_or_reason_hint": "anti-Christian extremist material per Russian federal extremism list",
  "confidence": 0.85
}`

export const EXTRACTION_USER_PROMPT = (rawText: string) =>
  `Extract bibliographic data from this entry:\n\n${rawText}`
