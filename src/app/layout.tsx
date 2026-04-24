import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  description: 'An international catalogue of books banned by governments and schools worldwide. Browse 60+ titles by country, genre, and reason.',
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
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t mt-10">
          <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 text-xs text-gray-400">
            <span className="sm:flex-1">Banned Books — an open catalogue of censored literature</span>
            <nav className="flex flex-wrap gap-x-5 gap-y-1">
              <Link href="/scope/school" className="hover:text-gray-700 transition-colors">School bans</Link>
              <Link href="/scope/government" className="hover:text-gray-700 transition-colors">Government bans</Link>
              <Link href="/sources" className="hover:text-gray-700 transition-colors">Sources</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
