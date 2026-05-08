import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import type { ContentBlockRow } from '@/lib/content-blocks'
import ContentBlockEditClient from './content-block-edit-client'

export const dynamic = 'force-dynamic'

export default async function AdminContentBlockEditPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { data } = await adminClient()
    .from('content_blocks')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!data) notFound()

  return <ContentBlockEditClient block={data as ContentBlockRow} />
}
