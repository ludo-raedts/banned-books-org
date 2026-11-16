import type { NextRequest } from 'next/server'
import { existsSync, statSync, createReadStream } from 'node:fs'
import { join } from 'node:path'
import { adminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ZIP_PATH = join(process.cwd(), 'private', 'dataset.zip')
const DOWNLOAD_FILENAME = 'banned-books-dataset.zip'
const MAX_DOWNLOADS = 20

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return new Response('Missing token', { status: 400 })
  }

  const supabase = adminClient()

  const { data: order, error } = await supabase
    .from('dataset_orders')
    .select('id, download_token_expires_at, downloads_count')
    .eq('download_token', token)
    .single()

  if (error || !order) {
    return new Response('Invalid or expired download link', { status: 404 })
  }

  if (order.download_token_expires_at && new Date(order.download_token_expires_at) < new Date()) {
    return new Response('This download link has expired. Contact support to renew.', { status: 410 })
  }

  // A paid link is for the buyer; a leaked/shared one would otherwise stream the
  // full zip unlimited times for 30 days. Generous enough for retries and
  // re-downloads on a new device.
  if (order.downloads_count >= MAX_DOWNLOADS) {
    return new Response('This download link has reached its download limit. Contact support to renew.', { status: 429 })
  }

  if (!existsSync(ZIP_PATH)) {
    console.error('[download] dataset.zip missing at', ZIP_PATH)
    return new Response(
      'The dataset is being rebuilt and will be available again shortly. Please try again in a few minutes.',
      { status: 503 },
    )
  }

  // Best-effort accounting; never block the download on this. Compare-and-swap
  // on the count we read, so two concurrent downloads can't both write n+1.
  void supabase
    .from('dataset_orders')
    .update({
      downloads_count: order.downloads_count + 1,
      last_downloaded_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .eq('downloads_count', order.downloads_count)
    .select('id')
    .then(({ data, error: updateError }) => {
      if (updateError) console.error('[download] update failed', updateError)
      else if (!data?.length) console.warn('[download] concurrent download, count not bumped', order.id)
    })

  const stat = statSync(ZIP_PATH)
  const stream = createReadStream(ZIP_PATH)

  return new Response(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${DOWNLOAD_FILENAME}"`,
      'Content-Length': String(stat.size),
      'Cache-Control': 'no-store',
    },
  })
}
