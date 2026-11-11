import { describe, expect, it } from 'vitest'
import {
  focusText, htmlToText, isDeniedSource, quoteOnPage, sentenceGroundingProblems, sourceTier,
} from '../censorship-context-verify'

const PAGE = htmlToText(`<html><head><title>x</title><script>var a = "banned in 1990"</script></head><body>
<nav>Home</nav><p>The novel came out in English in 1949, but was <i>banned</i> in the Soviet&nbsp;Union in any language until 1988.<sup class="reference">[12]</sup></p>
<p>Orwell&rsquo;s book was &ldquo;long suppressed&rdquo; &mdash; the editors said.</p></body></html>`)

describe('quoteOnPage', () => {
  it('accepts a verbatim passage across inline tags, entities and footnote markers', () => {
    expect(quoteOnPage('but was banned in the Soviet Union in any language until 1988.', PAGE)).toBe(true)
    expect(quoteOnPage(`Orwell's book was "long suppressed" - the editors said.`, PAGE)).toBe(true)
  })
  it('rejects a paraphrase, a changed year, and text that only lives in a script', () => {
    expect(quoteOnPage('was prohibited in the Soviet Union in every language until 1988', PAGE)).toBe(false)
    expect(quoteOnPage('but was banned in the Soviet Union in any language until 1990.', PAGE)).toBe(false)
    expect(quoteOnPage('var a = "banned in 1990" and some more characters to pass the minimum', PAGE)).toBe(false)
  })
  it('rejects quotes too short to identify a passage', () => {
    expect(quoteOnPage('banned in the Soviet Union', PAGE)).toBe(false)
  })
})

describe('source policy', () => {
  it('denies our own site, forums and study-guide mills', () => {
    expect(isDeniedSource('https://www.banned-books.org/books/1984')).toBe(true)
    expect(isDeniedSource('https://old.reddit.com/r/books/x')).toBe(true)
    expect(isDeniedSource('https://www.gradesaver.com/1984')).toBe(true)
    expect(isDeniedSource('https://www.ala.org/bbooks')).toBe(false)
  })
  it('tiers hosts', () => {
    expect(sourceTier('https://www.marshall.edu/library/bannedbooks/')).toBe('institutional')
    expect(sourceTier('https://www.classification.gov.au/titles/x')).toBe('institutional')
    expect(sourceTier('https://en.wikipedia.org/wiki/X')).toBe('reference')
    expect(sourceTier('https://assets.contentstack.io/v3/x.pdf')).toBe('other')
  })
})

describe('sentenceGroundingProblems', () => {
  const quotes = ['The novel came out in English in 1949, but was banned in the Soviet Union in any language until 1988.']
  const base = { quotes, pageTexts: [PAGE], allowWords: ['1984', 'George Orwell'], title: '1984' }
  it('passes a sentence whose numbers and names are in the source; the title is not a number', () => {
    expect(sentenceGroundingProblems({ ...base, sentence: '1984 was banned in the Soviet Union in any language until 1988.' })).toEqual([])
  })
  it('flags a year that is not in the cited quote', () => {
    expect(sentenceGroundingProblems({ ...base, sentence: '1984 was banned in the Soviet Union until 1990.' })).toEqual(['number:1990'])
  })
  it('flags a name that is nowhere on the cited page', () => {
    expect(sentenceGroundingProblems({ ...base, sentence: '1984 was banned in the Soviet Union by Glavlit until 1988.' })).toEqual(['name:Glavlit'])
  })
  it('flags time relative to now, but not past-tense "remained"', () => {
    expect(sentenceGroundingProblems({ ...base, sentence: '1984 was challenged last year.' })).toContain('relative:last year')
    expect(sentenceGroundingProblems({ ...base, sentence: '1984 remains banned in the Soviet Union.' })).toContain('relative:remains')
    expect(sentenceGroundingProblems({ ...base, sentence: '1984 remained banned in the Soviet Union until 1988.' })).toEqual([])
  })
})

describe('focusText', () => {
  it('returns null when the page never mentions the book', () => {
    expect(focusText('A page about something else entirely.', ['Lolita', 'Nabokov'])).toBeNull()
  })
  it('keeps only the windows around mentions on a long page', () => {
    const long = 'x'.repeat(30000) + ' Lolita was banned in France. ' + 'y'.repeat(30000)
    const f = focusText(long, ['Lolita'], 200, 5000)!
    expect(f).toContain('Lolita was banned in France.')
    expect(f.length).toBeLessThan(1000)
  })
})
