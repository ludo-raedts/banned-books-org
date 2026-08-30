/**
 * POST /api/admin/revalidate
 *
 * On-demand cache bust for ISR/Cache-Components routes. Use this after a
 * one-off DB rename, manual SQL fix, or any change that bypasses the normal
 * write paths (which already call revalidatePath / revalidateTag inline).
 *
 * Auth: same `admin_session` cookie + `ADMIN_SECRET` as the other admin
 * routes (see refresh-views/route.ts).
 *
 * Body (JSON):
 *   { path: string, type?: 'page' | 'layout' }
 *     - literal path (e.g. "/books/marka-e-somnath") — omit `type`
 *     - or route pattern (e.g. "/books/[slug]") — `type` is REQUIRED per
 *       Next 16 docs (node_modules/next/dist/docs/01-app/03-api-reference/
 *       04-functions/revalidatePath.md)
 *   { paths: string[] }
 *     - batch of LITERAL paths in one request. Batch scripts bust only the
 *       rows they actually changed (see scripts/lib/revalidate.ts), which is
 *       hundreds of paths per run — one POST each would be hundreds of
 *       round-trips. Route patterns are rejected here: a pattern invalidates
 *       the whole route, so it never belongs in a targeted batch.
 *   { tag: string }
 *     - revalidates any data tagged with this tag
 *
 * Returns: { revalidated: true, path?: string, count?: number, tag?: string, now: number }
 */
import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { revalidatePath, revalidateTag } from 'next/cache'

type Body = {
  path?: string
  paths?: string[]
  type?: 'page' | 'layout'
  tag?: string
}

// Bounds one request. Comfortably above a typical enrichment run's changed-row
// count; beyond this the caller should chunk (scripts/lib/revalidate.ts does).
const MAX_PATHS = 1000

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { path, paths, type, tag } = body

  const given = [path, paths, tag].filter(v => v !== undefined && v !== null).length
  if (given === 0) {
    return NextResponse.json(
      { error: 'Provide one of `path`, `paths` or `tag` in the body' },
      { status: 400 },
    )
  }
  if (given > 1) {
    return NextResponse.json(
      { error: 'Provide only one of `path`, `paths` or `tag`, not several' },
      { status: 400 },
    )
  }

  // Batch branch: literal paths only, so each entry busts exactly one page.
  if (paths) {
    if (!Array.isArray(paths) || paths.some(p => typeof p !== 'string')) {
      return NextResponse.json({ error: '`paths` must be an array of strings' }, { status: 400 })
    }
    if (paths.length === 0) {
      return NextResponse.json({ error: '`paths` must not be empty' }, { status: 400 })
    }
    if (paths.length > MAX_PATHS) {
      return NextResponse.json(
        { error: `\`paths\` exceeds ${MAX_PATHS} entries — send in chunks` },
        { status: 400 },
      )
    }
    const bad = paths.find(p => !p.startsWith('/') || p.length > 1024 || /\[.+\]/.test(p))
    if (bad !== undefined) {
      return NextResponse.json(
        { error: `Invalid path in \`paths\`: "${bad.slice(0, 80)}" — must be a literal path starting with "/" and under 1024 chars` },
        { status: 400 },
      )
    }
    // De-duplicate: an enrichment run often touches the same book twice.
    const unique = [...new Set(paths)]
    for (const p of unique) revalidatePath(p)
    return NextResponse.json({ revalidated: true, count: unique.length, now: Date.now() })
  }

  // Next 16: dynamic-segment paths REQUIRE the `type` parameter, literal
  // paths must OMIT it. Detect the bracket convention and validate.
  if (path) {
    const isDynamic = /\[.+\]/.test(path)
    if (isDynamic && !type) {
      return NextResponse.json(
        { error: `Path "${path}" contains a dynamic segment — \`type\` ('page' or 'layout') is required` },
        { status: 400 },
      )
    }
    if (!isDynamic && type) {
      return NextResponse.json(
        { error: `Literal path "${path}" must not include \`type\`` },
        { status: 400 },
      )
    }
    if (path.length > 1024) {
      return NextResponse.json({ error: 'Path exceeds 1024 chars' }, { status: 400 })
    }
  }

  if (path) {
    if (type) revalidatePath(path, type)
    else revalidatePath(path)
    return NextResponse.json({ revalidated: true, path, type, now: Date.now() })
  }

  // tag branch
  revalidateTag(tag as string, 'max')
  return NextResponse.json({ revalidated: true, tag, now: Date.now() })
}
