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

export const metadata: Metadata = {
  title: "Banned Books",
  description: "An international catalogue of books banned by governments and schools.",
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
          <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between text-xs text-gray-400">
            <span>Banned Books — an open catalogue of censored literature</span>
            <Link href="/sources" className="hover:text-gray-700 transition-colors">
              Sources
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
