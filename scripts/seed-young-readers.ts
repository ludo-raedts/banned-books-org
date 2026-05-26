// Seed the Young Readers reading-club track with an editor-reviewable
// starter set: one intro content block + 12 books with blurbs and
// publisher-cited audience strings.
//
// Everything lands as DRAFT (`status='draft'` for the content block,
// `published_at=null` for each book row). The editor reviews in
// /admin/reading-club + /admin/content-blocks and publishes from there.
//
// Discussion-question columns intentionally stay NULL — the editor
// generates those per-book via the "Generate with AI" buttons once the
// definitive prompt templates are finalised.
//
// Run with:
//   pnpm tsx --env-file=.env.local scripts/seed-young-readers.ts
//
// Idempotent: upserts on (slug) for content_blocks and on (book_id) for
// reading_club_young_readers, so re-running updates copy without
// duplicating rows.

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, key)

const INTRO_HTML = `<p>Books written for children that adults tried to keep from them.</p>
<p>Each book on this list was made <em>for</em> children — picture books, middle grade, young adult — by the same culture that later tried to remove it from libraries and classrooms. Every challenge claims to protect a child. We document who tried, where, when, and on what grounds. The audience category on each book comes from the publisher, not from us — we don't assign age ranges.</p>
<p>What you read with the young reader in your life is your decision. This track exists so that decision can be informed by what the book was written to do, and what the people who tried to ban it actually said about why.</p>

<h3>Why no age recommendations?</h3>
<p>We document who tried to keep these books from young readers — not who should read them. Age suitability is a decision for a specific child, their household, their school, their community. Replacing that judgement with our judgement would reproduce exactly the move we&rsquo;re documenting.</p>

<h3>What does &ldquo;audience as published&rdquo; mean?</h3>
<p>The publisher&rsquo;s own audience categorization, taken from back-cover copy, library catalogs, or standard publishing-industry categories (picture book, middle grade, young adult). It&rsquo;s a citation, not our recommendation. Where possible we link the source.</p>

<h3>Where can I see specific challenges to a book?</h3>
<p>Click any book on this page. The detail page shows the documented ban history — country, year, scope (school, public library, government), stated reason, source. The book-club PDF download repeats that record in printable form.</p>

<h3>Why two discussion-question sets per book?</h3>
<p>One set asks about the book itself — characters, choices, what the author was trying to do. The other asks about the censorship history — who tried to remove it, what they said they were protecting, what gets lost. Use the same set with any reader in your group; we don&rsquo;t separate parent-questions from child-questions.</p>`

type Seed = {
  matchTitle: string
  audience: string
  audienceSourceUrl: string
  blurb: string
  featured: boolean
}

const SEEDS: Seed[] = [
  {
    matchTitle: 'In the Night Kitchen',
    audience: 'Picture book (ages 4-8, per HarperCollins)',
    audienceSourceUrl: 'https://www.harpercollins.com/products/in-the-night-kitchen-50th-anniversary-edition-maurice-sendak',
    featured: true,
    blurb:
      "Mickey tumbles out of bed and into a dream-bakery at midnight, where three Oliver-Hardy-mustachioed bakers nearly bake him into the morning cake. Maurice Sendak drew Mickey nude through several pages of the bakery odyssey — an unselfconscious child in an unselfconscious story. American school libraries spent five decades drawing pants on Mickey in pen, taping over the page, or removing the book entirely. The cartoon nudity of a small boy remains the dominant cited reason for the challenges — for a story written for children that age.",
  },
  {
    matchTitle: 'Where the Wild Things Are',
    audience: 'Picture book (ages 4-8, per HarperCollins)',
    audienceSourceUrl: 'https://www.harpercollins.com/products/where-the-wild-things-are-50th-anniversary-edition-maurice-sendak',
    featured: true,
    blurb:
      "Max, sent to bed without supper, sails through night and day to where the wild things are, tames them, becomes their king, and sails home to find his supper still warm. Maurice Sendak's 1963 picture book — ten illustrated spreads, thirty-eight pages — was greeted on publication by librarians who refused to stock it: the monsters would terrify children, the unrepentantly angry boy would encourage tantrums. Sendak said the early reviews were “practically all terrible” and that the book sat off shelves for its first decade. It has been on every list of most-challenged children's books since.",
  },
  {
    matchTitle: 'And Tango Makes Three',
    audience: 'Picture book (ages 4-8, per Simon & Schuster)',
    audienceSourceUrl: 'https://www.simonandschuster.com/books/And-Tango-Makes-Three/Justin-Richardson/9781416924340',
    featured: true,
    blurb:
      "The true story of two male chinstrap penguins at the Central Park Zoo who raise an abandoned egg together. Roy and Silo's pairing was documented by a real zookeeper; Justin Richardson and Peter Parnell wrote the children's-book version. From 2006 onward it has appeared on the ALA top-ten most-challenged list more years than any other title, almost always for “homosexuality.” The book itself is forty pages of nonfiction about birds — no agenda, no didactics. The challenges are not about what the book contains. They are about what the banning adult wants children not to know exists.",
  },
  {
    matchTitle: 'The Story of Ferdinand',
    audience: 'Picture book (ages 3-7, per Penguin Random House)',
    audienceSourceUrl: 'https://www.penguinrandomhouse.com/books/304770/the-story-of-ferdinand-by-munro-leaf-illustrated-by-robert-lawson/',
    featured: true,
    blurb:
      "A young bull in Spain prefers smelling flowers to fighting in the bullring. Munro Leaf's quiet 1936 picture book became a global bestseller within two years — and was promptly burned by Franco's regime as pacifist propaganda, banned in Nazi Germany, and banned in Stalin's Soviet Union (where it was also denounced as fascist propaganda). Three regimes that agreed on little agreed that a story about a bull who would not fight was dangerous enough to suppress. The book was published for four-year-olds.",
  },
  {
    matchTitle: `Charlotte's Web`,
    audience: 'Middle grade (ages 8-11, per HarperCollins)',
    audienceSourceUrl: 'https://www.harpercollins.com/products/charlottes-web-e-b-white',
    featured: true,
    blurb:
      "Fern saves a runt piglet, Wilbur, from being slaughtered. A literate spider in the barn saves him a second time. The spider dies. E. B. White's 1952 novel — quietly devastating in its final twenty pages — has been challenged in US schools on two recurring grounds: that talking animals are blasphemous (they show no respect for the natural order God created), and that Charlotte's death and the references to slaughter are inappropriate for the audience the book was written for. The audience the book was written for is the audience that learns from it.",
  },
  {
    matchTitle: 'James and the Giant Peach',
    audience: 'Middle grade (ages 7-10, per Penguin Random House)',
    audienceSourceUrl: 'https://www.penguinrandomhouse.com/books/164691/james-and-the-giant-peach-by-roald-dahl/',
    featured: false,
    blurb:
      "A miserable orphan escapes his cruel aunts inside a magical, oversized peach with a crew of human-sized insects. Roald Dahl's first children's book has been challenged regularly since publication: for the wine drunk inside the peach, for the lonely-orphan opening, for stray rude words, for what one Florida school called “encouraging children to disobey parents and other authority figures.” It is, on most readings, a book about exactly that — escaping cruelty through imagination.",
  },
  {
    matchTitle: 'A Wrinkle in Time',
    audience: 'Middle grade (ages 10-14, per Square Fish / Macmillan)',
    audienceSourceUrl: 'https://us.macmillan.com/books/9780312367541/awrinkleintime',
    featured: true,
    blurb:
      "Meg Murry's father has vanished mid-experiment with the fifth dimension. Three otherworldly women — Mrs Whatsit, Mrs Who, Mrs Which — send her, her younger brother, and a schoolmate after him. Madeleine L'Engle's 1962 novel sat in the rejection pile of every major publisher for two years (too strange, too religious, too feminist, too scientific for children). It has been challenged ever since publication on contradictory grounds: too Christian for secular districts, too occult for evangelical ones. The book about a girl who refuses to give up on her family is somehow always too much for someone.",
  },
  {
    matchTitle: 'Bridge to Terabithia',
    audience: 'Middle grade (ages 10-14, per HarperCollins)',
    audienceSourceUrl: 'https://www.harpercollins.com/products/bridge-to-terabithia-katherine-paterson',
    featured: true,
    blurb:
      "Two rural Virginia fifth-graders, Jess and Leslie, build an imaginary kingdom in the woods. One of them dies. Katherine Paterson based the novel on her own son's grief after a friend's death. The book has been on the ALA's most-challenged list almost every year since 1990, cited variously for: Leslie's family being non-religious, the children's profanity (“Lord”), occult themes (an imaginary kingdom), Jess questioning whether God damns nonbelievers. The actual subject — what death does to a ten-year-old, and what imagination does for one — is rarely listed.",
  },
  {
    matchTitle: 'The Giver',
    audience: 'Middle grade (ages 10-14, per Houghton Mifflin Harcourt)',
    audienceSourceUrl: 'https://www.hmhbooks.com/shop/books/The-Giver/9780544336261',
    featured: true,
    blurb:
      "Jonas's perfectly ordered community has solved pain, ambiguity, and choice. At twelve he is assigned to inherit the community's suppressed memories from a single Receiver. He learns about colour, weather, music, sex, war, and what happens to the elderly and to babies who do not thrive. Lois Lowry's 1993 dystopia is taught in fourth- and fifth-grade classrooms across the US — and challenged in many of them. The challenges focus on the explicit references to euthanasia, the brief mention of sexual feelings (“stirrings”), and the violence in Jonas's inherited memories. The book is about a society that solved discomfort by erasing it.",
  },
  {
    matchTitle: `Harry Potter and the Philosopher's Stone`,
    audience: 'Middle grade (ages 8-12, per Bloomsbury / Scholastic)',
    audienceSourceUrl: 'https://www.bloomsbury.com/uk/harry-potter-and-the-philosophers-stone-9781408855898/',
    featured: false,
    blurb:
      "Harry, an orphaned eleven-year-old who has spent his life in the cupboard under the stairs, learns he is a wizard and goes to Hogwarts. J. K. Rowling's first novel triggered the most coordinated and durable censorship campaign in modern children's publishing. From 2000 onward it has been challenged or restricted in thousands of US school districts on grounds that depicting witchcraft promotes occultism; Catholic schools across the US have removed it (“the curses and spells used in the books are actual curses and spells,” a Nashville school librarian said in 2019); the Vatican has issued conflicting statements. The objection is consistently religious. The book is consistently a story about being kind.",
  },
  {
    matchTitle: 'The Outsiders',
    audience: 'Young adult (ages 12+, per Penguin / Viking)',
    audienceSourceUrl: 'https://www.penguinrandomhouse.com/books/315910/the-outsiders-by-s-e-hinton/',
    featured: false,
    blurb:
      "S. E. Hinton wrote The Outsiders at fifteen and published it at eighteen. Ponyboy and his greaser friends fight, drink, smoke, kill, and grieve in suburban Oklahoma. The book invented modern young-adult fiction by treating teenagers as people whose interior lives the author took seriously. Six decades of challenges have cited the violence, the smoking, the underage drinking, the family dysfunction. The actual taboo in 1967 — that teenage poverty, addiction, and violence existed and that teenagers might want to read about them — has aged into the background of the complaint.",
  },
  {
    matchTitle: 'I Know Why the Caged Bird Sings',
    audience: 'Young adult / adult crossover (ages 14+, per Random House)',
    audienceSourceUrl: 'https://www.penguinrandomhouse.com/books/3924/i-know-why-the-caged-bird-sings-by-maya-angelou/',
    featured: true,
    blurb:
      "Maya Angelou's autobiography of her childhood and adolescence in 1930s-40s Arkansas and California: segregation, displacement, and the rape she survived at eight years old. The book is taught in advanced high-school English programmes across the US and challenged in many of them. The challenges almost always cite the depiction of the rape — a child describing what was done to her — as “sexually explicit.” The same school districts that ban it for sexual content also teach it for the racism it documents. The book is about both.",
  },
  {
    matchTitle: 'The Chocolate War',
    audience: 'Young adult (ages 14+, per Knopf)',
    audienceSourceUrl: 'https://www.penguinrandomhouse.com/books/49717/the-chocolate-war-by-robert-cormier/',
    featured: false,
    blurb:
      "Jerry Renault refuses to sell chocolates for his Catholic boys' school's annual fundraiser. The school's secret society and a sadistic teacher punish him. Robert Cormier ends the book with the bullies winning — a refusal to deliver the YA-novel moral ending that adults expected. Five decades of challenges have cited the language, the masturbation references, and the bleak ending. The bleak ending is the point. The book asks whether the lone moral stand is worth what it costs the person making it. The answer is not the one adults wanted children to be given.",
  },
  {
    matchTitle: 'Speak',
    audience: 'Young adult (ages 12+, per Macmillan / Square Fish)',
    audienceSourceUrl: 'https://us.macmillan.com/books/9780312674397/speak',
    featured: true,
    blurb:
      "Melinda Sordino is raped at a summer party by an older student and stops speaking — through most of her ninth-grade year. Laurie Halse Anderson based the novel on a survivor's anonymous letter she received. Speak has been challenged in school libraries for decades; in 2010 a Missouri State University professor called it “soft pornography” in a Springfield newspaper, citing the rape scene. The author's response: “Speak is not pornography. It is a novel about rape.” A book written for teenage girls about how to survive what happened to her was, by adult challengers, classified as the thing that happened to her.",
  },
  {
    matchTitle: 'The Absolutely True Diary of a Part-Time Indian',
    audience: 'Young adult (ages 14+, per Little, Brown)',
    audienceSourceUrl: 'https://www.lbyr.com/titles/sherman-alexie/the-absolutely-true-diary-of-a-part-time-indian/9780316013680/',
    featured: false,
    blurb:
      "Junior, a cartooning teenager on the Spokane Indian reservation, transfers to the all-white high school twenty-two miles away. Sherman Alexie's semi-autobiographical novel won the 2007 National Book Award for Young People's Literature and has been challenged in school districts every year since publication. The cited reasons: profanity, references to masturbation, the unflinching depictions of reservation poverty, alcoholism, and grief. The book describes what Junior's actual community looks like. The challenges accuse the book of being the thing it describes.",
  },
]

async function findBookId(title: string): Promise<number | null> {
  // Same lookup as the candidate-probe: exact match first, then ilike with
  // single-result preference, then shortest match if multiple.
  const { data: exact } = await supabase
    .from('books').select('id, title').eq('title', title).limit(1)
  if (exact && exact.length === 1) return exact[0].id
  const { data: ilike } = await supabase
    .from('books').select('id, title').ilike('title', `%${title}%`).limit(3)
  if (!ilike || ilike.length === 0) return null
  return ilike.sort((a, b) => a.title.length - b.title.length)[0].id
}

async function upsertIntroBlock(): Promise<void> {
  // content_blocks shape (per migrations baseline): slug, title,
  // placeholder_brief, body_markdown, body_html, status, notes,
  // last_edited_by, last_edited_at, published_at.
  const { error } = await supabase
    .from('content_blocks')
    .upsert({
      slug: 'track-young-readers-intro',
      title: 'Young Readers — track intro',
      placeholder_brief: 'Editorial framing for the Young Readers reading-club hub page. Roughly 100-200 words. Lays out the paradox and the editorial position: publisher-cited audience, no banned-books.org age labels.',
      body_html: INTRO_HTML,
      body_markdown: null,
      status: 'draft',
      last_edited_by: 'seed-young-readers.ts',
      last_edited_at: new Date().toISOString(),
    }, { onConflict: 'slug' })
  if (error) throw new Error(`content_blocks upsert failed: ${error.message}`)
}

async function seedBook(seed: Seed, position: number): Promise<{ ok: boolean; note: string }> {
  const bookId = await findBookId(seed.matchTitle)
  if (!bookId) return { ok: false, note: `book "${seed.matchTitle}" not found` }

  const { error } = await supabase
    .from('reading_club_young_readers')
    .upsert({
      book_id: bookId,
      position,
      custom_blurb: seed.blurb,
      audience_as_published: seed.audience,
      audience_source_url: seed.audienceSourceUrl,
      discussion_questions_book: null,
      discussion_questions_ban: null,
      featured: seed.featured,
      published_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'book_id' })
  if (error) return { ok: false, note: `upsert failed: ${error.message}` }
  return { ok: true, note: `#${position} book_id=${bookId}` }
}

async function main() {
  console.log('Seeding Young Readers track…\n')
  console.log('Step 1: intro content block')
  await upsertIntroBlock()
  console.log('  ✓ track-young-readers-intro (DRAFT — publish from admin)\n')

  console.log(`Step 2: ${SEEDS.length} books`)
  let ok = 0, fail = 0
  for (let i = 0; i < SEEDS.length; i++) {
    const seed = SEEDS[i]
    const result = await seedBook(seed, i + 1)
    if (result.ok) {
      console.log(`  ✓ ${seed.matchTitle.padEnd(50)} ${result.note}`)
      ok++
    } else {
      console.log(`  ✗ ${seed.matchTitle.padEnd(50)} ${result.note}`)
      fail++
    }
  }
  console.log(`\nDone. ${ok} seeded, ${fail} failed.`)
  console.log('All rows are DRAFT. Review in /admin/reading-club → Young Readers tab, generate questions, then publish.')
}

main().catch(err => { console.error(err); process.exit(1) })
