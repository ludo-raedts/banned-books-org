import type { BreadcrumbItem } from '@/components/breadcrumb'
import { SITE_URL } from '@/lib/canonical-host'

// Schema.org BreadcrumbList without a visual breadcrumb. Hub pages (country,
// reason, scope, context, year) carry their own eyebrow/H1 hierarchy, so the
// visible trail would be redundant — but the structured trail was missing
// entirely there (audit 2026-10-25), while book/author pages emit it inline.
// Items mirror <Breadcrumb>'s shape; hrefs are site-relative.
export default function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }}
    />
  )
}
