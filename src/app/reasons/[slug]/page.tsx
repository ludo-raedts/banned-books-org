export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Image from 'next/image'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import ReasonBadge, { reasonLabel, reasonIcon } from '@/components/reason-badge'
import GenreBadge from '@/components/genre-badge'

const REASON_INTROS: Record<string, string> = {
  lgbtq: 'LGBTQ+ content has become the primary driver of book challenges in American schools since 2020, with the American Library Association reporting it as the most cited reason in its annual challenged books survey. Titles featuring same-sex relationships, transgender characters, or frank depictions of queer identity have been removed from school libraries at record rates. Internationally, the picture is darker still: in dozens of countries, books with LGBTQ+ themes are subject to outright government bans under laws criminalizing "homosexual propaganda" or "immoral content."',
  political: 'Political censorship predates the printing press: Socrates was executed in 399 BCE for his ideas. Books that challenge state authority, document government atrocities, or advocate for dissident ideologies have been burned, banned, and confiscated by governments of every stripe — Communist, Fascist, theocratic, and democratic. The titles in this category include some of the most important works of the 20th century, silenced precisely because they told the truth.',
  religious: 'The Catholic Church\'s Index Librorum Prohibitorum, maintained from 1559 to 1966, included Galileo, Copernicus, Descartes, Locke, Voltaire, and Hume — essentially the entire intellectual foundation of the modern world. Religious censorship remains active: blasphemy laws are still enforceable in over 70 countries, and the 1989 fatwa against Salman Rushdie demonstrated that a religious edict could make an author a global fugitive. Books in this category threatened not just faith, but the institutional power structures that depended on it.',
  sexual: 'Sexual content was the dominant censorship pretext of the 19th and 20th centuries. Flaubert was tried in France for Madame Bovary (1856); Lawrence was prosecuted in Britain for Lady Chatterley\'s Lover (1928); Miller\'s Tropic of Cancer was banned in the US until 1961; Nabokov\'s Lolita circulated in a grey zone for years. Many of the most celebrated works of world literature were first encountered by their audiences as contraband. The books listed here were prosecuted — and are now in print everywhere.',
  violence: 'Depictions of violence have been used as a pretext for banning books by school boards wary of disturbing content, and by authoritarian governments seeking to suppress accounts of their own atrocities. The same passage that gets a young adult novel challenged at a Texas school board might, in a different context, be the reason a dissident writer\'s memoir is confiscated at an airport.',
  racial: 'Books that deal honestly with race — using historical slurs, depicting racism, or centering the experience of marginalized communities — face challenges from multiple directions. Huckleberry Finn has been challenged for its language by communities who object to the slur it uses; works by Black authors have been removed for making white students uncomfortable. The US school ban wave of the 2020s has a pronounced racial dimension, with books by and about people of color disproportionately targeted.',
  drugs: 'Drug use as a topic has been used to ban books both as a moral objection (particularly in books aimed at young readers) and as a pretext to suppress politically inconvenient authors. William S. Burroughs\'s Naked Lunch — depicting heroin addiction — was prosecuted in multiple countries. Today, the category primarily appears in US school challenges targeting young adult fiction that deals honestly with addiction.',
  obscenity: 'Obscenity as a legal standard has been notoriously difficult to define — the US Supreme Court\'s "I know it when I see it" formulation captures the problem. The Obscene Publications Act (UK, 1857) and the Comstock Act (US, 1873) gave authorities sweeping powers that were used not just against pornography but against serious literary works. The landmark 1960 Lady Chatterley trial in Britain, in which the jury acquitted Penguin Books, effectively ended literary obscenity prosecutions in the English-speaking world.',
  blasphemy: 'Blasphemy charges target works deemed offensive to religion. The most widely known modern case is the 1989 fatwa issued by Ayatollah Khomeini against Salman Rushdie for The Satanic Verses, which forced Rushdie underground for nearly a decade. But blasphemy prosecutions predate Islam: the Catholic Inquisition burned Giordano Bruno at the stake in 1600 for heretical cosmological views. Today blasphemy remains a criminal offense in over 70 countries.',
  moral: 'Broad moral grounds — "indecent," "corrupting to youth," "contrary to public morals" — have historically served as catch-all categories for banning books that challenged prevailing social norms. Ireland\'s Censorship Board, operating under the 1929 Censorship of Publications Act, banned thousands of books on these grounds, including works by the country\'s most celebrated authors.',
  language: 'Language bans target books written in suppressed minority languages as instruments of cultural oppression. The Russian Empire banned Ukrainian-language publications in 1863 and again in 1876. Stalin\'s USSR suppressed dozens of Soviet minority languages. Spain\'s Franco regime restricted Catalan, Basque, and Galician publishing. To ban a language is to attempt to erase a culture.',
  other: 'Some censorship acts resist categorization. Books have been banned for defaming a head of state, revealing state secrets, causing public disorder, or simply because the author was inconvenient. The "other" category documents the creative range of pretexts authorities have used when the standard justifications didn\'t apply.',
}

type Book = {
  id: number; title: string; slug: string; cover_url: string | null
  description: string | null; first_published_year: number | null; genres: string[]
  book_authors: { authors: { display_name: string } | null }[]
  bans: { id: number; status: string; country_code: string; countries: { name_en: string } | null; ban_reason_links: { reasons: { slug: string } | null }[] }[]
}

function authorName(book: Book) {
  return book.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', ')
}

function countryFlag(code: string): string {
  if (['SU', 'CS', 'DD', 'YU'].includes(code)) return '🚩'
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)
  ).join('')
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const label = reasonLabel(slug)
  const icon = reasonIcon(slug)
  return {
    title: `${icon} ${label} — Books Banned for ${label} Content`,
    description: `Browse books banned or challenged for ${label.toLowerCase()} content. ${REASON_INTROS[slug]?.slice(0, 120) ?? ''}`,
    alternates: { canonical: `/reasons/${slug}` },
  }
}

export default async function ReasonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const label = reasonLabel(slug)
  if (!label || label === slug) notFound()

  const supabase = adminClient()

  const { data: reason } = await supabase.from('reasons').select('id, slug').eq('slug', slug).single()
  if (!reason) notFound()

  const { data: banLinks } = await supabase
    .from('ban_reason_links')
    .select('ban_id, bans(book_id)')
    .eq('reason_id', reason.id)

  const bookIds = [...new Set(
    (banLinks ?? []).map(bl => (bl.bans as any)?.book_id).filter(Boolean)
  )]

  let books: Book[] = []
  if (bookIds.length > 0) {
    const { data } = await supabase
      .from('books')
      .select(`
        id, title, slug, cover_url, description, first_published_year, genres,
        book_authors(authors(display_name)),
        bans(id, status, country_code, countries(name_en), ban_reason_links(reasons(slug)))
      `)
      .in('id', bookIds)
      .order('title')
    books = (data as unknown as Book[]) ?? []
  }

  const totalBans = books.reduce((sum, b) => sum + b.bans.length, 0)
  const activeBans = books.reduce((sum, b) => sum + b.bans.filter(bn => bn.status === 'active').length, 0)
  const countries = [...new Set(books.flatMap(b => b.bans.map(bn => bn.country_code)))].length

  const intro = REASON_INTROS[slug]

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/reasons" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-8 transition-colors">
        ← All reasons
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl" aria-hidden="true">{reasonIcon(slug)}</span>
          <h1 className="text-3xl font-bold tracking-tight">{label}</h1>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 mt-2 mb-5">
          <span className="font-medium text-red-500 dark:text-red-400">{books.length} books</span>
          <span>{totalBans} bans across {countries} countries</span>
          {activeBans > 0 && <span>{activeBans} currently active</span>}
        </div>
        {intro && (
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed max-w-2xl text-sm">{intro}</p>
        )}
      </div>

      {books.length === 0 ? (
        <p className="text-gray-500">No books recorded for this reason yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {books.map(book => {
            const activeBanList = book.bans.filter(b => b.status === 'active')
            const displayBans = activeBanList.length > 0 ? activeBanList : book.bans.slice(0, 3)
            return (
              <Link key={book.id} href={`/books/${book.slug}`} className="group flex flex-col">
                <div className="mb-2">
                  {book.cover_url ? (
                    <Image src={book.cover_url} alt={`Cover of ${book.title}`} width={160} height={240}
                      className="rounded shadow-sm object-cover w-full" sizes="160px" />
                  ) : (
                    <BookCoverPlaceholder title={book.title} author={authorName(book)} slug={book.slug} />
                  )}
                </div>
                <h3 className="text-sm font-semibold leading-snug group-hover:underline">{book.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{authorName(book)}</p>
                <div className="flex flex-wrap gap-0.5 mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  {displayBans.slice(0, 4).map(b => (
                    <span key={b.id} title={b.countries?.name_en}>{countryFlag(b.country_code)}</span>
                  ))}
                  {book.bans.length > 4 && <span>+{book.bans.length - 4}</span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {book.genres.slice(0, 2).map(g => <GenreBadge key={g} slug={g} />)}
                  <ReasonBadge slug={slug} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
