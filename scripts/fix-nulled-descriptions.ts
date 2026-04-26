/**
 * Write proper descriptions for the 7 books whose wrong/scraped descriptions
 * were nulled in the data-quality audit fix.
 */
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

const updates: { slug: string; description: string }[] = [
  {
    slug: 'burned-pcc',
    description: "Burned is the seventh novel in P.C. Cast and Kristin Cast's House of Night series, a paranormal fantasy set in a world where vampyres live openly alongside humans. The story follows Zoey Redbird, a teenage vampyre fledgling, whose soul has been shattered by tragedy, scattering her spirit to the Otherworld. Her friends must undertake a dangerous quest to bring her back before darkness claims her forever. Challenged in schools for its sexual content, occult themes, and language.",
  },
  {
    slug: 'untamed-pcc',
    description: "Untamed is the fourth novel in P.C. Cast and Kristin Cast's House of Night series. After a devastating betrayal, Zoey Redbird finds herself alone at the House of Night—her friends have turned against her and her relationships lie in ruins. As an ancient evil grows stronger and dark forces converge on the school, Zoey must rebuild her circle and face a threat that could destroy both the vampyre and human worlds. Challenged in schools for its occult themes, sexual content, and depictions of violence.",
  },
  {
    slug: 'stray-memories',
    description: "Stray Memories is a collection of short stories by Bahraini writer Abdullah Al Busais, exploring themes of memory, identity, and loss in the contemporary Arab world. Through fragmentary and lyrical prose, Al Busais examines the tensions between tradition and modernity, personal longing and collective history. The book was banned in Bahrain, reflecting broader restrictions on literary expression in the Gulf region.",
  },
  {
    slug: 'the-mushroom-picker',
    description: "The Mushroom Picker is a darkly comic novel by Russian-British writer Zinovy Zinik, first published in 1987. The story follows a Soviet émigré in England whose wife abandons him to return to the USSR, driven by an obsessive longing for Russian mushrooms she cannot find abroad. Zinik uses the absurd premise to probe the disorienting experience of exile, the persistence of cultural identity, and the impossibility of truly belonging to two worlds at once. It was banned in the Soviet Union.",
  },
  {
    slug: 'the-sleepless-world',
    description: "The Sleepless World (Die schlaflose Welt) is an early satirical work by Erich Kästner, the German author best known for Emil and the Detectives. Written during the Weimar Republic, it reflects Kästner's sharp critique of bourgeois society, consumerism, and political complacency. Like much of his adult writing, it was condemned by the Nazi regime and consigned to the flames in the book burnings of 1933, which destroyed the majority of Kästner's non-children's work.",
  },
  {
    slug: 'marquis-de-sade-biography',
    description: "The Marquis de Sade is a biography by British historian Donald Thomas, examining the life of Donatien Alphonse François, Marquis de Sade—the eighteenth-century French nobleman whose erotic writings gave rise to the word 'sadism'. Thomas places Sade's scandalous novels and his long imprisonment in historical context, arguing that beneath the transgression lay a serious philosophical challenge to Enlightenment morality and religious authority. The book has been challenged for its frank discussion of Sade's sexual philosophy.",
  },
  {
    slug: 'kissing-kate',
    description: "Kissing Kate is a young adult novel by Lauren Myracle published in 2003. Lissa and Kate have been best friends since childhood, but a drunken kiss between them at a party shatters their relationship, leaving Lissa confused about her feelings and her identity. As she tries to make sense of what happened and what she wants, Lissa befriends a quirky new girl who helps her find the courage to be honest with herself. The novel has been challenged and banned in schools for its positive portrayal of same-sex attraction.",
  },
]

async function main() {
  for (const { slug, description } of updates) {
    const { error } = await supabase
      .from('books')
      .update({ description })
      .eq('slug', slug)

    if (error) {
      console.log(`  ✗ ${slug}: ${error.message}`)
    } else {
      console.log(`  ✓ ${slug}`)
    }
  }
  console.log('\nDone.')
}

main().catch(console.error)
