#!/usr/bin/env tsx
// Detect duplicate series VOLUMES: same author, same series name, same volume
// number, written differently — "Attack on Titan 10" / "Attack on Titan, Vol 10"
// / "Attack on Titan. 10". The TXFTRP import (2026-11-03) minted up to three
// rows per manga volume this way; _audit_same_author_title_dupes.ts misses
// them (the titles differ after normalisation). Read-only: writes a merge
// worklist for merge-paren-suffix-dupes.ts (--file=data/volume-dupes.json).
//
// Guard: when the text AFTER the volume number differs between rows ("Vol. 3:
// Haunted America Part 1" vs "Part 2", Naruto subtitles) or names an edition
// ("(Spanish Edition)"), the group is only printed as FLAGGED, never paired.
// KEEP = the row whose title has the ", Vol. N" form, then most bans, then
// lowest id.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/_audit_volume_dupes.ts
//   npx tsx --env-file=.env.local scripts/_audit_volume_dupes.ts --ids-file=data/txftrp/book-ids.json
//     (only groups that contain one of these ids; KEEP prefers rows outside the list)
//   npx tsx --env-file=.env.local scripts/merge-paren-suffix-dupes.ts --file=data/volume-dupes.json [--apply]

import { writeFileSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { idsFlag } from './lib/cli'

const OUT = 'data/volume-dupes.json'
const scope = idsFlag()
const scoped = new Set<number>(scope ?? [])

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim()
// base + volume number + rest; the vol/volume/book/no/part/# marker is optional
const RE = /^(.*?)[\s,.:;(\-]*(?:\b(?:vol(?:ume)?|book|no|part)\b\.?|#)?\s*(\d{1,3})\b(.*)$/i
const volForm = (t: string) => (/,\s*vol\.?\s*\d/i.test(t) ? 0 : 1)

type Row = { id: number; title: string; bans: number; au: string; rest: string }

;(async () => {
  const c = await newPgClient()
  await c.connect()
  const rows = (await c.query(`
    select b.id::int id, b.title, (select count(*) from bans where book_id = b.id)::int bans,
           string_agg(ba.author_id::text, ',' order by ba.author_id) au
    from books b join book_authors ba on ba.book_id = b.id
    where b.is_blanket_works = false
    group by b.id`)).rows as Omit<Row, 'rest'>[]
  await c.end()

  const groups = new Map<string, Row[]>()
  for (const r of rows) {
    const m = r.title.match(RE)
    if (!m) continue
    const base = norm(m[1]).replace(/\b(the|vol|volume|book)\b/g, ' ').replace(/\s+/g, ' ').trim()
    if (base.length < 3) continue
    const rest = norm(m[3].replace(/^[\s,.:;)\-]+/, ''))
      .replace(/\b(d gray man book \d+|d gray man \d+)\b/, '').trim()
    const key = `${r.au}|${base}|${Number(m[2])}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ ...r, rest })
  }

  const pairs: object[] = []
  const flagged: string[] = []
  for (const [key, g] of groups) {
    if (g.length < 2 || (scope && !g.some(r => scoped.has(r.id)))) continue
    // Differing subtitles, or a translated/special edition ("(Spanish Edition)"):
    // translations go through merge-cross-language-dupes.ts, not this path.
    if (new Set(g.map(r => r.rest).filter(Boolean)).size > 1 || g.some(r => /\bedition\b/.test(r.rest))) {
      flagged.push(g.map(r => `#${r.id} ${r.title}`).join(' | '))
      continue
    }
    g.sort((a, b) => (+scoped.has(a.id)) - (+scoped.has(b.id)) || volForm(a.title) - volForm(b.title)
      || b.bans - a.bans || a.id - b.id)
    const [keep, ...drops] = g
    for (const d of drops) {
      pairs.push({
        keep: keep.id, drop: d.id, keep_title: keep.title, drop_title: d.title, confidence: 'high',
        reasons: [`same author + series + volume (${key.split('|').slice(1).join(' #')})`], flags: [],
      })
      console.log(`  #${keep.id} "${keep.title}"  <=  #${d.id} "${d.title}"`)
    }
  }
  writeFileSync(OUT, JSON.stringify(pairs, null, 1) + '\n')
  console.log(`\nPairs: ${pairs.length} → ${OUT}`)
  if (flagged.length) {
    console.log(`FLAGGED (different text after the volume number — review, not paired): ${flagged.length}`)
    for (const f of flagged) console.log(`  ${f}`)
  }
})()
