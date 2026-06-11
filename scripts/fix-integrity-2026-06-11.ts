// fix-integrity-2026-06-11.ts — one-off remediation for the 3 invariants
// audit-integrity.ts flagged on 2026-06-11 (mojibake ×3, empty book ×1,
// impossible-year ×11). Each fix is researched + hardcoded; see comments.
//
// Run:   pnpm tsx --env-file=.env.local scripts/fix-integrity-2026-06-11.ts          (dry-run)
//        pnpm tsx --env-file=.env.local scripts/fix-integrity-2026-06-11.ts --apply

import { adminClient } from '../src/lib/supabase'

const sb = adminClient()
const APPLY = process.argv.includes('--apply')

// ── 1. Mojibake: Latin-1→UTF-8 decode failure turned every French accented
//      char into U+FFFD in description_book of three Liste-Otto books.
//      Texts reconstructed from French orthography (every � was a single
//      accented char / guillemet — unambiguous in context).
const MOJIBAKE_FIXES: { id: number; slug: string; description_book: string }[] = [
  {
    id: 15102,
    slug: 'finances-de-guerre',
    description_book:
      "La présente édition propose la reproduction de deux discours introuvables et importants non seulement dans le domaine économique mais également dans les ressorts psychologiques, l'appréhension, la perception, par les contemporains, de cette guerre qui se met en place progressivement. A sa prise de fonction, le 1er novembre 1938, au poste de ministre des finances, Paul Reynaud ne jouit pas de la confiance de ses concitoyens car il préconise une politique opposée à celle du Front populaire. Un an plus tard, le 13 et 28 décembre 1939, le ministre soumet, aux deux Chambres du Parlement, le premier budget de guerre et propose un bilan du dernier budget de paix. Dans ces discours, méconnus et prononcés trois mois après le déclenchement de la seconde guerre mondiale, le ministre des finances revient sur les mesures économiques, sociales et financières du Front populaire qu'il désapprouve.",
  },
  {
    id: 14759,
    slug: 'leglise-et-la-guerre',
    description_book:
      "« Le catholicisme survit en France, sinon comme une loi religieuse fidèlement observée par tous, au moins comme un statut social dont bien peu se sont départis. » C'est Waldeck-Rousseau qui tenait ce langage, en 1903, dans un discours au Sénat. Il énonçait ainsi l'exacte vérité ; et ces simples mots rendaient un hommage à ce que représente l'Eglise de France dans l'atmosphère morale du pays. Quelle que soit la tiédeur de beaucoup de populations, quelque indifférentes que parfois elles puissent être aux conséquences religieuses de leurs votes, un certain nombre de Français écoutent l'Eglise comme une institutrice de bonne vie, un très grand nombre la convoquent comme une garante de bonne mort.Et, près de ceux-ci comme de ceux-là, l'Eglise tout de suite est la bienvenue, lorsque sonne une heure comme celle de la guerre, où la bonne vie doit s'exalter jusqu'à l'héroïsme, où la mort est constamment proche. Dans le double mouvement par lequel les âmes se rapprochent de l'Eglise, par lequel l'Eglise se rapproche des âmes, se déchaîne alors une force d'élan qui balaie les malentendus, fait taire les susceptibilités et pour un instant au moins, rend à la vieille Eglise un persuasif ascendant. Voilà vingt-huit mois que l'Eglise de France met cet ascendant au service de la France... »",
  },
  {
    id: 14890,
    slug: 'les-fables-de-la-fontaine-et-hitler',
    description_book:
      "Ce livre contient les volumes 1 à 4 et est agrémenté d'illustrations d'époque. Les Fables choisies, mises en vers par M. de La Fontaine, appelées simplement Fables de La Fontaine publiés par Jean de La Fontaine entre 1668 et 1694. La plupart, pas toutes, mettent en scène des animaux anthropomorphes et finissent, parfois commencent, par une morale.L'auteur y invente un genre en rupture avec les traditions ésopique, évangélique et humaniste, où le style et l'esprit plus que le propos se veulent didactiques. Modèle du français moderne, ces apologues sont utilisés dès le début du xviiie siècle comme support d'enseignement par les jésuites, principal corps enseignant en France jusqu'en 1763, et par les précepteurs familiaux, puis deviennent, sous la Troisième République et jusqu'après guerre, un incontournable de l'école primaire.",
  },
]

// ── 2. Broken import row: book 18789 has empty slug+title, zero authors,
//      one unidentifiable Frisco-ISD-2022 ban (33533). Title is unrecoverable
//      → delete; bans/book_authors/ban_*_links all cascade from books.
const EMPTY_BOOK_ID = 18789

// ── 3a. Publication-year fixes (verified against publisher/OL records).
const BOOK_YEAR_FIXES: { id: number; slug: string; year: number; why: string }[] = [
  { id: 7282,  slug: 'love-in-the-open-air',           year: 1970, why: 'Tuppy Owens, Cand Haven 1970 (NZ ban 1972 consistent); 1825 was a wrong-edition match' },
  { id: 17576, slug: 'beasts-of-burden-animal-rites',  year: 2010, why: 'Dark Horse collection first published 2010 (Dorkin/Thompson); 1900 bogus' },
  { id: 17864, slug: 'thank-you-jackie-robinson',      year: 1974, why: 'Barbara Cohen, Lothrop 1974; 1883 predates Jackie Robinson himself' },
  { id: 18043, slug: 'macbeth-the-graphic-novel',      year: 2015, why: 'credited author is adapter Gareth Hinds (Candlewick 2015); 1608 is the play' },
  { id: 18753, slug: 'ways-to-live-forever',           year: 2008, why: 'Sally Nicholls debut, Marion Lloyd 2008; 1974 bogus' },
  { id: 18886, slug: 'the-confessions-of-nat-turner',  year: 1967, why: 'William Styron novel 1967; 1920 bogus (1831 Gray pamphlet is a different work)' },
  // the-republic stays at -380: correct once Plato's birth year gets its BC sign.
]

// ── 3b. Ancient authors stored with positive BC years → flip sign.
const AUTHOR_YEAR_FIXES: { id: number; slug: string; birth_year: number; death_year: number }[] = [
  { id: 6499,  slug: 'aeschylus', birth_year: -525, death_year: -456 },
  { id: 12193, slug: 'sophocles', birth_year: -496, death_year: -406 },
  { id: 12194, slug: 'plato',     birth_year: -428, death_year: -348 },
]

// ── 3c. jean-marcel (10286, sole book = 1938 Liste-Otto pamphlet) was
//      enriched with Jean-Marcel Paquette (Québécois, b. 1941): birth year,
//      photo and OL318044A all belong to the wrong person → null them.
const JEAN_MARCEL_ID = 10286

async function main() {
  console.log(APPLY ? '== APPLY ==' : '== DRY-RUN (pass --apply to write) ==')

  for (const f of MOJIBAKE_FIXES) {
    console.log(`mojibake: repair description_book of ${f.slug} (#${f.id}), ${f.description_book.length} chars`)
    if (APPLY) {
      const { error } = await sb.from('books').update({ description_book: f.description_book }).eq('id', f.id).eq('slug', f.slug)
      if (error) throw new Error(`${f.slug}: ${error.message}`)
    }
  }

  console.log(`empty book: DELETE books #${EMPTY_BOOK_ID} (cascades its single ban)`)
  if (APPLY) {
    const { error } = await sb.from('books').delete().eq('id', EMPTY_BOOK_ID).eq('slug', '')
    if (error) throw new Error(`delete ${EMPTY_BOOK_ID}: ${error.message}`)
  }

  for (const f of BOOK_YEAR_FIXES) {
    console.log(`year: ${f.slug} (#${f.id}) → ${f.year}  [${f.why}]`)
    if (APPLY) {
      const { error } = await sb.from('books').update({ first_published_year: f.year }).eq('id', f.id).eq('slug', f.slug)
      if (error) throw new Error(`${f.slug}: ${error.message}`)
    }
  }

  for (const f of AUTHOR_YEAR_FIXES) {
    console.log(`BC sign: ${f.slug} (#${f.id}) → born ${f.birth_year}, died ${f.death_year}`)
    if (APPLY) {
      const { error } = await sb.from('authors').update({ birth_year: f.birth_year, death_year: f.death_year }).eq('id', f.id).eq('slug', f.slug)
      if (error) throw new Error(`${f.slug}: ${error.message}`)
    }
  }

  console.log(`jean-marcel (#${JEAN_MARCEL_ID}): null birth_year + photo_url + openlibrary_author_id (wrong-person enrichment)`)
  if (APPLY) {
    const { error } = await sb.from('authors')
      .update({ birth_year: null, photo_url: null, openlibrary_author_id: null })
      .eq('id', JEAN_MARCEL_ID).eq('slug', 'jean-marcel')
    if (error) throw new Error(`jean-marcel: ${error.message}`)
  }

  console.log(APPLY ? 'done — re-run audit-integrity.ts to verify' : 'dry-run complete')
}

main()
