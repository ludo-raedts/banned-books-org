import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const HOSTS_FILE = join(process.cwd(), 'src/lib/allowed-image-hosts.ts')

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  // ALLOWED_IMAGE_HOSTS is a build-time constant: next.config.ts reads it to
  // build next/image's remotePatterns. Editing the source file at runtime can
  // never take effect without a redeploy, and Vercel's runtime filesystem is
  // read-only anyway. So this is a local-dev convenience only — in production
  // we tell the operator to add the host in code and deploy.
  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    return NextResponse.json({
      error:
        'The image-host allowlist is compiled at build time. Add the hostname to ' +
        'src/lib/allowed-image-hosts.ts and redeploy — it cannot be changed at runtime.',
    }, { status: 400 })
  }

  let body: { hostname?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const hostname = body.hostname?.trim().toLowerCase()
  if (!hostname || !/^[a-z0-9.-]+$/.test(hostname)) {
    return NextResponse.json({ error: 'Invalid hostname' }, { status: 400 })
  }

  const content = readFileSync(HOSTS_FILE, 'utf-8')

  // Direct substring check for the quoted hostname. (The old
  // /'([^']+)'/g extraction was broken: an apostrophe in a comment threw the
  // greedy match off, so dedup silently failed and hosts were added twice.)
  // hostname is validated to [a-z0-9.-] above, so it's safe to interpolate.
  if (content.includes(`'${hostname}'`)) {
    return NextResponse.json({ ok: true, added: false, message: 'Already present' })
  }

  // Insert right after the array's opening bracket. Anchoring on the opening
  // line is robust regardless of what follows the array (the isAllowedImageUrl
  // helper now lives below it, so the old end-of-file `]` anchor no longer
  // matched and silently no-op'd).
  const anchor = 'export const ALLOWED_IMAGE_HOSTS = [\n'
  if (!content.includes(anchor)) {
    return NextResponse.json({
      error: 'Could not locate ALLOWED_IMAGE_HOSTS array to update.',
    }, { status: 500 })
  }
  const updated = content.replace(anchor, `${anchor}  '${hostname}',\n`)
  writeFileSync(HOSTS_FILE, updated, 'utf-8')

  return NextResponse.json({ ok: true, added: true })
}
