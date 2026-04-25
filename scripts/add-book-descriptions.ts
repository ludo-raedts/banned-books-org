import { adminClient } from '../src/lib/supabase'

/**
 * Adds descriptions to well-known books that currently have none.
 * Only updates records where description IS NULL — safe to re-run.
 */

const supabase = adminClient()

const descriptions: Record<string, string> = {
  'alices-adventures-in-wonderland': 'Lewis Carroll\'s whimsical tale of a young girl who falls down a rabbit hole into a nonsensical world populated by talking animals and peculiar characters — the Queen of Hearts, the Cheshire Cat, the Mad Hatter. Written by Oxford mathematics lecturer Charles Dodgson for Alice Liddell, daughter of a colleague. Banned in China in the 1930s on the grounds that animals speaking on equal terms with humans was considered inappropriate; challenged in the US for various reasons throughout the 20th century.',

  'brave-new-world': 'Aldous Huxley\'s 1932 dystopian novel set in a future "World State" where human beings are produced in hatcheries and conditioned from birth to accept their predetermined social roles. Citizens are kept docile through the drug soma and consequence-free sexuality. A satirical response to H.G. Wells\' optimistic techno-utopianism, the novel has been challenged worldwide for its explicit depictions of promiscuity, drug use, and what critics describe as its nihilistic rejection of traditional values.',

  'catch-22': 'Joseph Heller\'s darkly comic anti-war novel set during World War II, following American bombardier Yossarian, who desperately tries to be grounded as insane in order to avoid flying more missions. The central paradox — that anyone who tries to avoid combat by claiming insanity proves they are sane — coined the universal phrase "catch-22." Banned and challenged in US schools for its profanity, sexual content, and irreverent portrayal of military authority and patriotism.',

  'fahrenheit-451': 'Ray Bradbury\'s anti-censorship masterwork about a future America where books are illegal and firemen burn them, following Guy Montag, a fireman who begins to question his work after meeting a free-thinking teenage girl. One of literary history\'s great ironies: the novel itself was censored. A publisher produced a school edition that removed profanity; Bradbury was furious when he discovered it years later and demanded the censored version be destroyed.',

  'flowers-for-algernon': 'Daniel Keyes\' story of Charlie Gordon, a man with an intellectual disability who undergoes an experimental surgical procedure that makes him a genius, only to watch his new intelligence ebb away. First published as a short story in 1959, the novel version won the Nebula Award. Frequently challenged in US schools for sexual content depicting Charlie\'s coming-of-age as his mind develops, and for its bleak portrayal of the scientific establishment.',

  'the-great-gatsby': 'F. Scott Fitzgerald\'s Jazz Age masterpiece narrated by Nick Carraway about his mysterious neighbour, the fabulously wealthy Jay Gatsby, and Gatsby\'s obsession with the beautiful, married Daisy Buchanan. Considered one of the defining American novels of the 20th century and a withering critique of the American Dream. Challenged in US schools for its depictions of drunkenness, sexual promiscuity, and moral corruption; challenged in some communities for its language.',

  'the-catcher-in-the-rye': 'J.D. Salinger\'s novel narrated by sixteen-year-old Holden Caulfield over two days after his expulsion from Pencey Prep school, as he wanders New York City in a state of alienation from "phonies." One of the most challenged books in American history, removed from schools and libraries for its profanity, sexual content, and glorification of teenage rebellion. Its notoriety took a dark turn: Mark David Chapman was carrying a copy when he shot John Lennon in 1980.',

  'to-kill-a-mockingbird': 'Harper Lee\'s Pulitzer Prize-winning novel set in 1930s Alabama, narrated by young Scout Finch as her lawyer father Atticus defends Tom Robinson, a Black man falsely accused of raping a white woman. A foundational text of American literature and a defining portrayal of racial injustice in the American South. Among the most frequently challenged books in US schools — both for its racial slurs (used as evidence of racism, not endorsement) and, in some contexts, for making students "uncomfortable."',

  'a-passage-to-india': 'E.M. Forster\'s 1924 novel set in British India during the Raj, exploring the impossibility of genuine friendship between British colonists and Indians through the story of Dr. Aziz, who is accused of assaulting a British woman during a visit to the Marabar Caves. Widely considered Forster\'s masterpiece and a prescient critique of imperialism. Challenged for its frank sexual themes — the cave scene remains deliberately ambiguous — and its sympathetic portrayal of the colonised over the colonisers.',

  'a-wrinkle-in-time': 'Madeleine L\'Engle\'s science fantasy novel about Meg Murry, her prodigious younger brother Charles Wallace, and friend Calvin O\'Keefe, who travel through space via a "tesseract" (a wrinkle in time) to rescue Meg\'s physicist father from a malevolent force. Rejected by 26 publishers before winning the Newbery Medal. One of the most frequently challenged children\'s books in the US, targeted by some Christian groups for depicting witches sympathetically and for its science-fictional elements intertwined with Christian themes.',

  'a-little-life': 'Hanya Yanagihara\'s epic, harrowing novel following four college friends — Willem, JB, Malcolm, and Jude — over decades as they pursue careers in New York City. The novel gradually centres on Jude St. Francis, whose past of extreme abuse and its psychological aftermath becomes the novel\'s consuming subject. Shortlisted for the Man Booker Prize and the National Book Award. Challenged and removed from some schools and libraries for its unflinching portrayal of child sexual abuse, self-harm, and prolonged trauma.',

  'in-the-dream-house': 'Carmen Maria Machado\'s 2019 memoir told in experimental form — as a guide to narrative conventions (the haunted house, the choose-your-own-adventure, the fairy tale) — about her abusive relationship with a woman. A landmark work for naming and validating intimate partner violence in queer relationships, a subject historically invisible in both legal frameworks and literature. Challenged in schools for its LGBTQ+ content and its frank portrayal of psychological and physical abuse.',

  'stamped-racism': 'Jason Reynolds and Ibram X. Kendi\'s young adult adaptation of Kendi\'s National Book Award-winning "Stamped from the Beginning," tracing the history of racist ideas in America from Puritan Massachusetts to the present, through the stories of five key figures: Cotton Mather, Thomas Jefferson, William Lloyd Garrison, W.E.B. Du Bois, and Angela Davis. Among the most frequently banned books in the US since 2021, challenged for what critics describe as "indoctrinating" content about systemic racism.',

  'front-desk': 'Kelly Yang\'s semi-autobiographical novel about ten-year-old Mia Tang, a recent Chinese immigrant whose family manages a run-down motel in California — while secretly sheltering undocumented immigrants in the back rooms. Based on Yang\'s own childhood experiences. Challenged in US schools for its depiction of illegal immigration and its frank portrayal of poverty and racial discrimination experienced by immigrant children.',

  'hey-kiddo': 'Jarrett J. Krosoczka\'s graphic memoir about growing up in Massachusetts with a mother addicted to heroin — cycling in and out of prison — while being raised by his grandparents and trying to hide his family situation at school. A National Book Award finalist. Challenged in US schools for its depictions of drug use and family dysfunction, though widely praised by educators and librarians for its compassionate portrayal of addiction\'s impact on children.',

  'speak-anderson': 'Laurie Halse Anderson\'s 1999 novel about Melinda, a high school freshman who is ostracised after calling the police from a summer party. The reader gradually understands she was raped by a senior named Andy Evans. One of the most frequently challenged young adult novels — and one of the most critically important — Speak is often challenged for its frank portrayal of sexual assault, the very crime it was written to help survivors name and survive.',

  'wuhan-diary-fang-fang': 'A day-by-day account of life inside locked-down Wuhan posted to Chinese social media by celebrated novelist Fang Fang during the first 76 days of China\'s COVID-19 lockdown in early 2020. The diary attracted millions of readers before being censored on Weibo and WeChat. Its publication in English and German translations drew fierce nationalist attacks on Fang Fang as a traitor who "handed ammunition to China\'s enemies" — illustrating the CCP\'s sensitivity about international narratives of the pandemic\'s origins.',

  'viral-murong-xuecun': 'Chinese author and Amnesty International prisoner of conscience Murong Xuecun (pen name of Hao Qun) travelled secretly to Wuhan in 2020 to investigate and document what was happening beyond official accounts — interviewing frontline doctors, grieving families, and survivors. The resulting book exposes the weeks of information suppression that allowed COVID-19 to spread globally before China acknowledged human-to-human transmission. Banned in China; Murong has lived under constant surveillance.',

  'all-the-kremlins-men': 'Russian journalist Mikhail Zygar\'s 2016 inside account of Vladimir Putin\'s two and a half decades in power, based on hundreds of off-the-record interviews with senior officials, oligarchs, and Kremlin insiders. The book presents Putin not as a strategic mastermind but as a reactive leader shaped by his courtiers and circumstances. Zygar co-founded the independent TV channel Dozhd (Rain) and fled Russia after the 2022 invasion of Ukraine; his books were removed from Russian shelves.',

  'the-turkish-gambit': 'The second of Boris Akunin\'s beloved Erast Fandorin detective series, set during the 1877–78 Russo-Turkish War, in which the elegant investigator untangles a web of espionage. Akunin — pen name of Georgian-Russian author Grigory Shalvovich Chkhartishvili — was one of Russia\'s best-selling authors. He publicly condemned Putin\'s 2022 invasion of Ukraine, left Russia, and his books were subsequently removed from Russian bookstores and libraries.',

  'the-jewel-of-medina': 'Sherry Jones\'s historical novel imagining the life of Aisha, one of the Prophet Muhammad\'s wives, from her childhood betrothal to her political role after his death. Random House cancelled its American publication in 2008 after receiving a letter warning the book could incite violence; it was published first in Serbia. The UK publisher\'s home was fire-bombed three days after publication. Eventually published in the US and several other countries, but banned across much of the Muslim world.',

  'damsel-arnold': 'Elana K. Arnold\'s Printz Award-winning novel that plays with and subverts the fantasy rescue trope: a prince slays a dragon and "rescues" a girl with no memory of who she was before — but the rescue comes with deeply sinister expectations. A sharp, allegorical exploration of patriarchal coercion and sexual violence disguised as a fairy tale. Challenged in US schools for its sexual content and what some parents describe as anti-male messaging.',

  'crank-hopkins': 'Ellen Hopkins\'s 2004 novel in verse, a semi-autobiographical account of Kristina Georgia Snow, a straight-A student who is introduced to crystal meth ("crank") and descends into addiction. Based on her own daughter\'s experiences. One of the best-selling young adult novels ever published despite — or because of — its near-permanent presence on banned book lists, challenged for its graphic depictions of drug use, sexual content, and violence.',

  'sold-mccormick': 'Patricia McCormick\'s 2006 novel told in spare, lyrical verse about Lakshmi, a thirteen-year-old girl from rural Nepal who is sold by her stepfather into a Kolkata brothel under the pretence of domestic work. Based on extensive research and interviews with trafficking survivors. Challenged in US schools for its sexual content, but widely used by NGOs and educators working on human trafficking awareness for its unflinching and humanising portrayal.',

  'breathless-niven': 'Jennifer Niven\'s 2021 novel about Claude Henry, a bookish teenager who spends a summer on a small Georgia island, falls into her first relationship, and experiences her first sexual experiences. A follow-up to Niven\'s bestselling "All the Bright Places." Almost immediately added to US school ban lists for its frank portrayal of teenage sexuality, making it one of the emblematic titles of the post-2021 wave of American school book removals.',

  'the-naked-lunch': 'William S. Burroughs\' 1959 novel — published by Olympia Press in Paris after being rejected everywhere in the US — presenting a hallucinatory series of vignettes involving drug addiction, bureaucratic nightmare, and sexual violence in a cut-up, non-linear form. Subject to one of the last major American literary obscenity trials, in Massachusetts in 1965, where Norman Mailer and Allen Ginsberg testified to its literary merit. Considered a founding text of the Beat Generation.',

  'tropic-of-capricorn': 'Henry Miller\'s autobiographical novel about his early years in New York City before his departure for Paris, completed in the late 1930s. A companion to "Tropic of Cancer," it is equally frank about sexuality and equally scathing about American bourgeois life. Like its predecessor, banned in the US as obscene until Grove Press won the right to publish it in 1962, following obscenity trials that established important precedents for American free speech.',

  'cry-the-beloved-country': 'Alan Paton\'s 1948 novel about Black South African Anglican priest Stephen Kumalo\'s journey from rural Natal to Johannesburg to find his son Absalom, who has committed murder. One of the first major anti-apartheid novels, published the same year the Afrikaner Nationalist government came to power. Banned in apartheid South Africa for its sympathetic portrayal of Black suffering and its implicit condemnation of the racial system.',

  'lady-chatterleys-lover-japan': 'D.H. Lawrence\'s last novel, published privately in Florence in 1928, follows the love affair between Constance Chatterley, an aristocratic woman trapped in a loveless marriage to a paraplegic husband, and Oliver Mellors, her gamekeeper. Its frank portrayal of female sexual desire and its language made it a target for obscenity prosecution in Britain until the landmark 1960 trial cleared Penguin Books after sixty witnesses — including bishops and professors — testified to its literary merit.',

  'the-handmaids-tale': 'Margaret Atwood\'s speculative fiction novel set in the near-future theocratic Republic of Gilead, where women have been stripped of their rights and fertile women (handmaids) are forced to reproduce for ruling-class families. Drawing on Puritan history, Cold War totalitarianism, and 1980s American religious conservatism, the novel has become a touchstone of feminist literature. Challenged in schools and libraries for its sexual content and themes, and adopted globally as a symbol of resistance to women\'s oppression.',

  'a-clockwork-orange': 'Anthony Burgess\'s 1962 dystopian novella narrated in a future teen slang ("Nadsat," a mix of Russian and Cockney) about Alex, a teenage delinquent who undergoes state-sanctioned "aversion therapy" to cure his violent impulses. Stanley Kubrick\'s 1971 film adaptation led Burgess to distance himself from the work. Burgess\'s original UK edition included a redemptive final chapter that Kubrick omitted. The most banned book in the US in the 2024–2025 school year according to PEN America.',

  'spycatcher': 'The memoir of Peter Wright, a former British MI5 officer, alleging that the Director-General of MI5 had been a Soviet spy and detailing numerous illegal operations run by British intelligence. The British government\'s attempt to suppress publication through injunctions — pursued even in Australian courts after Wright published there — became one of the most famous and counterproductive censorship attempts in modern British history, raising the question of whether the government\'s actions proved there was something to hide.',
}

async function main() {
  let updated = 0
  let skipped = 0

  for (const [slug, description] of Object.entries(descriptions)) {
    const { data: book } = await supabase.from('books').select('id, description').eq('slug', slug).single()
    if (!book) {
      console.log(`  [not found] ${slug}`)
      continue
    }
    if (book.description) {
      skipped++
      continue
    }
    const { error } = await supabase.from('books').update({ description }).eq('id', book.id)
    if (error) {
      console.error(`  [error] ${slug}: ${error.message}`)
    } else {
      console.log(`  ✓ ${slug}`)
      updated++
    }
  }

  console.log(`\nUpdated: ${updated}, Skipped (already had description): ${skipped}`)
}

main().catch(console.error)
