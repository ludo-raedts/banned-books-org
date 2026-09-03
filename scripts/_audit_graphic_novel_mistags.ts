/**
 * _audit_graphic_novel_mistags.ts — READ-ONLY. Comics filed as prose.
 *
 * The highest-yield slice of the literary-fiction problem
 * (scripts/_audit_literary_fiction_default.ts). PEN's 2021+ data is comics-heavy,
 * and the deleted import-pen.ts regex only recognised a graphic novel when the
 * TITLE literally said "graphic novel" or "illustrated" — so Gareth Hinds's
 * Odyssey and Iliad landed on literary-fiction, and everything else landed on
 * whichever branch its title tripped. `graphic-novel` currently sits on ~120 of
 * 20k books, which is far too few for this catalogue.
 *
 * Mis-tagging a comic is not a cosmetic slip: for a banned book the FORM is often
 * the thing that got it banned (Maus, Persepolis, Gender Queer, Fun Home were all
 * challenged over images), and a `literary-fiction` badge hides exactly that.
 *
 * Tiers, most to least certain:
 *   STRONG   — the title itself says comics ("The Graphic Novel", "A Graphic
 *              Memoir", "Manga Shakespeare"). Hand-verifiable list, small.
 *   PROBABLE — the description names the form outright ("a graphic novel",
 *              "graphic memoir", "manga").
 *   WEAK      — softer description signals (illustrator credit, "panels").
 *              Reported for completeness only; too noisy to act on in bulk.
 *
 * NEGATIVE GUARDS matter as much as the signals. A prose book ABOUT comics is not
 * a comic: "Why Comics?", "The Art of Comics", "A Brief History of Manga" and the
 * "Manga Dinosaurs" how-to-draw series all match the title regex and are all
 * false positives. So do novels whose plot involves comics ("Verona Comics") and
 * illustrated children's books that are not sequential art ("A Picture Book of
 * Anne Frank"). Those are separated out, not silently tagged.
 *
 * Writes NOTHING. The verified STRONG corrections are applied by
 * scripts/_fix_graphic_novel_mistags.ts.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/_audit_graphic_novel_mistags.ts
 *   npx tsx --env-file=.env.local scripts/_audit_graphic_novel_mistags.ts --verbose
 */
import { adminClient } from '../src/lib/supabase'
import { hasFlag } from './lib/cli'

const PAGE = 1000
const VERBOSE = hasFlag('verbose')

// ── signals ────────────────────────────────────────────────────────────────
/** The title declares the form. */
const TITLE_STRONG =
  /\b(?:the |a |an )?graphic (?:novel|memoir|adaptation|biography|history|journey|collection|diary)\b|\bmanga\b|\bani-manga\b|\bcomics?\b|\bcomic book\b|\billustrated (?:novel|adaptation|edition|classic)\b/i
/**
 * The description names the form outright. `cartoonist` / `webcomic` / `comix` /
 * `bande dessinee` belong here, not in the weak tier: they are how a description
 * describes comics when it never uses the phrase "graphic novel". Without them
 * the detector misses #502 Maus 1 (tagged historical-fiction, while its sibling
 * row #122 Maus is correctly tagged graphic-novel), #549 Relish and #1123 Brazen.
 */
const DESC_STRONG =
  /\bgraphic (?:novel|memoir|adaptation|biography|history|tragicomic)\b|\bmanga\b|\bcomics (?:anthology|collection|adaptation|memoir|journalism)\b|\bcomic(?:-| )book (?:series|adaptation)\b|\bsequential art\b|\bcomix\b|\bcartoonist\b|\bwebcomic\b|\bcomic strip\b|\bbande dessin[ée]e\b|\bblog BD\b/i
/**
 * Softer — an illustrator credit or panel talk. NOT actionable: illustrated prose
 * and picture books hit these constantly (#246 The Sun and Her Flowers, a poetry
 * collection, lands here).
 */
const DESC_WEAK = /\billustrat(?:ed|ions?|or) by\b|\bdrawn by\b|\bpanels?\b/i

/**
 * A prose book ABOUT comics, a how-to-draw manual, or a novel whose plot involves
 * comics. All of these trip TITLE_STRONG and none of them is a comic.
 */
const NOT_COMICS =
  /\b(?:why|the art of|a brief history of|history of|art of|how to draw|drawing|guide to|understanding|reading)\b.{0,24}\b(?:comics?|manga)\b|\bmanga (?:dinosaurs|dragons|martial arts|superheroes)\b|\bhistory of western art in comics\b|\bverona comics\b/i
/** Illustrated children's book, not sequential art. */
const PICTURE_NOT_COMICS = /\bpicture book\b|\bdisney illustrated edition\b/i

type Row = {
  id: number
  slug: string
  title: string
  genres: string[]
  description_book: string | null
  book_authors: { authors: { display_name: string } | null }[]
}

async function loadBooks(): Promise<Row[]> {
  const sb = adminClient()
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('books')
      .select('id, slug, title, genres, description_book, book_authors(authors(display_name))')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as unknown as Row[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

const authorOf = (b: Row) =>
  b.book_authors.map((ba) => ba.authors?.display_name).filter(Boolean).join(', ') || 'unknown'

function line(b: Row) {
  return `  #${b.id} ${JSON.stringify(b.genres)} — "${b.title.slice(0, 62)}" / ${authorOf(b).slice(0, 34)}`
}

async function main() {
  const books = await loadBooks()
  const tagged = books.filter((b) => (b.genres ?? []).includes('graphic-novel'))
  const untagged = books.filter((b) => !(b.genres ?? []).includes('graphic-novel'))

  const strong: Row[] = []
  const probable: Row[] = []
  const weak: Row[] = []
  const excludedProse: Row[] = []
  const excludedPicture: Row[] = []

  for (const b of untagged) {
    const desc = b.description_book ?? ''
    const titleHit = TITLE_STRONG.test(b.title)
    const descHit = DESC_STRONG.test(desc)
    if (!titleHit && !descHit && !DESC_WEAK.test(desc)) continue

    if (NOT_COMICS.test(b.title)) { excludedProse.push(b); continue }
    if (PICTURE_NOT_COMICS.test(b.title) && !/graphic|manga|comic/i.test(b.title.replace(/picture book/i, ''))) {
      excludedPicture.push(b); continue
    }

    if (titleHit) strong.push(b)
    else if (descHit) probable.push(b)
    else weak.push(b)
  }

  const withLf = (rows: Row[]) => rows.filter((b) => (b.genres ?? []).includes('literary-fiction'))

  console.log('\n══ graphic-novel mis-tag audit (read-only) ══')
  console.log(`  books:                       ${books.length}`)
  console.log(`  already tagged graphic-novel: ${tagged.length}`)

  console.log(`\n── STRONG — the TITLE declares the form (${strong.length}) ──`)
  console.log(`   ${withLf(strong).length} of these carry literary-fiction.`)
  for (const b of strong) console.log(line(b))

  console.log(`\n── PROBABLE — the DESCRIPTION names the form (${probable.length}) ──`)
  console.log(`   ${withLf(probable).length} of these carry literary-fiction.`)
  for (const b of (VERBOSE ? probable : probable.slice(0, 25))) console.log(line(b))
  if (!VERBOSE && probable.length > 25) console.log(`  … +${probable.length - 25} more (--verbose for all)`)

  console.log(`\n── WEAK — illustrator credit / panel talk only (${weak.length}) ──`)
  console.log('   Not actionable in bulk: prose books with illustrations hit these too.')
  for (const b of weak.slice(0, VERBOSE ? 60 : 8)) console.log(line(b))
  if (weak.length > (VERBOSE ? 60 : 8)) console.log(`  … +${weak.length - (VERBOSE ? 60 : 8)} more`)

  console.log(`\n── EXCLUDED by the negative guards ──`)
  console.log(`  prose ABOUT comics / how-to-draw / plot-involves-comics (${excludedProse.length}):`)
  for (const b of excludedProse) console.log(line(b))
  console.log(`  illustrated but not sequential art (${excludedPicture.length}):`)
  for (const b of excludedPicture) console.log(line(b))

  console.log('\n══ summary ══')
  console.log(`  STRONG (act on, hand-verified):  ${strong.length}`)
  console.log(`  PROBABLE (re-grade via the classifier): ${probable.length}`)
  console.log(`  WEAK (leave):                    ${weak.length}`)
  console.log(`  excluded by guards:              ${excludedProse.length + excludedPicture.length}`)
  console.log('\nApply the verified STRONG set with scripts/_fix_graphic_novel_mistags.ts --apply.')
  console.log('The PROBABLE set is best handled by the classifier, which now carries an')
  console.log('explicit "form beats subject" rule:')
  console.log(`  npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --ids=${probable.slice(0, 3).map((b) => b.id).join(',')},… --apply`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
