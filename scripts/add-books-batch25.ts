/**
 * Batch 25 — descriptions for 25 well-known books still missing them.
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
  ['elmer-gantry',
    'A thundering satire of American religious hypocrisy by Nobel laureate Sinclair Lewis. Elmer Gantry is a college athlete turned con-man preacher who rises through revivalism by charm, seduction, and pure shamelessness. Banned in Boston and vigorously denounced from pulpits across America upon publication in 1927.'],

  ['fanny-hill',
    'Written in 1748 by John Cleland while imprisoned for debt, this epistolary novel follows a young orphan\'s passage through the London sex trade. One of the first works of prose pornography in English, it was banned for over two centuries in both Britain and the United States, with the last US prosecution occurring as late as 1963.'],

  ['a-dry-white-season',
    'A liberal Afrikaner schoolteacher in 1970s South Africa stumbles into the truth of apartheid brutality after his gardener\'s son is arrested. André Brink\'s 1979 novel was immediately banned by the South African censorship board for undermining race relations — a ban that only confirmed everything the book was saying.'],

  ['a-month-and-a-day',
    'The detention diary of Ken Saro-Wiwa, the Nigerian writer and activist who led the Ogoni people\'s campaign against Shell\'s environmental devastation of their homeland. Saro-Wiwa was arrested, tried on fabricated murder charges, and hanged by the Sani Abacha military regime in November 1995 — a judicial killing that shocked the world.'],

  ['a-tomb-for-boris-davidovich',
    'Seven linked stories depicting the fates of Old Bolsheviks consumed by the Stalinist machine. Yugoslav writer Danilo Kiš published this in 1976 and was immediately subjected to a campaign accusing him of plagiarism — widely understood as a political attack orchestrated by writers who found his depiction of communist terror too close to home.'],

  ['1000-years-of-joys-and-sorrows',
    'Ai Weiwei\'s sweeping memoir weaves together his father\'s story — poet Ai Qing, denounced in the Anti-Rightist Campaign and sent for twenty years of forced labor — with his own rise as China\'s most famous dissident artist, his 2011 secret detention by the Chinese state, and his subsequent exile. Predictably unavailable in China.'],

  ['a-case-of-exploding-mangoes',
    'Mohammed Hanif\'s darkly comic first novel circles the mysterious 1988 plane crash that killed Pakistani dictator General Zia ul-Haq along with the US Ambassador and senior military commanders. Narrated by a junior air force officer who may or may not have caused it, the novel was a sensation in Pakistan — where the circumstances of the crash remain officially unexplained.'],

  ['daring-to-drive',
    'Manal al-Sharif\'s memoir of how she filmed herself driving in Saudi Arabia in 2011 and posted it online, igniting a movement that would ultimately end the world\'s only ban on women driving. She was detained for nine days. The book documents both the campaign and the broader reality of Saudi women\'s lives under guardianship laws.'],

  ['for-a-song-and-a-hundred-songs',
    'Chinese poet and musician Liao Yiwu was sentenced to four years in prison for writing a poem mourning the victims of Tiananmen. This memoir records his prison years in unflinching detail — the torture, the fellow inmates, the performances that helped him survive — and ranks among the most important documents of life inside China\'s prison system.'],

  ['gods-little-acre',
    'Erskine Caldwell\'s 1933 novel follows a Georgia farmer who spends decades digging up his own land searching for buried gold while his family disintegrates around him. Censored in the US for sexual content, it was defended in a landmark New York court case that helped establish literary merit as a defense against obscenity charges.'],

  ['dream-of-ding-village',
    'Yan Lianke\'s devastating 2005 novel about a rural Chinese village devastated by an AIDS epidemic spread through contaminated blood sales organized by local officials. Based on the real Henan blood scandal that infected hundreds of thousands, it was banned in China for its unflinching portrayal of official complicity and corruption.'],

  ['el-eternauta',
    'Héctor Germán Oesterheld\'s Argentine science fiction masterpiece, originally serialized 1957–59, follows survivors of a lethal alien snowfall conquering Buenos Aires. A second version in 1969 drew explicit parallels to US imperialism. Oesterheld and his four daughters were disappeared by Argentina\'s military dictatorship in 1977–78; his remains were never found.'],

  ['five-bandits',
    'Kim Chi-ha\'s 1970 satirical poem depicting five corrupt archetypes — a National Assemblyman, a general, a cabinet minister, a businessman, and a judge — gorging themselves on Korea\'s prosperity while the poor suffer. The South Korean government charged him with violating the Anti-Communist Law; he spent years in prison under threat of execution.'],

  ['hind-swaraj',
    'Gandhi\'s 1909 manifesto on Indian self-rule, written in Gujarati on the ship home from London. It argues that true independence requires rejecting Western industrial civilization itself, not merely British rule. The British colonial government in India immediately banned it as a seditious publication; Gandhi responded by publishing an English translation.'],

  ['a-woman-in-the-crossfire',
    'Syrian journalist and novelist Samar Yazbek kept a diary of the first months of the Syrian uprising in 2011, documenting the regime\'s massacres from inside Damascus before she was forced to flee. A member of the Alawite sect that provides Assad\'s base, her witness against her own community made the testimony especially powerful and dangerous.'],

  ['blue-lard',
    'Vladimir Sorokin\'s 1999 novel, in which clones of famous Soviet writers (Tolstoy, Chekhov, Nabokov) produce a mysterious substance called "blue lard." In 2002, the Kremlin-aligned youth group Idushchiye Vmeste staged public shredding of the book and filed an obscenity complaint; the case was eventually dropped, but the political signal was clear.'],

  ['by-grand-central-station-i-sat-down-and-wept',
    'Elizabeth Smart\'s 1945 prose poem — arguably one of the most intense love narratives in the English language — recounts her affair with the married poet George Barker. Smart wrote it while actually living it. The book was suppressed in Canada for years, partly through the influence of her wealthy family, who were scandalized by its content.'],

  ['asking-for-it',
    'Louise O\'Neill\'s 2015 Irish novel follows 18-year-old Emma O\'Donovan in the aftermath of being raped at a party — and the brutal social consequences that follow when photos appear online. A searing examination of rape culture, victim-blaming, and how communities protect perpetrators, it has been challenged in schools for its unflinching honesty.'],

  ['a-handful-of-sand',
    'The debut poetry collection of Ishikawa Takuboku, published in 1910, is regarded as a masterpiece of Japanese tanka. Takuboku\'s later work was suppressed during the Meiji period for its socialist politics; he died of tuberculosis at 26 in 1912, leaving behind a legacy that Japanese authorities continued to find uncomfortable well into the 20th century.'],

  ['abyssinian-chronicles',
    'Moses Isegawa\'s debut novel, published in Dutch in 1998, tracks three generations of a Ugandan family through Idi Amin\'s atrocities and the AIDS crisis, narrated by the ambitious and amoral Mugezi. The novel\'s unflinching depiction of Ugandan society and politics made it unwelcome in its home country despite winning international acclaim.'],

  ['a-minor-apocalypse',
    'Tadeusz Konwicki\'s 1979 novel, published in samizdat in Poland, follows a writer asked by dissidents to set himself on fire in front of the Communist Party headquarters as a symbolic protest. A dark comedy about the absurdity of both the regime and the opposition, it circulated underground for years before Solidarity\'s rise made it publishable.'],

  ['a-shameful-act',
    'Turkish historian Taner Akçam\'s landmark scholarly work on the Armenian Genocide, examining Ottoman state documents and the postwar military tribunals that prosecuted the perpetrators. Published in 2006, it contributes to the scholarly consensus that the events constituted genocide — a conclusion that remains criminalized under Turkey\'s Article 301 laws.'],

  ['a-dry-white-season',
    'Already described above — skipping duplicate.'],

  ['going-bovine',
    'Libba Bray\'s 2009 Printz Award-winning novel follows Cameron Smith, a 16-year-old slacker diagnosed with Creutzfeldt-Jakob disease (mad cow disease), on a surreal road trip to find a cure — accompanied by a miniature Norse god in a garden gnome. Challenged in US schools for language and sexual content.'],

  ['deogratias-a-tale-of-rwanda',
    'Jean-Philippe Stassen\'s 2000 Belgian graphic novel depicts the Rwandan genocide through the eyes of Deogratias, a young Hutu man haunted by the role he played in the murders of a Tutsi family. One of the first graphic novels to confront the genocide directly, it was challenged in US school libraries for its violence and sexual content.'],
]

async function main() {
  let count = 0
  for (const [slug, desc] of DESCRIPTIONS) {
    await updateDescription(slug, desc)
    count++
  }
  console.log(`\nProcessed ${count} entries.`)

  const { count: total } = await supabase.from('books').select('*', { count: 'exact', head: true })
  const { count: noDesc } = await supabase.from('books').select('*', { count: 'exact', head: true }).is('description', null)
  console.log(`Total books: ${total}, still without description: ${noDesc}`)
}

main().catch(console.error)
