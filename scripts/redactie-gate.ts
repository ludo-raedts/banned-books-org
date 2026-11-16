/**
 * Mechanical fact gate for redactie drafts (data/redactie/drafts/<slug>.json vs packs/<slug>.json). Read-only.
 * FAIL: number or capitalised name not in the pack; a 4-digit year of the current text missing; word count outside 15–160;
 *       padding phrase; 'banned' used while the pack never says banned. WARN: measure-word drift, lost hedge, >25% 5-gram overlap with another draft.
 */
import { promises as fs } from 'node:fs'
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3)
const norm = (s: string) => s.toLowerCase().replace(/[‘’'`´]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ')
const PAD = ['it is worth noting', 'broader trend', 'sparked debate', 'sparked controversy', 'continues to resonate', 'remains relevant', 'in today\'s world', 'serves as a reminder', 'this reflects', 'a testament to', 'raises important questions']
const SKIP = new Set(['In', 'On', 'The', 'A', 'An', 'It', 'Its', 'He', 'She', 'They', 'After', 'Before', 'When', 'While', 'By', 'For', 'Of', 'At', 'To', 'As', 'From', 'That', 'This', 'These', 'Those', 'Copies', 'Some', 'Both', 'Later', 'Then', 'There', 'Despite', 'Since', 'Under', 'During', 'Also', 'Although', 'However', 'Today', 'Reported', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'])
async function main() {
  const slugs = arg('slugs')?.split(',').filter(Boolean) ?? (await fs.readdir('data/redactie/drafts')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))
  const drafts: Record<string, any> = {}; const grams = new Map<string, Set<string>>()
  for (const s of slugs) { try { drafts[s] = JSON.parse(await fs.readFile(`data/redactie/drafts/${s}.json`, 'utf8')) } catch { console.log('FAIL', s, 'no draft'); continue }
    const w = norm(drafts[s].text).replace(/[^a-z0-9' ]+/g, ' ').split(' ').filter(Boolean); const g = new Set<string>(); for (let i = 0; i + 5 <= w.length; i++) g.add(w.slice(i, i + 5).join(' ')); grams.set(s, g) }
  let fail = 0
  for (const s of Object.keys(drafts)) {
    const d = drafts[s]; const pack = JSON.parse(await fs.readFile(`data/redactie/packs/${s}.json`, 'utf8'))
    const facts = norm([pack.title, pack.author, pack.first_published_year, pack.current_text, ...(pack.sources ?? []).map((x: any) => x.quote), ...pack.ban_rows.map((r: any) => [r.country, r.year, r.end, r.note].join(' '))].join(' '))
    const issues: string[] = []; const warns: string[] = []
    const t = String(d.text ?? ''); const wc = t.split(/\s+/).filter(Boolean).length
    if (wc < 15 || wc > 160) issues.push(`length ${wc} words`)
    for (const n of t.match(/\b\d[\d,.]*\d\b|\b\d\b/g) ?? []) if (!facts.includes(n.replace(/,/g, ''))) issues.push(`number ${n} not in pack`)
    for (const w of new Set(t.match(/\b[A-Z][\p{L}-]{2,}\b/gu) ?? [])) if (!SKIP.has(w) && !facts.includes(norm(w))) issues.push(`name "${w}" not in pack`)
    for (const y of new Set(String(pack.current_text).match(/\b(1[0-9]{3}|20[0-9]{2})\b/g) ?? [])) if (!t.includes(y)) issues.push(`year ${y} of current text lost`)
    for (const p of PAD) if (norm(t).includes(p)) issues.push(`padding phrase "${p}"`)
    const cur = norm(pack.current_text); const nt = norm(t)
    if (/\bbanned\b/.test(nt) && !/\bban(ned|s)?\b/.test(facts)) issues.push('"banned" not supported by pack')
    for (const m of ['challenged', 'removed', 'restricted', 'prosecut', 'seiz', 'index']) if (cur.includes(m) && !nt.includes(m)) warns.push(`measure word "${m}" dropped`)
    for (const h of ['reported', 'no date', 'sources differ', 'not documented', 'unverified']) if (cur.includes(h) && !nt.includes(h)) warns.push(`hedge "${h}" dropped`)
    const mine = grams.get(s)!
    for (const [o, g] of grams) { if (o === s || !mine.size) continue; let c = 0; for (const x of mine) if (g.has(x)) c++; if (c / mine.size > 0.25) warns.push(`${Math.round(100 * c / mine.size)}% 5-gram overlap with ${o}`) }
    const verdict = issues.length ? 'FAIL' : warns.length ? 'WARN' : 'PASS'; if (issues.length) fail++
    console.log(verdict, s, issues.concat(warns).slice(0, 5).join(' | '))
  }
  process.exit(fail ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
