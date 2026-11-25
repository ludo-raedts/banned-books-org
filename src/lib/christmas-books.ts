// Curated registry for /christmas-banned-books.
//
// Hand-picked: every id below is a book in the catalogue that is about
// Christmas (title, plot or setting) AND has at least one documented ban or
// removal row. Nothing is added from a "banned Christmas books" listicle
// without a sourced ban — see the "What we looked for" block on the page.
//
// Picked 2026-11-25 from a title + description search of `books`, then
// reviewed by hand (noise like memoirs that merely mention Christmas dropped).
// Ban counts and covers are read live from the DB; only the grouping and the
// one-line editorial hooks live here.

export type ChristmasGroup = {
  key: string
  title: string
  subtitle: string
  ids: number[]
}

export const CHRISTMAS_GROUPS: ChristmasGroup[] = [
  {
    key: 'story',
    title: 'The Christmas story',
    subtitle: 'Nativity picture books and retellings of the gospel story: the quietest, most traditional shelf in this list.',
    // 18420 (anonymous KJV "Christmas Story", 2023) deliberately left out: its
    // cover is a different book (Dickens' "New Christmas Story"), no ISBN.
    ids: [18418, 18655, 18652, 18592, 18629, 18674, 18066, 17453, 17455, 18414, 18283],
  },
  {
    key: 'picture',
    title: 'Picture books & young readers',
    subtitle: 'Stockings, reindeer, tamales and one very naughty David.',
    ids: [1408, 7957, 17659, 5352, 5487, 18869, 3307, 25917, 26285],
  },
  {
    key: 'teen',
    title: 'Middle grade & teen Christmas',
    subtitle: 'Snowed-in romances, scavenger hunts in a New York bookshop, and a ghost-of-Christmas-past retelling.',
    ids: [7693, 7798, 24706, 17908, 2580, 4867, 26943, 27643, 27663],
  },
  {
    key: 'adult',
    title: 'Classics, mysteries & holiday reads for adults',
    subtitle: 'Dickens, O. Henry, Maya Angelou, a Christmas murder mystery or two.',
    ids: [26726, 25875, 9165, 26250, 26249, 26251, 26914, 24953, 25621, 25579, 9319],
  },
]

export const CHRISTMAS_IDS: number[] = CHRISTMAS_GROUPS.flatMap((g) => g.ids)

/** Six gift picks for the Bookshop.org strip. Only books whose isbn13 is
 *  probe-verified on Bookshop (bookshop_status='valid', checked 2026-11-25) so
 *  every tile is a real deep link, not a storefront fallback. Re-check after
 *  the next probe-bookshop-isbn.ts run. */
export const CHRISTMAS_GIFT_PICKS: number[] = [1408, 7798, 24706, 26943, 25917, 26285]
