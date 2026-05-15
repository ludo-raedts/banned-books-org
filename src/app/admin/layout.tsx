import type { Metadata } from 'next'

// Apply noindex + nofollow to every /admin/* route via Next's nested metadata
// system. Crawlers (Google, Bing, GPTBot, etc.) routinely follow links into
// admin paths and waste crawl budget on auth-gated pages that 401/403; the
// robots meta short-circuits that before the request even hits requireAdmin.
//
// `nocache` keeps stale snapshots out of search caches in the rare case a
// page slips through without the auth wrapper.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
