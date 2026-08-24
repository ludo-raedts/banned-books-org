/**
 * _fix_split_authors_rename_only_2026_08_24.ts
 *
 * Repairs the "rename-only" clusters surfaced by _audit_split_authors.ts, i.e.
 * books where every single-token author fragment belongs to that book alone.
 *
 * GROUNDING — every target name below comes from the row that produced the
 * fragments, not from memory:
 *   - 16 books: the author cell of the import source itself,
 *     https://en.wikipedia.org/wiki/Book_censorship_in_Hong_Kong#List_of_banned_books
 *     (e.g. "Davis, Deborah., Vogel, Ezra F." → Deborah Davis + Ezra F. Vogel),
 *     cross-checked against OpenLibrary where an ISBN exists.
 *   - book 6589 ("Zola — All works"): merges into the EXISTING author
 *     Émile Zola (#100) rather than minting a duplicate.
 *
 * NOT touched (false positives of the detector, reported instead):
 *   - the 24 Portugal/Estado-Novo clusters (b22610…b23393). Brandão's source
 *     prints co-authors as "Surname/Surname" and the importer split them
 *     CORRECTLY — they are two real people each, recorded surname-only. Fusing
 *     them would invent a person.
 *   - book 12717 (Bahesty/Bahonar): also two real people, and no verified
 *     source row for that import.
 *
 * SCRUB: every fragment row was enriched off a single token, so its photo,
 * OpenLibrary id and birth_year are namesake garbage by construction — the
 * photos resolve to Richard Nixon, a Pokémon, a Hunter x Hunter cover, Ben
 * Nevis, Zhang Zilin, Brian Boru… Those three fields are nulled on every row we
 * keep, and photo_v2_checked_at is deliberately left NULL so the photo pipeline
 * can retry against the now-correct full name. Verified bios/photos (Mother
 * Teresa, Brian Kolodiejchuk) are preserved.
 *
 * Read-only by default; pass --apply to write.
 */
import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { isApply } from './lib/cli'

const APPLY = isApply()
const NOW = new Date().toISOString()
const HK = 'https://en.wikipedia.org/wiki/Book_censorship_in_Hong_Kong#List_of_banned_books'

type Rename = { id: number; to: string; keepEnrichment?: boolean }
type Cluster = {
  book: number
  sourceCell: string
  renames: Rename[]
  drop: number[]
  /** authors to unlink from this book but NOT delete — they are real authors of
   *  other books that a previous cleanup wrongly absorbed a fragment into. */
  unlinkOnly?: number[]
  relinkTo?: number // merge into an existing author instead of renaming
}

const CLUSTERS: Cluster[] = [
  { book: 6581, sourceCell: 'Ding, Zilin.', renames: [{ id: 4625, to: 'Ding Zilin' }], drop: [4690] },
  { book: 6582, sourceCell: 'Davis, Deborah., Vogel, Ezra F.',
    renames: [{ id: 4691, to: 'Deborah Davis' }, { id: 4693, to: 'Ezra F. Vogel' }], drop: [4692, 4694] },
  { book: 6588, sourceCell: 'Hong, Ying., Avery, Martha.',
    renames: [{ id: 4702, to: 'Hong Ying' }, { id: 4704, to: 'Martha Avery' }], drop: [4703, 4705] },
  { book: 6589, sourceCell: 'Zola — All works (Liste Otto blanket-works row)',
    renames: [], drop: [4706, 4707], relinkTo: 100 },
  { book: 6600, sourceCell: 'Hicks, George L., Asai, Motofumi.',
    renames: [{ id: 4722, to: 'George L. Hicks' }, { id: 4724, to: 'Motofumi Asai' }], drop: [4725, 4723] },
  { book: 6632, sourceCell: 'Benton, Gregor., Hunter, Alan.',
    renames: [{ id: 4777, to: 'Gregor Benton' }, { id: 4779, to: 'Alan Hunter' }], drop: [4778, 4780] },
  { book: 6642, sourceCell: 'Simmie, Scott., Nixon, Bob.',
    renames: [{ id: 4792, to: 'Scott Simmie' }, { id: 4794, to: 'Bob Nixon' }], drop: [4793, 4795] },
  { book: 6660, sourceCell: 'Wasserstrom, Jeffrey N. (Editor), Perry, Elizabeth J. (Editor)',
    renames: [{ id: 4816, to: 'Jeffrey N. Wasserstrom' }, { id: 4818, to: 'Elizabeth J. Perry' }], drop: [4817, 4819] },
  { book: 6670, sourceCell: 'Black, George., Munro, Robin.',
    renames: [{ id: 4831, to: 'George Black' }, { id: 4833, to: 'Robin Munro' }], drop: [4834],
    // the "George." half of "Black, George." was absorbed into the real author
    // George Katsiaficas (#4637) by an earlier cleanup; he belongs to b6541
    // ("Katsiaficas, George.") only, so unlink him here rather than delete.
    unlinkOnly: [4637] },
  { book: 6958, sourceCell: '方良柱等 (編輯) / Fang, Liangzhu. et al.',
    renames: [{ id: 5175, to: 'Fang Liangzhu' }], drop: [5176] },
  { book: 7070, sourceCell: 'Cardenal, Juan Pablo., Araújo, Heriberto.',
    renames: [{ id: 5311, to: 'Juan Pablo Cardenal' }, { id: 5313, to: 'Heriberto Araújo' }], drop: [5314, 5312] },
  { book: 7119, sourceCell: '鍾明新等 / Zhong, Mingxin. et al.',
    renames: [{ id: 5377, to: 'Zhong Mingxin' }], drop: [5378] },
  { book: 7172, sourceCell: '麥海華等 / Mai, Haihua. et al.',
    renames: [{ id: 5447, to: 'Mai Haihua' }], drop: [5448] },
  { book: 7214, sourceCell: '石光劍, 紀偉仁 / Shi, Guangjian., Ji, Weiren.',
    renames: [{ id: 4904, to: 'Shi Guangjian' }, { id: 5511, to: 'Ji Weiren' }], drop: [5510, 5512] },
  { book: 7224, sourceCell: '梅碧思, 翁達揚 / Mei, Bisi., Weng, Dayang.',
    renames: [{ id: 5524, to: 'Mei Bisi' }, { id: 5526, to: 'Weng Dayang' }], drop: [5525, 5527] },
  { book: 7305, sourceCell: '「香港電台」記者, 馮玉蓮等 / "Xianggang dian tai" ji zhe, Feng, Yulian.',
    renames: [{ id: 5612, to: 'Feng Yulian' }], drop: [5613] },
  { book: 7363, sourceCell: 'Teresa., Kolodiejchuk, Brian.',
    // both rows already carry a correct, person-specific bio (and Teresa a
    // correct Commons portrait) — do not scrub those two.
    renames: [{ id: 5676, to: 'Mother Teresa', keepEnrichment: true },
              { id: 5677, to: 'Brian Kolodiejchuk', keepEnrichment: true }], drop: [5678] },
]

async function main() {
  const sb = adminClient()
  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN (pass --apply to write) ===')

  // Pre-flight: no target name/slug may collide with an author outside this set.
  const involved = new Set(CLUSTERS.flatMap(c => [...c.renames.map(r => r.id), ...c.drop, ...(c.unlinkOnly ?? [])]))
  for (const c of CLUSTERS) {
    for (const r of c.renames) {
      const slug = slugify(r.to)
      const { data } = await sb.from('authors').select('id, slug, display_name')
        .or(`slug.eq.${slug},display_name.eq.${r.to}`)
      const clash = (data ?? []).filter((a: any) => !involved.has(a.id))
      if (clash.length) throw new Error(`collision for "${r.to}" (${slug}): ${JSON.stringify(clash)}`)
    }
  }
  console.log(`pre-flight: ${CLUSTERS.reduce((n, c) => n + c.renames.length, 0)} target names, no collisions outside the cluster set\n`)

  let renamed = 0, dropped = 0, unlinked = 0, relinked = 0, aliases = 0
  const SEL = 'id, slug, display_name, photo_url, openlibrary_author_id, birth_year, bio'

  for (const c of CLUSTERS) {
    const ids = [...c.renames.map(r => r.id), ...c.drop, ...(c.unlinkOnly ?? [])]
    const { data: before } = await sb.from('authors').select(SEL).in('id', ids).order('id')
    const { data: baBefore } = await sb.from('book_authors').select('author_id').eq('book_id', c.book)
    console.log(`\n--- book ${c.book} — source cell: ${c.sourceCell}`)
    console.log('BEFORE authors      :', JSON.stringify(before))
    console.log('BEFORE book_authors :', JSON.stringify((baBefore ?? []).map((r: any) => r.author_id).sort()))
    if (!APPLY) {
      console.log('WOULD rename:', c.renames.map(r => `#${r.id}→"${r.to}" (${slugify(r.to)})`).join(', ') || '—')
      console.log('WOULD drop  :', c.drop.join(', ') || '—',
        c.unlinkOnly?.length ? `| unlink-only ${c.unlinkOnly.join(', ')}` : '',
        c.relinkTo ? `| relink book to author #${c.relinkTo}` : '')
      continue
    }

    for (const r of c.renames) {
      const patch: Record<string, unknown> = { display_name: r.to, slug: slugify(r.to), updated_at: NOW }
      if (!r.keepEnrichment) {
        // single-token-derived enrichment is namesake garbage — clear it and let
        // the pipelines redo it against the correct full name.
        patch.photo_url = null
        patch.openlibrary_author_id = null
        patch.ol_checked_at = null
        patch.birth_year = null
      }
      const { data, error } = await sb.from('authors').update(patch).eq('id', r.id).select(SEL)
      if (error) throw error
      renamed += data?.length ?? 0
    }

    if (c.relinkTo) {
      const { error: e1 } = await sb.from('book_authors')
        .upsert({ book_id: c.book, author_id: c.relinkTo, role: 'author' }, { onConflict: 'book_id,author_id' })
      if (e1) throw e1
      relinked++
    }

    for (const id of c.unlinkOnly ?? []) {
      const { data, error } = await sb.from('book_authors')
        .delete().eq('book_id', c.book).eq('author_id', id).select()
      if (error) throw error
      unlinked += data?.length ?? 0
    }

    for (const id of c.drop) {
      // record the dead slug so old /authors/<slug> URLs still resolve
      const { data: row } = await sb.from('authors').select('slug').eq('id', id).single()
      const target = c.relinkTo ?? c.renames[0]?.id
      if (row && target) {
        const { error } = await sb.from('author_slug_aliases')
          .upsert({ slug: (row as any).slug, author_id: target, source: 'merge' }, { onConflict: 'slug' })
        if (error) throw error
        aliases++
      }
      const { data: del, error: e2 } = await sb.from('book_authors')
        .delete().eq('book_id', c.book).eq('author_id', id).select()
      if (e2) throw e2
      unlinked += del?.length ?? 0
      const { data: da, error: e3 } = await sb.from('authors').delete().eq('id', id).select('id')
      if (e3) throw e3
      dropped += da?.length ?? 0
    }

    // 6589 also needs its own dead slugs pointed at the surviving Zola row
    const { data: after } = await sb.from('authors').select(SEL).in('id', c.renames.map(r => r.id)).order('id')
    const { data: baAfter } = await sb.from('book_authors')
      .select('author_id, authors(display_name, slug)').eq('book_id', c.book)
    console.log('AFTER authors       :', JSON.stringify(after))
    console.log('AFTER book_authors  :', JSON.stringify(baAfter))
  }

  console.log(`\n== rows: renamed ${renamed}, dropped ${dropped}, book_authors unlinked ${unlinked}, ` +
              `relinked ${relinked}, slug aliases ${aliases}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
