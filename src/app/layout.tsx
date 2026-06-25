import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import MobileNav from "@/components/mobile-nav";
import NavLink from "@/components/nav-link";
import AnalyticsWrapper from "@/components/AnalyticsWrapper";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SITE_URL } from '@/lib/canonical-host'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Banned Books',
    template: '%s | Banned Books',
  },
  description: 'An international catalogue of books banned by governments and schools worldwide. Browse by country, genre, and reason.',
  authors: [{ name: 'Banned Books', url: 'https://www.banned-books.org' }],
  openGraph: {
    siteName: 'Banned Books',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <head>
        <link rel="alternate" type="application/rss+xml" title="Banned Books — Latest Censorship News" href="/feed.xml" />
      </head>
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand focus:shadow-lg focus:ring-2 focus:ring-brand"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold text-sm tracking-tight text-brand hover:opacity-80 transition-opacity">
              <Image src="/brand/compact-bb.svg" alt="" width={24} height={24} priority className="rounded-[5px]" />
              <span>Banned Books</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 flex-1">
              <NavLink href="/search">Search</NavLink>
              <NavLink href="/dataset">Dataset</NavLink>
              <NavLink href="/countries">Countries</NavLink>
              <NavLink href="/most-banned-authors">Authors</NavLink>
              <NavLink href="/stats">Stats</NavLink>
              <NavLink href="/reasons">Reasons</NavLink>
              <NavLink href="/history">History</NavLink>
              <NavLink href="/essays">Essays</NavLink>
              <NavLink href="/news">News</NavLink>
              <NavLink href="/reading-club">Reading club</NavLink>
            </nav>
            <MobileNav />
          </div>
        </header>
        {/* id target for the skip link. Stays a <div>, not <main>: individual
            pages render their own <main> landmark, so a <main> here would nest. */}
        <div id="main" className="flex-1">{children}</div>
        <footer className="border-t border-gray-200 mt-10">
          <div className="max-w-5xl mx-auto px-4 py-8 text-xs text-gray-500">
            <nav aria-label="Footer" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-6">
              <div>
                <h2 className="text-[11px] uppercase tracking-wider font-semibold text-gray-700 mb-2">Browse</h2>
                <ul className="space-y-1.5">
                  <li><Link href="/search" className="hover:text-gray-800 transition-colors">Search</Link></li>
                  <li><Link href="/countries" className="hover:text-gray-800 transition-colors">Countries</Link></li>
                  <li><Link href="/reasons" className="hover:text-gray-800 transition-colors">Reasons</Link></li>
                  <li><Link href="/most-banned-authors" className="hover:text-gray-800 transition-colors">Most banned authors</Link></li>
                  <li><Link href="/scope/school" className="hover:text-gray-800 transition-colors">School bans</Link></li>
                  <li><Link href="/scope/government" className="hover:text-gray-800 transition-colors">Government bans</Link></li>
                  <li><Link href="/challenged-books" className="hover:text-gray-800 transition-colors">Challenged books</Link></li>
                </ul>
              </div>
              <div>
                <h2 className="text-[11px] uppercase tracking-wider font-semibold text-gray-700 mb-2">Lists</h2>
                <ul className="space-y-1.5">
                  <li><Link href="/top-100-banned-books" className="hover:text-gray-800 transition-colors">Top 100 banned books</Link></li>
                  <li><Link href="/trending-banned-books" className="hover:text-gray-800 transition-colors">Trending</Link></li>
                  <li><Link href="/rising-banned-books" className="hover:text-gray-800 transition-colors">Rising</Link></li>
                  <li><Link href="/banned-classics" className="hover:text-gray-800 transition-colors">Classics</Link></li>
                  <li><Link href="/banned-childrens-books" className="hover:text-gray-800 transition-colors">Children&rsquo;s books</Link></li>
                  <li><Link href="/non-english-banned-books" className="hover:text-gray-800 transition-colors">Non-English books</Link></li>
                  <li><Link href="/award-winning-banned-books" className="hover:text-gray-800 transition-colors">Award winners</Link></li>
                  <li><Link href="/banned-books-week" className="hover:text-gray-800 transition-colors">Banned Books Week</Link></li>
                  <li><Link href="/banned-books" className="hover:text-gray-800 transition-colors">By year</Link></li>
                </ul>
              </div>
              <div>
                <h2 className="text-[11px] uppercase tracking-wider font-semibold text-gray-700 mb-2">Data</h2>
                <ul className="space-y-1.5">
                  <li><Link href="/dataset" className="hover:text-gray-800 transition-colors">Download dataset</Link></li>
                  <li><Link href="/stats" className="hover:text-gray-800 transition-colors">Stats</Link></li>
                  <li><Link href="/sources" className="hover:text-gray-800 transition-colors">Sources</Link></li>
                  <li><Link href="/methodology" className="hover:text-gray-800 transition-colors">Methodology</Link></li>
                  <li><Link href="/data-quality" className="hover:text-gray-800 transition-colors">Data quality</Link></li>
                </ul>
              </div>
              <div>
                <h2 className="text-[11px] uppercase tracking-wider font-semibold text-gray-700 mb-2">Read</h2>
                <ul className="space-y-1.5">
                  <li><Link href="/film" className="hover:text-gray-800 transition-colors">Film</Link></li>
                  <li><Link href="/essays" className="hover:text-gray-800 transition-colors">Essays</Link></li>
                  <li><Link href="/history" className="hover:text-gray-800 transition-colors">History</Link></li>
                  <li><Link href="/timeline" className="hover:text-gray-800 transition-colors">Timeline</Link></li>
                  <li><Link href="/news" className="hover:text-gray-800 transition-colors">News</Link></li>
                  <li><Link href="/reading-club" className="hover:text-gray-800 transition-colors">Reading club</Link></li>
                  <li><Link href="/discover" className="hover:text-gray-800 transition-colors">Pick a banned book</Link></li>
                  <li><Link href="/share" className="hover:text-gray-800 transition-colors">Daily book · share &amp; embed</Link></li>
                  <li><Link href="/reading-list" className="hover:text-gray-800 transition-colors">Further reading</Link></li>
                </ul>
              </div>
              <div>
                <h2 className="text-[11px] uppercase tracking-wider font-semibold text-gray-700 mb-2">About</h2>
                <ul className="space-y-1.5">
                  <li><Link href="/about" className="hover:text-gray-800 transition-colors">About</Link></li>
                  <li><Link href="/support" className="hover:text-gray-800 transition-colors">Support this project</Link></li>
                  <li><Link href="/press" className="hover:text-gray-800 transition-colors">Press</Link></li>
                  <li><Link href="/privacy" className="hover:text-gray-800 transition-colors">Privacy</Link></li>
                  <li><Link href="/accessibility" className="hover:text-gray-800 transition-colors">Accessibility</Link></li>
                  <li><a href="/feed.xml" type="application/rss+xml" className="hover:text-gray-800 transition-colors">RSS feed</a></li>
                </ul>
              </div>
            </nav>
            <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between gap-4 text-gray-400">
              <span>Banned Books — an open catalogue of censored literature</span>
              <div className="flex items-center gap-4 shrink-0">
                <a
                  href="https://bsky.app/profile/banned-books.org"
                  target="_blank"
                  rel="me noopener noreferrer"
                  aria-label="Banned Books on Bluesky — a banned book of the day"
                  className="hover:text-gray-700 transition-colors"
                >
                  <svg viewBox="0 0 600 530" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                    <path d="M135.72 44.03C202.216 93.951 273.74 195.17 300 249.49c26.262-54.316 97.782-155.54 164.28-205.46C512.26 8.009 590-19.862 590 68.825c0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.38-3.69-10.832-3.708-7.896-.017-2.936-1.193.516-3.707 7.896-13.72 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.45-163.25-81.433C10.155 217.616 0 86.536 0 68.825c0-88.687 77.742-60.816 125.72-24.795z" />
                  </svg>
                </a>
                <a
                  href="https://www.linkedin.com/company/banned-books-org"
                  target="_blank"
                  rel="me noopener noreferrer"
                  aria-label="Banned Books on LinkedIn"
                  className="hover:text-gray-700 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
                  </svg>
                </a>
                <a
                  href="https://www.facebook.com/bannedbooks.org"
                  target="_blank"
                  rel="me noopener noreferrer"
                  aria-label="Banned Books on Facebook"
                  className="hover:text-gray-700 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                    <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.03 4.39 11.03 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8v8.44C19.61 23.1 24 18.1 24 12.07z" />
                  </svg>
                </a>
                <a
                  href="https://www.instagram.com/bannedbooksarchive"
                  target="_blank"
                  rel="me noopener noreferrer"
                  aria-label="Banned Books on Instagram"
                  className="hover:text-gray-700 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                    <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 3.68a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-10.4a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0z" />
                  </svg>
                </a>
                <a
                  href="/feed.xml"
                  type="application/rss+xml"
                  aria-label="RSS feed"
                  className="hover:text-gray-700 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                    <path d="M4 11a9 9 0 0 1 9 9h-2.5A6.5 6.5 0 0 0 4 13.5V11zm0-5a14 14 0 0 1 14 14h-2.5A11.5 11.5 0 0 0 4 8.5V6zm1.5 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
                  </svg>
                </a>
              </div>
            </div>
            <p className="mt-2 leading-relaxed text-gray-400">
              Some outbound book links may be affiliate links. They help support this project at no extra cost to you.
            </p>
          </div>
        </footer>
        <AnalyticsWrapper />
        <SpeedInsights />
      </body>
    </html>
  );
}
