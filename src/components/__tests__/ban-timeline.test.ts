import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BanTimeline, { type TimelineRow } from '../ban-timeline'

function render(props: React.ComponentProps<typeof BanTimeline>) {
  return renderToStaticMarkup(React.createElement(BanTimeline, props))
}

// Iconic ~Ulysses spread: bans 1921–1933 across US/UK/DE/IE, all 'historical' / 'banned'.
const ulyssesRows: TimelineRow[] = [
  {
    key: 'US', label: 'United States', flag: '🇺🇸', sublabel: 'US',
    bans: [
      { id: 1, year_started: 1921, year_ended: 1934, status: 'historical', action_type: 'banned' },
    ],
  },
  {
    key: 'GB', label: 'United Kingdom', flag: '🇬🇧', sublabel: 'GB',
    bans: [
      { id: 2, year_started: 1923, year_ended: 1936, status: 'historical', action_type: 'banned' },
    ],
  },
  {
    key: 'IE', label: 'Ireland', flag: '🇮🇪', sublabel: 'IE',
    bans: [
      { id: 3, year_started: 1922, year_ended: 1960, status: 'historical', action_type: 'banned' },
    ],
  },
  {
    key: 'DE', label: 'Germany', flag: '🇩🇪', sublabel: 'DE',
    bans: [
      { id: 4, year_started: 1933, year_ended: 1945, status: 'historical', action_type: 'banned' },
    ],
  },
]

// Mein Kampf spread: long active bans in DE/AT/NL.
const meinKampfRows: TimelineRow[] = [
  {
    key: 'DE', label: 'Germany', flag: '🇩🇪', sublabel: 'DE',
    bans: [
      { id: 10, year_started: 1945, year_ended: null, status: 'historical', action_type: 'banned' },
      { id: 11, year_started: 2016, year_ended: null, status: 'active', action_type: 'restricted' },
    ],
  },
  {
    key: 'AT', label: 'Austria', flag: '🇦🇹', sublabel: 'AT',
    bans: [
      { id: 12, year_started: 1945, year_ended: null, status: 'active', action_type: 'banned' },
    ],
  },
  {
    key: 'NL', label: 'Netherlands', flag: '🇳🇱', sublabel: 'NL',
    bans: [
      { id: 13, year_started: 1987, year_ended: null, status: 'active', action_type: 'restricted' },
    ],
  },
]

// Edge case: exactly 3 bans, one with no year_ended.
const edgeRows: TimelineRow[] = [
  {
    key: 'US', label: 'United States', flag: '🇺🇸',
    bans: [
      { id: 100, year_started: 1990, year_ended: 1995, status: 'historical', action_type: 'banned' },
      { id: 101, year_started: 2010, year_ended: null, status: 'active', action_type: 'challenged' },
    ],
  },
  {
    key: 'CA', label: 'Canada', flag: '🇨🇦',
    bans: [
      { id: 102, year_started: 2005, year_ended: 2008, status: 'historical', action_type: 'restricted' },
    ],
  },
]

describe('BanTimeline', () => {
  it('renders a Ulysses-like spread (multiple countries, 1922–1940)', () => {
    const out = render({ rows: ulyssesRows, firstPublishedYear: 1922, currentYear: 2026 })
    expect(out).toMatchSnapshot()
  })

  it('renders a Mein-Kampf-like spread with active bans and mixed action types', () => {
    const out = render({ rows: meinKampfRows, firstPublishedYear: 1925, currentYear: 2026 })
    expect(out).toMatchSnapshot()
  })

  it('renders an edge-case book with exactly 3 bans, one open-ended', () => {
    const out = render({ rows: edgeRows, firstPublishedYear: 1985, currentYear: 2026 })
    expect(out).toMatchSnapshot()
    // Sanity: contains a bar that runs to currentYear via the title text
    expect(out).toContain('2010–present')
  })

  it('renders nothing when bans.length < 3', () => {
    const out = render({
      rows: [
        {
          key: 'US', label: 'United States',
          bans: [
            { id: 1, year_started: 2020, year_ended: null, status: 'active', action_type: 'banned' },
            { id: 2, year_started: 2021, year_ended: null, status: 'active', action_type: 'banned' },
          ],
        },
      ],
      currentYear: 2026,
    })
    expect(out).toBe('')
  })

  it('renders nothing when rows is empty', () => {
    const out = render({ rows: [], currentYear: 2026 })
    expect(out).toBe('')
  })

  it('respects a custom minBansToRender threshold', () => {
    const oneBan: TimelineRow[] = [
      {
        key: 'US', label: 'United States',
        bans: [{ id: 1, year_started: 2020, year_ended: null, status: 'active', action_type: 'banned' }],
      },
    ]
    expect(render({ rows: oneBan, currentYear: 2026 })).toBe('')
    expect(render({ rows: oneBan, minBansToRender: 1, currentYear: 2026 })).not.toBe('')
  })
})
