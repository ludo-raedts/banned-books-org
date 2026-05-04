export const metadata = {
  title: 'Sources — Banned Books',
  description: 'Sources and methodology behind the Banned Books catalogue. Data drawn from PEN America, ALA, Wikipedia, and government records.',
  alternates: { canonical: '/sources' },
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
      'Book cover images and descriptions are fetched from the Open Library API, a project of the Internet Archive. Open Library data is published under a CC0 public domain dedication.',
  },
  {
    name: 'PEN America',
    url: 'https://pen.org',
    description:
      'PEN America tracks and publishes detailed data on book bans in the United States, including school and library challenges. Their Index of School Book Bans is one of the most comprehensive records of US educational censorship.',
  },
  {
    name: 'American Library Association (ALA)',
    url: 'https://www.ala.org',
    description:
      'The ALA\'s Office for Intellectual Freedom documents challenged and banned books across the United States. Their annual lists of the most frequently challenged books are a key reference for US school and library bans.',
  },
  {
    name: 'Reporters Without Borders (RSF)',
    url: 'https://rsf.org',
    description:
      'RSF monitors press and publishing freedom worldwide, including government-level book bans and censorship. Their annual World Press Freedom Index provides context for bans in authoritarian regimes.',
  },
  {
    name: 'Index on Censorship',
    url: 'https://www.indexoncensorship.org',
    description:
      'Index on Censorship is a UK-based organisation that publishes reports and case studies on censorship globally, including book bans and literary suppression across different political systems.',
  },
]

export default function SourcesPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="bg-brand-light dark:bg-brand-dark/10 border-l-4 border-brand pl-6 pr-4 py-6 mb-10 rounded-r-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-brand/70 dark:text-brand/60 mb-3">Reference</p>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Sources</h1>
        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
          This catalogue is built on publicly available data. Below are the primary sources we use.
        </p>
      </div>

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

      <div className="mt-10 border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-3">Data limitations</h2>
        <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex flex-col gap-3">
          <p>
            This catalogue is not a neutral global census of book bans — it is a record of what has
            been documented. Coverage is strongest for the United States, where PEN America and the ALA
            provide structured, annual data. It is weakest for closed authoritarian states, where
            censorship is pervasive but rarely reported through accessible channels.
          </p>
          <p>
            US bans are also structurally different: most are school-district removals — local
            administrative decisions — rather than national prohibitions. Each removal is counted
            separately, which inflates the US total relative to countries where a single government
            decree bans a book everywhere at once.
          </p>
          <p>
            Read the full explanation in our{' '}
            <a href="/methodology" className="underline hover:text-gray-800 dark:hover:text-gray-200">
              methodology essay
            </a>
            .
          </p>
        </div>
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
