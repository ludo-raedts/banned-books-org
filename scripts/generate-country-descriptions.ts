import Anthropic from '@anthropic-ai/sdk'
import { adminClient } from '../src/lib/supabase'

const anthropic = new Anthropic()
const supabase = adminClient()

const COUNTRY_CONTEXT: Record<string, string> = {
  US:  'the United States, where school and library book challenges are common and documented by the ALA, though the First Amendment broadly protects free speech',
  GB:  'the United Kingdom, which has historically prosecuted books under obscenity law but today has strong press freedom protections',
  SU:  'the Soviet Union, where state censorship was systematic and politically motivated throughout the 20th century',
  DE:  'Germany, including its history of Nazi-era book burnings in the 1930s and today\'s strong constitutional protections for free expression',
  FR:  'France, which prosecuted authors for obscenity and blasphemy in the 19th century but now has broad protections for literary expression',
  IR:  'Iran, where the Islamic Revolution of 1979 led to strict religious censorship and the government has issued death fatwas against authors',
  LB:  'Lebanon, which has censored books deemed offensive to religion or national security, though it remains one of the more open press environments in the Arab world',
  IE:  'Ireland, where the Censorship of Publications Act 1929 led to widespread banning of literary works on moral grounds throughout the 20th century',
  AU:  'Australia, which has a classification system that can restrict or ban publications deemed offensive, with state-level variations in enforcement',
  PH:  'the Philippines, where Spanish colonial authorities banned subversive literature in the 19th century and later governments have periodically restricted publications',
}

async function generateDescription(code: string, name: string): Promise<string | null> {
  const context = COUNTRY_CONTEXT[code]
  if (!context) return null

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Write a concise 2–3 sentence description about the history of book banning and freedom of speech in ${context}. Be factual, neutral, and focus on the cultural and political context that led to books being banned there. No markdown, no bullet points.`,
    }],
  })

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as Anthropic.Messages.TextBlock).text)
    .join('')
    .trim()

  return text || null
}

async function main() {
  const { data: countries, error } = await supabase
    .from('countries')
    .select('code, name_en')
    .is('description', null)

  if (error) throw error
  if (!countries || countries.length === 0) {
    console.log('All countries already have descriptions.')
    return
  }

  console.log(`Generating descriptions for ${countries.length} countries...`)

  let updated = 0
  for (const { code, name_en } of countries) {
    const description = await generateDescription(code, name_en)
    if (!description) {
      console.log(`  [skip] ${name_en} — no context defined`)
      continue
    }

    const { error: ue } = await supabase
      .from('countries')
      .update({ description })
      .eq('code', code)

    if (ue) console.warn(`  [error] ${name_en}: ${ue.message}`)
    else { console.log(`  [ok] ${name_en}`); updated++ }
  }

  console.log(`\nDone. Updated: ${updated}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
