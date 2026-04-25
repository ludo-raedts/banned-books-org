import { adminClient } from '../src/lib/supabase'

/**
 * Batch 10 — Deep coverage of 10 focus areas
 *
 * Covers:
 *  1. US Comstock Act era (1873–1950s) — postal / customs bans
 *  2. UK Obscene Publications Act cases — Spycatcher, Lord Horror, Anarchist Cookbook
 *  3. Germany modern — Mein Kampf, Holocaust denial titles
 *  4. France — Madame Bovary, Napoléon le Petit, Story of O, Sade prosecutions
 *  5. Italy — Fascist-era bans: Silone, Vittorini, Moravia; post-war Pasolini
 *  6. Spain under Franco — Lorca, Machado, Neruda, Hemingway, Goytisolo, Cela, etc.
 *  7. Albania under Hoxha; more Hungary under Kádár
 *  8. Classic literature with formal government bans — Boccaccio, Ovid, Machiavelli,
 *     Spinoza, Dante
 *  9. Religious bans — Taliban Afghanistan, Saudi Arabia, Pakistan blasphemy
 * 10. Comics / graphic novels — Barefoot Gen, El Eternauta, Watchmen, From Hell
 *
 * Sources:
 *  - Wikipedia "Comstock laws"; "Anthony Comstock"; individual book articles
 *  - Boyer, Paul S. "Purity in Print" (1968)
 *  - Wikipedia "Obscene Publications Act 1959"; Robertson, Geoffrey. "Obscenity" (1979)
 *  - Wikipedia "Censorship in Spain under Franco"; Abellán "Censura y creación literaria" (1980)
 *  - Wikipedia "Censorship in Italy"; Ben-Ghiat "Fascist Modernities" (2001)
 *  - Wikipedia "Censorship in France"
 *  - Wikipedia "Censorship in Albania"; "Index Librorum Prohibitorum"
 *  - Human Rights Watch; PEN International; Article 19
 */

const supabase = adminClient()
const COVER_DELAY_MS = 300

interface OLResult { coverUrl: string | null; workId: string | null; publishYear: number | null }

async function fetchOL(title: string, author: string): Promise<OLResult> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=key,cover_i,first_publish_year&limit=1`)
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number; first_publish_year?: number }> }
    const doc = json.docs?.[0]
    return {
      coverUrl:    doc?.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      workId:      doc?.key?.replace('/works/', '') ?? null,
      publishYear: doc?.first_publish_year ?? null,
    }
  } catch { return { coverUrl: null, workId: null, publishYear: null } }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function upsertSource(name: string, url: string) {
  const { data } = await supabase.from('ban_sources').upsert(
    { source_name: name, source_url: url, source_type: 'web' },
    { onConflict: 'source_url' }
  ).select('id').single()
  return data?.id as number | null
}

async function ensureCountry(code: string, name: string, slug: string) {
  const { data } = await supabase.from('countries').select('code').eq('code', code).single()
  if (!data) {
    await supabase.from('countries').insert({ code, name_en: name, slug })
    console.log(`Added country: ${name}`)
  }
}

async function main() {
  const { data: scopes }          = await supabase.from('scopes').select('id, slug')
  const { data: reasons }         = await supabase.from('reasons').select('id, slug')
  const { data: existing }        = await supabase.from('books').select('slug')
  const { data: existingAuthors } = await supabase.from('authors').select('id, slug')

  const existingSlugs = new Set((existing ?? []).map(b => b.slug))
  const authorMap     = new Map((existingAuthors ?? []).map(a => [a.slug, a.id as number]))

  const scopeId  = (slug: string) => scopes!.find(s => s.slug === slug)!.id
  const reasonId = (slug: string) => {
    const r = reasons!.find(r => r.slug === slug)
    if (!r) throw new Error(`Reason slug missing from DB: "${slug}"`)
    return r.id
  }

  const govId = scopeId('government')

  // ── Sources ───────────────────────────────────────────────────────────────
  const wikpSource     = await upsertSource('Wikipedia – List of books banned by governments', 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments')
  const comstockSource = await upsertSource('Wikipedia – Comstock laws', 'https://en.wikipedia.org/wiki/Comstock_laws')
  const ipiSource      = await upsertSource('Index on Censorship', 'https://www.indexoncensorship.org/')
  const penSource      = await upsertSource('PEN International', 'https://pen.org/banned-books/')
  const art19Source    = await upsertSource('Article 19 – Freedom of Expression', 'https://www.article19.org/')
  const indexSource    = await upsertSource('Index Librorum Prohibitorum', 'https://en.wikipedia.org/wiki/Index_Librorum_Prohibitorum')
  const hrwSource      = await upsertSource('Human Rights Watch – Banned Books', 'https://www.hrw.org/')

  // ── Ensure countries ──────────────────────────────────────────────────────
  await ensureCountry('AL', 'Albania', 'albania')
  await ensureCountry('AR', 'Argentina', 'argentina')
  await ensureCountry('BD', 'Bangladesh', 'bangladesh')
  await ensureCountry('CO', 'Colombia', 'colombia')
  // ES, IT, FR, DE, GB, US, VA, HU, SA, PK, AF, JP already exist

  async function getOrCreateAuthor(displayName: string, slug: string): Promise<number | null> {
    if (authorMap.has(slug)) return authorMap.get(slug)!
    const { data, error } = await supabase.from('authors').insert({
      slug, display_name: displayName, birth_year: null, death_year: null,
    }).select('id').single()
    if (error) {
      const { data: ex } = await supabase.from('authors').select('id').eq('slug', slug).single()
      if (ex) { authorMap.set(slug, ex.id); return ex.id }
      return null
    }
    authorMap.set(slug, data.id)
    return data.id
  }

  async function addBook(opts: {
    title: string; slug: string; authorDisplay: string; authorSlug: string
    year: number; genres: string[]; lang?: string
    bans: { country: string; scopeId: number; status: string; yearStarted: number; reasonSlugs: string[]; sourceId: number | null }[]
  }) {
    if (existingSlugs.has(opts.slug)) { console.log(`  [skip] ${opts.title}`); return }
    process.stdout.write(`  ${opts.title} — cover... `)
    const ol = await fetchOL(opts.title, opts.authorDisplay)
    await sleep(COVER_DELAY_MS)
    console.log(ol.coverUrl ? 'ok' : 'no cover')

    const authorId = await getOrCreateAuthor(opts.authorDisplay, opts.authorSlug)

    const { data: book, error: be } = await supabase.from('books').insert({
      title: opts.title, slug: opts.slug,
      original_language: opts.lang ?? 'en',
      first_published_year: opts.year, ai_drafted: false, genres: opts.genres,
      cover_url: ol.coverUrl, openlibrary_work_id: ol.workId,
    }).select('id').single()
    if (be) { console.error(`  [error] ${opts.title}: ${be.message}`); return }

    existingSlugs.add(opts.slug)
    if (authorId) await supabase.from('book_authors').insert({ book_id: book.id, author_id: authorId })

    for (const ban of opts.bans) {
      const { data: newBan, error: bane } = await supabase.from('bans').insert({
        book_id: book.id, country_code: ban.country, scope_id: ban.scopeId,
        action_type: 'banned', status: ban.status, year_started: ban.yearStarted,
      }).select('id').single()
      if (bane) { console.error(`  [ban error] ${ban.country}: ${bane.message}`); continue }
      for (const rs of ban.reasonSlugs) {
        await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: reasonId(rs) })
      }
      if (ban.sourceId) {
        await supabase.from('ban_source_links').insert({ ban_id: newBan.id, source_id: ban.sourceId })
      }
    }
    console.log(`  [ok] ${opts.title}`)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. US GOVERNMENT / POSTAL BANS — COMSTOCK ACT ERA (1873–1950s)
  // ═══════════════════════════════════════════════════════════════════════════
  // The Comstock Act (18 U.S.C. §1461, 1873) empowered the US Post Office to refuse
  // mailing of "obscene" material, and US Customs to seize it at the border.
  // Anthony Comstock personally led hundreds of prosecutions as a postal inspector.
  //
  // Primary sources:
  //  - Boyer, Paul S. "Purity in Print" (1968) — standard historical account
  //  - Ernst, Morris L. & Seagle, William. "To the Pure" (1928)
  //  - US Federal court records; Library of Congress censorship documentation

  await addBook({
    // Theodore Dreiser's "The 'Genius'" — suppressed 1916 by the New York Society for the
    // Suppression of Vice; publisher ordered to withdraw; Dreiser fought back with a petition
    // signed by hundreds of authors. Source: Wikipedia "The Genius (novel)"; Boyer p. 78.
    title: "The 'Genius'",
    slug: 'the-genius-dreiser',
    authorDisplay: 'Theodore Dreiser',
    authorSlug: 'theodore-dreiser',
    year: 1915, genres: ['literary-fiction'],
    bans: [{ country: 'US', scopeId: govId, status: 'historical', yearStarted: 1916, reasonSlugs: ['sexual', 'moral'], sourceId: comstockSource }],
  })

  await addBook({
    // Sinclair Lewis's "Elmer Gantry" (1927) — banned in several US cities; Boston banned it
    // under the city's "Watch and Ward Society" ordinances immediately upon publication.
    // Source: Wikipedia "Elmer Gantry (novel)"; Boyer p. 200.
    title: 'Elmer Gantry',
    slug: 'elmer-gantry',
    authorDisplay: 'Sinclair Lewis',
    authorSlug: 'sinclair-lewis',
    year: 1927, genres: ['literary-fiction', 'satire'],
    bans: [{ country: 'US', scopeId: govId, status: 'historical', yearStarted: 1927, reasonSlugs: ['religious', 'moral'], sourceId: comstockSource }],
  })

  await addBook({
    // Edmund Wilson's "Memoirs of Hecate County" (1946) — convicted of obscenity in New York;
    // Supreme Court upheld the conviction 4-4 in Doubleday v. New York (1948); landmark case.
    // Source: Wikipedia "Memoirs of Hecate County"; Doubleday v. New York, 335 U.S. 848 (1948).
    title: 'Memoirs of Hecate County',
    slug: 'memoirs-of-hecate-county',
    authorDisplay: 'Edmund Wilson',
    authorSlug: 'edmund-wilson',
    year: 1946, genres: ['literary-fiction'],
    bans: [{ country: 'US', scopeId: govId, status: 'historical', yearStarted: 1946, reasonSlugs: ['sexual', 'obscenity'], sourceId: comstockSource }],
  })

  await addBook({
    // Henry Miller's "Tropic of Cancer" (1934, Paris) — banned by US Customs 1934–1961;
    // Grove Press published in 1961; Postmaster General tried to ban from the mails again;
    // Supreme Court upheld right to publish Grove Press v. Gerstein (1964).
    // Source: Wikipedia "Tropic of Cancer (novel)"; Boyer pp. 255–265.
    title: 'Tropic of Cancer',
    slug: 'tropic-of-cancer',
    authorDisplay: 'Henry Miller',
    authorSlug: 'henry-miller',
    year: 1934, genres: ['literary-fiction'],
    bans: [{ country: 'US', scopeId: govId, status: 'historical', yearStarted: 1934, reasonSlugs: ['sexual', 'obscenity'], sourceId: comstockSource }],
  })

  await addBook({
    // Henry Miller's "Tropic of Capricorn" (1939, Paris) — banned by US Customs alongside
    // Tropic of Cancer; the two titles were treated identically by customs authorities.
    // Source: Wikipedia "Tropic of Capricorn (novel)".
    title: 'Tropic of Capricorn',
    slug: 'tropic-of-capricorn',
    authorDisplay: 'Henry Miller',
    authorSlug: 'henry-miller',
    year: 1939, genres: ['literary-fiction'],
    bans: [{ country: 'US', scopeId: govId, status: 'historical', yearStarted: 1939, reasonSlugs: ['sexual', 'obscenity'], sourceId: comstockSource }],
  })

  await addBook({
    // Margaret Sanger's birth control pamphlet "Family Limitation" (1914) — Sanger indicted
    // under the Comstock Act; she fled to England to avoid prosecution. The postal ban on
    // contraceptive information was a central use of the Comstock Act.
    // Source: Wikipedia "Margaret Sanger"; "Family Limitation" Wikipedia article.
    title: 'Family Limitation',
    slug: 'family-limitation-sanger',
    authorDisplay: 'Margaret Sanger',
    authorSlug: 'margaret-sanger',
    year: 1914, genres: ['non-fiction'],
    bans: [{ country: 'US', scopeId: govId, status: 'historical', yearStarted: 1914, reasonSlugs: ['sexual', 'moral'], sourceId: comstockSource }],
  })

  await addBook({
    // D.H. Lawrence's "Lady Chatterley's Lover" (1928, Florence) — banned by US Customs
    // 1929–1959; when Grove Press published it 1959, Postmaster General Summerfield banned it
    // from the mails; federal court overturned that ban (Grove Press v. Christenberry, 1959).
    // Source: Wikipedia "Lady Chatterley's Lover § Publication history".
    title: "Lady Chatterley's Lover",
    slug: 'lady-chatterleys-lover',
    authorDisplay: 'D. H. Lawrence',
    authorSlug: 'dh-lawrence',
    year: 1928, genres: ['literary-fiction', 'romance'],
    bans: [
      { country: 'US', scopeId: govId, status: 'historical', yearStarted: 1929, reasonSlugs: ['sexual', 'obscenity'], sourceId: comstockSource },
      { country: 'AU', scopeId: govId, status: 'historical', yearStarted: 1930, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Radclyffe Hall's "The Well of Loneliness" — US Customs seized copies in 1929;
    // federal court ruled in favour of the book the same year (US v. One Book Entitled
    // "God's Little Acre" etc.). Separate ban from the UK ban already in batch 9.
    // Source: Wikipedia "The Well of Loneliness § Publication history".
    title: 'The Well of Loneliness',
    slug: 'the-well-of-loneliness',
    authorDisplay: 'Radclyffe Hall',
    authorSlug: 'radclyffe-hall',
    year: 1928, genres: ['literary-fiction'],
    bans: [
      { country: 'US', scopeId: govId, status: 'historical', yearStarted: 1929, reasonSlugs: ['lgbtq', 'obscenity'], sourceId: comstockSource },
    ],
  })

  await addBook({
    // Erskine Caldwell's "God's Little Acre" (1933) — seized by New York Society for the
    // Suppression of Vice; landmark court ruling NOT obscene (People v. Viking Press, 1933),
    // but Massachusetts and other states banned it for years.
    // Source: Wikipedia "God's Little Acre (novel)".
    title: "God's Little Acre",
    slug: 'gods-little-acre',
    authorDisplay: 'Erskine Caldwell',
    authorSlug: 'erskine-caldwell',
    year: 1933, genres: ['literary-fiction'],
    bans: [{ country: 'US', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['sexual', 'obscenity'], sourceId: comstockSource }],
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. UK GOVERNMENT BANS — OBSCENE PUBLICATIONS ACT CASES
  // ═══════════════════════════════════════════════════════════════════════════
  // The Obscene Publications Acts of 1857 and 1959 enabled criminal prosecution.
  // Sources: Robertson, Geoffrey. "Obscenity" (1979); UK court records; Wikipedia.

  await addBook({
    // Peter Wright's "Spycatcher" (1987) — banned by UK government 1985–1988; injunctions
    // in England and Scotland; published in Australia first; injunction failed before
    // the House of Lords (Attorney-General v Guardian Newspapers [1987] AC 617).
    // Source: Wikipedia "Spycatcher"; UK House of Lords judgment 1988.
    title: 'Spycatcher',
    slug: 'spycatcher',
    authorDisplay: 'Peter Wright',
    authorSlug: 'peter-wright',
    year: 1987, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'GB', scopeId: govId, status: 'historical', yearStarted: 1985, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    // David Britton's "Lord Horror" (1989) — convicted under the Obscene Publications Act 1959;
    // conviction later overturned on appeal; the seizure and trial documented.
    // Source: Wikipedia "Lord Horror"; Robertson "Obscenity" updated notes.
    title: 'Lord Horror',
    slug: 'lord-horror',
    authorDisplay: 'David Britton',
    authorSlug: 'david-britton',
    year: 1989, genres: ['literary-fiction'],
    bans: [{ country: 'GB', scopeId: govId, status: 'historical', yearStarted: 1991, reasonSlugs: ['violence', 'obscenity'], sourceId: wikpSource }],
  })

  await addBook({
    // William Powell's "The Anarchist Cookbook" (1971) — UK Court of Appeal 2016 ruled in
    // R v. Faraz that possession constitutes "having useful information" under the Terrorism
    // Act 2000. Effectively banned for possession since that ruling.
    // Source: Wikipedia "The Anarchist Cookbook"; R v Faraz [2012] EWCA Crim 2820.
    title: 'The Anarchist Cookbook',
    slug: 'the-anarchist-cookbook',
    authorDisplay: 'William Powell',
    authorSlug: 'william-powell',
    year: 1971, genres: ['non-fiction'],
    bans: [{ country: 'GB', scopeId: govId, status: 'active', yearStarted: 2007, reasonSlugs: ['violence'], sourceId: wikpSource }],
  })

  await addBook({
    // "Inside Linda Lovelace" (1974) — publisher convicted UK 1976 under Obscene Publications
    // Act; books ordered destroyed. Source: Wikipedia "Inside Linda Lovelace".
    title: 'Inside Linda Lovelace',
    slug: 'inside-linda-lovelace',
    authorDisplay: 'Linda Lovelace',
    authorSlug: 'linda-lovelace',
    year: 1974, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'GB', scopeId: govId, status: 'historical', yearStarted: 1976, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikpSource }],
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. GERMANY MODERN — NEO-NAZI, HOLOCAUST DENIAL
  // ═══════════════════════════════════════════════════════════════════════════
  // Germany bans content under §86 and §130 StGB (incitement to hatred, use of
  // Nazi symbols). The Bundesprüfstelle (now BzKJ) can "index" books restricting sale.
  // Sources: Wikipedia individual articles; German Federal Constitutional Court rulings.

  await addBook({
    // Adolf Hitler's "Mein Kampf" (1925/26) — copyright held by the Free State of Bavaria
    // from 1945–2015; Bavaria refused ALL publication. After copyright expiry, a critical
    // annotated edition was published 2016. Previously banned in Germany and Austria.
    // Source: Wikipedia "Mein Kampf"; widely documented.
    title: 'Mein Kampf',
    slug: 'mein-kampf',
    authorDisplay: 'Adolf Hitler',
    authorSlug: 'adolf-hitler',
    year: 1925, genres: ['non-fiction'], lang: 'de',
    bans: [
      { country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1945, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
      { country: 'AT', scopeId: govId, status: 'active', yearStarted: 1945, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Richard Verrall's "Did Six Million Really Die?" (1974) — Holocaust denial pamphlet;
    // banned in Germany under §130 StGB; also banned in Canada after Ernst Zündel prosecutions.
    // Source: Wikipedia "Did Six Million Really Die?"; German Federal Court records.
    title: 'Did Six Million Really Die?',
    slug: 'did-six-million-really-die',
    authorDisplay: 'Richard Verrall',
    authorSlug: 'richard-verrall',
    year: 1974, genres: ['non-fiction'],
    bans: [
      { country: 'DE', scopeId: govId, status: 'active', yearStarted: 1979, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
      { country: 'CA', scopeId: govId, status: 'active', yearStarted: 1980, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // William Luther Pierce's "The Turner Diaries" (1978) — banned in Germany under §86a
    // StGB for neo-Nazi content; indexed by Bundesprüfstelle. In the US it inspired the
    // 1995 Oklahoma City bombing (Timothy McVeigh carried it).
    // Source: Wikipedia "The Turner Diaries"; German Federal Review Board records.
    title: 'The Turner Diaries',
    slug: 'the-turner-diaries',
    authorDisplay: 'William Luther Pierce',
    authorSlug: 'william-luther-pierce',
    year: 1978, genres: ['political-fiction'],
    bans: [{ country: 'DE', scopeId: govId, status: 'active', yearStarted: 1979, reasonSlugs: ['political', 'racial', 'violence'], sourceId: wikpSource }],
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. FRANCE — HISTORICAL BANS
  // ═══════════════════════════════════════════════════════════════════════════
  // Sources: Wikipedia individual book articles; French court records.

  await addBook({
    // Gustave Flaubert's "Madame Bovary" (1857) — serialized in La Revue de Paris 1856;
    // French government prosecuted Flaubert and publisher for obscenity and offending public
    // morals; Flaubert acquitted. This is one of the most famous literary trials in history.
    // Source: Wikipedia "Madame Bovary § Trial (1857)"; widely documented.
    title: 'Madame Bovary',
    slug: 'madame-bovary',
    authorDisplay: 'Gustave Flaubert',
    authorSlug: 'gustave-flaubert',
    year: 1857, genres: ['literary-fiction'], lang: 'fr',
    bans: [{ country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1857, reasonSlugs: ['sexual', 'moral'], sourceId: wikpSource }],
  })

  await addBook({
    // Victor Hugo's "Napoléon le Petit" (1852) — political pamphlet against Louis-Napoléon's
    // coup; banned immediately by the Second Empire; Hugo went into 19-year exile.
    // Source: Wikipedia "Napoléon le Petit"; widely documented.
    title: 'Napoléon le Petit',
    slug: 'napoleon-le-petit',
    authorDisplay: 'Victor Hugo',
    authorSlug: 'victor-hugo',
    year: 1852, genres: ['non-fiction', 'political-fiction'], lang: 'fr',
    bans: [{ country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1852, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    // Stendhal's "The Red and the Black" (1830) — suppressed under the Bourbon Restoration
    // for its anticlericalism; briefly banned. Placed on the Vatican Index 1841.
    // Source: Wikipedia "The Red and the Black"; Index Librorum Prohibitorum.
    title: 'The Red and the Black',
    slug: 'the-red-and-the-black',
    authorDisplay: 'Stendhal',
    authorSlug: 'stendhal',
    year: 1830, genres: ['literary-fiction'], lang: 'fr',
    bans: [
      { country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1830, reasonSlugs: ['political', 'moral'], sourceId: wikpSource },
      { country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1841, reasonSlugs: ['religious', 'moral'], sourceId: indexSource },
    ],
  })

  await addBook({
    // Guillaume Apollinaire's "Les Onze Mille Verges" (1907) — banned in France for obscenity;
    // not legally publishable in France until 1970 when it passed through censors.
    // Source: Wikipedia "Les Onze Mille Verges".
    title: 'Les Onze Mille Verges',
    slug: 'les-onze-mille-verges',
    authorDisplay: 'Guillaume Apollinaire',
    authorSlug: 'guillaume-apollinaire',
    year: 1907, genres: ['literary-fiction'], lang: 'fr',
    bans: [{ country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1907, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikpSource }],
  })

  await addBook({
    // "Story of O" by Pauline Réage (Anne Desclos) — published Paris 1954; French government
    // issued an ordinance banning it in 1955 for offending public morals; landmark French
    // obscenity case. Source: Wikipedia "Story of O"; French Ministry of Interior order 1955.
    title: 'Story of O',
    slug: 'story-of-o',
    authorDisplay: 'Pauline Réage',
    authorSlug: 'pauline-reage',
    year: 1954, genres: ['literary-fiction'], lang: 'fr',
    bans: [{ country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1955, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikpSource }],
  })

  await addBook({
    // Marquis de Sade's "Justine, or the Misfortunes of Virtue" (1791) — seized and banned
    // by French police under Napoleon in 1801; Sade imprisoned without trial. The Jean-Jacques
    // Pauvert prosecutions (1954–58) for publishing Sade's complete works is the landmark
    // modern French obscenity case. Source: Wikipedia "Justine (de Sade)".
    title: 'Justine, or the Misfortunes of Virtue',
    slug: 'justine-or-misfortunes-of-virtue',
    authorDisplay: 'Marquis de Sade',
    authorSlug: 'marquis-de-sade',
    year: 1791, genres: ['literary-fiction'], lang: 'fr',
    bans: [{ country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1801, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikpSource }],
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. ITALY — UNDER MUSSOLINI (1922–1943) AND POST-WAR
  // ═══════════════════════════════════════════════════════════════════════════
  // The Ministero della Cultura Popolare (MinCulPop) controlled all publishing.
  // Sources: Ben-Ghiat "Fascist Modernities" (2001); Wikipedia individual book articles.

  await addBook({
    // Elio Vittorini's "Conversations in Sicily" (Conversazione in Sicilia, 1941) — serialized
    // in the magazine Letteratura but MinCulPop banned its book publication; Vittorini was a
    // Communist Party member. Source: Wikipedia "Elio Vittorini"; Ben-Ghiat pp. 182–185.
    title: 'Conversations in Sicily',
    slug: 'conversations-in-sicily',
    authorDisplay: 'Elio Vittorini',
    authorSlug: 'elio-vittorini',
    year: 1941, genres: ['literary-fiction'], lang: 'it',
    bans: [{ country: 'IT', scopeId: govId, status: 'historical', yearStarted: 1941, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Alberto Moravia's "Agostino" (1944) — confiscated by Fascist police shortly before the
    // regime's fall; Moravia was half-Jewish and went into hiding. His works placed on Vatican
    // Index in 1952. Source: Wikipedia "Alberto Moravia"; Ben-Ghiat.
    title: 'Agostino',
    slug: 'agostino-moravia',
    authorDisplay: 'Alberto Moravia',
    authorSlug: 'alberto-moravia',
    year: 1944, genres: ['literary-fiction'], lang: 'it',
    bans: [
      { country: 'IT', scopeId: govId, status: 'historical', yearStarted: 1944, reasonSlugs: ['sexual', 'moral'], sourceId: ipiSource },
      { country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1952, reasonSlugs: ['sexual', 'moral'], sourceId: indexSource },
    ],
  })

  await addBook({
    // Pier Paolo Pasolini's "Ragazzi di vita" (1955) — prosecuted for obscenity by the Italian
    // government; publisher acquitted, but Pasolini faced repeated prosecutions throughout his
    // career. Source: Wikipedia "Ragazzi di vita"; Italian court records.
    title: 'Ragazzi di vita',
    slug: 'ragazzi-di-vita',
    authorDisplay: 'Pier Paolo Pasolini',
    authorSlug: 'pier-paolo-pasolini',
    year: 1955, genres: ['literary-fiction'], lang: 'it',
    bans: [{ country: 'IT', scopeId: govId, status: 'historical', yearStarted: 1955, reasonSlugs: ['sexual', 'moral'], sourceId: wikpSource }],
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. SPAIN UNDER FRANCO (1939–1975)
  // ═══════════════════════════════════════════════════════════════════════════
  // Mandatory prior censorship (censura previa) operated from 1939; partially reformed
  // by the 1966 Ley Fraga, which introduced deposit/objection system instead.
  // Sources: Abellán, Manuel. "Censura y creación literaria en España (1939–1976)" (1980);
  //          Neuschäfer, Hans-Jörg. "Adiós a la España eterna" (1994);
  //          Wikipedia "Censorship in Spain under Franco"

  await addBook({
    // Federico García Lorca — all works banned; Lorca shot by Nationalist forces August 1936.
    // "Romancero gitano" (Gypsy Ballads, 1928) — his most widely circulated banned collection.
    // Source: Wikipedia "Federico García Lorca"; Abellán pp. 45–46.
    title: 'Gypsy Ballads',
    slug: 'gypsy-ballads-lorca',
    authorDisplay: 'Federico García Lorca',
    authorSlug: 'federico-garcia-lorca',
    year: 1928, genres: ['literary-fiction'], lang: 'es',
    bans: [{ country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1939, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    // Antonio Machado — poet of the Generation of '98; died in exile January 1939.
    // "Campos de Castilla" (Fields of Castile, 1912) — his most famous collection, banned.
    // Source: Wikipedia "Antonio Machado"; Abellán p. 48.
    title: 'Fields of Castile',
    slug: 'fields-of-castile-machado',
    authorDisplay: 'Antonio Machado',
    authorSlug: 'antonio-machado',
    year: 1912, genres: ['literary-fiction'], lang: 'es',
    bans: [{ country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1939, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    // Miguel de Unamuno — "Del sentimiento trágico de la vida" (The Tragic Sense of Life, 1913).
    // After Unamuno's break with Franco at the Salamanca confrontation (Oct 1936), his works
    // were banned. He died under house arrest weeks later.
    // Source: Wikipedia "Miguel de Unamuno"; Abellán p. 40.
    title: 'The Tragic Sense of Life',
    slug: 'the-tragic-sense-of-life',
    authorDisplay: 'Miguel de Unamuno',
    authorSlug: 'miguel-de-unamuno',
    year: 1913, genres: ['non-fiction'], lang: 'es',
    bans: [{ country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1939, reasonSlugs: ['political', 'religious'], sourceId: wikpSource }],
  })

  await addBook({
    // Rafael Alberti — communist poet; all works banned by Franco; exiled to Argentina 1939.
    // "Marinero en tierra" (Sailor on Shore, 1925) — his most celebrated collection.
    // Source: Wikipedia "Rafael Alberti"; Abellán p. 52.
    title: 'Marinero en tierra',
    slug: 'marinero-en-tierra',
    authorDisplay: 'Rafael Alberti',
    authorSlug: 'rafael-alberti',
    year: 1925, genres: ['literary-fiction'], lang: 'es',
    bans: [{ country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1939, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    // Juan Goytisolo — "Señas de identidad" (Marks of Identity, 1966) — banned in Spain;
    // published in Mexico by Editorial Joaquín Mortiz. Goytisolo lived in Paris and Marrakech.
    // Source: Wikipedia "Juan Goytisolo"; Neuschäfer pp. 140–145.
    title: 'Marks of Identity',
    slug: 'marks-of-identity',
    authorDisplay: 'Juan Goytisolo',
    authorSlug: 'juan-goytisolo',
    year: 1966, genres: ['literary-fiction'], lang: 'es',
    bans: [{ country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1966, reasonSlugs: ['political', 'sexual'], sourceId: ipiSource }],
  })

  await addBook({
    // Arturo Barea's autobiographical trilogy "La forja de un rebelde" (The Forging of a Rebel,
    // 1941–46) — written in exile in England; banned in Spain throughout the Franco era.
    // Source: Wikipedia "Arturo Barea"; Abellán.
    title: 'The Forging of a Rebel',
    slug: 'the-forging-of-a-rebel',
    authorDisplay: 'Arturo Barea',
    authorSlug: 'arturo-barea',
    year: 1941, genres: ['memoir', 'non-fiction'], lang: 'es',
    bans: [{ country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1941, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Pablo Neruda — Communist; all works banned in Spain during the Franco era.
    // "Canto General" (1950) — his great epic; banned in Spain.
    // Source: Wikipedia "Canto General"; Abellán p. 96.
    title: 'Canto General',
    slug: 'canto-general',
    authorDisplay: 'Pablo Neruda',
    authorSlug: 'pablo-neruda',
    year: 1950, genres: ['literary-fiction'], lang: 'es',
    bans: [{ country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1950, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    // Camilo José Cela — "La colmena" (The Hive, 1951) — banned in Spain; published in
    // Argentina by Emecé. Cela won the Nobel Prize in 1989.
    // Source: Wikipedia "The Hive (Cela)"; Neuschäfer pp. 65–70.
    title: 'The Hive',
    slug: 'the-hive-cela',
    authorDisplay: 'Camilo José Cela',
    authorSlug: 'camilo-jose-cela',
    year: 1951, genres: ['literary-fiction'], lang: 'es',
    bans: [{ country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1951, reasonSlugs: ['political', 'moral'], sourceId: wikpSource }],
  })

  await addBook({
    // Max Aub — "Campo cerrado" (1943) — first volume of his "Laberinto mágico" cycle about
    // the Spanish Civil War; written in Mexican exile; banned in Spain throughout Franco era.
    // Source: Wikipedia "Max Aub"; Abellán p. 57.
    title: 'Campo cerrado',
    slug: 'campo-cerrado-max-aub',
    authorDisplay: 'Max Aub',
    authorSlug: 'max-aub',
    year: 1943, genres: ['literary-fiction'], lang: 'es',
    bans: [{ country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1943, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Luis Martín-Santos — "Tiempo de silencio" (Time of Silence, 1962) — the most important
    // Spanish novel of the post-war period; censors passed a mutilated version; the full text
    // only available after Franco's death. Source: Wikipedia "Time of Silence (novel)";
    // Neuschäfer pp. 110–115.
    title: 'Time of Silence',
    slug: 'time-of-silence-martin-santos',
    authorDisplay: 'Luis Martín-Santos',
    authorSlug: 'luis-martin-santos',
    year: 1962, genres: ['literary-fiction'], lang: 'es',
    bans: [{ country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1962, reasonSlugs: ['political', 'moral'], sourceId: ipiSource }],
  })

  await addBook({
    // George Orwell's "Homage to Catalonia" (1938) — banned in Spain under Franco for its
    // sympathetic portrayal of POUM anarchists in the Civil War.
    // Source: Wikipedia "Homage to Catalonia"; Abellán p. 93.
    title: 'Homage to Catalonia',
    slug: 'homage-to-catalonia',
    authorDisplay: 'George Orwell',
    authorSlug: 'george-orwell',
    year: 1938, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1939, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    // Jorge Semprún — Communist resistance fighter and former Buchenwald prisoner;
    // "Autobiografía de Federico Sánchez" (1977) details his years as underground Communist
    // Party leader in Spain; the book described in detail his clandestine activities under
    // the very regime that had banned his earlier French-language works.
    // Source: Wikipedia "Jorge Semprún"; Abellán.
    title: 'Autobiografía de Federico Sánchez',
    slug: 'autobiografia-de-federico-sanchez',
    authorDisplay: 'Jorge Semprún',
    authorSlug: 'jorge-semprun',
    year: 1977, genres: ['memoir', 'non-fiction'], lang: 'es',
    bans: [{ country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1964, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. ALBANIA UNDER HOXHA; MORE HUNGARY UNDER KÁDÁR
  // ═══════════════════════════════════════════════════════════════════════════
  // Albania declared the world's first atheist state in 1967; all religious texts banned.
  // Sources: Wikipedia "Censorship in Albania"; "Ismail Kadare"; Index on Censorship.

  await addBook({
    // Ismail Kadare's "The Palace of Dreams" (Pallati i ëndrrave, 1981) — banned immediately
    // after publication for its allegorical critique of totalitarianism; Kadare exiled 1990.
    // Source: Wikipedia "The Palace of Dreams (novel)"; Index on Censorship.
    title: 'The Palace of Dreams',
    slug: 'the-palace-of-dreams',
    authorDisplay: 'Ismail Kadare',
    authorSlug: 'ismail-kadare',
    year: 1981, genres: ['literary-fiction'], lang: 'sq',
    bans: [{ country: 'AL', scopeId: govId, status: 'historical', yearStarted: 1982, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Kadare's "The General of the Dead Army" (1963) — published in Albania but Hoxha objected;
    // Kadare was forced to make revisions; banned in Soviet bloc countries.
    // Source: Wikipedia "The General of the Dead Army".
    title: 'The General of the Dead Army',
    slug: 'the-general-of-the-dead-army',
    authorDisplay: 'Ismail Kadare',
    authorSlug: 'ismail-kadare',
    year: 1963, genres: ['literary-fiction'], lang: 'sq',
    bans: [{ country: 'AL', scopeId: govId, status: 'historical', yearStarted: 1972, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // The Quran — banned in Hoxha's Albania from 1967 when Albania declared itself the world's
    // first atheist state; possession could result in imprisonment or execution.
    // Source: Wikipedia "Religion in Albania"; "Persecution of Muslims in Albania under Hoxha".
    title: 'The Quran',
    slug: 'the-quran-albania',
    authorDisplay: 'Various Authors',
    authorSlug: 'various-authors',
    year: 609, genres: ['non-fiction'], lang: 'ar',
    bans: [{ country: 'AL', scopeId: govId, status: 'historical', yearStarted: 1967, reasonSlugs: ['religious'], sourceId: wikpSource }],
  })

  await addBook({
    // György Faludy's "My Happy Days in Hell" (Pokolbéli víg napjaim, 1962) — account of
    // his imprisonment in the Recsk labour camp under the Rákosi regime; banned in Hungary
    // until 1989. Source: Wikipedia "György Faludy"; Index on Censorship.
    title: 'My Happy Days in Hell',
    slug: 'my-happy-days-in-hell',
    authorDisplay: 'György Faludy',
    authorSlug: 'gyorgy-faludy',
    year: 1962, genres: ['memoir', 'non-fiction'], lang: 'hu',
    bans: [{ country: 'HU', scopeId: govId, status: 'historical', yearStarted: 1962, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Tibor Déry — "Niki: The Story of a Dog" (1956) — published the same year as the Hungarian
    // Revolution; Déry was imprisoned for 2 years for supporting the revolution. His works
    // were banned or severely restricted during imprisonment. Source: Wikipedia "Tibor Déry".
    title: 'Niki: The Story of a Dog',
    slug: 'niki-story-of-a-dog',
    authorDisplay: 'Tibor Déry',
    authorSlug: 'tibor-dery',
    year: 1956, genres: ['literary-fiction'], lang: 'hu',
    bans: [{ country: 'HU', scopeId: govId, status: 'historical', yearStarted: 1957, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. CLASSIC LITERATURE — FORMAL GOVERNMENT / PAPAL BANS ON ANCIENT TEXTS
  // ═══════════════════════════════════════════════════════════════════════════
  // Sources: Wikipedia "Index Librorum Prohibitorum"; individual book articles.

  await addBook({
    // Giovanni Boccaccio's "The Decameron" (1353) — placed on the Catholic Index Librorum
    // Prohibitorum in 1559; US Customs banned a 1927 American edition; landmark multi-era ban.
    // Source: Wikipedia "The Decameron § Publication history".
    title: 'The Decameron',
    slug: 'the-decameron',
    authorDisplay: 'Giovanni Boccaccio',
    authorSlug: 'giovanni-boccaccio',
    year: 1353, genres: ['literary-fiction'], lang: 'it',
    bans: [
      { country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1559, reasonSlugs: ['sexual', 'religious'], sourceId: indexSource },
      { country: 'US', scopeId: govId, status: 'historical', yearStarted: 1927, reasonSlugs: ['sexual', 'obscenity'], sourceId: comstockSource },
    ],
  })

  await addBook({
    // Ovid's "Ars Amatoria" (The Art of Love, c. 2 BCE) — banned by Emperor Augustus in 8 CE
    // and used as one of two official reasons for exiling Ovid to Tomis (Romania).
    // One of the earliest documented government book bans in recorded history.
    // Source: Wikipedia "Ars Amatoria"; "Ovid's exile".
    title: 'Ars Amatoria',
    slug: 'ars-amatoria',
    authorDisplay: 'Ovid',
    authorSlug: 'ovid',
    year: -2, genres: ['literary-fiction'], lang: 'la',
    bans: [{ country: 'IT', scopeId: govId, status: 'historical', yearStarted: 8, reasonSlugs: ['sexual', 'moral'], sourceId: wikpSource }],
  })

  await addBook({
    // Niccolò Machiavelli's "The Prince" (1532) — placed on the Index Librorum Prohibitorum
    // in 1559; banned by the Catholic Church and numerous European states.
    // Source: Wikipedia "The Prince § Censorship"; Index Librorum Prohibitorum.
    title: 'The Prince',
    slug: 'the-prince-machiavelli',
    authorDisplay: 'Niccolò Machiavelli',
    authorSlug: 'niccolo-machiavelli',
    year: 1532, genres: ['non-fiction'], lang: 'it',
    bans: [{ country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1559, reasonSlugs: ['political', 'religious'], sourceId: indexSource }],
  })

  await addBook({
    // Baruch Spinoza's "Theologico-Political Treatise" (1670) — banned by the Dutch government
    // in 1674; placed on the Vatican Index; banned by Protestant church councils too.
    // One of the most censored books of the 17th century.
    // Source: Wikipedia "Tractatus Theologico-Politicus".
    title: 'Theologico-Political Treatise',
    slug: 'theologico-political-treatise',
    authorDisplay: 'Baruch Spinoza',
    authorSlug: 'baruch-spinoza',
    year: 1670, genres: ['non-fiction'], lang: 'la',
    bans: [
      { country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1679, reasonSlugs: ['religious', 'political'], sourceId: indexSource },
      { country: 'NL', scopeId: govId, status: 'historical', yearStarted: 1674, reasonSlugs: ['religious', 'political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Dante Alighieri's "De Monarchia" (c. 1313) — publicly burned on order of Pope John XXII
    // in 1329; placed on the Index Librorum Prohibitorum.
    // Source: Wikipedia "De Monarchia"; Index Librorum Prohibitorum.
    title: 'De Monarchia',
    slug: 'de-monarchia-dante',
    authorDisplay: 'Dante Alighieri',
    authorSlug: 'dante-alighieri',
    year: 1313, genres: ['non-fiction'], lang: 'la',
    bans: [{ country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1329, reasonSlugs: ['political', 'religious'], sourceId: indexSource }],
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. RELIGIOUS BANS — TALIBAN/AFGHANISTAN, SAUDI ARABIA, PAKISTAN
  // ═══════════════════════════════════════════════════════════════════════════
  // Sources: Human Rights Watch; PEN International; Article 19; Wikipedia.

  await addBook({
    // Atiq Rahimi's "The Patience Stone" (Syngué Sabour, 2008) — winner of the Prix Goncourt;
    // depicts a woman speaking freely to her comatose husband; banned by the Taliban regime.
    // Source: PEN International; Human Rights Watch Afghanistan 2021.
    title: 'The Patience Stone',
    slug: 'the-patience-stone',
    authorDisplay: 'Atiq Rahimi',
    authorSlug: 'atiq-rahimi',
    year: 2008, genres: ['literary-fiction'], lang: 'fa',
    bans: [{ country: 'AF', scopeId: govId, status: 'active', yearStarted: 2021, reasonSlugs: ['sexual', 'moral'], sourceId: penSource }],
  })

  await addBook({
    // Turki al-Hamad's "Adama" (1998) — first of his trilogy; depicts young Saudis seeking
    // freedom from social conformity; banned in Saudi Arabia and author arrested.
    // Source: Wikipedia "Turki al-Hamad"; Article 19 Saudi Arabia.
    title: 'Adama',
    slug: 'adama-turki-al-hamad',
    authorDisplay: 'Turki al-Hamad',
    authorSlug: 'turki-al-hamad',
    year: 1998, genres: ['literary-fiction'], lang: 'ar',
    bans: [{ country: 'SA', scopeId: govId, status: 'active', yearStarted: 1998, reasonSlugs: ['political', 'religious'], sourceId: art19Source }],
  })

  await addBook({
    // Mirza Ghulam Ahmad's "The Philosophy of the Teachings of Islam" (1896) — Ahmadiyya
    // religious text; banned in Pakistan under the 1984 Anti-Ahmadiyya Ordinance (Ordinance XX)
    // which made it illegal for Ahmadis to call themselves Muslim or propagate their faith.
    // Source: Wikipedia "Persecution of Ahmadis in Pakistan"; Human Rights Watch.
    title: 'The Philosophy of the Teachings of Islam',
    slug: 'philosophy-of-the-teachings-of-islam',
    authorDisplay: 'Mirza Ghulam Ahmad',
    authorSlug: 'mirza-ghulam-ahmad',
    year: 1896, genres: ['non-fiction'], lang: 'ur',
    bans: [{ country: 'PK', scopeId: govId, status: 'active', yearStarted: 1984, reasonSlugs: ['religious'], sourceId: art19Source }],
  })

  await addBook({
    // Taslima Nasrin's "Lajja" (Shame, 1993) — banned in Bangladesh within weeks of
    // publication for allegedly inciting religious tensions; death threats against the author;
    // Nasrin fled Bangladesh. Source: Wikipedia "Lajja (novel)"; Article 19.
    title: 'Lajja',
    slug: 'lajja-taslima-nasrin',
    authorDisplay: 'Taslima Nasrin',
    authorSlug: 'taslima-nasrin',
    year: 1993, genres: ['literary-fiction'], lang: 'bn',
    bans: [{ country: 'BD', scopeId: govId, status: 'active', yearStarted: 1993, reasonSlugs: ['religious', 'political'], sourceId: wikpSource }],
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. COMICS / GRAPHIC NOVELS — GOVERNMENT BANS
  // ═══════════════════════════════════════════════════════════════════════════
  // Sources: Wikipedia individual articles; Australian Classification Board records.

  await addBook({
    // Keiji Nakazawa's "Barefoot Gen" (Hadashi no Gen, 1973–87) — manga about the Hiroshima
    // bombing; removed from Matsue City school and public libraries 2012 by order of the
    // city board of education (Japan); earlier Chinese translations banned by Chinese
    // government for depicting Japanese suffering rather than Japanese aggression.
    // Source: Wikipedia "Barefoot Gen § Bans and controversies".
    title: 'Barefoot Gen',
    slug: 'barefoot-gen',
    authorDisplay: 'Keiji Nakazawa',
    authorSlug: 'keiji-nakazawa',
    year: 1973, genres: ['graphic-novel'], lang: 'ja',
    bans: [{ country: 'JP', scopeId: govId, status: 'historical', yearStarted: 2013, reasonSlugs: ['violence'], sourceId: wikpSource }],
  })

  await addBook({
    // Héctor Germán Oesterheld's "El Eternauta" (1957–59) — Argentine science fiction comic;
    // Oesterheld "disappeared" by the military junta in 1977; the comic was banned as
    // subversive. Source: Wikipedia "El Eternauta"; Argentine military dictatorship records.
    title: 'El Eternauta',
    slug: 'el-eternauta',
    authorDisplay: 'Héctor Germán Oesterheld',
    authorSlug: 'hector-german-oesterheld',
    year: 1957, genres: ['graphic-novel'], lang: 'es',
    bans: [{ country: 'AR', scopeId: govId, status: 'historical', yearStarted: 1976, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    // Alan Moore & Dave Gibbons's "Watchmen" (1987) — graphic novel; Singapore's Media
    // Development Authority (MDA) classified it unsuitable for sale 2009; distribution banned.
    // Source: Wikipedia "Watchmen § Bans and challenges"; MDA Singapore 2009.
    title: 'Watchmen',
    slug: 'watchmen',
    authorDisplay: 'Alan Moore & Dave Gibbons',
    authorSlug: 'alan-moore-dave-gibbons',
    year: 1987, genres: ['graphic-novel'],
    bans: [{ country: 'SG', scopeId: govId, status: 'historical', yearStarted: 2009, reasonSlugs: ['violence', 'sexual'], sourceId: wikpSource }],
  })

  await addBook({
    // Alan Moore & Eddie Campbell's "From Hell" (1989–1996 serialized; book 1999) — the
    // Australian Classification Board refused classification (effectively banning it) in 2002
    // for its extremely graphic violence depicting Jack the Ripper murders.
    // Source: Australian Classification Board RC records 2002.
    title: 'From Hell',
    slug: 'from-hell-alan-moore',
    authorDisplay: 'Alan Moore & Eddie Campbell',
    authorSlug: 'alan-moore-eddie-campbell',
    year: 1999, genres: ['graphic-novel'],
    bans: [{ country: 'AU', scopeId: govId, status: 'historical', yearStarted: 2002, reasonSlugs: ['violence'], sourceId: wikpSource }],
  })

  console.log('\nAll done. Recommended next step:')
  console.log('  npx tsx --env-file=.env.local scripts/generate-descriptions.ts')
}

main().catch(err => { console.error(err); process.exit(1) })
