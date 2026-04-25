import { adminClient } from '../src/lib/supabase'
async function main() {
  const s = adminClient()
  
  // Fix "Lucky (AS)" → "Lucky"
  const { data: lucky } = await s.from('books').select('id, title, description').eq('slug', 'lucky-as').single()
  if (lucky?.title === 'Lucky (AS)') {
    await s.from('books').update({ title: 'Lucky' }).eq('id', lucky.id)
    console.log('Fixed: Lucky (AS) → Lucky')
  }
  
  // Check naked-lunch has description
  const { data: nl } = await s.from('books').select('id, description').eq('slug', 'naked-lunch').single()
  if (nl && !nl.description) {
    await s.from('books').update({
      description: "William S. Burroughs' 1959 novel — published by Olympia Press in Paris after being rejected everywhere in the US — presenting a hallucinatory series of vignettes involving drug addiction, bureaucratic nightmare, and sexual violence in a cut-up, non-linear form. Subject to one of the last major American literary obscenity trials, in Massachusetts in 1965, where Norman Mailer and Allen Ginsberg testified to its literary merit. Considered a founding text of the Beat Generation."
    }).eq('id', nl.id)
    console.log('Added description for Naked Lunch')
  } else {
    console.log('Naked Lunch already has description:', nl?.description?.slice(0, 60))
  }
  
  // Check speak has description
  const { data: speak } = await s.from('books').select('id, description').eq('slug', 'speak').single()
  if (speak && !speak.description) {
    await s.from('books').update({
      description: "Laurie Halse Anderson's 1999 novel about Melinda, a high school freshman who is ostracised after calling the police from a summer party. The reader gradually understands she was raped by a senior named Andy Evans. One of the most frequently challenged young adult novels — and one of the most critically important — Speak is often challenged for its frank portrayal of sexual assault, the very crime it was written to help survivors name and survive."
    }).eq('id', speak.id)
    console.log('Added description for Speak')
  } else {
    console.log('Speak already has description:', speak?.description?.slice(0, 60))
  }
  
  // Check crank has description
  const { data: crank } = await s.from('books').select('id, description').eq('slug', 'crank').single()
  if (crank && !crank.description) {
    await s.from('books').update({
      description: "Ellen Hopkins's 2004 novel in verse, a semi-autobiographical account of Kristina Georgia Snow, a straight-A student who is introduced to crystal meth (\"crank\") and descends into addiction. Based on her own daughter's experiences. One of the best-selling young adult novels ever published despite — or because of — its near-permanent presence on banned book lists, challenged for its graphic depictions of drug use, sexual content, and violence."
    }).eq('id', crank.id)
    console.log('Added description for Crank')
  } else {
    console.log('Crank already has description:', crank?.description?.slice(0, 60))
  }
  
  // Check damsel has description
  const { data: damsel } = await s.from('books').select('id, description').eq('slug', 'damsel').single()
  if (damsel && !damsel.description) {
    await s.from('books').update({
      description: "Elana K. Arnold's Printz Award-winning novel that plays with and subverts the fantasy rescue trope: a prince slays a dragon and \"rescues\" a girl with no memory of who she was before — but the rescue comes with deeply sinister expectations. A sharp, allegorical exploration of patriarchal coercion and sexual violence disguised as a fairy tale. Challenged in US schools for its sexual content."
    }).eq('id', damsel.id)
    console.log('Added description for Damsel')
  } else {
    console.log('Damsel already has description:', damsel?.description?.slice(0, 60))
  }
  
  // Check sold has description
  const { data: sold } = await s.from('books').select('id, description').eq('slug', 'sold-patricia-mccormick').single()
  if (sold && !sold.description) {
    await s.from('books').update({
      description: "Patricia McCormick's 2006 novel told in spare, lyrical verse about Lakshmi, a thirteen-year-old girl from rural Nepal who is sold by her stepfather into a Kolkata brothel under the pretence of domestic work. Based on extensive research and interviews with trafficking survivors. Challenged in US schools for its sexual content, but widely used by NGOs and educators working on human trafficking awareness."
    }).eq('id', sold.id)
    console.log('Added description for Sold')
  } else {
    console.log('Sold already has description:', sold?.description?.slice(0, 60))
  }
  
  // Check stamped has description  
  const { data: stamped } = await s.from('books').select('id, description').eq('slug', 'stamped-racism-antiracism-and-you').single()
  if (stamped && !stamped.description) {
    await s.from('books').update({
      description: "Jason Reynolds and Ibram X. Kendi's young adult adaptation of Kendi's National Book Award-winning 'Stamped from the Beginning,' tracing the history of racist ideas in America from Puritan Massachusetts to the present. Among the most frequently banned books in the US since 2021, challenged for what critics describe as 'indoctrinating' content about systemic racism."
    }).eq('id', stamped.id)
    console.log('Added description for Stamped')
  } else {
    console.log('Stamped already has description:', stamped?.description?.slice(0, 60))
  }
}
main().catch(console.error)
