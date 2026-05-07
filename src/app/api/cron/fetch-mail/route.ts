import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { adminClient } from '@/lib/supabase'

export const maxDuration = 30

const PREVIEW_COUNT = 5
const SNIPPET_MAX = 140

function makeSnippet(text: string | undefined | null): string {
  if (!text) return ''
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= SNIPPET_MAX) return collapsed
  return collapsed.slice(0, SNIPPET_MAX - 1).trimEnd() + '…'
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const host = process.env.ZOHO_IMAP_HOST
  const user = process.env.ZOHO_IMAP_USER
  const pass = process.env.ZOHO_IMAP_PASS
  if (!host || !user || !pass) {
    return NextResponse.json({ error: 'IMAP env vars missing' }, { status: 500 })
  }

  const client = new ImapFlow({
    host,
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  })

  type Row = {
    uid: number
    from_name: string | null
    from_address: string | null
    subject: string | null
    snippet: string
    received_at: string | null
    is_unread: boolean
  }
  const rows: Row[] = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      const status = await client.status('INBOX', { messages: true })
      const total = status.messages ?? 0
      if (total > 0) {
        // Sequence range for the last PREVIEW_COUNT messages.
        const from = Math.max(1, total - PREVIEW_COUNT + 1)
        const range = `${from}:${total}`

        for await (const msg of client.fetch(range, {
          envelope: true,
          flags: true,
          source: true,
          uid: true,
        })) {
          const env = msg.envelope
          const fromEntry = env?.from?.[0]
          let snippet = ''
          if (msg.source) {
            try {
              const parsed = await simpleParser(msg.source)
              const html = typeof parsed.html === 'string' ? parsed.html : null
              snippet = makeSnippet(parsed.text ?? html?.replace(/<[^>]+>/g, ' '))
            } catch {
              snippet = ''
            }
          }
          rows.push({
            uid: Number(msg.uid),
            from_name: fromEntry?.name ?? null,
            from_address: fromEntry?.address ?? null,
            subject: env?.subject ?? null,
            snippet,
            received_at: env?.date ? new Date(env.date).toISOString() : null,
            is_unread: !msg.flags?.has('\\Seen'),
          })
        }
      }
    } finally {
      lock.release()
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'IMAP fetch failed' },
      { status: 502 },
    )
  } finally {
    try { await client.logout() } catch { /* already closed */ }
  }

  rows.sort((a, b) => {
    const da = a.received_at ? Date.parse(a.received_at) : 0
    const db = b.received_at ? Date.parse(b.received_at) : 0
    return db - da
  })

  const supabase = adminClient()
  // Replace strategy: wipe + insert. Five rows max — no need for upsert/diff.
  const { error: delErr } = await supabase.from('inbox_preview').delete().gte('id', 0)
  if (delErr) {
    return NextResponse.json({ error: `delete failed: ${delErr.message}` }, { status: 500 })
  }
  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('inbox_preview').insert(rows)
    if (insErr) {
      return NextResponse.json({ error: `insert failed: ${insErr.message}` }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, count: rows.length })
}
