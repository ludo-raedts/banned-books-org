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
    // Interruption model: the US row has a real gap (banned ended 1995, the
    // challenge began 2010), so it stays as TWO bars rather than one envelope.
    // Canada keeps its single closed span.
    expect(out).toContain('banned 1990–1995')
    expect(out).toContain('challenged 2010–present')
    expect(out).toContain('2005–2008')
  })

  it('fades out a lifted ban with no recorded end year and labels it "unknown"', () => {
    const rows: TimelineRow[] = [
      {
        key: 'ES', label: 'Spain', flag: '🇪🇸',
        bans: [{ id: 1, year_started: 1939, year_ended: null, status: 'historical', action_type: 'banned' }],
      },
      {
        key: 'US', label: 'United States', flag: '🇺🇸',
        bans: [{ id: 2, year_started: 2023, year_ended: null, status: 'active', action_type: 'restricted' }],
      },
    ]
    const out = render({ rows, firstPublishedYear: 1862, currentYear: 2026 })
    // Historical + open-ended → "unknown" label, fade-gradient fill, and the
    // footnote that explains the fade. The active US ban stays "present".
    expect(out).toContain('banned 1939–unknown')
    expect(out).toContain('url(#ban-timeline-fade)')
    expect(out).toContain('lifted, end year unknown')
    expect(out).toContain('2023–present')
  })

  it('lists countries whose bans have no year as a "not shown" footnote', () => {
    const rows: TimelineRow[] = [
      {
        key: 'ES', label: 'Spain', flag: '🇪🇸',
        bans: [{ id: 1, year_started: 1939, year_ended: 1975, status: 'historical', action_type: 'banned' }],
      },
      {
        key: 'US', label: 'United States', flag: '🇺🇸',
        bans: [{ id: 2, year_started: 2023, year_ended: null, status: 'active', action_type: 'restricted' }],
      },
    ]
    const out = render({ rows, currentYear: 2026, undatedLabels: ['Vatican City (Holy See)', 'Russia'] })
    expect(out).toContain('Not shown')
    expect(out).toContain('Vatican City (Holy See), Russia')
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
    // Two bans across two countries — avoids the single-row span guard, so the
    // threshold is the only thing gating render. Renders under the default
    // threshold of 2, but is suppressed when the caller demands 3.
    const twoBans: TimelineRow[] = [
      {
        key: 'US', label: 'United States',
        bans: [{ id: 1, year_started: 2020, year_ended: null, status: 'active', action_type: 'banned' }],
      },
      {
        key: 'CA', label: 'Canada',
        bans: [{ id: 2, year_started: 2021, year_ended: null, status: 'active', action_type: 'banned' }],
      },
    ]
    expect(render({ rows: twoBans, currentYear: 2026 })).not.toBe('')
    expect(render({ rows: twoBans, minBansToRender: 3, currentYear: 2026 })).toBe('')
  })
})
