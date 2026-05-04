/**
 * Round 4: Remaining countries with bans that lack descriptions.
 * Covers: TW, KW, CO, VE, TH, MA, PE, CZ, BE, UY, SD, UG, TZ, BH, TN, DZ, NI, SV
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-wikipedia-countries-r4.ts
 *   npx tsx --env-file=.env.local scripts/import-wikipedia-countries-r4.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

const COUNTRY_UPDATES: { code: string; name: string; mode: 'new' | 'improve'; description: string }[] = [

  {
    code: 'TW', name: 'Taiwan', mode: 'new',
    description: `Taiwan under Kuomintang (KMT) authoritarian rule (1949–1987) maintained comprehensive censorship during the period of martial law — the longest in history for any country. Publications deemed pro-communist, sympathetic to the People's Republic of China, or challenging KMT legitimacy were banned. The lifting of martial law in 1987 and democratisation transformed Taiwan into one of Asia's most open societies. Today Taiwan ranks among the world's freest countries for press freedom and has some of the most robust free expression protections in the region, standing in stark contrast to the censorship regime prevailing across the Taiwan Strait.`,
  },

  {
    code: 'KW', name: 'Kuwait', mode: 'new',
    description: `Kuwait restricts freedom of expression under laws that prohibit criticism of the emir, the government, religion, or content deemed contrary to public morals. The Ministry of Information reviews imported books and publications at the border, and many works on LGBT themes, political dissent, or content critical of Islam are prohibited. Despite being a constitutional monarchy with an elected parliament — the most active legislature in the Gulf — press freedom is constrained by self-censorship and legal risks. Kuwait ranked approximately 120th on international press freedom indices in recent years.`,
  },

  {
    code: 'CO', name: 'Colombia', mode: 'new',
    description: `Colombia's most acute censorship threat has come not from formal state banning but from the violence directed at journalists and writers by guerrilla groups, paramilitaries, and drug cartels during decades of armed conflict. Journalists covering the FARC, ELN, or paramilitary groups faced assassination, exile, or self-censorship. Under successive governments, some publications on narcotrafficking or government corruption faced legal pressure, but formal book banning has been rare. The 2016 peace agreement with the FARC improved security conditions for journalists in some regions, though violence against reporters in conflict zones has continued.`,
  },

  {
    code: 'VE', name: 'Venezuela', mode: 'new',
    description: `Venezuela under Hugo Chávez (1999–2013) and Nicolás Maduro (2013–present) has progressively restricted press freedom. While formal book banning has been limited, the government has used defamation laws, broadcast licence revocations, and economic pressure to silence critical voices. Independent publishers and bookshops have struggled under economic controls and paper shortages deliberately affecting critical publications. Writers and journalists critical of the government have faced prosecution under laws against "disrespecting authorities." Venezuela consistently ranks near the bottom of Latin American press freedom indices.`,
  },

  {
    code: 'TH', name: 'Thailand', mode: 'new',
    description: `Thailand's censorship is shaped by its lèse-majesté laws (Criminal Code Section 112), which criminalise criticism of the monarchy with penalties of up to 15 years imprisonment per count. These laws have been used to prosecute books, articles, and social media posts deemed insulting to the king. Following the 2014 military coup, the National Council for Peace and Order banned hundreds of books and academic texts. Thailand periodically bans books on sensitive political topics, particularly those touching on the monarchy, recent coups, or the southern insurgency. The country has ranked around 107th–115th on international press freedom indices.`,
  },

  {
    code: 'MA', name: 'Morocco', mode: 'new',
    description: `Morocco restricts freedom of expression under laws that prohibit criticism of the king, the monarchy, Islam, and Morocco's sovereignty over Western Sahara — the last considered a particularly sensitive subject. Books and publications on these topics are banned from import or distribution. The government has prosecuted journalists and bloggers under press codes and anti-terrorism laws. Writers and poets have been imprisoned for works deemed insulting to religion or the state. Morocco ranked approximately 135th of 180 countries on the 2022 Reporters Without Borders Press Freedom Index.`,
  },

  {
    code: 'PE', name: 'Peru', mode: 'new',
    description: `Peru's censorship history includes periods of military dictatorship — notably under Juan Velasco Alvarado (1968–1975) and Alberto Fujimori (1990–2000) — during which independent media faced closures and critical publications were suppressed. Fujimori's government bought media outlets, intimidated journalists, and used intelligence services to intercept and suppress reporting on corruption. Peru's Truth and Reconciliation Commission (2001–2003) documented censorship of coverage of the conflict with Sendero Luminoso and the MRTA. Today Peru has constitutional free expression protections and a more open press environment, though defamation suits against journalists remain a concern.`,
  },

  {
    code: 'CZ', name: 'Czech Republic', mode: 'new',
    description: `The Czech Republic is the successor to Communist Czechoslovakia (the code CS in this database covers Czechoslovakia's unified period). After the Velvet Revolution of 1989, Czechoslovakia and then the independent Czech Republic quickly established strong free expression protections. The Czech Republic today has a robust and free press and ranks consistently in the top tier of European press freedom indices. Historical censorship from the communist period (1948–1989) is covered under Czechoslovakia. Modern Czech law prohibits Holocaust denial and incitement to racial hatred, which has led to occasional prosecutions.`,
  },

  {
    code: 'BE', name: 'Belgium', mode: 'new',
    description: `Belgium has one of Europe's strongest constitutional protections for press freedom, rooted in the freedom of the press clause in its 1831 constitution. Political censorship has been effectively absent since the country's founding. During the Nazi occupation (1940–1944), Belgian publishers and writers were subject to German censorship and repression. Modern Belgian law prohibits Holocaust denial (since 1995) and incitement to racial hatred, which has led to prosecutions of far-right publications. Belgium consistently ranks among the world's most press-free countries.`,
  },

  {
    code: 'UY', name: 'Uruguay', mode: 'new',
    description: `Uruguay under the civic-military dictatorship (1973–1985) banned thousands of books and records in one of the most comprehensive cultural censorship campaigns in Latin American history. Over 1,000 authors, musicians, and artists were blacklisted, and their works removed from public libraries and destroyed. Writers and intellectuals were imprisoned, forced into exile, or disappeared. Uruguay's cultural censorship was documented as particularly systematic. The return of democracy in 1985 ended formal censorship, and Uruguay today consistently ranks as one of Latin America's most press-free countries.`,
  },

  {
    code: 'SD', name: 'Sudan', mode: 'new',
    description: `Sudan under Omar al-Bashir's Islamist government (1989–2019) maintained strict censorship of books and media under National Security laws and Islamic moral codes. Publications critical of the government or deemed contrary to Islamic values were banned; pre-publication censorship of newspapers was enforced through the National Press and Publication Council. Authors and journalists faced imprisonment or exile. Nobel Peace Prize laureate Ahmed al-Daghir was persecuted for his activism. The 2019 revolution that ousted al-Bashir opened a brief democratic transition, but subsequent military coups have reversed most press freedom gains.`,
  },

  {
    code: 'UG', name: 'Uganda', mode: 'new',
    description: `Uganda restricts press freedom under laws that criminalise "false news," sedition, and publications deemed harmful to national security or offensive to the dignity of public officers. Under Yoweri Museveni (president since 1986), the government has closed independent newspapers, revoked broadcast licences, and detained journalists. The Anti-Homosexuality Act and related laws have led to banning of publications related to LGBT rights. Uganda ranked approximately 125th on the 2022 Reporters Without Borders Press Freedom Index.`,
  },

  {
    code: 'TZ', name: 'Tanzania', mode: 'new',
    description: `Tanzania restricts media under the Newspaper Act 1976, which allows the government to ban publications it deems contrary to the public interest. The government of John Magufuli (2015–2021) significantly tightened media restrictions, banning several newspapers and arresting journalists. Publications critical of the government or touching on sensitive topics such as corruption or election fraud have been suppressed. Tanzania ranked approximately 124th on international press freedom indices during the Magufuli era.`,
  },

  {
    code: 'BH', name: 'Bahrain', mode: 'new',
    description: `Bahrain restricts freedom of expression under laws that prohibit criticism of the government, the ruling Al Khalifa family, and Islam. Following the 2011 Arab Spring protests and the government's violent crackdown, dozens of journalists, bloggers, and activists — including prominent writer and activist Nabeel Rajab — were imprisoned for social media posts and books. Publications and websites critical of the government are banned. Bahrain ranked near the bottom of global press freedom indices, at approximately 168th of 180 in 2022.`,
  },

  {
    code: 'TN', name: 'Tunisia', mode: 'new',
    description: `Tunisia under Zine El Abidine Ben Ali (1987–2011) maintained comprehensive censorship of the press and publications, particularly works critical of the government or politically sensitive topics. The 2011 Jasmine Revolution, which triggered the Arab Spring, briefly created significant press freedom. However, President Kais Saied's 2021 consolidation of power has reversed many gains: a new constitution removes judicial independence, and Decree 54/2022 criminalises online "false information," used to prosecute journalists and activists. Tunisia has fallen sharply in press freedom rankings since 2021.`,
  },

  {
    code: 'DZ', name: 'Algeria', mode: 'new',
    description: `Algeria restricts freedom of expression under press codes that require newspapers to register and prohibit content deemed insulting to the state, the president, or the military. Books and publications on sensitive political topics — the Black Decade civil war (1991–2002), the military's role in politics, or the independence movement — have been suppressed or required self-censorship. The 2019 Hirak protest movement and its subsequent crackdown included prosecutions of writers and journalists under broad anti-terrorism laws. Algeria ranked approximately 134th of 180 countries on the 2022 Reporters Without Borders Press Freedom Index.`,
  },

  {
    code: 'NI', name: 'Nicaragua', mode: 'new',
    description: `Nicaragua under the Ortega-Murillo government (2007–present, and particularly since the 2018 crackdown on protest) has dramatically restricted press freedom. Independent newspapers have been shut down, printing companies raided, and journalists exiled or imprisoned. The Nobel Peace Prize–nominated Mothers of April — documenting state violence — was effectively suppressed. Writer Sergio Ramírez, once vice president of Nicaragua, was stripped of his citizenship in 2021 and his books effectively banned domestically after he criticised the Ortega government. Nicaragua ranked among the bottom countries for press freedom globally.`,
  },

  {
    code: 'SV', name: 'El Salvador', mode: 'new',
    description: `El Salvador's press faced extreme censorship and violence during its civil war (1979–1992), when death squads murdered journalists and writers critical of the government. The US-backed military government and associated paramilitaries were responsible for many killings, including the assassination of Archbishop Óscar Romero in 1980. The post-war constitution provides free expression protections. Under President Nayib Bukele (2019–present), journalists and critical outlets have faced harassment, surveillance under Pegasus spyware, and legal pressure, leading to renewed press freedom concerns.`,
  },
]

async function main() {
  const supabase = adminClient()
  console.log(`\n── import-wikipedia-countries-r4 (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  let added = 0, skipped = 0

  for (const upd of COUNTRY_UPDATES) {
    const { data: existing } = await supabase.from('countries')
      .select('description').eq('code', upd.code).single()
    const isNew = !existing?.description

    if (upd.mode === 'new' && !isNew) {
      console.log(`[${upd.code}] SKIP — already has description`); skipped++; continue
    }

    console.log(`[${upd.code}] ${upd.name}: ${isNew ? 'ADDING' : 'IMPROVING'}`)

    if (APPLY) {
      const { error } = await supabase.from('countries')
        .update({ description: upd.description }).eq('code', upd.code)
      if (error) { console.error(`  ✗ ${error.message}`) }
      else { console.log(`  ✓ written`); added++ }
    }
  }

  console.log(`\nDone. ${APPLY ? `Added/updated: ${added}  Skipped: ${skipped}` : 'DRY-RUN — add --apply to write.'}`)
}

main().catch(e => { console.error(e); process.exit(1) })
