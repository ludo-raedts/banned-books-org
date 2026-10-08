import { SITEMAP_BASE_URL } from '@/lib/sitemap-xml'

// CollectionPage + ItemList JSON-LD for hub/listing pages (top-100, countries,
// essays, news). `items` are rendered in order; `path` is the page's own path.
export default function CollectionJsonLd({
  path,
  name,
  description,
  items,
}: {
  path: string
  name: string
  description: string
  items: { name: string; path: string }[]
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITEMAP_BASE_URL}${path}`,
    url: `${SITEMAP_BASE_URL}${path}`,
    name,
    description,
    isPartOf: { '@type': 'WebSite', name: 'Banned Books', url: SITEMAP_BASE_URL },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        url: `${SITEMAP_BASE_URL}${it.path}`,
      })),
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
    />
  )
}
