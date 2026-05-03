import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const HOSTS_FILE = join(process.cwd(), 'src/lib/allowed-image-hosts.ts')

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  if (!secret || session !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  // Extract existing hostnames from the array
  const matches = [...content.matchAll(/'([^']+)'/g)].map(m => m[1])
  if (matches.includes(hostname)) {
    return NextResponse.json({ ok: true, added: false, message: 'Already present' })
  }

  // Append new hostname before the closing bracket
  const updated = content.replace(/(\s*\]\s*\n?)$/, `  '${hostname}',\n]\n`)
  writeFileSync(HOSTS_FILE, updated, 'utf-8')

  return NextResponse.json({ ok: true, added: true })
}
