import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

async function seed() {
  // Clear in reverse dependency order
  await supabase.from('ban_source_links').delete().not('ban_id', 'is', null)
  await supabase.from('ban_sources').delete().not('id', 'is', null)
  await supabase.from('bans').delete().not('id', 'is', null)
  await supabase.from('book_authors').delete().not('book_id', 'is', null)
  await supabase.from('books').delete().not('id', 'is', null)
  await supabase.from('authors').delete().not('id', 'is', null)
  await supabase.from('countries').delete().neq('code', '')

  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const schoolScopeId = scopes!.find((s) => s.slug === 'school')!.id
  console.log('School scope ID:', schoolScopeId)

  const { data: countries, error: ce } = await supabase
    .from('countries')
    .insert([
      { code: 'US', name_en: 'United States',  slug: 'united-states' },
      { code: 'GB', name_en: 'United Kingdom', slug: 'united-kingdom' },
      { code: 'IR', name_en: 'Iran',            slug: 'iran' },
    ])
    .select()
  if (ce) throw ce
  console.log('Countries:', countries!.map((c) => c.code))

  const { data: authors, error: ae } = await supabase
    .from('authors')
    .insert([
      { display_name: 'George Orwell',  slug: 'george-orwell',  birth_year: 1903, death_year: 1950 },
      { display_name: 'Toni Morrison',  slug: 'toni-morrison',  birth_year: 1931, death_year: 2019 },
      { display_name: 'Salman Rushdie', slug: 'salman-rushdie', birth_year: 1947 },
    ])
    .select()
  if (ae) throw ae
  console.log('Authors:', authors!.map((a) => a.display_name))

  const { data: books, error: be } = await supabase
    .from('books')
    .insert([
      { title: '1984',               slug: '1984',               original_language: 'en', first_published_year: 1949, ai_drafted: false },
      { title: 'The Bluest Eye',     slug: 'the-bluest-eye',     original_language: 'en', first_published_year: 1970, ai_drafted: false },
      { title: 'The Satanic Verses', slug: 'the-satanic-verses', original_language: 'en', first_published_year: 1988, ai_drafted: false },
    ])
    .select()
  if (be) throw be
  console.log('Books:', books!.map((b) => b.title))

  const { error: bae } = await supabase
    .from('book_authors')
    .insert([
      { book_id: books![0].id, author_id: authors![0].id },
      { book_id: books![1].id, author_id: authors![1].id },
      { book_id: books![2].id, author_id: authors![2].id },
    ])
  if (bae) throw bae
  console.log('Book-author links inserted.')

  const { data: bans, error: bane } = await supabase
    .from('bans')
    .insert([
      { book_id: books![0].id, country_code: 'US', scope_id: schoolScopeId, action_type: 'banned', status: 'active' },
      { book_id: books![1].id, country_code: 'GB', scope_id: schoolScopeId, action_type: 'banned', status: 'active' },
      { book_id: books![2].id, country_code: 'IR', scope_id: schoolScopeId, action_type: 'banned', status: 'active' },
    ])
    .select()
  if (bane) throw bane
  console.log('Bans:', bans!.length)

  const { data: banSources, error: bse } = await supabase
    .from('ban_sources')
    .insert([
      { source_name: 'Wikipedia', source_url: 'https://en.wikipedia.org/wiki/Nineteen_Eighty-Four', source_type: 'web' },
      { source_name: 'Wikipedia', source_url: 'https://en.wikipedia.org/wiki/The_Bluest_Eye',       source_type: 'web' },
      { source_name: 'Wikipedia', source_url: 'https://en.wikipedia.org/wiki/The_Satanic_Verses',   source_type: 'web' },
    ])
    .select()
  if (bse) throw bse
  console.log('Ban sources inserted.')

  const { error: bsle } = await supabase
    .from('ban_source_links')
    .insert([
      { ban_id: bans![0].id, source_id: banSources![0].id },
      { ban_id: bans![1].id, source_id: banSources![1].id },
      { ban_id: bans![2].id, source_id: banSources![2].id },
    ])
  if (bsle) throw bsle
  console.log('Ban-source links inserted.')

  console.log('\nSeed complete.')
}

seed().catch((err) => { console.error(err); process.exit(1) })
