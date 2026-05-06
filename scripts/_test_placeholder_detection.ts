/**
 * Tests for the Google Books placeholder detector.
 *
 *   1. The known placeholder URL (Google Books id=5HFlswEACAAJ) → rejected
 *   2. A known real Open Library cover                           → accepted
 *   3. Sanity: hashing the local placeholder file gives distance 0 to itself
 *
 * Run:
 *   npx tsx scripts/_test_placeholder_detection.ts
 *
 * Exit code is 0 on all-pass, 1 on any failure.
 */

import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import phash from 'sharp-phash'
import distance from 'sharp-phash/distance'
import {
  checkImageUrl,
  getPlaceholderHash,
  PLACEHOLDER_HAMMING_THRESHOLD,
} from './lib/placeholder'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PLACEHOLDER_PATH = path.resolve(__dirname, '../assets/google-books-placeholder.png')

const PLACEHOLDER_URL  = 'https://books.google.com/books/content?id=5HFlswEACAAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'
// Stable Open Library cover for Orwell's "1984" — a real book jacket.
const KNOWN_GOOD_URL   = 'https://covers.openlibrary.org/b/id/8231856-L.jpg'

type Result = { name: string; ok: boolean; detail: string }

async function run() {
  const results: Result[] = []
  const placeholderHash = await getPlaceholderHash()
  console.log(`Placeholder hash: ${placeholderHash}`)
  console.log(`Threshold:        Hamming <= ${PLACEHOLDER_HAMMING_THRESHOLD}\n`)

  // --- Test 1: placeholder URL must be rejected ---
  {
    const name = 'Placeholder URL is rejected'
    const check = await checkImageUrl(PLACEHOLDER_URL)
    if (check.ok === false && check.reason === 'placeholder') {
      results.push({ name, ok: true, detail: `distance=${check.hammingDistance}` })
    } else if (check.ok === false) {
      results.push({ name, ok: false, detail: `unexpected reason="${check.reason}" detail=${('detail' in check) ? check.detail : ''}` })
    } else {
      results.push({ name, ok: false, detail: `accepted (distance=${check.hammingDistance}) — should have rejected` })
    }
  }

  // --- Test 2: known real cover must be accepted ---
  {
    const name = 'Known-good cover URL is accepted'
    const check = await checkImageUrl(KNOWN_GOOD_URL)
    if (check.ok === true) {
      results.push({ name, ok: true, detail: `distance=${check.hammingDistance}` })
    } else if (check.reason === 'placeholder') {
      results.push({ name, ok: false, detail: `wrongly classified as placeholder (distance=${check.hammingDistance})` })
    } else {
      results.push({ name, ok: false, detail: `network/decoding error: reason=${check.reason} ${'detail' in check ? check.detail : ''}` })
    }
  }

  // --- Test 3: local fixture sanity check ---
  {
    const name = 'Local placeholder file matches itself (distance 0)'
    const buf = await fs.readFile(PLACEHOLDER_PATH)
    const localHash = await phash(buf)
    const dist = distance(localHash, placeholderHash)
    if (dist === 0) {
      results.push({ name, ok: true, detail: `distance=0 hash=${localHash}` })
    } else {
      results.push({ name, ok: false, detail: `distance=${dist} (expected 0)` })
    }
  }

  console.log('── Results ──')
  for (const r of results) {
    const tag = r.ok ? '✓' : '✗'
    console.log(`${tag} ${r.name}  ${r.detail}`)
  }

  const failed = results.filter(r => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch(e => { console.error(e); process.exit(1) })
