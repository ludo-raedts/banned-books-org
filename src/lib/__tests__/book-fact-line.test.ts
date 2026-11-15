import { describe, expect, it } from 'vitest'
import { buildFactLine, type FactBan } from '../book-fact-line'

const NAMES: Record<string, string> = {
  RO: 'Romania', HU: 'Hungary', BG: 'Bulgaria', PL: 'Poland', CU: 'Cuba',
  CN: 'China', US: 'United States', FR: 'France',
}
const ban = (cc: string, status: 'active' | 'historical', year: number | null = 1949): FactBan => ({
  year_started: year, status, country_code: cc, countries: NAMES[cc] ? { name_en: NAMES[cc] } : null,
})
const many = (cc: string, status: 'active' | 'historical', k: number, year = 2023) =>
  Array.from({ length: k }, () => ban(cc, status, year))

describe('buildFactLine', () => {
  it('1984 shape: active clause names only the active countries, never the lifted ones', () => {
    const bans = [
      ban('PL', 'historical'), ban('HU', 'historical'), ban('BG', 'historical'), ban('RO', 'historical'),
      ban('CU', 'active', 1959), ban('US', 'active', 1981), ban('CN', 'active', 1985),
      ...many('US', 'active', 15),
    ]
    const line = buildFactLine(bans).join(' · ')
    expect(line).toBe('22 documented bans · earliest in 1949 · 18 still active (in Cuba, United States and China)')
    expect(line).not.toMatch(/Romania|Hungary|Bulgaria|Poland/)
    expect(line).not.toMatch(/including/)
  })

  it('mixed, single active country', () => {
    const line = buildFactLine([ban('FR', 'historical', 1950), ...many('US', 'active', 4)]).join(' · ')
    expect(line).toBe('5 documented bans · earliest in 1950 · 4 still active (in United States)')
  })

  it('mixed, more than three active countries collapses the tail', () => {
    const bans = [ban('PL', 'historical'), ban('CU', 'active'), ban('US', 'active'), ban('CN', 'active'), ban('FR', 'active')]
    expect(buildFactLine(bans).join(' · ')).toContain('4 still active (in Cuba, United States, China and 1 more)')
  })

  it('all active: no status clause, generic examples allowed', () => {
    const bans = [ban('CU', 'active'), ban('US', 'active'), ban('CN', 'active'), ban('FR', 'active')]
    expect(buildFactLine(bans)).toEqual(['4 documented bans', 'earliest in 1949', 'including Cuba, United States and China'])
  })

  it('all historical: no status clause, examples are fine (nothing says "active")', () => {
    const bans = [ban('PL', 'historical'), ban('HU', 'historical'), ban('BG', 'historical')]
    const line = buildFactLine(bans).join(' · ')
    expect(line).toBe('3 documented bans · earliest in 1949 · including Poland, Hungary and Bulgaria')
    expect(line).not.toMatch(/still active/)
  })

  it('single ban, undated or dated', () => {
    expect(buildFactLine([ban('FR', 'active', 1960)])).toEqual(['1 documented ban in 1960'])
    expect(buildFactLine([ban('FR', 'active', null)])).toEqual(['1 documented ban'])
  })

  it('active bans without a country name still count, without a "(in …)"', () => {
    const bans = [ban('PL', 'historical'), { year_started: 2020, status: 'active', country_code: 'XX', countries: null }]
    expect(buildFactLine(bans)).toEqual(['2 documented bans', 'earliest in 1949', '1 still active'])
  })

  it('statuses other than active count as not active (rescinded etc.)', () => {
    const bans = [{ ...ban('PL', 'historical'), status: 'rescinded' }, ban('US', 'active')]
    expect(buildFactLine(bans).join(' · ')).toContain('1 still active (in United States)')
  })

  it('empty input', () => {
    expect(buildFactLine([])).toEqual([])
  })
})
