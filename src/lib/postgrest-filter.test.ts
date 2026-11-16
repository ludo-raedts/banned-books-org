import { describe, expect, it } from 'vitest'
import { ilikeContains, orIlikeContains } from './postgrest-filter'

describe('postgrest-filter', () => {
  it('escapes LIKE metacharacters', () => {
    expect(ilikeContains('100%_a\\b')).toBe('%100\\%\\_a\\\\b%')
  })

  it('quotes values so commas/parens cannot split the or() expression', () => {
    const out = orIlikeContains(['title', 'title_native'], 'Pride, Prejudice')
    expect(out).toBe('title.ilike."%Pride, Prejudice%",title_native.ilike."%Pride, Prejudice%"')
  })

  it('neutralises an injected extra condition', () => {
    const out = orIlikeContains(['title'], 'x%,internal.ilike.a%"')
    // quote is backslash-escaped, % escaped for LIKE (then \\ for the quoting layer)
    expect(out).toBe('title.ilike."%x\\\\%,internal.ilike.a\\\\%\\"%"')
  })
})
