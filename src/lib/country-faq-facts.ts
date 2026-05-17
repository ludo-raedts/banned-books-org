// Country-level editorial facts that feed the `Can I read / Can I buy /
// Who decides` Q&As on /countries/{code}. Hand-curated per jurisdiction.
// Kept minimal — only the five top countries by ban count for now; others
// fall back to the data-only questions (how many, when, what reasons, what
// books). Start with five, grow as we tighten the editorial review.
//
// Legality values:
//   'legal'      — no general legal prohibition on reading/buying
//   'restricted' — distribution is regulated; possession may carry risk
//                  depending on title / context, but no blanket criminal ban
//   'criminal'   — possession of certain titles is itself a criminal
//                  offence under named law(s)

export type CountryFaqLegality = 'legal' | 'restricted' | 'criminal'

export type CountryFaqFacts = {
  // Who actually decides which books are banned in this country. Long-form
  // string suitable for inline placement in a sentence ("In the US, book
  // bans come from {banAuthority}.").
  banAuthority: string
  // Reading status + a one-sentence explanation. The reasoning string is
  // appended to a "Reading banned books is …" or "Reading banned books
  // carries legal risk …" lead-in.
  readingLegal: CountryFaqLegality
  readingNote: string
  // Same for purchase.
  purchaseLegal: CountryFaqLegality
  purchaseNote: string
  // Optional extra paragraph that follows banAuthority for context.
  notableContext?: string
}

export const COUNTRY_FAQ_FACTS: Record<string, CountryFaqFacts> = {
  US: {
    banAuthority:
      'school boards, state legislatures, and (rarely) federal courts',
    readingLegal: 'legal',
    readingNote:
      'There is no general criminal liability for reading banned books in the United States. Teachers and librarians, however, face employment risk in states whose 2022–2025 laws criminalised the distribution of "harmful to minors" material to students.',
    purchaseLegal: 'legal',
    purchaseNote:
      'Banned-in-schools titles remain openly available through bookstores, libraries outside the affected districts, and online sellers. The First Amendment protects commercial distribution of books that are not legally obscene.',
    notableContext:
      'The 2020s wave is concentrated in Florida, Texas, Tennessee, Iowa, and Missouri school districts.',
  },

  GB: {
    banAuthority:
      'the Crown Prosecution Service (obscenity), school governing bodies, and Ofcom',
    readingLegal: 'legal',
    readingNote:
      'There is no general criminal liability for reading or possessing books in the UK. The Terrorism Act 2006 criminalises possession of material "likely to be useful to a person committing or preparing an act of terrorism" — narrowly construed, but the only meaningful exception for adult readers.',
    purchaseLegal: 'legal',
    purchaseNote:
      'Most titles are in print and freely sold. The Obscene Publications Act 1959 makes distribution of "obscene" material actionable; in practice prosecutions are rare since the 1960 Lady Chatterley acquittal.',
    notableContext:
      'Modern UK challenges centre on prison-library lists, school-library guidance under the 2010 Equality Act, and occasional graphic-novel obscenity cases.',
  },

  RU: {
    banAuthority:
      'the Ministry of Justice (which maintains the Federal List of Extremist Materials) and Roskomnadzor',
    readingLegal: 'criminal',
    readingNote:
      'Possession of materials on the Federal List of Extremist Materials is an offence under Articles 20.29 and 282.2. Russia’s 2022 "discrediting the armed forces" law and 2023 expansion of the "LGBT propaganda" ban have extended the list to anti-war and LGBTQ+ titles. Risk of prosecution depends on the title and the readers’ visibility (libraries, schools, journalists most exposed).',
    purchaseLegal: 'restricted',
    purchaseNote:
      'Books on the extremist register are pulled from Russian booksellers; importing physical copies risks customs seizure. Online and e-book channels persist via VPN but are themselves increasingly restricted.',
    notableContext:
      'The Federal List has grown by hundreds of entries per year since 2022; booksellers and individual readers have been fined and, in a small number of cases, criminally charged.',
  },

  CN: {
    banAuthority:
      'the National Press and Publication Administration and the Cyberspace Administration of China',
    readingLegal: 'restricted',
    readingNote:
      'There is no blanket criminal ban on reading, but possession of titles concerning Tiananmen, Falun Gong, Xinjiang/Tibet, or critical of the Communist Party can support charges under the National Security Law (Hong Kong, 2020) or sedition/subversion statutes. Foreign nationals have been detained on entry with such titles in their luggage.',
    purchaseLegal: 'restricted',
    purchaseNote:
      "Banned titles are pulled from mainland bookstores and online retailers. Print copies circulate through underground channels and Hong Kong publishers historically — though Hong Kong's pre-2020 publishing freedom has narrowed sharply.",
    notableContext:
      'Hong Kong’s 2020 National Security Law extended mainland-style restrictions to a jurisdiction that previously had open political publishing; library purges followed within months.',
  },

  IR: {
    banAuthority:
      'the Ministry of Culture and Islamic Guidance ("Ershad"), which operates a pre-publication review system',
    readingLegal: 'restricted',
    readingNote:
      'Iran has no general criminal statute for reading, but possession of titles deemed "corrupting on earth", blasphemous, or promoting "Western cultural invasion" can trigger morality-police searches and arrest. Books mocking the Supreme Leader, depicting same-sex relationships, or contradicting Islamic theology carry the highest risk.',
    purchaseLegal: 'restricted',
    purchaseNote:
      'All Iranian publishers must submit manuscripts to Ershad before printing. Unreviewed foreign translations circulate via underground bookstores in Tehran and online via VPN; importing physical copies risks customs seizure.',
    notableContext:
      'The Salman Rushdie fatwa (1989) remains a uniquely durable feature of Iranian censorship policy — formally rescinded by the government in 1998 but never lifted by clerical authorities.',
  },
}
