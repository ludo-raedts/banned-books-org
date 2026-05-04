/**
 * Round 5: Final 9 countries without descriptions.
 */
import { adminClient } from '../src/lib/supabase'
const APPLY = process.argv.includes('--apply')

const DESCS: { code: string; name: string; description: string }[] = [
  { code: 'ER', name: 'Eritrea', description: `Eritrea is widely regarded as Africa's most repressive state for press freedom. Since independence in 1993 and particularly since the 2001 government crackdown, all independent media has been shut down. No private newspapers, independent publishers, or foreign media are permitted to operate. Writers, journalists, and intellectuals who criticised the government of President Isaias Afwerki were arrested without charge in 2001 and held in undisclosed locations; many are presumed dead. Eritrea ranked last or near-last globally on press freedom indices for years, and virtually all literary and cultural expression is state-controlled.` },
  { code: 'LK', name: 'Sri Lanka', description: `Sri Lanka restricted press freedom significantly during its civil war (1983–2009) against the Tamil Tigers. Journalists covering military operations or documenting human rights abuses faced violence, disappearances, and prosecutions for sedition. The Prevention of Terrorism Act has been used to imprison critics of the government. After the war's end, press freedom did not fully recover: journalists and writers critical of the Rajapaksa government faced intimidation and prosecution. Sri Lanka ranked approximately 146th on the 2022 Reporters Without Borders Press Freedom Index, and investigations into the murders of journalists have been largely inconclusive.` },
  { code: 'BA', name: 'Bosnia and Herzegovina', description: `Bosnia and Herzegovina's media environment was shaped profoundly by the 1992–1995 war and the systematic use of ethnic nationalist propaganda by Serb, Croat, and Bosniak forces. During the war, all sides suppressed opposing narratives. Post-war Bosnia has constitutional press freedom protections under the Dayton Agreement framework, but ethnic divisions are reflected in largely segregated media markets. Defamation remains a criminal offence and has been used to silence critical journalism. Bosnia ranks in the mid-range of European press freedom indices.` },
  { code: 'MU', name: 'Mauritius', description: `Mauritius has one of Africa's most robust press freedom records, with constitutional protections for free expression and a pluralistic media environment. No formal book censorship regime exists. The country's legal framework does include provisions against defamation and incitement, which have occasionally been used against journalists. Mauritius consistently ranks among Africa's top performers on international press freedom indices.` },
  { code: 'MZ', name: 'Mozambique', description: `Mozambique's press freedom has improved since the end of its civil war (1977–1992) and the introduction of multiparty democracy. The country has constitutional free expression protections, and independent media exists. However, journalists covering corruption and organised crime have faced violence and intimidation. The 2015 kidnapping and murder of journalist Paulo Machava illustrated ongoing risks. Mozambique ranked approximately 97th on the 2022 Reporters Without Borders Press Freedom Index.` },
  { code: 'HT', name: 'Haiti', description: `Haiti has experienced severe restrictions on press freedom under various dictatorships, most notably the Duvalier regimes (Papa Doc 1957–1971, Baby Doc 1971–1986), which suppressed all critical publications and exiled or imprisoned dissenting writers and intellectuals. Since democratisation, press freedom has improved but remains constrained by poverty, gang violence, and political instability. Journalists covering gang territories or political corruption face extreme physical danger. Haiti is among the most dangerous countries for journalists in the Western Hemisphere.` },
  { code: 'HN', name: 'Honduras', description: `Honduras has one of the hemisphere's most dangerous environments for journalists and writers, with many killed for reporting on drug trafficking, corruption, and environmental activism. The country's Press Law and Penal Code contain broad prohibitions on content deemed insulting to officials. The 2009 military coup was followed by a crackdown on critical media. Environmental activist and Indigenous rights defender Berta Cáceres was murdered in 2016 after receiving the Goldman Environmental Prize; her collaborators have faced ongoing persecution. Honduras ranked approximately 161st on the 2022 Reporters Without Borders Press Freedom Index.` },
  { code: 'YE', name: 'Yemen', description: `Yemen's censorship has been shaped by decades of authoritarian rule and, since 2015, by civil war and the fragmentation of state authority. Under President Ali Abdullah Saleh, publications critical of the government were banned and journalists prosecuted. The Houthi movement and the Saudi-led coalition have both engaged in censorship of hostile reporting in areas under their control. Journalists face extreme danger in Yemen, which has been called one of the world's worst conflicts for media freedom.` },
  { code: 'OM', name: 'Oman', description: `Oman restricts freedom of expression under laws prohibiting criticism of Sultan Qaboos (now Sultan Haitham) and the government, as well as content deemed contrary to Islam or public morality. The Press and Publications Law requires media registration and prohibits a broad range of sensitive topics. Writers and bloggers have been imprisoned for social media posts. Books on political reform, human rights criticism, or LGBT topics are banned. Oman ranked approximately 135th on international press freedom indices.` },
]

async function main() {
  const supabase = adminClient()
  console.log(`\n── import-wikipedia-countries-r5 (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)
  let added = 0
  for (const upd of DESCS) {
    const { data } = await supabase.from('countries').select('description').eq('code', upd.code).single()
    if (data?.description) { console.log(`[${upd.code}] SKIP`); continue }
    console.log(`[${upd.code}] ${upd.name}: ADDING`)
    if (APPLY) {
      const { error } = await supabase.from('countries').update({ description: upd.description }).eq('code', upd.code)
      if (error) console.error(`  ✗ ${error.message}`)
      else { console.log(`  ✓ written`); added++ }
    }
  }
  console.log(`\nDone. ${APPLY ? `Added: ${added}` : 'DRY-RUN — add --apply to write.'}`)
}
main().catch(e => { console.error(e); process.exit(1) })
