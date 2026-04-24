import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

const DESCRIPTIONS: Record<string, string> = {
  US: 'The United States has no federal book bans, but individual school districts and public libraries regularly challenge and remove books. The American Library Association documents hundreds of such attempts each year, with the most targeted titles typically dealing with race, sexuality, or religion. The First Amendment broadly protects free expression, making outright government bans rare, but local school board decisions remain a persistent flashpoint.',

  GB: 'The United Kingdom prosecuted authors and publishers for obscenity throughout the 19th and 20th centuries under the Obscene Publications Acts, leading to the banning of works such as Lady Chatterley\'s Lover and The Well of Loneliness. Since the landmark 1960 Lady Chatterley trial, literary censorship has largely receded, and the UK now has strong press freedom protections. Government bans on books are rare today, though some titles have been restricted at the border.',

  SU: 'The Soviet Union operated one of the most extensive state censorship apparatuses in history. All publications required approval from Glavlit, the central censorship authority, and works deemed politically subversive, religiously motivated, or ideologically impure were systematically suppressed. Authors faced imprisonment, internal exile, or forced psychiatric treatment for writing outside the bounds of Socialist Realism, and samizdat — self-published underground literature — became the primary means of circulating banned works.',

  DE: 'Germany\'s most dramatic episode of book censorship came during the Nazi era, when the regime organised public burnings of thousands of titles in May 1933, targeting works by Jewish, communist, and politically undesirable authors. Today, post-war Germany has strong constitutional protections for free expression, though certain categories of content — such as Nazi propaganda and Holocaust denial — remain restricted by law. Modern Germany ranks consistently high in global press freedom indices.',

  FR: 'France prosecuted authors for obscenity and blasphemy throughout the 19th century, with high-profile trials against Flaubert (Madame Bovary) and Baudelaire (Les Fleurs du Mal) among the most famous. The principle of liberté d\'expression is deeply embedded in French law and culture, and outright book bans became increasingly rare through the 20th century. France today is generally considered to have strong literary freedom, though some works have been banned on grounds of defamation or incitement.',

  IR: 'Iran has maintained strict state censorship of books since the Islamic Revolution of 1979, with the Ministry of Culture and Islamic Guidance required to approve all publications. Works deemed contrary to Islamic values, critical of the government, or sexually explicit are routinely banned. The 1989 fatwa issued by Ayatollah Khomeini against Salman Rushdie for The Satanic Verses became one of the most widely reported acts of literary censorship in modern history, forcing Rushdie into hiding for nearly a decade.',

  LB: 'Lebanon operates a censorship system overseen by the General Security directorate, which reviews books, films, and other media for content deemed offensive to religion, morality, or national security. Despite this, Lebanon is generally considered to have a more open publishing environment than many of its neighbours in the Arab world. Books have been banned for offending religious communities or touching on sensitive political topics, though enforcement has been inconsistent.',

  IE: 'Ireland\'s Censorship of Publications Act of 1929 established a Censorship Board that banned thousands of books over several decades, including works by many of the country\'s most celebrated writers — among them Samuel Beckett, Edna O\'Brien, and John McGahern. Many books were banned on moral grounds, particularly for references to contraception or sexual content. The law was liberalised in 1967, and most previously banned books were released; Ireland today has no formal book censorship regime.',

  AU: 'Australia\'s classification system allows authorities to restrict or ban publications considered offensive, with the Classification Board empowered to assign restricted or refused-classification ratings. The Queensland state government banned American Psycho outright in 1991 — a ban that remained in place until 2011 — while other states required it to be sold in plain wrapping. Australia\'s federal system means that enforcement has historically varied by state, and the country generally ranks well on international press freedom measures.',

  PH: 'Under Spanish colonial rule, the Philippine authorities banned Noli Me Tángere and other works by José Rizal as subversive to the colonial order and the Catholic Church. After independence, successive governments periodically restricted publications deemed a threat to national security, particularly during the Marcos dictatorship (1972–1986), when martial law enabled broad censorship powers. The Philippines today has a constitutionally protected free press, though journalists and authors continue to face pressure in practice.',
}

async function main() {
  console.log(`Seeding descriptions for ${Object.keys(DESCRIPTIONS).length} countries...`)

  let updated = 0
  for (const [code, description] of Object.entries(DESCRIPTIONS)) {
    const { error } = await supabase
      .from('countries')
      .update({ description })
      .eq('code', code)

    if (error) console.warn(`  [error] ${code}: ${error.message}`)
    else { console.log(`  [ok] ${code}`); updated++ }
  }

  console.log(`\nDone. Updated: ${updated}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
