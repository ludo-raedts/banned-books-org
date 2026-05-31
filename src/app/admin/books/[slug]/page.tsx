import { adminClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import AdminBackLink from '@/components/admin-back-link'
import BookEditClient from './book-edit-client'

export const dynamic = 'force-dynamic'

export type WarningLevel = 'none' | 'context' | 'extended'

export type BookEditData = {
  id: number
  slug: string
  title: string
  title_native: string | null
  title_native_script: string | null
  title_transliterated: string | null
  title_english_meaningful: string | null
  cover_url: string | null
  first_published_year: number | null
  genres: string[]
  description_book: string | null
  description_ban: string | null
  censorship_context: string | null
  ai_drafted: boolean | null
  warning_level: WarningLevel
  inclusion_rationale: string | null
  extended_context: string | null
  isbn13: string | null
  openlibrary_work_id: string | null
  ban_count: number
  ban_countries: string
}

export default async function AdminBookEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = adminClient()

  const { data, error } = await supabase
    .from('books')
    .select(`
      id, slug, title,
      title_native, title_native_script, title_transliterated, title_english_meaningful,
      cover_url, first_published_year, genres,
      description_book, description_ban, censorship_context,
      ai_drafted, warning_level, inclusion_rationale, extended_context,
      isbn13, openlibrary_work_id,
      bans(id, country_code)
    `)
    .eq('slug', slug)
    .single()

  if (error || !data) notFound()

  const raw = data as unknown as {
    id: number; slug: string; title: string
    title_native: string | null; title_native_script: string | null
    title_transliterated: string | null; title_english_meaningful: string | null
    cover_url: string | null
    first_published_year: number | null; genres: string[]
    description_book: string | null; description_ban: string | null
    censorship_context: string | null; ai_drafted: boolean | null
    warning_level: WarningLevel | null
    inclusion_rationale: string | null
    extended_context: string | null
    isbn13: string | null; openlibrary_work_id: string | null
    bans: Array<{ id: number; country_code: string }>
  }

  const countries = [...new Set(raw.bans.map(b => b.country_code))].sort().join(', ')

  const book: BookEditData = {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    title_native: raw.title_native,
    title_native_script: raw.title_native_script,
    title_transliterated: raw.title_transliterated,
    title_english_meaningful: raw.title_english_meaningful,
    cover_url: raw.cover_url,
    first_published_year: raw.first_published_year,
    genres: raw.genres ?? [],
    description_book: raw.description_book,
    description_ban: raw.description_ban,
    censorship_context: raw.censorship_context,
    ai_drafted: raw.ai_drafted,
    warning_level: (raw.warning_level ?? 'none') as WarningLevel,
    inclusion_rationale: raw.inclusion_rationale,
    extended_context: raw.extended_context,
    isbn13: raw.isbn13,
    openlibrary_work_id: raw.openlibrary_work_id,
    ban_count: raw.bans.length,
    ban_countries: countries,
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold leading-snug">{book.title}</h1>
        <AdminBackLink href="/admin/books" label="All books" />
      </div>
      <BookEditClient book={book} />
    </main>
  )
}
