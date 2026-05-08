import { Resend } from 'resend'

const FROM = process.env.EMAIL_FROM ?? 'Banned Books <onboarding@resend.dev>'
const REPLY_TO = process.env.EMAIL_REPLY_TO

let client: Resend | null = null
function getClient() {
  if (client) return client
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  client = new Resend(apiKey)
  return client
}

export type DownloadEmailParams = {
  to: string
  downloadUrl: string
  expiresAt: Date
  orderId: string
}

export async function sendDownloadEmail(params: DownloadEmailParams) {
  const resend = getClient()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping send')
    return { skipped: true as const }
  }

  const { to, downloadUrl, expiresAt, orderId } = params
  const expiresStr = expiresAt.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const subject = 'Your Banned Books dataset download'
  const text = [
    'Thanks for your purchase.',
    '',
    'Download your dataset here (valid until ' + expiresStr + '):',
    downloadUrl,
    '',
    'The link can be used multiple times. If you lose this email, the same link is also',
    'shown on the success page right after checkout.',
    '',
    'What you get:',
    '  · Books, bans, authors, countries, reasons (CSV + JSON)',
    '  · Single-file SQLite database with all relations',
    '  · README and license',
    '',
    'License: personal/research use only. Cite as "Banned Books',
    '(https://www.banned-books.org)". See LICENSE.txt in the archive for details.',
    '',
    'Need help? Reply to this email or visit',
    'https://www.banned-books.org/about#get-in-touch',
    '',
    `Order: ${orderId}`,
  ].join('\n')

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 24px auto; color: #1a1a1a; line-height: 1.5;">
  <h1 style="font-size: 22px; margin: 0 0 16px;">Your Banned Books dataset</h1>
  <p style="margin: 0 0 16px;">Thanks for your purchase.</p>
  <p style="margin: 0 0 24px;">
    <a href="${escapeHtml(downloadUrl)}"
       style="display: inline-block; background: #8b1a1a; color: white; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 600;">
      Download the dataset →
    </a>
  </p>
  <p style="font-size: 14px; color: #555; margin: 0 0 24px;">
    The link is valid until <strong>${escapeHtml(expiresStr)}</strong> and can be used multiple times.
    If you lose this email, the same link also appears on the confirmation page after checkout.
  </p>

  <h2 style="font-size: 15px; margin: 24px 0 8px;">What's in the archive</h2>
  <ul style="font-size: 14px; color: #333; padding-left: 18px; margin: 0 0 24px;">
    <li>Books, bans, authors, countries, reasons (CSV + JSON)</li>
    <li>Single-file SQLite database with all relations</li>
    <li>README and license</li>
  </ul>

  <h2 style="font-size: 15px; margin: 24px 0 8px;">License</h2>
  <p style="font-size: 14px; color: #555; margin: 0 0 24px;">
    Personal and research use only. Cite as
    &ldquo;Banned Books (https://www.banned-books.org)&rdquo;.
    See LICENSE.txt in the archive for details, or contact us for a redistribution license.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
  <p style="font-size: 13px; color: #888; margin: 0;">
    Need help? Reply to this email or use the
    <a href="https://www.banned-books.org/about#get-in-touch" style="color: #8b1a1a;">contact form</a>.
  </p>
  <p style="font-size: 11px; color: #aaa; margin: 8px 0 0;">Order ${escapeHtml(orderId)}</p>
</body></html>`

  try {
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject,
      text,
      html,
      ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
    })
    if (result.error) {
      console.error('[email] resend returned error', result.error)
      return { skipped: false as const, error: result.error.message }
    }
    return { skipped: false as const, id: result.data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[email] send failed', message)
    return { skipped: false as const, error: message }
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => (
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '"' ? '&quot;' : '&#39;'
  ))
}
