// Cloudflare's "Email Address Obfuscation" (Scrape Shield) rewrites every
// e-mail address in the HTML we serve into `<a data-cfemail=…>[email protected]</a>`
// and injects email-decode.min.js. React then hydrates against the ORIGINAL
// text and throws React #418 (text mismatch) on every page that mentions an
// address — this was the console error Lighthouse flagged on /, /books/* and
// /countries/*. Cloudflare skips anything wrapped in <!--email_off--> …
// <!--/email_off-->; React cannot emit HTML comments from JSX, so the anchor
// is rendered through dangerouslySetInnerHTML (which React does not diff
// during hydration). Plain-text fallback keeps the address readable without
// JS and in the markdown twins.

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

export default function EmailLink({
  email,
  className,
}: {
  email: string
  className?: string
}) {
  const safe = escapeHtml(email)
  const cls = className ? ` class="${escapeHtml(className)}"` : ''
  const html = `<!--email_off--><a href="mailto:${safe}"${cls}>${safe}</a><!--/email_off-->`
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
