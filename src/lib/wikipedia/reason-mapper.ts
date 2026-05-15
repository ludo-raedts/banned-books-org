// Notes-text → reason slug.
//
// The slug vocabulary mirrors the `reasons` table in production:
//   blasphemy, drugs, language, lgbtq, moral, obscenity, other,
//   political, racial, religious, sexual, violence.
// No new slugs are introduced here; everything not matching a pattern is
// routed to review.
//
// Decision flow (per editorial doctrine 2026-05-13):
//   1. Try every explicit reason pattern. First match wins; confidence='high'.
//   2. No reason pattern matched, but the notes describe an import/customs
//      mechanism ("imported", "cannot be brought into India", etc.) → the
//      ban exists but the underlying reason is unknown from the cell. Tag
//      with slug='other' + quality_flag='import_ban_no_explicit_reason' and
//      route to review.
//   3. No reason and no import-clue → slug=null + quality_flag='unmapped_reason',
//      route to review.
//
// This intentionally avoids labelling customs-driven bans as 'political' by
// default. Better an extra review row than systematically wrong reasons in
// production.
//
// Pattern design notes:
//   - Word-stems (terror, secession, defamat, disparag, alleg) drop the
//     trailing \b so "terrorism" / "secessionism" / "defamation" all match.
//   - LGBTQ patterns are deliberately narrow — bare words like "bisexual"
//     or "gay" cause false positives (e.g. an anti-LGBTQ ban claim against a
//     biographical book). Only unambiguously identity-themed phrases match.
//   - Political patterns include India-specific markers: "Naxalite",
//     "Khalistan", "Sikh state", "Hindu Mahasabha"-style party defamation,
//     "British colonial" bans (almost always sedition in this dataset).

import type { QualityFlag, ReasonMapping } from './types'

// Order matters: more specific patterns come first. The first match wins.
const PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // ── LGBTQ ────────────────────────────────────────────────────────────────
  // Strict: identity-themed phrases only. Bare "gay" / "lesbian" / "bisexual"
  // excluded because they appear in unrelated defamation contexts.
  [/\b(lgbt|homosexual|same-sex|sexual orientation|transgender|gay rights|lesbian rights|gay (community|relationship)|lesbian (community|relationship)|gay marriage|gender identity)\b/i, 'lgbtq'],

  // ── Blasphemy ────────────────────────────────────────────────────────────
  [/\bblasph/i, 'blasphemy'],

  // ── Obscenity / pornography ──────────────────────────────────────────────
  [/\b(obscen|pornograph|sexually explicit|indecen)/i, 'obscenity'],

  // ── Sexual / erotic ──────────────────────────────────────────────────────
  [/\b(sexual content|erotic|incest)\b/i, 'sexual'],

  // ── Sexual — ALA corpus (added 2026-05-14) ──────────────────────────────
  // ALA challenge cells phrase sex-themed reasons as "sexual references",
  // "sex education", "teenage sexuality", "references to masturbation",
  // "ritualistic sex", "sexual abuse", "physical and sexual abuse". The
  // existing 'sexual content|erotic|incest' is too narrow for these.
  // "rape" gates on a state/perpetrator context to avoid matching academic
  // discussions of rape law or rape-history non-fiction unrelated to bans.
  [
    /\b(sexual (?:references?|abuse|explicitness|imagery|content)|sex(?:ual)? education|teenage sexual(?:ity)?|discussions? of (?:puberty|sexualit)|references? to (?:masturbation|rape|sexual abuse)|ritualistic sex|nudity)\b/i,
    'sexual',
  ],

  // ── Religious offence ────────────────────────────────────────────────────
  // Trailing \b deliberately omitted: the alternation contains stems like
  // "hindu" / "islam" / "muslim" that should also match plurals ("Hindus")
  // and inflected forms. Each pattern starts on a word boundary; that's
  // enough to avoid mid-word false positives.
  [
    /\b(prophet muhammad|prophet of islam|muhammad'?s|mock(?:ing|s|ed)? (?:islam|hindu|christian|muslim|sikh)|critique of political islam|fatwa|muslim religious|hindu sentiment|hindu mahasabha|sikh faith|hurt religious|religious sentiment|religious sect|communal (?:discord|disharmony|tension|violence|feeling|harmony)|insult.*(?:islam|hindu|christian|muslim|sikh|prophet|religion|allah|god)|defamation of religion|anti-religious|religious hatred|holy book|sacred text|objectionable material against|insult.*(?:faith|sect)|offend.*(?:islam|hindu|christian|muslim|sikh)|disrespect.*(?:prophet|hindu|islam)|attempt to insult|holy war|waging.*jihad|(?:hindu|muslim|christian|sikh|jewish|buddhist) (?:view|perspective|critique) of (?:christianity|islam|hinduism|sikhism|judaism|buddhism))/i,
    'religious',
  ],

  // ── Religious — international corpus (added 2026-05-14 from master aggregator) ──
  // heresy: Spanish-Inquisition era bans; inquisition: any inquisition-era
  // condemnation; contradicting the teaching: e.g. Toland's Christianity not
  // Mysterious vs Anglican Church; criticizing christianity: Francoist-Spain
  // ban of Wells. "Promoting hanukkah/christmas/..." matches the Lebanese
  // Sesame Street ban + analogous holiday-promotion bans.
  [
    /\b(heres(?:y|ies|ical)|inquisition|contradicting the teaching|criticizing (?:christianity|islam|hinduism|judaism|buddhism|sikhism|the church|catholicism|protestantism)|promoting (?:hanukkah|christmas|easter|ramadan|eid))\b/i,
    'religious',
  ],

  // ── Religious — ALA corpus (added 2026-05-14) ───────────────────────────
  // ALA cells cite "witchcraft", "occult themes", "supernatural themes",
  // "religious viewpoint" (used as a complaint about books that *contain*
  // a religious viewpoint), "anti-religion", and "promotion of Islam" as
  // ban reasons. These are religious-content concerns even when the framing
  // is anti-religious (the ban exists because religion is involved).
  [
    /\b(witchcraft|occult|supernatural themes?|religious viewpoint|anti-religion|promotion of (?:islam|christianity|judaism|hinduism|buddhism))\b/i,
    'religious',
  ],

  // ── Political — sedition, separatism, terrorism, extremism ──────────────
  // Trailing \b dropped for the same reason: stems must match inflected
  // forms ("secessionism", "terrorism", "extremist", etc.).
  [
    /\b(seditio|anti-state|anti-government|treason|subversi|secession|terror|extremis|naxalite|maoist|marxist|communist party|khalistan|sikh state|insurg|incite.*disaffection|hindutva)/i,
    'political',
  ],

  // ── Political — security / public order ─────────────────────────────────
  [
    /\b(national security|public order|propagat.*false narrative|psyche of youth|culture of grievance|incit.*violence|cause.*violence|promote.*discord|may cause.*violence|disturb.*tranquil)/i,
    'political',
  ],

  // ── Political — defamation of state / political figure ──────────────────
  // Stems ("defamato" / "disparag" / "alleg") need no trailing boundary —
  // inflected forms ("defamatory", "disparaging", "allegedly") must match.
  [
    /\b(derogatory|defamato|libel|disparag|in (?:poor|bad) light|negative portrayal of|portrayed.*(?:in a bad light)|cia informer|alleg.*(?:cia|informer|spy|defame|paid)|defaming.*(?:gandhi|nehru|patel|shivaji|modi|indira)|defamation suit|defaming the)/i,
    'political',
  ],

  // ── Political — colonial-era British bans ───────────────────────────────
  // In this dataset, "banned by British authorities/colonial government" is
  // an almost-perfect proxy for sedition or anti-imperial speech. Confident
  // editorial label for pre-1947 ban entries.
  [/\bbanned by (?:the )?british (?:colonial )?(?:government|authorit)/i, 'political'],

  // ── Political — Indian political figures / parties ──────────────────────
  // Named figures (Gandhi, Nehru, Modi, Sonia Gandhi, etc.) and partisan
  // parties (Shiv Sena, BJP, Congress, Hindutva movement) appear in cells
  // describing defamation suits, political fiction, and partisan complaints.
  // The phrases below are narrow enough that they do not collide with the
  // many cells where these names appear only as historical context.
  [
    /\b(right-wing party|left-wing party|shiv sena|protests? from the party|sonia gandhi|congress (?:lawyer|spokesperson|leader)|(?:gandhi|nehru|indira|modi|patel|shivaji) was (?:a |an )?)/i,
    'political',
  ],

  // ── Political — international corpus (added 2026-05-14 from master aggregator) ──
  // "political sensitivity" covers ~9 Vietnam rows in one shot. lèse-majesté
  // covers Thai king-related bans. "criticism of [civil liberties|the king|...
  // |president NAME]" covers Eritrea/Thailand/etc. Named-regime patterns
  // ("banned by Soviet Union", "Francoist Spain", "German occupation", etc.)
  // cover historical-dictatorship bans where the cell merely names the
  // regime without spelling out the reason — these are political almost by
  // definition. Verbotsgesetz + Nazi-propaganda phrases handle the small set
  // of post-1945 anti-Nazi-propaganda statute bans (Austria, Guatemala).
  [
    /\b(?:political|politically) sensitivit(?:y|ies)\b/i,
    'political',
  ],
  // Trailing \b deliberately omitted on the accented variant: JS `\b` is
  // defined over ASCII `\w`, so the boundary between a trailing `é` and a
  // following space registers as non-word→non-word — i.e. no boundary —
  // and the match fails on real text like "lese-majesté rules".
  [
    /\bl[èe]se[- ]?majest[ée]|\blese majesty\b/i,
    'political',
  ],
  [
    /\bcriticism of (?:civil liberties|the (?:regime|government|state|king|president|monarchy)|king [A-Z]\w+|president [A-Z]\w+|[A-Z]\w+ regime)|\bcriticizing (?:the )?(?:regime|government|state|king|president|monarchy)\b/i,
    'political',
  ],
  [
    /\b(?:tsarist|francoist|nationalist) (?:censor|monarch|government|regime|spain)\b|\bfranco(?:'s)? (?:regime|government)\b/i,
    'political',
  ],
  [
    /\bbanned (?:by|during) (?:the )?(?:tsarist|francoist|nazi|fascist|german occupation|imperial|soviet|stalin|apartheid)/i,
    'political',
  ],
  [
    /\b(?:verbotsgesetz|nazi propaganda|advocating the nazi party|high-level corruption)\b/i,
    'political',
  ],

  // ── Political — ALA corpus (added 2026-05-14) ───────────────────────────
  // "political viewpoint" is the ALA boilerplate complaint about books that
  // express a political stance. "Un-American content" / "anti-American"
  // appear in the Librarian of Basra-style cells. Communist/socialist
  // sympathy (Call of the Wild) is also political under the ALA framing.
  [
    /\b(political viewpoint|"?un-american"? content|anti-american|pro-socialism|socialist sympathies)\b/i,
    'political',
  ],

  // ── Drugs ───────────────────────────────────────────────────────────────
  [/\b(drug abuse|drug use|drug references?|narcot|cannabis|marijuana|opium|heroin)\b/i, 'drugs'],

  // ── Violence / gore ─────────────────────────────────────────────────────
  [/\b(graphic violence|gore|grisly|gratuitous violence)\b/i, 'violence'],

  // ── Violence — ALA corpus (added 2026-05-14) ────────────────────────────
  // Bare "violence" hits a lot of ALA challenge cells where violence IS the
  // ban reason. "gang violence" / "depictions of torture" / "torture and
  // mutilation" / "firearms" / "depictions of violence against women" are
  // common variants. Risk of false positives in other sources is low —
  // existing imports route to review-queue anyway, and the previous narrow
  // pattern was leaving ~30 ALA rows unmapped.
  [
    /\b(?:gang violence|violence against|firearms?|torture|mutilation|dark themes?\/violence|darkness\/scariness|violence(?: and (?:torture|mutilation))?)\b/i,
    'violence',
  ],

  // ── Racial / caste / Indigenous ─────────────────────────────────────────
  // Caste is context-gated: bare "caste" appears in descriptive notes about
  // book content (e.g. "the book is about Hinduism, caste and phallicism")
  // without indicating a caste-related ban reason. Require an explicit
  // discrimination/hatred/violence qualifier.
  [
    /\b(racial|racism|caste discrimination|caste hatred|caste violence|caste-based discrimination|anti-caste|dalit|adivasi|santhal|tribal portrayal)\b/i,
    'racial',
  ],

  // ── Racial — international corpus (added 2026-05-14) ────────────────────
  // "hate literature/speech" covers Canadian holocaust-denial bans.
  // antisemit/anti-Jewish/Jewish characters cover Nazi-era and modern
  // antisemitic-ban contexts. white supremacy is unambiguous. NOTE: bare
  // "apartheid" is intentionally NOT here — too many cells mention "during
  // apartheid" as period context without that being the ban reason.
  [
    /\b(?:hate (?:literature|speech)|antisemit|anti-?jewish|jewish characters?|white supremacy)\b/i,
    'racial',
  ],

  // ── Racial — ALA corpus (added 2026-05-14) ──────────────────────────────
  // ALA cells flag "stereotypes of [ethnicity/race] culture" and bare
  // "racially offensive" / "racially insensitive". These are ethnicity-
  // depiction complaints, distinct from the colonial racism / antisemitism
  // patterns above.
  [
    /\b(?:stereotypes? of (?:mexican|asian|african|black|hispanic|indigenous|native|jewish|chinese|indian|arab)|racially (?:offensive|insensitive))\b/i,
    'racial',
  ],

  // ── Moral / family-values ───────────────────────────────────────────────
  [/\b(immoral(?:ity)?|good taste|family value|moral decay)\b/i, 'moral'],

  // ── Moral — international corpus (added 2026-05-14) ─────────────────────
  // "for moral reasons" is the explicit ban-reason phrasing on Wikipedia.
  // "threat to morality" picks up Malaysia's Fifty Shades ban. The Korean
  // ministry-of-culture youth restriction is a moral-protection mechanism.
  [
    /\b(?:for moral reasons|threat to morality|distribution to readers below the age of 19)\b/i,
    'moral',
  ],

  // ── Moral — ALA corpus (added 2026-05-14) ───────────────────────────────
  // ALA challenges cite "anti-family", "encouraging disobedience",
  // "references to suicide" / "assisted suicide", "alcoholism", "drinking",
  // "smoking", "gambling", "infidelity", "child abuse" as ban reasons.
  // These are moral/family-values concerns about content unsuitable for
  // young readers. "Unsuited to age group" is the most common ALA
  // boilerplate — also moral by ALA's own framing.
  [
    /\b(?:anti-family|encouraging disobedience|references? to (?:suicide|assisted suicide|drinking|smoking|gambling)|alcoholism|infidelity|child abuse|unsuited (?:to|for) age group|unsuitable for (?:young readers|children))\b/i,
    'moral',
  ],

  // ── Language / profanity ────────────────────────────────────────────────
  [/\b(inappropriate language|profan|swear word|vulgar language)\b/i, 'language'],

  // ── Language — ALA corpus (added 2026-05-14) ────────────────────────────
  // "offensive language", "crude language", and "slur" / "slurs" appear in
  // ~10 ALA cells. "Offensive language" alone is the most common.
  [/\b(?:offensive language|crude language|slurs?)\b/i, 'language'],

  // ── Obscenity — NZ Indecent Publications regime ─────────────────────────
  // The NZ wikitable uses "restricted N in YYYY" (e.g. "restricted 18 in
  // 1972") as boilerplate for adult-content rating decisions by the Indecent
  // Publications Tribunal (1963-1994) and its successor OFLC. The numeric
  // value is an age-restriction (R16/R18) imposed for sexual or violent
  // adult content — both code as 'obscenity' in this DB's vocabulary.
  [/\brestricted\s+\d+\s+in\s+\d{4}\b/i, 'obscenity'],

  // ── Political — China dataset (added 2026-05-14) ────────────────────────
  // Wikipedia's "Book censorship in China" page uses recurring phrasing for
  // bans driven by CCP political control: "critical of the CCP", "Cultural
  // Revolution" purges/massacres, books "banned for discussing" sensitive
  // historical events (Great Leap Forward, Tiananmen, Mao-era purges).
  // These are state-imposed political bans, not religious/sexual/moral.
  // Patterns are narrow enough that academic mentions of the same terms in
  // unrelated bans (e.g. Western ban of a Chinese-history textbook) won't
  // false-match because they require the China-specific phrasing.
  [
    /\b(critical of (?:the )?ccp|cultural revolution|chinese communist (?:party|rule)|mainland china|communist (?:party|government)|peasant protests?|great chinese famine|propaganda department|mao zedong|ccp deemed|chinese communists|tiananmen|fictional collapse of (?:chinese|communist))\b/i,
    'political',
  ],

  // ── Political — China/HK extended (added 2026-05-15) ────────────────────
  // Xi-Jinping comparisons (Chongzhen Emperor row in CN), CCP-adjacent figures
  // (Zhao Ziyang memoirs), state-pressure euphemisms on the HK Sino-United
  // chain ("banned by bookstores under Sino United Publishing" — Sino-United
  // is a CCP-controlled retailer/publisher conglomerate; the phrase is the
  // standard wording on the HK page for post-2020 retail-level NSL bans).
  // Disqualifications from the HK Biennial Awards (3 rows in 2023) are the
  // post-NSL purge of dissenting authors from the literary establishment.
  [
    /\b(?:xi jinping|zhao ziyang|chongzhen emperor|chinese characters|spiritual pollution|plasma economy|sino united publishing|disqualified from the (?:award|hong kong biennial))\b/i,
    'political',
  ],

  // ── Political — wartime / pacifist / anti-war (added 2026-05-15) ────────
  // NZ WW1/WW2 era and master-aggregator wartime bans repeatedly use these
  // phrases: pacifism, anti-war propaganda, anti-imperialist, conscientious
  // objectors, IWW agitation. All are state-imposed political bans even when
  // the cell does not explicitly say "political".
  [
    /\b(?:pacifis|anti-?war|anti-?imperialis|anti-?military|conscientious objector|industrial workers of the world|seditious propaganda)/i,
    'political',
  ],

  // ── Political — statutory state-censorship machinery (added 2026-05-15) ─
  // NZ wartime and master-aggregator rows where the cell only names the
  // enforcement instrument: "War Regulations Act 1914", "War Precautions Act",
  // "prohibited by an Order in Council", "withheld by the Controller of
  // Censorship", Indonesian "Presidential Instruction" / "Inpres No.". These
  // are unambiguous state-action verbs, not editorial complaints.
  [
    /\b(?:war regulations? act|war precautions? act|order in council|controller of censorship|presidential instruction|inpres no\.?)\b/i,
    'political',
  ],

  // ── Political — communist/marxist works (added 2026-05-15) ──────────────
  // Tsarist/NZ-wartime/Nazi-era bans on Lenin, Stalin, Trotsky, Marx, and
  // associated communist literature. "Communist Programme" and "Land of
  // Socialism" titles also fit here. Narrow enough to skip academic mentions.
  [
    /\b(?:works? of (?:lenin|stalin|trotsky|marx|engels)|lenin and stalin|land of socialism|the communist programme|programme of the world revolution|marxist literature|communist literature|communist propaganda)\b/i,
    'political',
  ],

  // ── Political — named regimes / banning authorities (added 2026-05-15) ──
  // Captures master-aggregator rows where the cell is "Banned by the Spanish
  // censors", "Banned in Apartheid South Africa", "Banned in Tsarist Russia",
  // "Banned in the Soviet Union", "Banned by the Portuguese government", etc.
  // These are regime-level political bans by definition; the previous master
  // pattern only caught "banned by/during" (verb-bound) which missed
  // "Banned in Tsarist Russia" and "Banned in Apartheid South Africa".
  [
    /\b(?:apartheid south africa|tsarist russia|tsarist russian|the soviet (?:union|government|censors?)|the spanish censors|spanish censors gave|the portuguese (?:government|censors)|the second czechoslovak republic|saudi (?:government|arabia for|arabia from|arabia since)|the bangladeshi government|francoist spain|the francoist|the nazi (?:government|regime|censors|authorities)|nazi germany|banned by the reform government|banned by the military censor|the british central board for conscientious objectors)\b/i,
    'political',
  ],

  // ── Political — state-rationale euphemisms (added 2026-05-15) ───────────
  // Pakistan/Malaysia ban announcements consistently cite "objectionable
  // material as the cause" or "confusion and anxiety among the Muslims";
  // El Salvador cites "portrayal of human rights violations"; Saudi Arabia
  // bans citing scriptural reinterpretation ("suggesting the Hebrews
  // originated in Yemen..."). These are political-control framings even
  // when the announcement itself avoids the word "political".
  [
    /\b(?:objectionable material as the cause|confusion and anxiety among the muslims|portrayal of human rights violations|human rights violations|criticism of the actions of the national liberation front|criticism of the (?:government|state|regime))\b/i,
    'political',
  ],

  // ── Racial — antisemitic ban basis (added 2026-05-15) ───────────────────
  // Master aggregator: "Banned in Lebanon for its positive depiction of Jews"
  // — the ban exists because Jews are depicted positively, antisemitic in
  // motivation. Treated as racial (antisemitism bucket), distinct from
  // religious-content bans of Jewish texts.
  [
    /\b(?:positive depiction of jews|positive portrayal of jews|sympathetic.*?\bjews\b|because of jews|jewish characters? in (?:a |an )?positive)\b/i,
    'racial',
  ],

  // ── Moral — youth-protection framing (added 2026-05-15) ─────────────────
  // China's manga bans ("Attack on Titan", "Highschool of the Dead", "Death
  // Note") use the standard PRC formula "for the purpose of protecting the
  // healthy development of youth". Other jurisdictions echo: "harmful to
  // minors", "unfit for young readers". These are moral/age-protection
  // framings, distinct from sexual/violent content patterns above.
  [
    /\b(?:healthy development of youth|protect(?:ing|ion of)? (?:the )?(?:youth|children|minors)|harmful to (?:youth|children|minors)|unfit for young readers)\b/i,
    'moral',
  ],

  // ── Obscenity — NZ/Australian classification regime extras (added 2026-05-15) ─
  // NZ Office of Film & Literature Classification cells phrase rationale as
  // "deemed to be objectionable" / "interim restriction order" / "R18
  // classification" / "Restricted N unless instructed by parents" /
  // "degrading and dehumanising images". Australian "bawdiness amounting to
  // sex obsession" / "obsession" / "in a way that is likely to cause offence
  // to a reasonable adult, [of] a person who is, or appears to be, a child
  // under 18". These all map to obscenity in this DB's vocabulary.
  [
    /\b(?:deemed to be objectionable|interim restriction order|r\s*18 classification|degrading and dehumanising|sex obsession|bawdiness|appears to be(?:,)? a child under 18|child under 18|restricted \d+ unless instructed)\b/i,
    'obscenity',
  ],

  // ── Political — military regimes / state-permit denial (added 2026-05-15) ─
  // Master aggregator: "military dictator Zia-ul-Haq's government" (Pakistan),
  // "the Vietnamese government had seized" / "unable to get certification for
  // publication" (Vietnam state-permit denial). These are political-control
  // mechanisms even when the cell does not spell out "political".
  [
    /\b(?:military dictator|military junta|military government|military regime|unable to get certification for publication|certification for publication|government had seized|government seized|attempted to suspend publication of classified|publishing classified information)\b/i,
    'political',
  ],

  // ── Political — NZ wartime "withheld" decisions (added 2026-05-15) ──────
  // NZ Controller of Censorship cells repeatedly use "withheld and held for
  // decision by a higher authority" or "Withheld from Wellington booksellers"
  // — both are wartime-political censorship mechanisms. Not caught by the
  // generic "Controller of Censorship" pattern above when that phrase is
  // absent from the cell.
  [
    /\bwithheld (?:and held for decision|from (?:wellington )?booksellers)\b/i,
    'political',
  ],

  // ── Moral — NZ pre-1963 booksellers cooperation (added 2026-05-15) ──────
  // "Banned by the Department of Justice with the cooperation of Associated
  // Booksellers of New Zealand" — pre-Indecent-Publications-Tribunal moral
  // censorship of pulp/crime/sex paperbacks. Distinct from political wartime
  // bans which used the Controller of Censorship apparatus.
  [
    /\bdepartment of justice\b[^.]*\bassociated booksellers\b/i,
    'moral',
  ],
]

// Detects notes that *only* describe an import-ban mechanism. Step 2 in the
// flow above. "Imported into" is the most common phrasing on the India page.
const IMPORT_BAN_HINT =
  /\b(import(?:ed)? (?:into|in)|cannot be brought|cannot be imported|prohibit.*import|customs)\b/i

// Civil-defamation patterns. Defamation suits/cases by private parties (or
// individual politicians acting privately) are civil actions, not state-
// imposed bans on political grounds. Even when a court issues a temporary
// stay, editorial review is required to decide whether the row meets the
// project's inclusion criteria. Checked BEFORE the main pattern loop so
// these never get auto-mapped to 'political' via the "defamato" stem.
const DEFAMATION_SUIT_PATTERNS: ReadonlyArray<RegExp> = [
  /\bdefamation\s+suit/i,
  /\bdefamation\s+case/i,
  /\bdefamatory/i,
  /\blibel\s+suit/i,
]

// Private-party civil action without the defamation keyword. The
// underlying ban exists because a private plaintiff won an injunction or
// damages claim — not because a state organ banned the work on its own
// initiative. Sample-9 (Hersh — Price of Power) is the canonical case:
// "Desai obtained an injunction from the Bombay High Court... and sued
// for damages".
const PRIVATE_PARTY_PATTERNS: ReadonlyArray<RegExp> = [
  /\bobtained an injunction\b/i,
  /\bsued for damages\b/i,
  /\bfiled a lawsuit\b/i,
  /\blawsuit filed by\b/i,
  /\bout-of-court settlement\b/i,
  // Self-censorship by publisher to avoid threatened civil action — e.g.
  // "HarperCollins anticipated legal action from the Ambani family". The
  // book was never published but the row is still in the ban list because
  // the chilling effect was state-equivalent. Editor decides scope.
  /\banticipated legal action\b/i,
  /\bfear(?:ed|ing) legal action\b/i,
]

// Civil-court procedural stay orders (interim restraints pending verdict).
// Distinct from a final ban. Requires "civil court" or explicit "civil
// suit/case" wording — a bare "stay order" is intentionally NOT matched,
// because state-issued stays exist on the page and should still route to
// the normal reason-mapping (e.g. "Other challenged books" entries that
// represent legitimate state action). Sample-10 (Jha — Myth of the Holy
// Cow) is the canonical case: "A civil court in Andhra Pradesh put a
// temporary stay order on the book until verdict."
const CIVIL_COURT_PATTERNS: ReadonlyArray<RegExp> = [
  /\bcivil court\b[^.]*\bstay order\b/i,
  /\bstay order\b[^.]*\bcivil court\b/i,
  /\bcivil (?:suit|case)\b/i,
]

export type ReasonMapResult = {
  mapping: ReasonMapping
  extra_flags: QualityFlag[]
}

// True when `notes` carries no reason signal — empty after trim, composed
// solely of matrix-style tick markers ("✓", "✓ ✓", "✓ ✓ ✓"), or carrying only
// translator-credit boilerplate ("Translated by X" / "translated into Persian
// by Y"). The Hong Kong table represents each ban location as a separate
// ✓-column; stripWikitext joins those into a notes blob that's just whitespace
// + checkmarks. The Iran table has a similar pattern where the notes cell
// sometimes contains only translator attribution and no ban-reason text.
// Without this guard, the source-fallback never fires for those rows because
// notes !== ''.
function hasNoReasonSignal(notes: string): boolean {
  const trimmed = notes.trim()
  if (/^[\s✓]*$/u.test(trimmed)) return true
  // Iran ministry-of-culture rows: cells like "Translated by Hossin Shahrabi"
  // or "translated into Persian by Kaveh Mirabasi" carry no reason signal —
  // fall through to the source-level fallback configured for wikipedia-iran.
  if (/^translated (?:by|into)\b[^.]*\.?\s*$/i.test(trimmed)) return true
  return false
}

export function mapReason(
  notes: string,
  fallbackSlug?: string | null,
): ReasonMapResult {
  if (DEFAMATION_SUIT_PATTERNS.some(p => p.test(notes))) {
    return {
      mapping: { slug: 'other', confidence: 'low' },
      extra_flags: ['defamation_suit_civil'],
    }
  }
  if (PRIVATE_PARTY_PATTERNS.some(p => p.test(notes))) {
    return {
      mapping: { slug: 'other', confidence: 'low' },
      extra_flags: ['civil_action_private_party'],
    }
  }
  if (CIVIL_COURT_PATTERNS.some(p => p.test(notes))) {
    return {
      mapping: { slug: 'other', confidence: 'low' },
      extra_flags: ['civil_court_stay_order'],
    }
  }
  for (const [re, slug] of PATTERNS) {
    if (re.test(notes)) {
      return { mapping: { slug, confidence: 'high' }, extra_flags: [] }
    }
  }
  if (IMPORT_BAN_HINT.test(notes)) {
    return {
      mapping: { slug: 'other', confidence: 'low' },
      extra_flags: ['import_ban_no_explicit_reason'],
    }
  }
  // Source-level fallback: applies only when the row itself carries no
  // signal AND the section config declares a fallback (Index Librorum →
  // religious; Hong Kong NSL list → political). Confidence stays 'low'
  // because the slug comes from context, not from the cell — the editor
  // should still glance at the row before approving.
  if (fallbackSlug && hasNoReasonSignal(notes)) {
    return {
      mapping: { slug: fallbackSlug, confidence: 'low' },
      extra_flags: ['source_default_reason'],
    }
  }
  return {
    mapping: { slug: null, confidence: 'low' },
    extra_flags: ['unmapped_reason'],
  }
}
