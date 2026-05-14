import { describe, it, expect } from 'vitest'
import {
  detectScript,
  inferLanguage,
  inferScriptAndLanguage,
} from '../language-inference'

describe('detectScript', () => {
  it('returns null for null/empty input', () => {
    expect(detectScript(null)).toBeNull()
    expect(detectScript(undefined)).toBeNull()
    expect(detectScript('')).toBeNull()
    expect(detectScript('   ')).toBeNull()
    expect(detectScript('123 ...!?')).toBeNull()
  })

  it('detects plain Latin', () => {
    expect(detectScript('Brave New World')).toBe('latin')
    expect(detectScript('Lolita')).toBe('latin')
  })

  it('detects Latin with diacritics', () => {
    expect(detectScript('Eden, Eden, Eden')).toBe('latin')
    expect(detectScript('Voltaire — Pensées')).toBe('latin')
  })

  it('detects Cyrillic', () => {
    expect(detectScript('Архипелаг ГУЛАГ')).toBe('cyrillic')
  })

  it('detects Han (Chinese)', () => {
    expect(detectScript('香港城邦論')).toBe('han')
  })

  it('detects Japanese via kana presence even with Han mixed in', () => {
    // Mixed kanji + hiragana → Japanese
    expect(detectScript('ノルウェイの森')).toBe('katakana')
    expect(detectScript('こころ')).toBe('hiragana')
    // 吾輩 (han) + は (hiragana) + 猫 (han) + である (hiragana) → 4 hiragana, 2 han
    expect(detectScript('吾輩は猫である')).toBe('hiragana')
  })

  it('detects Hangul', () => {
    expect(detectScript('채식주의자')).toBe('hangul')
  })

  it('detects Arabic', () => {
    expect(detectScript('ألف ليلة وليلة')).toBe('arabic')
  })

  it('detects Devanagari', () => {
    expect(detectScript('मीणाक्षीपुरम')).toBe('devanagari')
  })

  it('detects Tamil', () => {
    expect(detectScript('மீண்டெழும் பாண்டியர் வரலாறு')).toBe('tamil')
  })

  it('detects Hebrew', () => {
    expect(detectScript('אלף לילה ולילה')).toBe('hebrew')
  })

  it('detects Thai, Greek, Khmer, Georgian, Armenian', () => {
    expect(detectScript('ภาษาไทย')).toBe('thai')
    expect(detectScript('Ελληνικά')).toBe('greek')
    expect(detectScript('ភាសាខ្មែរ')).toBe('khmer')
    expect(detectScript('ქართული')).toBe('georgian')
    expect(detectScript('Հայերեն')).toBe('armenian')
  })

  it('non-Latin dominates even with surrounding Latin chars', () => {
    // Hong Kong style: native title with a stray Latin token
    expect(detectScript('香港城邦論 X')).toBe('han')
  })

  it('returns mixed when no script holds ≥70% of non-Latin chars', () => {
    // Equal Cyrillic + Devanagari → no clear winner
    expect(detectScript('АБВГ देवनागरी')).toBe('mixed')
  })
})

describe('inferLanguage — unambiguous scripts', () => {
  it('Tamil → ta regardless of country', () => {
    expect(inferLanguage('tamil', 'IN', null)).toBe('ta')
    expect(inferLanguage('tamil', null, null)).toBe('ta')
  })

  it('one-to-one scripts return their fixed language', () => {
    expect(inferLanguage('gujarati', null, null)).toBe('gu')
    expect(inferLanguage('gurmukhi', null, null)).toBe('pa')
    expect(inferLanguage('telugu', null, null)).toBe('te')
    expect(inferLanguage('malayalam', null, null)).toBe('ml')
    expect(inferLanguage('thai', null, null)).toBe('th')
    expect(inferLanguage('khmer', null, null)).toBe('km')
    expect(inferLanguage('hebrew', null, null)).toBe('he')
    expect(inferLanguage('greek', null, null)).toBe('el')
    expect(inferLanguage('hangul', null, null)).toBe('ko')
    expect(inferLanguage('hiragana', null, null)).toBe('ja')
    expect(inferLanguage('katakana', null, null)).toBe('ja')
    expect(inferLanguage('georgian', null, null)).toBe('ka')
    expect(inferLanguage('armenian', null, null)).toBe('hy')
    expect(inferLanguage('tibetan', null, null)).toBe('bo')
  })
})

describe('inferLanguage — ambiguous scripts use country', () => {
  it('Cyrillic defaults to ru; UA→uk, BY→be, BG→bg, RS→sr', () => {
    expect(inferLanguage('cyrillic', null, null)).toBe('ru')
    expect(inferLanguage('cyrillic', 'RU', null)).toBe('ru')
    expect(inferLanguage('cyrillic', 'UA', null)).toBe('uk')
    expect(inferLanguage('cyrillic', 'BY', null)).toBe('be')
    expect(inferLanguage('cyrillic', 'BG', null)).toBe('bg')
    expect(inferLanguage('cyrillic', 'RS', null)).toBe('sr')
  })

  it('Arabic defaults to ar; IR→fa, AF→fa, PK→ur', () => {
    expect(inferLanguage('arabic', null, null)).toBe('ar')
    expect(inferLanguage('arabic', 'SA', null)).toBe('ar')
    expect(inferLanguage('arabic', 'IR', null)).toBe('fa')
    expect(inferLanguage('arabic', 'AF', null)).toBe('fa')
    expect(inferLanguage('arabic', 'PK', null)).toBe('ur')
  })

  it('Han defaults to zh; HK/TW/CN→zh', () => {
    expect(inferLanguage('han', null, null)).toBe('zh')
    expect(inferLanguage('han', 'HK', null)).toBe('zh')
    expect(inferLanguage('han', 'TW', null)).toBe('zh')
    expect(inferLanguage('han', 'CN', null)).toBe('zh')
  })

  it('Devanagari → hi by default; NP→ne; Maharashtra state→mr', () => {
    expect(inferLanguage('devanagari', null, null)).toBe('hi')
    expect(inferLanguage('devanagari', 'IN', null)).toBe('hi')
    expect(inferLanguage('devanagari', 'NP', null)).toBe('ne')
    expect(inferLanguage('devanagari', 'IN', 'Maharashtra')).toBe('mr')
    expect(inferLanguage('devanagari', 'IN', 'Marathi')).toBe('mr')
  })

  it('Bengali defaults to bn; Indian state Assam → as', () => {
    expect(inferLanguage('bengali', 'BD', null)).toBe('bn')
    expect(inferLanguage('bengali', 'IN', null)).toBe('bn')
    expect(inferLanguage('bengali', 'IN', 'Assam')).toBe('as')
    expect(inferLanguage('bengali', 'IN', 'West Bengal')).toBe('bn')
  })
})

describe('inferLanguage — null/empty cases', () => {
  it('Latin / mixed / null script → null language', () => {
    expect(inferLanguage('latin', 'FR', null)).toBeNull()
    expect(inferLanguage('mixed', 'IN', null)).toBeNull()
    expect(inferLanguage(null, 'US', null)).toBeNull()
  })

  it('lowercases country codes are accepted', () => {
    expect(inferLanguage('arabic', 'ir', null)).toBe('fa')
    expect(inferLanguage('cyrillic', 'ua', null)).toBe('uk')
  })
})

describe('inferScriptAndLanguage — end-to-end', () => {
  it('Cyrillic title + Russia source → cyrillic + ru', () => {
    const r = inferScriptAndLanguage('Архипелаг ГУЛАГ', 'RU', null)
    expect(r).toEqual({ script: 'cyrillic', language: 'ru' })
  })

  it('Han title + HK source → han + zh', () => {
    const r = inferScriptAndLanguage('香港城邦論', 'HK', null)
    expect(r).toEqual({ script: 'han', language: 'zh' })
  })

  it('Tamil title + India source → tamil + ta (state ignored)', () => {
    const r = inferScriptAndLanguage('மீண்டெழும் பாண்டியர் வரலாறு', 'IN', 'Tamil Nadu')
    expect(r).toEqual({ script: 'tamil', language: 'ta' })
  })

  it('Devanagari title + India + Maharashtra → devanagari + mr', () => {
    const r = inferScriptAndLanguage('मराठी पुस्तक', 'IN', 'Maharashtra')
    expect(r).toEqual({ script: 'devanagari', language: 'mr' })
  })

  it('Arabic title + Iran source → arabic + fa', () => {
    const r = inferScriptAndLanguage('کتاب صادق هدایت', 'IR', null)
    expect(r).toEqual({ script: 'arabic', language: 'fa' })
  })

  it('null/empty input → both null', () => {
    expect(inferScriptAndLanguage(null, 'IN', null))
      .toEqual({ script: null, language: null })
    expect(inferScriptAndLanguage('', 'IN', null))
      .toEqual({ script: null, language: null })
  })
})
