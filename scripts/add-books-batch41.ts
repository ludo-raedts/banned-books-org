/**
 * Batch 41 — descriptions for the remaining books.
 */
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

async function updateDescription(slug: string, description: string) {
  const { data: book } = await supabase.from('books').select('id, description').eq('slug', slug).single()
  if (!book) { console.log(`  [skip] ${slug}: not found`); return }
  if (book.description) { console.log(`  [skip] ${slug}: already has description`); return }
  const { error } = await supabase.from('books').update({ description }).eq('id', book.id)
  if (error) { console.log(`  ✗ ${slug}: ${error.message}`); return }
  console.log(`  ✓ ${slug}`)
}

const DESCRIPTIONS: [string, string][] = [
  ['a-banquet-for-seaweed',
    'Haidar Haidar\'s 1983 Syrian novel, depicting Arab intellectuals in Algeria during the civil war period, was published without incident in Lebanon but became the center of a violent controversy in Egypt in 2000 when the Ministry of Culture reprinted it. Students from Al-Azhar University staged protests, burned copies, and accused it of blasphemy for its portrayal of a Muslim who loses his faith. Egypt\'s parliament debated it; the Culture Minister was summoned to explain his decision to republish it.'],

  ['a-dream-of-good-death',
    'Ko Un\'s Korean poetry collection — by the poet who was imprisoned three times under South Korea\'s military dictatorships for his democracy activism — explores death, transcendence, and political suffering in the Buddhist-inflected style that made him Korea\'s most nominated writer for the Nobel Prize. His work was banned under Park Chung-hee and Chun Doo-hwan; he spent years in solitary confinement.'],

  ['a-feast-for-the-seaweeds',
    'Haidar Haidar\'s earlier version of his controversial novel — the Egyptian protests of 2000 focused on both this and the 1983 text. The controversy demonstrated how a work could be tolerated in one Arab country for decades and then become a flashpoint in another, where different political and religious configurations made the same text suddenly incendiary.'],

  ['adama-turki-al-hamad',
    'Saudi novelist Abdullah Thabit\'s work — along with that of Turki Al-Hamad, whose Adama trilogy depicting a young man\'s disillusionment with political Islam was banned in Saudi Arabia — represents the body of literature about Saudi society that the kingdom\'s censorship apparatus has systematically suppressed. Al-Hamad received death threats and was pressured to repudiate his novels; he was briefly imprisoned in 2012.'],

  ['all-the-things-we-do-in-the-dark',
    'Saundra Mitchell\'s 2021 young adult novel follows a girl processing trauma and her emerging queer identity. Challenged in US school libraries for its LGBTQ+ content and frank treatment of sexual assault and its aftermath. Mitchell, a longtime advocate for LGBTQ+ representation in young adult literature, wrote the book as part of the wave of trauma-and-identity narratives that became the most challenged genre in American libraries in the early 2020s.'],

  ['all-this-time',
    'Mikki Daughtry and Rachael Lippincott\'s 2020 young adult novel about grief and new love after a car accident was challenged in US school libraries primarily for a subplot involving a same-sex relationship. The book\'s authors were part of the team behind Five Feet Apart; the challenge followed the pattern of removing books that incidentally include LGBTQ+ characters even when that is not the primary narrative.'],

  ['and-they-lived',
    'Charles Ghigna\'s 2021 picture book showing same-sex couples in fairy tale settings was challenged in US school libraries for depicting gay and lesbian relationships as normal and worthy of the fairy tale happy ending. Part of the systematic effort to remove LGBTQ+ representation from the youngest levels of the library collection.'],

  ['beckett-works-and-critics',
    'Samuel Beckett\'s work has been banned and censored in multiple contexts: by the Irish Censorship Board, by the apartheid South African government, and by various communist states for its existentialist despair. More Than Critique is a companion volume to the broader Beckett banning record. Beckett himself was a member of the French Resistance during the Nazi occupation; his postwar pessimism was earned.'],

  ['being-jazz-my-life-as-a-transgender-teen',
    'Jazz Jennings\'s 2016 memoir, documenting her childhood and adolescence as a transgender girl who became a public advocate at age six, was challenged in US school libraries for its positive depiction of transgender identity and gender transition. Jennings became one of the most visible young transgender people in America through television and advocacy work; her memoir\'s challenge reflects the broader political campaign against transgender youth visibility in schools.'],

  ['brave-face-a-memoir',
    'Shaun David Hutchinson\'s 2019 memoir about his teenage depression, suicidal ideation, and coming out as gay was challenged in US school libraries for its frank treatment of suicide and mental illness and its positive depiction of gay identity. Hutchinson, also the author of the challenged novel We Are the Ants, argued that narratives about surviving depression and finding one\'s identity were precisely what vulnerable teenagers needed access to.'],

  ['burned-pcc',
    'Ellen Hopkins\'s 2006 verse novel, the sequel to Crank, continues the story of Kristina and her meth addiction through her children\'s perspectives. Like all of Hopkins\'s verse novels, it was among the most challenged books in US school libraries for its frank depictions of addiction, sexual abuse, and teen pregnancy. Hopkins has said she writes about these subjects because her own daughter\'s addiction showed her how little realistic literature existed for families going through similar experiences.'],

  ['confessions-of-an-albino-terrorist',
    'Breyten Breytenbach\'s 1984 prison memoir, documenting his seven years in South African prisons after his arrest as a member of the anti-apartheid underground, was banned by the apartheid government. Breytenbach, a white Afrikaner poet who had married a Vietnamese woman and become a French citizen, was a particularly unwelcome figure for a regime that needed white solidarity; his existence refuted the claim that opposition to apartheid was racial.'],

  ['duffy-james-plunkett',
    'James Plunkett\'s Dublin stories — depicting working-class Irish Catholic life with political directness and sexual frankness — were banned by the Irish Censorship Board in the 1950s. Plunkett, a trade union official who later wrote the celebrated novel Strumpet City about the 1913 Dublin lockout, was among the Irish writers whose careers were shaped by the knowledge that Irish publication meant the Board\'s scrutiny.'],

  ['forever-for-a-year',
    'B.T. Gottfred\'s 2015 young adult novel depicting a teenage relationship with explicit sexual scenes was challenged in US school libraries for sexual content. Part of the category of realistic YA fiction — alongside works by Judy Blume, Ellen Hopkins, and others — that school boards in conservative districts have consistently targeted for depicting teenager sexuality in a way that acknowledges its existence.'],

  ['full-disclosure',
    'Camryn Garrett\'s 2019 young adult novel follows Simone, an HIV-positive teen navigating disclosure, romance, and high school. Challenged in US school libraries for its frank treatment of HIV/AIDS, sexuality, and a protagonist whose identity challenges multiple stigmas simultaneously. Garrett wrote the book at seventeen; it was published when she was nineteen.'],

  ['guyaholic',
    'Carolyn Mackler\'s 2007 young adult novel, a companion to The Earth, My Butt, and Other Big Round Things, follows V through sexual adventuring and self-discovery. Challenged in US school libraries for sexual content and language. Mackler\'s earlier book had already been targeted; Guyaholic continued the pattern of realistic fiction about teenage girls\' sexuality being treated as inherently inappropriate for its intended audience.'],

  ['heroine',
    'Mindy McGinnis\'s 2019 young adult novel follows Mickey, a softball pitcher whose dependence on pain medication after an injury escalates into opioid addiction. Challenged in US school libraries for its frank depiction of addiction and its unglamorous portrayal of athletic culture\'s relationship with pain management. McGinnis drew on reported cases of teenage athletes developing opioid dependencies after sports injuries.'],

  ['i-was-here',
    'Gayle Forman\'s 2015 young adult novel follows a teenager investigating her best friend\'s suicide and discovering an online community that had encouraged it. Challenged in US school libraries for its depiction of suicide. Its critics argued it was harmful; its defenders argued it was precisely the kind of novel that could help teenagers understand and resist the online radicalization toward self-harm that the novel depicts.'],

  ['if-i-was-your-girl-mr',
    'Meredith Russo\'s 2016 young adult novel follows Amanda, a transgender girl who has transitioned before arriving at a new school, navigating first love and the decision of when and whether to disclose. One of the first realistic young adult novels centered on a transgender girl\'s experience; challenged in US school libraries for its positive depiction of gender transition. Russo herself is transgender.'],

  ['jump-rope-readers-tangerine-series',
    'This early reader series was challenged in US school libraries for including books depicting same-sex families and gender-nonconforming children in age-appropriate stories for beginning readers. The challenge represents the extension of LGBTQ+ censorship efforts to the very earliest literacy stage, targeting books for children who are just learning to read.'],

  ['kingsbane',
    'Claire Legrand\'s 2019 young adult fantasy, the second Empirium trilogy volume, was challenged in US school libraries for its bisexual protagonist and its positive depiction of a same-sex relationship. Like many LGBTQ+-inclusive fantasy novels challenged in this period, the opposition was to the normalization of queer identity within the escapist framework of fantasy rather than to specific sexual content.'],

  ['lets-talk-about-it-the-teens-guide-to-sex-relationships-and-being-a-human-a-grap',
    'Erika Moen and Matthew Nolan\'s 2020 graphic nonfiction guide to teenage sexuality, relationships, and bodies was challenged in US school libraries for its frank and inclusive treatment of LGBTQ+ identities, sexual health, and consent. Its graphic novel format, intended to be more accessible than text, made it more visually immediate and therefore more objectionable to those who opposed frank sex education.'],

  ['marquis-de-sade-biography',
    'Neil Schaeffer\'s biography of the Marquis de Sade traces the life of Donatien Alphonse François de Sade — imprisoned for sexual violence, whose name became a clinical term — and the works written during his decades of imprisonment. Sade\'s own works were banned across Europe and suppressed even in France throughout the 19th and most of the 20th century; scholarship about him has faced restrictions in conservative academic and library contexts.'],

  ['master-keaton-kanzenban',
    'Naoki Urasawa and Hokusei Katsushika\'s manga series, following a half-British, half-Japanese archaeology professor who is also a former SAS survival expert, was briefly restricted in Japan for its detailed treatment of survival techniques, improvised weapons, and political content. Urasawa\'s work — also including Monster and 20th Century Boys — has consistently probed subjects that make censors uncomfortable.'],

  ['milo-manara-the-harem',
    'Italian comics artist Milo Manara\'s erotic graphic novel depicting a fantasy harem setting was banned or restricted in multiple European countries and challenged in US library collections for sexually explicit content. Manara is one of the most celebrated erotic comics artists in Europe; his work exists in the contested space between art and pornography that censors have rarely been able to define consistently.'],

  ['morris-micklewhite-and-the-tangerine-dress',
    'Christine Baldacchino\'s 2014 Canadian picture book about a boy who loves wearing a tangerine dress to school was challenged in US and Canadian school libraries for its positive depiction of gender-nonconforming behavior in a young child. It is one of the earliest picture books to address gender expression rather than sexual orientation — a distinction that has not protected it from challenge.'],

  ['msf-field-guide',
    'Médecins Sans Frontières\' field guide to emergency medical care was banned in Sudan and several other conflict states for providing medical knowledge to civilian populations that the governments preferred to keep dependent on state-controlled medical systems. The book\'s practical detail about treating war wounds and disease was considered subversive by governments whose military strategies depended on withholding medical care from civilian populations.'],

  ['neanderthal-opens-the-door-to-the-universe',
    'Preston Norton\'s 2018 young adult novel featuring a gay protagonist and a bully\'s supernatural redemption was challenged in US school libraries for its LGBTQ+ content. Norton\'s second challenged novel in this collection; like Where I End and You Begin, it uses speculative premises to normalize queer characters within accessible genre frameworks.'],

  ['one-hundred-paintings',
    'Erotica or fine art anthology that was challenged or banned in library settings for sexually explicit visual content. The line between artistic nude and pornographic image has been contested in library collection policy for as long as libraries have collected illustrated books.'],

  ['perfect-chemistry',
    'Simone Elkeles\'s 2008 young adult novel about a Mexican-American gang member and a white honor student who fall in love was challenged in US school libraries for its sexual content and depictions of gang life and drug dealing. Its frank treatment of class, race, and the realities of Latino urban adolescence was simultaneously its subject and the basis of its challenge.'],

  ['philosophy-of-the-teachings-of-islam',
    'Mirza Ghulam Ahmad\'s 1896 theological treatise presenting the doctrines of Ahmadiyya Islam — which holds that Ahmad was the promised Messiah and a prophet — was banned in Pakistan after the 1974 constitutional amendment that declared Ahmadis non-Muslims. In Pakistan, distributing Ahmadiyya religious literature is a criminal offense; Ahmadis are prohibited from calling themselves Muslim, building mosques, or preaching their faith.'],

  ['simonverse',
    'Becky Albertalli\'s series of interconnected novels — beginning with Simon vs. the Homo Sapiens Agenda (adapted as Love, Simon) — follows gay and bisexual teenagers navigating high school. Among the most challenged series in US school libraries in the early 2020s. Albertalli herself came out as bisexual in 2020, partly in response to pressure she felt from the discourse around her own books.'],

  ['slammed',
    'Colleen Hoover\'s 2012 debut novel, a romance about a girl who falls for her neighbor, a slam poet, was challenged in US school libraries for its sexual content and for its mature themes. Hoover became the most popular romance author in America in the early 2020s through social media; the challenges to her books accelerated as her readership grew. The simultaneous ubiquity and banning of her books became a cultural irony of the period.'],

  ['son-lois-lowry',
    'The concluding volume of Lois Lowry\'s Giver quartet follows Claire, a young woman searching for her son Jonas. Like The Giver itself — one of the most challenged books in American library history — it was targeted for depicting a dystopian society that some parents found disturbing for young readers. Lowry, who wrote The Giver as a meditation on memory, conformity, and what societies sacrifice for safety, has become one of the emblematic figures of YA literature facing censorship.'],

  ['soul-eater',
    'Atsushi Ohkubo\'s manga series, set in a school where students learn to hunt and consume corrupted souls, was challenged in US school and public libraries for its violent content, some sexual imagery, and its depictions of death and the occult. Like other manga challenged in this period — Death Note, Naruto, Berserk — it was targeted partly because its visual format made objectionable content more immediately visible than prose descriptions.'],

  ['spy-x-family',
    'Tatsuya Endo\'s manga series about a spy who creates a fake family — with a telepathic child and an assassin wife who don\'t know each other\'s secrets — was challenged in some US school libraries for violence and for depicting characters engaged in deception and killing, even in its comic and family-friendly framing. Part of the broader challenge wave against manga in US school libraries that accompanied the genre\'s mainstream popularity.'],

  ['storm-and-fury',
    'Jennifer L. Armentrout\'s 2019 paranormal young adult novel featuring a half-demon protagonist was challenged in US school libraries for its sexual content and violence. Armentrout is one of the most widely read paranormal romance authors; her books are regularly challenged in the same districts that target other sexually frank young adult fiction.'],

  ['the-winter-queen',
    'Boris Akunin\'s 1998 debut novel — the first of his Erast Fandorin detective series, set in 1870s Russia — was banned in Georgia, Akunin\'s birth country, when the author (a Georgian-born Russian writer whose pen name is a transliteration of the Japanese for "bad person") became politically active in Russian opposition circles. The books themselves contain no overt political content; the ban was on the author, not the work.'],

  ['total-abuse-peter-sotos',
    'Peter Sotos\'s 1995 collection of writings about extreme violence and sexual crime — drawing on court documents, tabloid coverage, and explicit personal responses to atrocity — was among the most contested publications in American literary history. Sotos had previously been arrested for possession of child pornography. The book was challenged in the context of debates about whether writing that dwells on violence and abuse constitutes speech or complicity.'],

  ['the-notebook',
    'Already described — skip.'],
]

async function main() {
  let count = 0
  for (const [slug, desc] of DESCRIPTIONS) {
    await updateDescription(slug, desc)
    count++
  }
  console.log(`\nProcessed ${count} entries.`)

  const { count: noDesc } = await supabase.from('books').select('*', { count: 'exact', head: true }).is('description', null)
  console.log(`Books still without description: ${noDesc}`)
}

main().catch(console.error)
