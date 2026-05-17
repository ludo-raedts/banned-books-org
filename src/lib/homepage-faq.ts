// Homepage FAQ — 10 editorial questions covering the "people also ask"
// patterns we expect for the banned-books topic. Data-driven values (total
// count, most-banned book) are passed in so the homepage's existing
// fetches are reused — this file does no DB calls of its own.
//
// Answers use markdown-lite for inline links — see FaqAccordion's
// renderAnswer() for the syntax.

import type { FaqItem } from '@/components/faq-accordion'

const BOOKSHOP_AFFILIATE_URL = 'https://bookshop.org/shop/banned-books-org'

export type HomepageFaqInputs = {
  total: number
  countryCount: number
  mostBannedBook: {
    title: string
    author: string
    slug: string
    banCount: number
    countryCount: number
  } | null
}

export function buildHomepageFaq({
  total,
  countryCount,
  mostBannedBook,
}: HomepageFaqInputs): FaqItem[] {
  const items: FaqItem[] = []

  items.push({
    q: 'How many books are banned worldwide?',
    a: `We document ${total.toLocaleString('en')} bans across ${countryCount} countries. The real total is higher — closed societies systematically under-report, and historical bans often go unrecorded. Every entry in our catalogue traces to a verifiable source.`,
  })

  items.push({
    q: 'Who bans books?',
    a: 'Governments, school boards, libraries, courts, and religious authorities — it varies by jurisdiction. School-board removals dominate the US data; national-government bans dominate the data from authoritarian states. See [the reasons taxonomy](/reasons) for the patterns we track.',
  })

  items.push({
    q: 'Is it legal to read a banned book?',
    a: "In most democracies, yes — bans target distribution and sale, not private reading. But possession is criminalised under blasphemy and national-security laws in several countries we track. Always check local law before traveling with a sensitive title, and never assume safety based on what's legal at home.",
  })

  items.push({
    q: 'Can I buy banned books?',
    a: `Almost always somewhere — a book banned in one country is usually in print elsewhere. We link to [Bookshop.org](${BOOKSHOP_AFFILIATE_URL}) for purchases that support independent bookstores, and never to Amazon ([why](/why-not-amazon)). Availability and shipping depend on your jurisdiction.`,
  })

  if (mostBannedBook) {
    items.push({
      q: 'What is the most banned book in the world?',
      a: `[${mostBannedBook.title}](/books/${mostBannedBook.slug}) by ${mostBannedBook.author} — ${mostBannedBook.banCount} documented bans across ${mostBannedBook.countryCount} countries. See the [full top 100](/top-100-banned-books) for the rest of the ranking.`,
    })
  }

  items.push({
    q: 'Why is the United States so prominent in your data?',
    a: "Two reasons. First, US school-board challenges are tracked and published by PEN America, the American Library Association, and EveryLibrary — no comparable infrastructure exists in most other countries. Second, the 2020s have seen a real, unprecedented surge in US school bans. We don't claim the US bans more books than China or Iran; we claim the US data is more visible. See [methodology](/methodology) for the full disclaimer.",
  })

  items.push({
    q: 'Where does this data come from?',
    a: 'Every entry traces back to a verifiable source: court records, school-board minutes, news reports, and NGO databases (PEN America, Index on Censorship, ALA, NCAC, Freedom to Read Canada). See [our sources page](/sources) for the full list.',
  })

  items.push({
    q: 'Is banned-books.org affiliated with PEN America or the ALA?',
    a: "No. This is an independent project, not affiliated with any advocacy group. We cite their data; they don't run us. Editorial choices about scope and inclusion are our own — see [what we document](/essays/what-we-document).",
  })

  items.push({
    q: 'Can I download the full dataset?',
    a: 'Yes — a structured CSV/JSON dataset is available via [our dataset page](/dataset). Used by researchers, journalists, educators, and policy analysts. The download includes books, bans, sources, countries, and reasons with stable IDs you can join across exports.',
  })

  items.push({
    q: 'How can I report a missing ban or a correction?',
    a: 'Email contact@banned-books.org with a source link (court filing, news report, school-board minutes, NGO record). We add new bans weekly and correct existing entries when better sources surface.',
  })

  return items
}
