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
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
                  <li><Link href="/essays" className="hover:text-gray-800 transition-colors">Essays</Link></li>
                  <li><Link href="/history" className="hover:text-gray-800 transition-colors">History</Link></li>
                  <li><Link href="/timeline" className="hover:text-gray-800 transition-colors">Timeline</Link></li>
                  <li><Link href="/news" className="hover:text-gray-800 transition-colors">News</Link></li>
                  <li><Link href="/reading-club" className="hover:text-gray-800 transition-colors">Reading club</Link></li>
                  <li><Link href="/discover" className="hover:text-gray-800 transition-colors">Pick a banned book</Link></li>
                  <li><Link href="/reading-list" className="hover:text-gray-800 transition-colors">Further reading</Link></li>
                </ul>
              </div>
              <div>
                <h2 className="text-[11px] uppercase tracking-wider font-semibold text-gray-700 mb-2">About</h2>
                <ul className="space-y-1.5">
                  <li><Link href="/about" className="hover:text-gray-800 transition-colors">About</Link></li>
                  <li><Link href="/press" className="hover:text-gray-800 transition-colors">Press</Link></li>
                  <li><Link href="/privacy" className="hover:text-gray-800 transition-colors">Privacy</Link></li>
                  <li><a href="/feed.xml" type="application/rss+xml" className="hover:text-gray-800 transition-colors">RSS feed</a></li>
                </ul>
              </div>
            </nav>
            <div className="mt-8 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-gray-400">
              <span>Banned Books — an open catalogue of censored literature</span>
              <Link href="/admin/login" className="text-gray-300 hover:text-gray-500 transition-colors">Admin</Link>
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
