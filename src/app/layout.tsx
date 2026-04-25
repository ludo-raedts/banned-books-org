import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://banned-books.org'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Banned Books',
    template: '%s | Banned Books',
  },
  description: 'An international catalogue of books banned by governments and schools worldwide. Browse by country, genre, and reason.',
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-6">
            <Link href="/" className="font-semibold text-sm tracking-tight hover:opacity-80 transition-opacity">
              📕 Banned Books
            </Link>
            <nav className="flex items-center gap-1 flex-1">
              <Link href="/countries" className="px-3 py-1.5 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Countries</Link>
              <Link href="/stats" className="px-3 py-1.5 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Stats</Link>
              <Link href="/reasons" className="px-3 py-1.5 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Reasons</Link>
              <Link href="/sources" className="px-3 py-1.5 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Sources</Link>
            </nav>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-gray-200 dark:border-gray-800 mt-10">
          <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 text-xs text-gray-400 dark:text-gray-500">
            <span className="sm:flex-1">Banned Books — an open catalogue of censored literature</span>
            <nav className="flex flex-wrap gap-x-5 gap-y-1">
              <Link href="/countries" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Countries</Link>
              <Link href="/stats" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Stats</Link>
              <Link href="/reasons" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Reasons</Link>
              <Link href="/scope/school" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">School bans</Link>
              <Link href="/scope/government" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Government bans</Link>
              <Link href="/sources" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Sources</Link>
            </nav>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
