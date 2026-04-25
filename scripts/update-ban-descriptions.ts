import { adminClient } from '../src/lib/supabase'

/**
 * Adds/updates ban descriptions for well-documented bans where we have
 * reliable contextual information. Also adds HK ban for Prisoner of the State
 * which was already in DB before batch22.
 */

const supabase = adminClient()

async function main() {
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')

  const scopeId = (slug: string) => scopes!.find(s => s.slug === slug)!.id
  const reasonId = (slug: string) => reasons!.find(r => r.slug === slug)!.id

  const libId = scopeId('public_library')

  const hkfpSource = await supabase.from('ban_sources')
    .select('id').eq('source_url', 'https://hongkongfp.com/2020/07/06/hong-kong-public-libraries-remove-books-by-pro-democracy-advocates-amid-nsl-fears/')
    .single()
  const hkfpId = hkfpSource.data?.id ?? null

  const NSL_BAN_DESC = 'Removed from Hong Kong Public Libraries for review after the enactment of the National Security Law (June 2020). Withdrawal was deemed necessary to assess potential breach of the new law.'
  const NLB_BAN_DESC = 'Removed from the children\'s section of Singapore\'s National Library Board (NLB) in July 2014 as "promoting family values contrary to those held by the majority in Singapore." After public outcry over the policy of pulping the books, some were moved to the adult section.'

  // ── Prisoner of the State — add missing HK ban ─────────────────────
  {
    const { data: book } = await supabase.from('books').select('id').eq('slug', 'prisoner-of-the-state').single()
    if (book) {
      const { data: existing } = await supabase.from('bans').select('id, country_code, description').eq('book_id', book.id)
      const hasHK = (existing ?? []).some(b => b.country_code === 'HK')
      if (!hasHK) {
        const { data: ban } = await supabase.from('bans').insert({
          book_id: book.id, country_code: 'HK', scope_id: libId,
          action_type: 'banned', status: 'active', year_started: 2020,
          actor: 'Hong Kong Public Libraries',
          description: NSL_BAN_DESC,
        }).select('id').single()
        if (ban) {
          await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId('political') })
          if (hkfpId) await supabase.from('ban_source_links').insert({ ban_id: ban.id, source_id: hkfpId })
          console.log('Added HK ban for Prisoner of the State')
        }
      } else {
        // Update existing HK ban description if empty
        const hkBan = (existing ?? []).find(b => b.country_code === 'HK')
        if (hkBan && !hkBan.description) {
          await supabase.from('bans').update({ description: NSL_BAN_DESC }).eq('id', hkBan.id)
          console.log('Updated HK ban description for Prisoner of the State')
        } else {
          console.log('[skip] Prisoner of the State HK ban already has description')
        }
      }
    }
  }

  // ── Singapore NLB 2014 — update ban descriptions ───────────────────
  const sgBooks = [
    { slug: 'the-white-swan-express', desc: NLB_BAN_DESC },
    { slug: 'whos-in-my-family', desc: NLB_BAN_DESC },
    { slug: 'and-tango-makes-three', country: 'SG', desc: NLB_BAN_DESC },
  ]

  for (const { slug, desc, country = undefined } of sgBooks) {
    const { data: book } = await supabase.from('books').select('id').eq('slug', slug).single()
    if (!book) { console.error(`  MISSING: ${slug}`); continue }
    let query = supabase.from('bans').select('id, description').eq('book_id', book.id)
    if (country) query = query.eq('country_code', country)
    const { data: bans } = await query
    for (const ban of bans ?? []) {
      if (!ban.description) {
        await supabase.from('bans').update({ description: desc }).eq('id', ban.id)
        console.log(`Updated SG ban description for ${slug}`)
      } else {
        console.log(`[skip] ${slug} ban already has description`)
      }
    }
  }

  // ── And Tango Makes Three — add book description ──────────────────
  {
    const { data: book } = await supabase.from('books').select('id, description').eq('slug', 'and-tango-makes-three').single()
    if (book && !book.description) {
      await supabase.from('books').update({
        description: 'A children\'s picture book based on the true story of Roy and Silo, two male chinstrap penguins at New York\'s Central Park Zoo who paired and raised a chick named Tango together. Since publication it has consistently topped the American Library Association\'s list of most-challenged books, making it one of the most banned children\'s books of the 21st century.'
      }).eq('id', book.id)
      console.log('Added description for And Tango Makes Three')
    }
  }

  // ── The Satanic Verses — add book description ─────────────────────
  {
    const { data: book } = await supabase.from('books').select('id, description').eq('slug', 'the-satanic-verses').single()
    if (book && !book.description) {
      await supabase.from('books').update({
        description: 'Salman Rushdie\'s novel weaving together the stories of two Indian actors who survive a hijacked plane explosion, exploring identity, migration, and faith through magical realist reimaginings of Islamic history. Published in 1988, it provoked one of the most severe literary crises of the modern era: Iran\'s Supreme Leader Ayatollah Khomeini issued a fatwa calling for Rushdie\'s death, forcing him into a decade of hiding under police protection.'
      }).eq('id', book.id)
      console.log('Added description for The Satanic Verses')
    }
  }

  // ── 1984 — add book description ────────────────────────────────────
  {
    const { data: book } = await supabase.from('books').select('id, description').eq('slug', '1984').single()
    if (book && !book.description) {
      await supabase.from('books').update({
        description: 'George Orwell\'s dystopian masterpiece set in a totalitarian future where "Big Brother" watches every citizen, independent thought is a crime (thoughtcrime), and history is continuously rewritten. Written in 1948 as a warning about Stalinist totalitarianism, it has been banned or restricted in the Soviet Union and numerous authoritarian states, and in the USA challenged in schools for its dark themes and sexual content. It gave the language the words "doublethink," "newspeak," and "Room 101."'
      }).eq('id', book.id)
      console.log('Added description for 1984')
    }
  }

  // ── The Diary of a Young Girl — add book description ──────────────
  {
    const { data: book } = await supabase.from('books').select('id, description').eq('slug', 'the-diary-of-a-young-girl').single()
    if (book && !book.description) {
      await supabase.from('books').update({
        description: 'Anne Frank\'s diary, kept during the two years she and her family hid from the Nazis in a concealed apartment in Amsterdam. Discovered and first published in 1947 by her father Otto, the sole family survivor, it has become one of the most widely read accounts of the Holocaust. Challenged in some US schools for its depiction of puberty and sexuality, and banned in Lebanon and some other countries with restrictions on material sympathetic to Israel.'
      }).eq('id', book.id)
      console.log('Added description for Diary of a Young Girl')
    }
  }

  // ── Lolita — add book description ─────────────────────────────────
  {
    const { data: book } = await supabase.from('books').select('id, description').eq('slug', 'lolita').single()
    if (book && !book.description) {
      await supabase.from('books').update({
        description: 'Vladimir Nabokov\'s controversial novel narrated by Humbert Humbert, a middle-aged professor obsessed with his 12-year-old stepdaughter Dolores. Rejected by every American publisher as unpublishable, it was first published in Paris by Olympia Press in 1955. Despite the repellent narrator, the novel is widely regarded as a masterwork of literary unreliable narration. Banned in France, the UK, Argentina, and New Zealand upon publication; challenged in US schools for decades.'
      }).eq('id', book.id)
      console.log('Added description for Lolita')
    }
  }

  console.log('\nDone.')
}

main().catch(console.error)
