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
 *   { tag: string }
 *     - revalidates any data tagged with this tag
 *
 * Returns: { revalidated: true, path?: string, tag?: string, now: number }
 */
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'

type Body = {
  path?: string
  type?: 'page' | 'layout'
  tag?: string
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  if (!secret || session !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { path, type, tag } = body

  if (!path && !tag) {
    return NextResponse.json(
      { error: 'Provide either `path` or `tag` in the body' },
      { status: 400 },
    )
  }

  if (path && tag) {
    return NextResponse.json(
      { error: 'Provide only one of `path` or `tag`, not both' },
      { status: 400 },
    )
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
