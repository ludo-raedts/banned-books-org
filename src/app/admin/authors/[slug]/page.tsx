import { adminClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import AdminBackLink from '@/components/admin-back-link'
import AuthorEditClient from './author-edit-client'

export const dynamic = 'force-dynamic'

export type AuthorEditData = {
  id: number
  slug: string
  display_name: string
  bio: string | null
  birth_year: number | null
  death_year: number | null
  birth_country: string | null
  photo_url: string | null
  ban_count: number
}

export default async function AdminAuthorEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = adminClient()

  const { data, error } = await supabase
    .from('authors')
    .select(`
      id, slug, display_name, bio, birth_year, death_year, birth_country, photo_url,
      book_authors(books(bans(id)))
    `)
    .eq('slug', slug)
    .single()

  if (error || !data) notFound()

  const raw = data as unknown as {
    id: number
    slug: string
    display_name: string
    bio: string | null
    birth_year: number | null
    death_year: number | null
    birth_country: string | null
    photo_url: string | null
    book_authors: Array<{ books: { bans: Array<{ id: number }> } | null }>
  }

  // Count total bans across all books by this author
  let ban_count = 0
  for (const ba of raw.book_authors) {
    ban_count += ba.books?.bans?.length ?? 0
  }

  const author: AuthorEditData = {
    id: raw.id,
    slug: raw.slug,
    display_name: raw.display_name,
    bio: raw.bio,
    birth_year: raw.birth_year,
    death_year: raw.death_year,
    birth_country: raw.birth_country,
    photo_url: raw.photo_url,
    ban_count,
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold leading-snug">{author.display_name}</h1>
        <AdminBackLink href="/admin/authors" label="All authors" />
      </div>
      <AuthorEditClient author={author} />
    </main>
  )
}
