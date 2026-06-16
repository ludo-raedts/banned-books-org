// Full-text RSS feed of all published essays. Subscribers get the complete
// markdown body in <content:encoded>, dek in <description>. AI crawlers can
// ingest the corpus from this single URL instead of paginating /essays.
//
// Adding a new essay: add an `import` + map entry below using the slug from
// essays-data.ts. The build will fail loudly if a slug is missing — that's
// intentional, so essays cannot silently drop out of the feed.

import { publishedEssays } from '@/lib/essays-data'

import { body as inWhoseNameBody } from '@/lib/markdown-pages/in-whose-name'
import { body as historyBody } from '@/lib/markdown-pages/history'
import { body as whyNotAmazonBody } from '@/lib/markdown-pages/why-not-amazon'
import { body as whatWeDocumentBody } from '@/lib/markdown-pages/what-we-document'
import { body as forbiddenKnowledgeIcebergBody } from '@/lib/markdown-pages/forbidden-knowledge-iceberg'
import { body as theGreyZoneBody } from '@/lib/markdown-pages/the-grey-zone'
import { body as firstAmendmentParadoxBody } from '@/lib/markdown-pages/first-amendment-paradox'
import { body as theLineWePretendNotToDrawBody } from '@/lib/markdown-pages/the-line-we-pretend-not-to-draw'

const ESSAY_BODIES: Record<string, string> = {
  'the-line-we-pretend-not-to-draw': theLineWePretendNotToDrawBody,
  'in-whose-name': inWhoseNameBody,
  'history': historyBody,
  'why-not-amazon': whyNotAmazonBody,
  'what-we-document': whatWeDocumentBody,
  'forbidden-knowledge-iceberg': forbiddenKnowledgeIcebergBody,
  'the-grey-zone': theGreyZoneBody,
  'first-amendment-paradox': firstAmendmentParadoxBody,
}

const BASE = 'https://www.banned-books.org'

export const revalidate = 3600

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// CDATA can contain anything except the literal ]]> terminator. Split it if
// it appears in the body so the section closes cleanly.
function wrapCdata(str: string): string {
  return `<![CDATA[${str.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

export function GET() {
  const essays = publishedEssays()

  const items = essays.map(essay => {
    const url = `${BASE}${essay.href}`
    const pubDate = new Date(essay.publishedAt).toUTCString()
    const body = ESSAY_BODIES[essay.slug] ?? ''

    return `
    <item>
      <title>${escapeXml(essay.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(essay.dek)}</description>
      <content:encoded>${wrapCdata(body)}</content:encoded>
      <pubDate>${pubDate}</pubDate>
      <source url="${escapeXml(`${BASE}/essays`)}">Banned Books Essays</source>
    </item>`
  }).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Banned Books — Essays</title>
    <link>${BASE}/essays</link>
    <description>Long-form pieces on censorship: what we document, how the categories blur, and the editorial choices behind this catalogue.</description>
    <language>en-us</language>
    <atom:link href="${BASE}/essays/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
