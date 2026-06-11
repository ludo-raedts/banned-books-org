// One-off: strip all `dark:` Tailwind variant tokens from the codebase.
// Dark mode was dead code (no provider/toggle ever set the .dark class), so we
// remove the tokens entirely rather than leave them. Matches a `dark:` token
// only when preceded by whitespace/quote/backtick (so it can never touch a
// CSS var name like `--color-brand-dark:`, which is followed by a space and so
// never forms a `dark:<token>` match anyway). Keeps the leading delimiter;
// leftover extra spaces inside class lists are harmless.
import { promises as fs } from 'fs'
import path from 'path'

const DRY = process.env.DRY === '1'
const ONLY = process.env.ONLY // optional single-file preview

// Consume an optional single leading space so we don't leave double-spaces in
// class lists. `dark:` inside a CSS var like `--color-brand-dark:` is always
// followed by a space, so `[^\s"'`]+` (needs >=1 non-space) can never match it.
const TOKEN = /[ \t]?dark:[^\s"'`]+/g

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) await walk(p, out)
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(p)
  }
  return out
}

async function main() {
  const files = ONLY ? [ONLY] : await walk('src')
  let changedFiles = 0
  let removed = 0
  for (const f of files) {
    const orig = await fs.readFile(f, 'utf8')
    const next = orig.replace(TOKEN, () => {
      removed++
      return ''
    })
    if (next !== orig) {
      changedFiles++
      if (DRY) {
        // Show a few changed lines for inspection.
        const oLines = orig.split('\n')
        const nLines = next.split('\n')
        let shown = 0
        for (let i = 0; i < oLines.length && shown < 6; i++) {
          if (oLines[i] !== nLines[i]) {
            console.log(`  ${f}:${i + 1}`)
            console.log(`   - ${oLines[i].trim()}`)
            console.log(`   + ${nLines[i].trim()}`)
            shown++
          }
        }
      } else {
        await fs.writeFile(f, next)
      }
    }
  }
  console.log(`\n${DRY ? '[DRY] ' : ''}files changed: ${changedFiles}, dark: tokens removed: ${removed}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
