import { describe, it, expect } from 'vitest'
import { canonicaliseAuthorName } from '../canonicalise-author-name'

describe('canonicaliseAuthorName', () => {
  it('passes through clean names untouched', () => {
    expect(canonicaliseAuthorName('Geoffrey Lowndes')).toBe('Geoffrey Lowndes')
    expect(canonicaliseAuthorName('William H. Masters')).toBe('William H. Masters')
    expect(canonicaliseAuthorName('Liao Yiwu')).toBe('Liao Yiwu')
  })

  it('strips PhD suffixes in their many KDN forms', () => {
    expect(canonicaliseAuthorName('Geoffrey Lowndes P.H.D')).toBe('Geoffrey Lowndes')
    expect(canonicaliseAuthorName('Geoffrey Lowndes Ph.D.')).toBe('Geoffrey Lowndes')
    expect(canonicaliseAuthorName('Geoffrey Lowndes PhD')).toBe('Geoffrey Lowndes')
  })

  it('strips M.D., M.A., B.A., J.P., Esq., Jr.', () => {
    expect(canonicaliseAuthorName('John Smith M.D.')).toBe('John Smith')
    expect(canonicaliseAuthorName('John Smith M.A.')).toBe('John Smith')
    expect(canonicaliseAuthorName('John Smith B.A.')).toBe('John Smith')
    expect(canonicaliseAuthorName('John Smith J.P.')).toBe('John Smith')
    expect(canonicaliseAuthorName('John Smith Esq.')).toBe('John Smith')
    expect(canonicaliseAuthorName('Kurt Vonnegut Jr.')).toBe('Kurt Vonnegut')
  })

  it('does NOT strip 1-2-letter surnames that look like degrees without a dot', () => {
    // M.A. with a dot is a degree; "Ma" without is a Chinese surname.
    expect(canonicaliseAuthorName('Yue Ma')).toBe('Yue Ma')
    expect(canonicaliseAuthorName('Long Ma')).toBe('Long Ma')
    // M.D. dotted; "Md" alone is the Malay short for Muhammad.
    expect(canonicaliseAuthorName('Ahmad Md')).toBe('Ahmad Md')
  })

  it('handles chained credentials', () => {
    expect(canonicaliseAuthorName('Dr. John Smith M.A. Ph.D.')).toBe('Dr. John Smith')
  })

  it('strips Malay honorifics in trailing position', () => {
    expect(canonicaliseAuthorName('Shaari Mohd Yusof Hj.')).toBe('Shaari Mohd Yusof')
  })

  it('cleans dangling commas and periods left by the strip', () => {
    expect(canonicaliseAuthorName('John Smith, Ph.D.')).toBe('John Smith')
    expect(canonicaliseAuthorName('John Smith.')).toBe('John Smith')
  })

  it('returns empty for empty/whitespace input', () => {
    expect(canonicaliseAuthorName('')).toBe('')
    expect(canonicaliseAuthorName('   ')).toBe('')
  })
})
