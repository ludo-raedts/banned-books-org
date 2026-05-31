/* @react-pdf/renderer document used by the /timeline/pdf route. Renders the
   full curated timeline (TIMELINE_EVENTS) as a printable A4 booklet — brand
   row at top, eras as section headings, events laid out chronologically.
   Server-side only; do not import from a client bundle. */

import React from 'react'
import path from 'node:path'
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Image,
  Link,
  renderToBuffer,
  type DocumentProps,
} from '@react-pdf/renderer'
import {
  TIMELINE_ERAS,
  sortedTimelineEvents,
  type TimelineEvent,
} from '@/lib/timeline-events'

const LOGO_PATH = path.join(process.cwd(), 'public', 'brand', 'compact-bb.png')

const OXBLOOD = '#7a1a1a'
const INK = '#1a1a1a'
const MUTED = '#5b5b5b'
const RULE = '#d4d4d4'

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    color: INK,
    lineHeight: 1.5,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
  },
  brandLogo: { width: 22, height: 22 },
  brandWordmark: {
    fontFamily: 'Times-Bold',
    fontSize: 12,
    color: INK,
    letterSpacing: 0.3,
  },
  brandDivider: { fontSize: 10, color: MUTED, marginHorizontal: 2 },
  brandLabel: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: MUTED,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flex: 1,
  },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: OXBLOOD,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 24,
    lineHeight: 1.15,
    color: INK,
    marginBottom: 10,
  },
  heroIntro: {
    fontFamily: 'Times-Italic',
    fontSize: 12,
    color: INK,
    marginBottom: 4,
  },
  heroMeta: {
    fontSize: 9,
    color: MUTED,
    marginBottom: 18,
  },
  eraTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 16,
    color: INK,
    marginTop: 14,
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: OXBLOOD,
  },
  eraIntro: {
    fontSize: 10,
    color: MUTED,
    marginBottom: 12,
    lineHeight: 1.45,
  },
  eventBlock: {
    marginBottom: 12,
    paddingLeft: 0,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  eventDate: {
    width: 78,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    letterSpacing: 0.6,
    color: OXBLOOD,
    textTransform: 'uppercase',
    paddingTop: 2,
  },
  eventBody: {
    flex: 1,
    paddingLeft: 10,
    borderLeftWidth: 0.5,
    borderLeftColor: RULE,
  },
  eventTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 11.5,
    color: INK,
    marginBottom: 3,
    lineHeight: 1.25,
  },
  eventSummary: {
    fontSize: 10,
    color: INK,
    marginBottom: 4,
    lineHeight: 1.5,
  },
  eventLinks: {
    fontSize: 8.5,
    color: MUTED,
    lineHeight: 1.4,
  },
  eventLink: {
    color: MUTED,
    textDecoration: 'none',
  },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: MUTED,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: RULE,
  },
  footerLink: { color: MUTED, textDecoration: 'none' },
  pageNum: { fontSize: 8, color: MUTED },
  sourcesBlock: {
    marginTop: 18,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: RULE,
  },
  sourcesTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sourceLine: {
    fontSize: 8.5,
    color: MUTED,
    marginBottom: 2,
    lineHeight: 1.4,
  },
})

const SITE_URL = 'https://www.banned-books.org'

function eventLinkLines(event: TimelineEvent): string[] {
  const lines: string[] = []
  if (event.related?.bookSlug) lines.push(`Book: ${SITE_URL}/books/${event.related.bookSlug}`)
  if (event.related?.authorSlug) lines.push(`Author: ${SITE_URL}/authors/${event.related.authorSlug}`)
  if (event.related?.countryCode) lines.push(`Country: ${SITE_URL}/countries/${event.related.countryCode.toLowerCase()}`)
  return lines
}

export function TimelinePdfDoc({ canonicalUrl }: { canonicalUrl: string }) {
  const events = sortedTimelineEvents()
  const grouped = TIMELINE_ERAS.map(era => ({
    era,
    events: events.filter(e => e.era === era.id),
  })).filter(g => g.events.length > 0)
  const generated = new Date().toISOString().slice(0, 10)

  return (
    <Document
      title="Timeline of Banned Books — 2,000 Years of Censorship"
      author="banned-books.org"
      subject="A curated timeline of landmark moments in the history of book banning."
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.brandRow} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
          <Image src={LOGO_PATH} style={styles.brandLogo} />
          <Text style={styles.brandWordmark}>banned-books.org</Text>
          <Text style={styles.brandDivider}>·</Text>
          <Text style={styles.brandLabel}>Timeline · 2,000 years of book bans</Text>
        </View>

        <Text style={styles.eyebrow}>Timeline · {events.length} landmark moments</Text>
        <Text style={styles.heroTitle}>The long history of suppressed words.</Text>
        <Text style={styles.heroIntro}>
          From a Qin emperor burning Confucian texts in 213 BCE to ten thousand US school bans in a single academic year — landmark moments in the long history of suppressed words. The methods change. The instinct doesn’t.
        </Text>
        <Text style={styles.heroMeta}>
          Generated {generated} · banned-books.org/timeline
        </Text>

        {grouped.map(({ era, events }) => (
          <View key={era.id}>
            <Text style={styles.eraTitle}>{era.label}</Text>
            <Text style={styles.eraIntro}>{era.intro}</Text>

            {events.map(e => {
              const linkLines = eventLinkLines(e)
              return (
                <View key={e.slug} style={styles.eventBlock} wrap={false}>
                  <View style={styles.eventRow}>
                    <Text style={styles.eventDate}>{e.displayDate}</Text>
                    <View style={styles.eventBody}>
                      <Text style={styles.eventTitle}>{e.title}</Text>
                      <Text style={styles.eventSummary}>{e.summary}</Text>
                      {linkLines.length > 0 && (
                        <Text style={styles.eventLinks}>
                          {linkLines.map((line, i) => (
                            <React.Fragment key={i}>
                              {i > 0 ? '  ·  ' : ''}
                              <Link src={line.split(': ')[1]} style={styles.eventLink}>
                                {line}
                              </Link>
                            </React.Fragment>
                          ))}
                        </Text>
                      )}
                      {e.externalLink && (
                        <Text style={styles.eventLinks}>
                          Reference:{' '}
                          <Link src={e.externalLink} style={styles.eventLink}>
                            {e.externalLink}
                          </Link>
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        ))}

        <View style={styles.sourcesBlock}>
          <Text style={styles.sourcesTitle}>About this timeline</Text>
          <Text style={styles.sourceLine}>
            Curated by banned-books.org — landmark events in the history of book banning, drawn from the project&rsquo;s catalogue and from documented historical record. Live, browsable version with country, author, and book links at{' '}
            <Link src={canonicalUrl} style={styles.eventLink}>{canonicalUrl}</Link>.
          </Text>
          <Text style={[styles.sourceLine, { marginTop: 4 }]}>
            Curated text © banned-books.org, licensed CC BY 4.0 — share with attribution.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Link src={canonicalUrl} style={styles.footerLink}>
            banned-books.org/timeline
          </Link>
          <Text
            style={styles.pageNum}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

export function renderTimelinePdfBuffer(canonicalUrl: string): Promise<Buffer> {
  const element = React.createElement(TimelinePdfDoc, { canonicalUrl }) as
    React.ReactElement<DocumentProps>
  return renderToBuffer(element)
}
