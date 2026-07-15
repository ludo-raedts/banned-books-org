// Read-only: match the 100 titles in Dua Lipa's Manifesto Library (Livraria
// Lello, Porto — Service95) against our catalog. Prints matched vs. missing.
import { adminClient } from '../src/lib/supabase'
import { titlesMatch } from '../src/lib/enrich/title-match'

const LIST: Array<[string, string, string]> = [
  // [title, author, theme]
  ['A Case of Exploding Mangoes', 'Mohammed Hanif', 'Power'],
  ['A Dictator Calls', 'Ismail Kadare', 'Power'],
  ['A History of Reading', 'Alberto Manguel', 'Power'],
  ['Felon', 'Reginald Dwayne Betts', 'Power'],
  ['Free', 'Lea Ypi', 'Power'],
  ['Glory', 'NoViolet Bulawayo', 'Power'],
  ['In Cold Blood', 'Truman Capote', 'Power'],
  ['Jerusalem', 'Gonçalo M. Tavares', 'Power'],
  ['Kleptopia', 'Tom Burgis', 'Power'],
  ["Lula Dean's Little Library of Banned Books", 'Kirsten Miller', 'Power'],
  ['Men Who Hate Women', 'Laura Bates', 'Power'],
  ['Nineteen Eighty-Four', 'George Orwell', 'Power'],
  ['One Day, Everyone Will Have Always Been Against This', 'Omar El Akkad', 'Power'],
  ["Putin's Russia", 'Anna Politkovskaya', 'Power'],
  ['The Crucible', 'Arthur Miller', 'Power'],
  ['The Feast of the Goat', 'Mario Vargas Llosa', 'Power'],
  ['The Grapes of Wrath', 'John Steinbeck', 'Power'],
  ['The Second Sex', 'Simone de Beauvoir', 'Power'],
  ['Unfree Speech', 'Joshua Wong', 'Power'],
  ['A Clockwork Orange', 'Anthony Burgess', 'Control'],
  ['Ai Weiwei on Censorship', 'Ai Weiwei', 'Control'],
  ['Animal Farm', 'George Orwell', 'Control'],
  ['Blindness', 'José Saramago', 'Control'],
  ['Brave New World', 'Aldous Huxley', 'Control'],
  ['Careless People', 'Sarah Wynn-Williams', 'Control'],
  ['Fahrenheit 451', 'Ray Bradbury', 'Control'],
  ['Naked Lunch', 'William S. Burroughs', 'Control'],
  ["One Flew Over the Cuckoo's Nest", 'Ken Kesey', 'Control'],
  ['The Accusation', 'Bandi', 'Control'],
  ['The Burnout Society', 'Byung-Chul Han', 'Control'],
  ["The Handmaid's Tale", 'Margaret Atwood', 'Control'],
  ['The Hunger Games', 'Suzanne Collins', 'Control'],
  ['The Melancholy of Resistance', 'László Krasznahorkai', 'Control'],
  ['The Memory Police', 'Yoko Ogawa', 'Control'],
  ['The Noise of Time', 'Julian Barnes', 'Control'],
  ['The Trial', 'Franz Kafka', 'Control'],
  ['A Thousand Splendid Suns', 'Khaled Hosseini', 'Voice'],
  ['Another Country', 'James Baldwin', 'Voice'],
  ["Are You There God? It's Me, Margaret", 'Judy Blume', 'Voice'],
  ['Born A Crime', 'Trevor Noah', 'Voice'],
  ['Decolonising the Mind', 'Ngugi wa Thiongo', 'Voice'],
  ['Erasure', 'Percival Everett', 'Voice'],
  ['Gender Queer', 'Maia Kobabe', 'Voice'],
  ['Girl, Woman, Other', 'Bernardine Evaristo', 'Voice'],
  ['Hard Like Water', 'Yan Lianke', 'Voice'],
  ['Heartstopper', 'Alice Oseman', 'Voice'],
  ['I Know Why The Caged Bird Sings', 'Maya Angelou', 'Voice'],
  ['Invisible Man', 'Ralph Ellison', 'Voice'],
  ['Milk and Honey', 'Rupi Kaur', 'Voice'],
  ['My Friends', 'Hisham Matar', 'Voice'],
  ['My Pen Is The Wing Of A Bird', 'Afghan Women', 'Voice'],
  ['Nineteen Minutes', 'Jodi Picoult', 'Voice'],
  ["Olhos d'Água", 'Conceição Evaristo', 'Voice'],
  ["On Earth We're Briefly Gorgeous", 'Ocean Vuong', 'Voice'],
  ['Stamped', 'Jason Reynolds', 'Voice'],
  ['Swimming in the Dark', 'Tomasz Jędrowski', 'Voice'],
  ['That Hair', 'Djaimilia Pereira de Almeida', 'Voice'],
  ['The Absolutely True Diary of a Part-Time Indian', 'Sherman Alexie', 'Voice'],
  ['The Adventures of Huckleberry Finn', 'Mark Twain', 'Voice'],
  ['The Catcher in the Rye', 'J. D. Salinger', 'Voice'],
  ['The Color Purple', 'Alice Walker', 'Voice'],
  ['The Dark Side of Skin', 'Jeferson Tenório', 'Voice'],
  ['The God of Small Things', 'Arundhati Roy', 'Voice'],
  ['The Hate U Give', 'Angie Thomas', 'Voice'],
  ['The Metamorphosis', 'Franz Kafka', 'Voice'],
  ['The Satanic Verses', 'Salman Rushdie', 'Voice'],
  ['The Three Marias', 'Maria Isabel Barreno', 'Voice'],
  ['The Vegetarian', 'Han Kang', 'Voice'],
  ['Their Eyes Were Watching God', 'Zora Neale Hurston', 'Voice'],
  ['There There', 'Tommy Orange', 'Voice'],
  ['Things Fall Apart', 'Chinua Achebe', 'Voice'],
  ['This Book Is Gay', 'Juno Dawson', 'Voice'],
  ['To Kill A Mockingbird', 'Harper Lee', 'Voice'],
  ['We Are Displaced', 'Malala Yousafzai', 'Voice'],
  ['We Are Not Numbers', 'Ahmed Alnaouq', 'Voice'],
  ['Beloved', 'Toni Morrison', 'Memory'],
  ['Half of a Yellow Sun', 'Chimamanda Ngozi Adichie', 'Memory'],
  ['Istanbul: Memories and the City', 'Orhan Pamuk', 'Memory'],
  ['Looking at Women Looking at War', 'Victoria Amelina', 'Memory'],
  ['Maus', 'Art Spiegelman', 'Memory'],
  ['Oblivion: A Memoir', 'Héctor Abad Faciolince', 'Memory'],
  ['One Hundred Years of Solitude', 'Gabriel García Márquez', 'Memory'],
  ['Pachinko', 'Min Jin Lee', 'Memory'],
  ['Patriot', 'Alexei Navalny', 'Memory'],
  ['Persepolis', 'Marjane Satrapi', 'Memory'],
  ['Soldiers of Salamis', 'Javier Cercas', 'Memory'],
  ['The Bastard of Istanbul', 'Elif Shafak', 'Memory'],
  ['The Book Thief', 'Markus Zusak', 'Memory'],
  ['The Books of Jacob', 'Olga Tokarczuk', 'Memory'],
  ['The Diary of a Young Girl', 'Anne Frank', 'Memory'],
  ['The House of the Spirits', 'Isabel Allende', 'Memory'],
  ['The Kite Runner', 'Khaled Hosseini', 'Memory'],
  ['The Last Kabbalist of Lisbon', 'Richard Zimler', 'Memory'],
  ['The Machine to Make Spaniards', 'Valter Hugo Mãe', 'Memory'],
  ['The Most Secret Memory of Men', 'Mohamed Mbougar Sarr', 'Memory'],
  ['The Murmuring Coast', 'Lídia Jorge', 'Memory'],
  ['The Return', 'Dulce Maria Cardoso', 'Memory'],
  ['The Sympathizer', 'Viet Thanh Nguyen', 'Memory'],
  ['The Unbearable Lightness of Being', 'Milan Kundera', 'Memory'],
  ['Wild Swans', 'Jung Chang', 'Memory'],
]

async function main() {
  const sb = adminClient()
  type Row = {
    id: number
    title: string
    slug: string
    book_authors: Array<{ authors: { display_name: string } | null }> | null
  }
  const all: Row[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('books')
      .select('id, title, slug, book_authors(authors(display_name))')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as unknown as Row[]))
    if (data.length < PAGE) break
  }
  console.log(`Catalog rows: ${all.length}\n`)

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const confirmed: Array<{ item: [string, string, string]; slug: string; author: string }> = []
  const review: Array<{ item: [string, string, string]; slug: string; author: string }> = []
  const missing: Array<[string, string, string]> = []

  for (const item of LIST) {
    const [title, author] = item
    const authKey = norm(author.split(/\s+/).slice(-1)[0]) // last name token
    const authHit = all.find((b) => {
      if (!titlesMatch(b.title, title)) return false
      const authors = (b.book_authors ?? []).map((ba) => ba.authors?.display_name ?? '').join(' ')
      return norm(authors).includes(authKey)
    })
    const titleHit = all.find((b) => titlesMatch(b.title, title))
    const fmt = (b: typeof authHit) => ({
      item,
      slug: b!.slug,
      author: (b!.book_authors ?? []).map((ba) => ba.authors?.display_name ?? '').join(', '),
    })
    if (authHit) confirmed.push(fmt(authHit))
    else if (titleHit) review.push(fmt(titleHit))
    else missing.push(item)
  }

  // Manual overrides where author-confirm missed a genuine match (title/diacritic variants).
  const OVERRIDE: Record<string, string> = {
    'Nineteen Eighty-Four': '1984',
    'Gender Queer': 'gender-queer',
    'The Bastard of Istanbul': 'the-bastard-of-istanbul',
    'The Vegetarian': 'the-vegetarian',
  }
  const slugByTitle = new Map<string, string>()
  for (const m of confirmed) slugByTitle.set(m.item[0], m.slug)
  for (const [t, s] of Object.entries(OVERRIDE)) {
    const b = all.find((x) => x.slug === s)
    if (b) slugByTitle.set(t, s)
  }
  // Emit final module data: one row per title with slug|null.
  const rows = LIST.map(([title, author, theme]) => ({
    theme, title, author, slug: slugByTitle.get(title) ?? null,
  }))
  const have = rows.filter((r) => r.slug).length
  console.log(`FINAL: ${have}/${LIST.length} link to a catalog page.\n`)
  const fs = require('fs') as typeof import('fs')
  fs.writeFileSync('data/manifesto-library-mapping.json', JSON.stringify(rows, null, 2))
  console.log('Wrote data/manifesto-library-mapping.json')
  void review; void missing
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
