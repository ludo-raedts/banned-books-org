import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { adminClient } from '@/lib/supabase'

const PREVIEW_COUNT = 5
const SNIPPET_MAX = 140

function makeSnippet(text: string | undefined | null): string {
  if (!text) return ''
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= SNIPPET_MAX) return collapsed
  return collapsed.slice(0, SNIPPET_MAX - 1).trimEnd() + '…'
}

type SyncResult =
  | { ok: true; count: number }
  | { ok: false; status: number; error: string }

export async function syncInboxPreview(): Promise<SyncResult> {
  const host = process.env.ZOHO_IMAP_HOST
  const user = process.env.ZOHO_IMAP_USER
  const pass = process.env.ZOHO_IMAP_PASS
  if (!host || !user || !pass) {
    return { ok: false, status: 500, error: 'IMAP env vars missing (ZOHO_IMAP_HOST/USER/PASS)' }
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
    const e = err as { message?: string; code?: string; responseText?: string; authenticationFailed?: boolean }
    const parts = [
      e?.code,
      e?.message,
      e?.responseText,
    ].filter(Boolean) as string[]
    const detail = parts.length > 0 ? parts.join(' — ') : 'IMAP fetch failed'
    return { ok: false, status: 502, error: detail }
  } finally {
    try { await client.logout() } catch { /* already closed */ }
  }

  rows.sort((a, b) => {
    const da = a.received_at ? Date.parse(a.received_at) : 0
    const db = b.received_at ? Date.parse(b.received_at) : 0
    return db - da
  })

  const supabase = adminClient()
  const { error: delErr } = await supabase.from('inbox_preview').delete().gte('id', 0)
  if (delErr) {
    return { ok: false, status: 500, error: `delete failed: ${delErr.message}` }
  }
  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('inbox_preview').insert(rows)
    if (insErr) {
      return { ok: false, status: 500, error: `insert failed: ${insErr.message}` }
    }
  }

  return { ok: true, count: rows.length }
}
