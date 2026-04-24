import Link from 'next/link'

export const metadata = {
  title: 'Sources — Banned Books',
  description: 'Data sources used to build the Banned Books catalogue.',
}

const SOURCES = [
  {
    name: 'Wikipedia',
    url: 'https://wikipedia.org',
    description:
      'Ban records, dates, and country-level context are sourced from Wikipedia articles on individual books and censorship events. Each ban entry links to the relevant Wikipedia article.',
  },
  {
    name: 'Open Library',
    url: 'https://openlibrary.org',
    description:
      'Book cover images and descriptions are fetched from the Open Library API (openlibrary.org), a project of the Internet Archive. Open Library data is published under a CC0 public domain dedication.',
  },
]

export default function SourcesPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors">
        ← All books
      </Link>

      <h1 className="text-3xl font-bold tracking-tight mb-2">Sources</h1>
      <p className="text-gray-500 text-sm mb-10">
        This catalogue is built on publicly available data. Below are the primary sources we use.
      </p>

      <div className="flex flex-col gap-6">
        {SOURCES.map((source) => (
          <div key={source.name} className="border rounded-xl p-6">
            <div className="flex items-baseline justify-between gap-4 mb-2">
              <h2 className="text-lg font-semibold">{source.name}</h2>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline shrink-0"
              >
                {source.url.replace('https://', '')}
              </a>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{source.description}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-xs text-gray-400 leading-relaxed">
        If you spot an error or want to suggest a source, please{' '}
        <a
          href="https://github.com/ludo-raedts/banned-books-org/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-600"
        >
          open an issue on GitHub
        </a>
        .
      </p>
    </main>
  )
}
