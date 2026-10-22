/**
 * _botd_week_2026_09_14.ts — pre-flight fixes for the book-of-the-day picks of
 * 2026-09-14 … 2026-09-21. Produced by the /botd-week skill.
 *
 * Authors (grounded, namesake-checked against Wikidata birth year + description):
 *   233  Sapphire            Q461075 (b. 1950-08-04, matches authors.birth_year 1950)
 *   389  Atsushi Ohkubo      Q757810 (already stored; bio stamped + widened)
 *   635  Breyten Breytenbach Q364207 (b. 1939-09-16, d. 2024-11-24 — matches our row)
 *  1064  Jessica Verdi       no Wikidata entity; grounded in her own site
 *  1499  John Berendt        Q3030493 (b. 1939-12-05, matches authors.birth_year 1939)
 *  6020  Deborah Ellis       Q290374 (bio already stamped; birthday fields only)
 *
 * Two CONTAMINATED author photos found and fixed:
 *   233 Sapphire  held File:Logan_Sapphire_10956420_cropped.png — the Logan
 *                 Sapphire GEMSTONE at the Smithsonian, not the author.
 *                 Replaced with Commons File:Sapphire 2014.jpg (CC BY 2.0),
 *                 viewed and consistent with the author (Black woman, b. 1950).
 *  1064 Jessica Verdi held File:Hayden_Panettiere_2009_(Straighten_Crop).jpg —
 *                 a photo of the ACTRESS Hayden Panettiere. Nulled; no free
 *                 portrait of Verdi exists on Commons.
 *
 * Book 2397 (Midnight in the Garden of Good and Evil) carried a confabulated
 * description_book naming the victim as "Billy Carl Hanson" (the real victim is
 * Danny Hansford) and calling Jim Williams a "millionaire" (he was an antiques
 * dealer). Rewritten from the Wikipedia article and re-stamped. Its
 * description_ban is garbled but traceable (it echoes the article's line about
 * Berendt "creating a relationship between Joe Odom (a homosexual) and Nancy
 * Hillis") and was left alone. Its genre was
 * the known importer stamp 'literary-fiction' on a work of non-fiction.
 *
 * Book 1738 (And She Was) had first_published_year 1994-era junk: 2013, which
 * is the year of Verdi's DEBUT (My Life After Now). And She Was is Scholastic
 * 2018 (author's own site + OpenLibrary).
 *
 * Read-only by default; pass --apply to write.
 */
import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { isApply } from './lib/cli'

const NOW = new Date().toISOString()
const APPLY = isApply()

const WP = (t: string) => `https://en.wikipedia.org/wiki/${t}`

type Patch = { id: number; label: string; patch: Record<string, unknown> }

const AUTHORS: Patch[] = [
  {
    id: 233,
    label: 'Sapphire',
    patch: {
      bio: [
        'Sapphire is the pen name of Ramona Lofton (born 4 August 1950 in Fort Ord, California), an American author and performance poet. One of four children of an army couple, she dropped out of high school and took a GED in San Francisco, studied at City College of San Francisco and City College of New York, and eventually took an MFA at Brooklyn College. She moved to New York City in 1977, worked as a performance artist and as a teacher of reading and writing, and became part of the slam poetry movement; she took the name Sapphire for its cultural associations and its marketability, and was a member of United Lesbians of Color for Change.',
        'She self-published Meditations on the Rainbow in 1987, and followed it with the collection American Dreams (1994) and Black Wings & Blind Angels: Poems (1999). Her first novel, Push (1996), is narrated by Precious Jones, an illiterate sixteen-year-old in Harlem, pregnant with a second child by her father and battered by her mother, who begins to write her way out of that life after meeting a radical teacher. Lee Daniels’ film adaptation, Precious, premiered at the Sundance Film Festival in January 2009 and won Mo’Nique the Academy Award for Best Supporting Actress. Sapphire received a Fellow Award in Literature from United States Artists in 2009, and published a second novel, The Kid, in 2011.',
        'Push is one of the most heavily censored titles in this database: 52 recorded bans and restrictions, every one of them in a United States school district — 34 outright removals and 18 restrictions — spread across fourteen states. Florida accounts for eighteen of them, Iowa for eleven and Texas for six, with the rest in Utah, Michigan, North Carolina, Georgia, Wisconsin, Minnesota, South Carolina, Pennsylvania, Maine, Colorado and Tennessee. The earliest recorded here dates from 2022 and the most recent from 2026.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: WP('Sapphire_(author)'),
      wikidata_id: 'Q461075',
      social_links: {
        twitter: 'https://x.com/MsSapph',
        instagram: 'https://www.instagram.com/sapphiretheauthor/',
        viaf: 'https://viaf.org/viaf/7505505',
      },
      birth_month: 8,
      birth_day: 4,
      birth_country: 'United States',
      photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Sapphire_2014.jpg/500px-Sapphire_2014.jpg',
      photo_v2_checked_at: NOW,
      links_checked_at: NOW,
    },
  },
  {
    id: 389,
    label: 'Atsushi Ohkubo',
    patch: {
      bio: [
        'Atsushi Ohkubo (Japanese: 大久保 篤, Hepburn: Ōkubo Atsushi; born 20 September 1979) is a Japanese manga artist, best known for Soul Eater and Fire Force, both of which were adapted into anime television series. He preferred drawing to school, and at twenty, after finishing manga school — where he met Rando Ayamine — he spent two years as Ayamine’s assistant on the series GetBackers.',
        'His own debut, B. Ichi, ran in Square Enix’s Monthly Shōnen Gangan from 2001 to 2003 after he won a magazine competition, and filled four volumes. Soul Eater followed in the same magazine from 2004 to 2013 and brought him worldwide success, with the five-volume spin-off Soul Eater Not! running from 2011 to 2014. Fire Force, his first weekly series, ran in Kodansha’s Weekly Shōnen Magazine from 2015 to 2022 and was adapted into three anime seasons; in May 2020 he announced it would be his last manga. He has also drawn artwork for the video game Lord of Vermilion, designed characters for Bravely Default and Bravely Second: End Layer, and was character designer for the 2023 anime KamiErabi God.app.',
        'Twenty-seven of his volumes are recorded in this database, carrying 69 bans and restrictions between them — all of them in United States school districts, most in Tennessee (27), Pennsylvania (17) and Florida (16). Fire Force, Vol. 1 accounts for five: restricted in St. John’s County School District in Florida and King George County Schools in Virginia (both 2024), and banned in Rockwood School District in Missouri (2022) and in Oak Ridge Schools and Rutherford County Schools in Tennessee (both 2025).',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: WP('Atsushi_Ohkubo'),
      birth_country: 'Japan',
      links_checked_at: NOW,
    },
  },
  {
    id: 635,
    label: 'Breyten Breytenbach',
    patch: {
      bio: [
        'Breyten Breytenbach (16 September 1939 – 24 November 2024) was a South African writer, poet and painter, one of the foremost figures in Afrikaans literature and, for most of his life, a dissident critic of apartheid. He was born in Bonnievale in the Cape Province, attended Hoërskool Hugenote in Wellington, and studied fine art at the Michaelis School of Fine Art and philology at the University of Cape Town. He was a younger brother of the SADF commander Jan Breytenbach and the war correspondent Cloete Breytenbach.',
        'He left South Africa in the early 1960s for Europe and settled in Paris, where in 1962 he married Yolande Ngo Thi Hoang Lien, a daughter of the South Vietnamese ambassador to France; the apartheid government’s Prohibition of Mixed Marriages Act and Immorality Act, which made sexual relations across the colour line a criminal offence, kept the couple out of the country. In 1961 he was a founding member of the Sestigers, the dissident movement of Afrikaans writers ranged against apartheid, and his first collection, Die Ysterkoei Moet Sweet, appeared in 1964. Returning clandestinely on a false passport in 1975 to help organise trade unions and recruit for Okhela — which he described in court as a branch of the ANC for white people — he was arrested, charged under the Terrorism Act and sentenced to nine years for high treason, the first two in solitary confinement. He wrote five volumes of poetry and prose in prison and was released in December 1982 after international protest and the intervention of President François Mitterrand. He later took French citizenship, became a visiting professor at the University of Cape Town in 2000 and taught at Princeton and New York University, curated the Stellenbosch poetry festival from 2013, and won several Hertzog Prizes, the Alan Paton Award in 1994 and the Zbigniew Herbert International Literary Award in 2017. He died in Paris on 24 November 2024, aged 85.',
        'Two of his books are recorded in this database, both banned nationally in apartheid South Africa. Skryt: Om ’n sinkende skip blou te verf (1972) was banned in 1975 over the poem “Brief uit die vreemde aan slagter”, addressed to Prime Minister Vorster and listing detainees who had died in police custody — only the second Afrikaans literary work ever banned. The True Confessions of an Albino Terrorist, his account of those seven years in prison, was banned in 1984, the year it appeared.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: WP('Breyten_Breytenbach'),
      wikidata_id: 'Q364207',
      social_links: { viaf: 'https://viaf.org/viaf/300425129' },
      birth_month: 9,
      birth_day: 16,
      links_checked_at: NOW,
    },
  },
  {
    id: 1064,
    label: 'Jessica Verdi',
    patch: {
      bio: [
        'Jessica Verdi, who works and writes as Jess Verdi, is an American author of young adult fiction and a book editor. She received her MFA in Writing for Children from The New School and lives in Brooklyn, New York. She spent close to ten years in the New York theatre world before an idea for a novel sent her to fiction; she is now a senior editor at Harlequin (HarperCollins), acquiring and editing LGBTQ+ and male/female romance for the Afterglow and Carina imprints.',
        'She has written five young adult novels — My Life After Now (2013), The Summer I Wasn’t Me (2014), What You Left Behind (2015), And She Was (2018) and Follow Your Arrow (2021) — and is co-author of the picture book I’m Not a Girl (2020). Follow Your Arrow, published by Scholastic in March 2021, follows CeCe Ross, a teenage social-media influencer known with her girlfriend Silvie as one half of #relationshipgoals, who is left to work out who she is online and off after the break-up. Kirkus called it “a page-turning exploration of the perils of social media and the complexities of sexuality”.',
        'Two of her books appear in this database, carrying eight recorded restrictions and bans between them, all in United States school districts. Follow Your Arrow is restricted in Collierville Schools in Tennessee and Fredericksburg Independent School District in Texas (both 2022) and in Katy Independent School District in Texas (2024). And She Was is restricted in North East Independent School District in Texas (2021), Collierville Schools (2022), Escambia County Public Schools in Florida (2023) and Katy ISD (2024), and was banned across the Department of Defense Education Activity’s schools in 2025.',
      ].join('\n\n'),
      bio_source_type: 'manual',
      bio_source_url: 'https://www.jessverdi.com/',
      website_url: 'https://www.jessverdi.com/',
      social_links: { instagram: 'https://www.instagram.com/jessverdi/' },
      // Contaminated: the stored photo was the actress Hayden Panettiere.
      photo_url: null,
      photo_v2_checked_at: NOW,
      birth_country: 'United States',
      links_checked_at: NOW,
    },
  },
  {
    id: 1499,
    label: 'John Berendt',
    patch: {
      bio: [
        'John Berendt (born 5 December 1939 in Syracuse, New York) is an American author and journalist. Both of his parents were writers. He read English at Harvard, where he worked on the staff of the Harvard Lampoon, graduating in 1961, and then spent three decades in New York journalism: associate editor at Esquire from 1961 to 1969, editor of New York magazine from 1977 to 1979, and an Esquire columnist from 1982 to 1994.',
        'In 1985, three years after meeting the Savannah antiques dealer Jim Williams, Berendt moved to Georgia and spent seven years researching his first book. Midnight in the Garden of Good and Evil, published by Random House in January 1994, is a non-fiction account of Savannah society built around the shooting of Williams’s employee Danny Hansford and the four murder trials that followed, the last of which ended in acquittal. It spent a record 216 weeks on the New York Times bestseller list, was a finalist for the 1995 Pulitzer Prize in General Nonfiction, and was filmed by Clint Eastwood in 1997. His second book, The City of Falling Angels (2005), follows the people of Venice in the months after the 1996 fire that destroyed the La Fenice opera house; he also published the photographic children’s book My Baby Blue Jays in 2011. A musical adaptation of Midnight opened at Chicago’s Goodman Theatre in 2024.',
        'Midnight in the Garden of Good and Evil has three recorded bans and restrictions in this database, all in United States school districts: restricted in Escambia County Public Schools in Florida in 2023, banned in Winterset Community School District in Iowa in 2023, and banned in Clay County School District in Florida in 2025.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: WP('John_Berendt'),
      wikidata_id: 'Q3030493',
      social_links: { viaf: 'https://viaf.org/viaf/99658961' },
      birth_month: 12,
      birth_day: 5,
      links_checked_at: NOW,
    },
  },
  {
    id: 6020,
    label: 'Deborah Ellis',
    patch: {
      // en.wikipedia gives "born August 7, 1960"; Wikidata P569 says 1960-08-08.
      // We follow Wikipedia, which is the source our stamped bio already cites.
      birth_month: 8,
      birth_day: 7,
      links_checked_at: NOW,
    },
  },
]

const BOOKS: Patch[] = [
  {
    id: 2397,
    label: 'Midnight in the Garden of Good and Evil',
    patch: {
      description_book:
        'John Berendt’s non-fiction account of Savannah, Georgia, built around the shooting of Danny Hansford — a local man who worked for the respected antiques dealer Jim Williams and was his casual sexual partner — and around the four murder trials that followed. The last of them ended in acquittal, after a change of venue away from the Savannah jury pool, on Williams’s account that he had fired in self-defence. Around that case Berendt assembles the Southern Gothic city he found when he moved there in 1985, in a book that was published by Random House in January 1994, stayed on the New York Times bestseller list for 216 weeks and was a finalist for the 1995 Pulitzer Prize in General Nonfiction.',
      description_source_type: 'wikipedia',
      description_source_url: WP('Midnight_in_the_Garden_of_Good_and_Evil'),
      genres: ['non-fiction'],
    },
  },
  {
    id: 1738,
    label: 'And She Was',
    patch: { first_published_year: 2018 },
  },
]

async function apply(table: 'authors' | 'books', rows: Patch[]) {
  const sb = adminClient()
  let total = 0
  for (const r of rows) {
    const sel = ['id', 'slug', ...Object.keys(r.patch)].filter((v, i, s) => s.indexOf(v) === i).join(',')
    const { data: before, error: e1 } = await sb.from(table).select(sel).eq('id', r.id).single()
    if (e1) throw e1
    console.log(`\n--- ${table} ${r.id} ${r.label}`)
    console.log('BEFORE:', JSON.stringify(before))
    if (!APPLY) {
      console.log('AFTER : (dry run) would set', JSON.stringify(Object.keys(r.patch)))
      continue
    }
    const { data: after, error: e2 } = await sb
      .from(table)
      .update({ ...r.patch, updated_at: NOW })
      .eq('id', r.id)
      .select(sel)
    if (e2) throw e2
    console.log('AFTER :', JSON.stringify(after?.[0]))
    total += after?.length ?? 0
  }
  return total
}

async function main() {
  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN (pass --apply to write) ===')
  for (const a of AUTHORS) {
    const p = a.patch.photo_url
    if (typeof p === 'string' && !isAllowedImageUrl(p)) throw new Error(`photo_url rejected for ${a.label}: ${p}`)
  }
  const nA = await apply('authors', AUTHORS)
  const nB = await apply('books', BOOKS)
  console.log(`\n== rows: authors ${nA}, books ${nB}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
