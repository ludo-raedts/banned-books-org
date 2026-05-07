import type { Metadata } from 'next'
import Link from 'next/link'
import EssayCard from '@/components/essay-card'
import { publishedEssays } from '@/lib/essays-data'

export const metadata: Metadata = {
  title: 'Essays — Banned Books',
  description:
    'Long-form pieces on censorship, what we document, and the editorial choices behind this catalogue.',
  alternates: { canonical: '/essays' },
}

export default function EssaysIndexPage() {
  const essays = publishedEssays()

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="inline-block text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-8"
      >
        ← Home
      </Link>

      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50 mb-3">
          Essays
        </h1>
        <p className="text-base text-gray-600 dark:text-gray-400 max-w-2xl">
          Long-form pieces about censorship — what we document, how the categories blur, and why
          the choices behind this catalogue are not neutral.
        </p>
      </header>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {essays.map(essay => (
          <li key={essay.slug}>
            <EssayCard essay={essay} />
          </li>
        ))}
      </ul>
    </main>
  )
}
