// Corporate / organizational "authors" — real catalogue credits that are NOT
// individual people: film studios, publishers, editorial bodies, imprints.
// They legitimately appear in the `authors` table (corporate authorship is a
// real cataloguing concept), but treating them as a `Person` is wrong on two
// fronts: the schema.org Person JSON-LD misrepresents the entity, and the
// "we couldn't find a bio about <person>" fallback reads as a failed lookup.
//
// Curated by slug rather than a DB column: ~a dozen rows, growing slowly, no
// admin UI or pipeline justified (build-vs-manual doctrine). Their bios are
// already NULL — the data-quality pass nulls them because a company has no
// person-bio — so this registry only changes how the page *frames* them.
//
// To add one: confirm the row is genuinely an organization (not a person whose
// name merely contains "Press"/"Inc"), then paste its exact `slug` here.
export const ORGANIZATION_AUTHOR_SLUGS = new Set<string>([
  'the-walt-disney-company',
  'time-life-books',
  'the-new-york-times-editorial-staff',
  'oxford-university-press',
  'rooster-teeth-productions',
  'ripleys-inc',
  'publications-international-ltd',
  'inc-world-book',
  'editors-of-cider-mill-press',
  'lantern-books-a-division-of-booklight-inc-lantern-books-a-division-of-128-second-place-brooklyn-ny-11231',
  'sam-luen-bookshop',
])

export function isOrganizationAuthor(slug: string): boolean {
  return ORGANIZATION_AUTHOR_SLUGS.has(slug)
}
