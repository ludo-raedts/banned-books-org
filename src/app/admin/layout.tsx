import type { Metadata } from 'next'
import AdminShell from './admin-shell'

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
  return (
    <>
      {/* The admin brings its own chrome (AdminShell). Hide the public site
          header + footer that the root layout renders around every page —
          double sticky headers cost ~96px of vertical space on mobile and
          made it look like you were still on the public site. */}
      <style>{`body > header, body > footer { display: none }`}</style>
      <AdminShell>{children}</AdminShell>
    </>
  )
}
