# Author photo audit — OpenLibrary OLID identity claims

Generated 2026-09-07T11:20:04.782Z by `scripts/_audit_author_photo_olid.ts` (read-only).

Every `authors.photo_url` of the form `covers.openlibrary.org/a/olid/<OLID>` claims to be the photo of OL author `<OLID>`. This report re-checks that claim against `/authors/<OLID>.json` (`name` / `personal_name` / `alternate_names`) with a normalised surname-token match. Nothing was written to the database.

- probed: **475**
- SURNAME_MISMATCH: **1**
- UNVERIFIABLE: **1**
- OK: **473**
- flagged (everything but OK): **2**
- of which photo OLID ≠ row's own `openlibrary_author_id`: **1**

> Do NOT null in bulk. Photo writes need a per-row visual/name check first, and `barbara-dee` (#3446) + `michelle-levy` (#1515) are permission-managed photos that must never be overwritten (both are self-hosted, so neither appears below).

## How these get in

`tryOpenLibrary()` in `src/lib/enrich/author-photos.ts` queries `/search/authors.json?q=<our name>` and accepts the first of up to 3 docs that has `work_count >= 1` and a HEAD-able photo — **it never compares `doc.name` to ours**. So any author whose name merely *retrieves* a photo-bearing OL record inherits that record's face: "Troy Andrews" pulled Lauran Paine, whose `alternate_names` include "Troy Howard (pseud.)". Nulling a row here is therefore only half a fix — the default enricher gate (`photo_url IS NULL AND photo_v2_checked_at IS NULL`) will skip it, but `--recheck` would re-pin the same wrong photo until that branch gets a name gate (`matchNames()` in this script is the check it lacks).

## SURNAME_MISMATCH (1)

Some tokens overlap (usually the given name) but the surnames disagree — likely a namesake. Check by eye before nulling.

### #12547 Troy Andrews — `troy-andrews`

- our name: **Troy Andrews**
- OL name (OL19793A): **Lauran Paine**
- OL variants: `Lauran Paine`, `Amber Dana`, `Angela Gordon`, `Angela Morgan`, `Antoinette Duchesne`, `Arlene Morgan`, `Arthur St. George`, `Audrey Davis`, `Badger Clark`, `Barbara Thorn`, `Beth Gorman`, `Betty Fleck`, `Bruce Martin`, `Buck Lyon`, `Buck Standish`, `Buck Thompson`, `Claude Cassidy`, `Clay Allen`, `Clifford Lewis`, `Clint Custer`, `Clint O'Connor`, `Concho Bradley`, `Donn Glendenning`, `Durham, John`, `Earl Titan`, `Elizabeth Howard`, `Francis Hart`, `Frank Bosworth`, `Frank Morgan`, `Harry Beck`, `Helen Holt`, `Helen Sharp`, `Henry Rawle`, `Hunter Liggett`, `J.F. Drexler`, `J.K. Lucas`, `Jack Ketchum`, `James Glenn`, `Jared Ingersol`, `Jay Hayden`, `Jim Slaughter`, `John Armour`, `John Durham`, `John Hunt`, `John Kilgore`, `John Morgan`, `John R. Holt`, `Joni Frost`, `Kathleen Bartlett`, `Kenneth Bedford`, `Lauran Paine Jr`, `Lauren Paine`, `Lawrence Kerfman Duby, Jr.`, `Margaret Stuart`, `Margot Fisher`, `Mark Carrel(l)`, `Nevada Carter`, `P.F. Undine`, `Ray Ainsbury`, `Ray Ainsworth`, `Ray Kelley`, `Reg Batchelor`, `Richard Clarke`, `Richard Dana`, `Robert Clarke`, `Rosa Almonte`, `Roy Ainsbury`, `Roy Ainsworth`, `Ruth Bovee`, `Timothy Hayes`, `Tom Martin`, `Troy Howard (pseud.)`, `Valerie Morgan`, `Will Benton`, `Will Bradford`, `Will Brennan`, `Will Houston`, `Wil Bradford`, `Will A. Brennan`, `Ruth Bovée`, `Will BRADFORD`
- shared tokens: troy
- photo: https://covers.openlibrary.org/a/olid/OL19793A-L.jpg?default=false
- our `openlibrary_author_id`: OL7537549A ⚠ **conflicts with the photo OLID**
- `photo_v2_checked_at`: 2026-06-10T14:33:12.565+00:00
- OL record: https://openlibrary.org/authors/OL19793A

## UNVERIFIABLE (1)

No comparable tokens — an all-initials name, or every OL variant is in a different script than ours. Review by eye; the matcher deliberately refuses to judge these.

### #16901 F. M. T. C — `f-m-t-c`

- our name: **F. M. T. C**
- OL name (OL120259A): **Maurice Bowra**
- OL variants: `Maurice Bowra`, `C. M. Bowra`, `Cecil Maurice Bowra`, `C. Maurice Bowra`, `Cecil Bowra`, `Cecil M. Bowra`, `Cecil Maurice, Sir Bowra`, `Cedil M. Bowra`, `Et.al Sir Bowra Maurice`, `Sir C.Maurice Bowra`, `Sir Cecil Maurice Bowra`, `Sir Maurice Cecil Bowra`, `and C. M. Bowra (Editors)`, `and C. M. Bowra (Editors) Anthology. Higham T. F.`, `c bowra`, `c. m. bowra`, `c.m. bowra`, `maurice bowra`
- photo: https://covers.openlibrary.org/a/olid/OL120259A-L.jpg?default=false
- our `openlibrary_author_id`: —
- `photo_v2_checked_at`: 2026-06-30T08:50:24.499+00:00
- OL record: https://openlibrary.org/authors/OL120259A

