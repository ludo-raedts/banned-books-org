async function getRestSummary(title: string) {
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
  const data = await res.json() as { extract?: string }
  return data.extract ?? ''
}

async function main() {
  for (const t of ['Animal Farm', 'Nineteen Eighty-Four', 'The Da Vinci Code']) {
    const s = await getRestSummary(t)
    const hasBan = /\b(ban|censor|challeng|prohibit|restrict|forbid|suppress)\b/i.test(s)
    console.log(`\n=== ${t} (hasBan:${hasBan}) ===`)
    console.log(s.slice(0, 500))
  }
  
  // Mein Kampf: check what index the "Current availability" is (it's section 13)
  // Let's try fetching it with "availab" keyword
  console.log('\n=== Mein Kampf - Current availability text (13) first 600 ===')
  const res = await fetch('https://en.wikipedia.org/w/api.php?action=parse&page=Mein%20Kampf&prop=text&section=13&format=json')
  const data = await res.json() as { parse?: { text?: { '*': string } } }
  const html = data.parse?.text?.['*'] ?? ''
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\[edit\]/gi, '').replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ').trim()
  console.log(text.slice(0, 800))
}
main().catch(console.error)
