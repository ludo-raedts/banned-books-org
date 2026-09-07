# Author photo audit — OpenLibrary OLID identity claims

Generated 2026-09-07T12:09:52.011Z by `scripts/_audit_author_photo_olid.ts` (read-only).

Every `authors.photo_url` of the form `covers.openlibrary.org/a/olid/<OLID>` claims to be the photo of OL author `<OLID>`. This report re-checks that claim against `/authors/<OLID>.json` (`name` / `personal_name` / `alternate_names`) with a normalised surname-token match. Nothing was written to the database.

- probed: **473**
- NO_NAME_OVERLAP: **9**
- SURNAME_MISMATCH: **1**
- OK: **463**
- flagged (everything but OK): **10**
- of which photo OLID ≠ row's own `openlibrary_author_id`: **4**

> Do NOT null in bulk. Photo writes need a per-row visual/name check first, and `barbara-dee` (#3446) + `michelle-levy` (#1515) are permission-managed photos that must never be overwritten (both are self-hosted, so neither appears below).

## How these get in

`tryOpenLibrary()` in `src/lib/enrich/author-photos.ts` used to query `/search/authors.json?q=<our name>` and accept the first of up to 3 docs that had `work_count >= 1` and a HEAD-able photo — **without ever comparing `doc.name` to ours**. So any author whose name merely *retrieved* a photo-bearing OL record inherited that record's face: "Troy Andrews" pulled Lauran Paine, whose `alternate_names` include "Troy Howard (pseud.)". That branch is now gated on `namesAgree()` from `src/lib/enrich/author-name-match.ts` — the same matcher this audit uses — so a candidate must positively agree on the surname before its photo is even HEAD-checked. The Wikidata and site branches are gated differently (human + writer-occupation, and JSON-LD `Person.image` respectively) and are NOT covered by this audit.

## NO_NAME_OVERLAP (9)

Zero shared name tokens with any OL variant — the Alex London/Mark Twain class. Treat as contamination: the photo belongs to a different person.

### #12090 Christopher M. Davidson — `christopher-m-davidson`

- our name: **Christopher M. Davidson**
- OL name (OL28127A): **Edgar Allan Poe**
- OL variants: `Edgar Allan Poe`, `Poe, Edgar Allan`, `Edgar Alan Poe`, `Edgar A. Poe`, `Poe,Edgar Allan ポー,エドガー・アラン (1809-1849)`, `Edgar Poe`, `/Edgar Allan Poe/Alihassanifard`, `Poe Edgar Allan`, `Poe E.A.`, `Edgar Allan 1809-1849 Poe`, `Edgar Allan Poe,Edgar Allan Poe`, `Edgar ALLAN POE`, `Poe, Edgar Allan, 1809-1849`, `EDGAR ALLAN POE`, `POE EDGAR ALLAN`, `Edgar allan Poe`, `Edgar Allan POE`, `Edgar Allan, Poe,`, `Poe Edgar Ala`, `POE Edgar Allan`, `E. Poe`, `POE-E`, `E. A Poe`, `E. A. Poe`, `E.A.: Poe`, `(mei) Po`, `Edgar POE`, `Po`, `Edgar Allan Edgar Allan Poe`, `Mr Edgar Allan Poe`, `M. Edgar Allan Poe`, `Edgar Allen Poe`, `edgar allan poe`, `Poe Edgar-Allan`, `Edgar Allan Poe Poe`, `Edgar Allan EDGAR ALLAN POE`, `Edgar-Allan Poe`, `Edgar Allan. : Poe`, `Эдгар Аллан По`, `Эдгар По`, `Э. По`, `Edgar Allan Poe Allan Poe`, `POE,EDGAR ALLAN`, `Poe, Edgar Allan,`, `Allan Poe Edgar`, `poe-edgar-allan`, `Poe,Edgar Allan`, `POE Edgar Allan -`, `ALLAN POE,EDGAR`, `Poe (Edgar Allan).`, `Poe. Edgar Allan`, `edgar poe`, `Édgar Poe`, `Edgar Poe Restrepo`, `Eager Allan Poe`, `Edagar Allan Poe`, `Edgar Alan Poe Staff`, `Edagr Allan Poe`, `Edgard Allan Poe`, `E.A. Poe`, `Poe, Edgar Allan; Alterton, Margaret (ed.)`, `E A Poe`, `Edgar A. POE`, `Edgard Poe`, `Edger Allan Poe`, `Poe, Edgar Allan ---- Van Doren Stern, Philip, editor`, `Edgar Allewn Poe`, `Edgar Allan Poe and Edwin Markham`, `Edgar Allan Poe, Edward Davidson, E. H. Davidson (Editor)`, `Edgar Allan; Edgar Allan Poe (Author); Groff Conklin (Edited with an Introduction by) Poe`, `Poe, Edgar Allan Carlson, Eric W.,`, `Poe, Edgar Allan and Sharp, William (Photogravures)`, `Edgar Allan et al POE`, `Edgar Allan Poe Marjorie P. Katz Pablo Marcos Studios`, `Edgar Allan Poe (The Franklin Library)`, `Edgrar Allan Poe`, `Edgar Allan. With Commentary By Mary Newton Stanard Poe`, `Edgar Allan`, `edgar allan [adapted by marjorie katz] poe`, `POE, EDGAR ALLAN with an introduction by GRAHAM, KENNETH`, `POE, EDGAR ALLAN`, `edgar allan poe/ laura benet`, `Poe, Edgar Allan Ostrom, John Ward,`, `Poe Edgar`, `Poe, Edgar Allan Macdonald, Dwight,`, `Poe, Edgar Allan Eichenberg, Fritz,`, `Edgar Allan Poe, Csaba Hunyadi, Katalin Sóvágó`, `Poe, Edgar Allan, Illustrated by Cover Art`, `Poe, Edgar Allan, ,Markham, Edwin,`, `Poe, Edgar Allan, Illustrated By Norman Nodel`, `Edgar Allen Poe (Edited By J. Montgomery Gambrill)`, `Edgar Allan Poe traduction de Charles Baudelaire`, `Poe, Edgar Allan Stovall, Floyd,`, `Poe, Edgar Allan;Allen, Hervey, special biographical introduction`, `Edgar Allan Poe Edgar Allan Poe`, `Poe, Edgar Allan ; Quinn, Arthur Hobson (Introduction) ; O'Neill, Edward (Notes)`, `Illus Edgar Allan Poe/Arthur Rackham`, `Edgar Allan . . . [et al Poe`, `Edgar Allan (adapt. Sara Torrico) Poe`, `EDGAR ALLA POE`, `Poe Edgar Allan Stevenson Robert Louis Grabiski Stefan`, `Edgar Allan Poe et. al.`, `Edgar Allan Poe Edebé (obra colectiva)`, `Edgar Allen Poe Herbert Spencer`, `Edgar Allan; Vincent Starrett (intro) Poe`, `Edgdar Allan Poe`, `POE, Edgar Allan (Subject);HOFFMAN, Daniel (Author)`, `POE, Edgar Allan`, `Poe, Edgar Allen; Davidson, E. H. (editor)`, `Poe, Edgar Allen`, `poe, edgar allan & sohn, david`, `poe, edgar allan`, `Egar Allan Poe`, `edgar allan edgar allan poe`, `Edga Allan Poe`, `POE, Edgar Allan and VERNE, Jules`, `E. Allen Poe`, `Edgar Allan Poe, Poe, Edgar`, `Edger Poe`, `Poe, Edgar Allan, Richardson, Charles Francis`, `Poe, Edgar Allan, Kay, Christopher, Cowan, Ted, Swallow, Bill`, `Edgar Allan Poe, Luigi Pirandello, Katherine Mansfiled`, `Poe, Edgar Allan; Allen, Hervey`, `Poe, Edgar Allan \ Lindsay, Philip`, `Edgar Edgar Allan Poe`, `Edgarz Edgar Allan Poe`, `edgar allen poe`, `Edgar Allan Poe; Introduction By Neil Gaiman`, `Edgar Allan Poe,Arthur E. Becher`, `Edgar Allan (Subject) POE`
- photo: https://covers.openlibrary.org/a/olid/OL28127A-L.jpg?default=false
- our `openlibrary_author_id`: OL3109988A ⚠ **conflicts with the photo OLID**
- `photo_v2_checked_at`: 2026-05-31T17:47:03.777+00:00
- OL record: https://openlibrary.org/authors/OL28127A

### #14213 H. W. Katz — `h-w-katz`

- our name: **H. W. Katz**
- OL name (OL28127A): **Edgar Allan Poe**
- OL variants: `Edgar Allan Poe`, `Poe, Edgar Allan`, `Edgar Alan Poe`, `Edgar A. Poe`, `Poe,Edgar Allan ポー,エドガー・アラン (1809-1849)`, `Edgar Poe`, `/Edgar Allan Poe/Alihassanifard`, `Poe Edgar Allan`, `Poe E.A.`, `Edgar Allan 1809-1849 Poe`, `Edgar Allan Poe,Edgar Allan Poe`, `Edgar ALLAN POE`, `Poe, Edgar Allan, 1809-1849`, `EDGAR ALLAN POE`, `POE EDGAR ALLAN`, `Edgar allan Poe`, `Edgar Allan POE`, `Edgar Allan, Poe,`, `Poe Edgar Ala`, `POE Edgar Allan`, `E. Poe`, `POE-E`, `E. A Poe`, `E. A. Poe`, `E.A.: Poe`, `(mei) Po`, `Edgar POE`, `Po`, `Edgar Allan Edgar Allan Poe`, `Mr Edgar Allan Poe`, `M. Edgar Allan Poe`, `Edgar Allen Poe`, `edgar allan poe`, `Poe Edgar-Allan`, `Edgar Allan Poe Poe`, `Edgar Allan EDGAR ALLAN POE`, `Edgar-Allan Poe`, `Edgar Allan. : Poe`, `Эдгар Аллан По`, `Эдгар По`, `Э. По`, `Edgar Allan Poe Allan Poe`, `POE,EDGAR ALLAN`, `Poe, Edgar Allan,`, `Allan Poe Edgar`, `poe-edgar-allan`, `Poe,Edgar Allan`, `POE Edgar Allan -`, `ALLAN POE,EDGAR`, `Poe (Edgar Allan).`, `Poe. Edgar Allan`, `edgar poe`, `Édgar Poe`, `Edgar Poe Restrepo`, `Eager Allan Poe`, `Edagar Allan Poe`, `Edgar Alan Poe Staff`, `Edagr Allan Poe`, `Edgard Allan Poe`, `E.A. Poe`, `Poe, Edgar Allan; Alterton, Margaret (ed.)`, `E A Poe`, `Edgar A. POE`, `Edgard Poe`, `Edger Allan Poe`, `Poe, Edgar Allan ---- Van Doren Stern, Philip, editor`, `Edgar Allewn Poe`, `Edgar Allan Poe and Edwin Markham`, `Edgar Allan Poe, Edward Davidson, E. H. Davidson (Editor)`, `Edgar Allan; Edgar Allan Poe (Author); Groff Conklin (Edited with an Introduction by) Poe`, `Poe, Edgar Allan Carlson, Eric W.,`, `Poe, Edgar Allan and Sharp, William (Photogravures)`, `Edgar Allan et al POE`, `Edgar Allan Poe Marjorie P. Katz Pablo Marcos Studios`, `Edgar Allan Poe (The Franklin Library)`, `Edgrar Allan Poe`, `Edgar Allan. With Commentary By Mary Newton Stanard Poe`, `Edgar Allan`, `edgar allan [adapted by marjorie katz] poe`, `POE, EDGAR ALLAN with an introduction by GRAHAM, KENNETH`, `POE, EDGAR ALLAN`, `edgar allan poe/ laura benet`, `Poe, Edgar Allan Ostrom, John Ward,`, `Poe Edgar`, `Poe, Edgar Allan Macdonald, Dwight,`, `Poe, Edgar Allan Eichenberg, Fritz,`, `Edgar Allan Poe, Csaba Hunyadi, Katalin Sóvágó`, `Poe, Edgar Allan, Illustrated by Cover Art`, `Poe, Edgar Allan, ,Markham, Edwin,`, `Poe, Edgar Allan, Illustrated By Norman Nodel`, `Edgar Allen Poe (Edited By J. Montgomery Gambrill)`, `Edgar Allan Poe traduction de Charles Baudelaire`, `Poe, Edgar Allan Stovall, Floyd,`, `Poe, Edgar Allan;Allen, Hervey, special biographical introduction`, `Edgar Allan Poe Edgar Allan Poe`, `Poe, Edgar Allan ; Quinn, Arthur Hobson (Introduction) ; O'Neill, Edward (Notes)`, `Illus Edgar Allan Poe/Arthur Rackham`, `Edgar Allan . . . [et al Poe`, `Edgar Allan (adapt. Sara Torrico) Poe`, `EDGAR ALLA POE`, `Poe Edgar Allan Stevenson Robert Louis Grabiski Stefan`, `Edgar Allan Poe et. al.`, `Edgar Allan Poe Edebé (obra colectiva)`, `Edgar Allen Poe Herbert Spencer`, `Edgar Allan; Vincent Starrett (intro) Poe`, `Edgdar Allan Poe`, `POE, Edgar Allan (Subject);HOFFMAN, Daniel (Author)`, `POE, Edgar Allan`, `Poe, Edgar Allen; Davidson, E. H. (editor)`, `Poe, Edgar Allen`, `poe, edgar allan & sohn, david`, `poe, edgar allan`, `Egar Allan Poe`, `edgar allan edgar allan poe`, `Edga Allan Poe`, `POE, Edgar Allan and VERNE, Jules`, `E. Allen Poe`, `Edgar Allan Poe, Poe, Edgar`, `Edger Poe`, `Poe, Edgar Allan, Richardson, Charles Francis`, `Poe, Edgar Allan, Kay, Christopher, Cowan, Ted, Swallow, Bill`, `Edgar Allan Poe, Luigi Pirandello, Katherine Mansfiled`, `Poe, Edgar Allan; Allen, Hervey`, `Poe, Edgar Allan \ Lindsay, Philip`, `Edgar Edgar Allan Poe`, `Edgarz Edgar Allan Poe`, `edgar allen poe`, `Edgar Allan Poe; Introduction By Neil Gaiman`, `Edgar Allan Poe,Arthur E. Becher`, `Edgar Allan (Subject) POE`
- photo: https://covers.openlibrary.org/a/olid/OL28127A-L.jpg?default=false
- our `openlibrary_author_id`: OL7832698A ⚠ **conflicts with the photo OLID**
- `photo_v2_checked_at`: 2026-06-30T09:13:18.374+00:00
- OL record: https://openlibrary.org/authors/OL28127A

### #12287 Nu Nu Yi — `nu-nu-yi`

- our name: **Nu Nu Yi**
- OL name (OL493904A): **Emmanuel Levinas**
- OL variants: `Emmanuel Levinas`, `Levinas Emmanuel`, `Emmanuel Lévinas`, `Emmanuel Lévinas`, `(法)伊曼努尔·列维纳斯`, `(Fa)Yi Man Nu Er·Lie Wei Na Si`
- photo: https://covers.openlibrary.org/a/olid/OL493904A-L.jpg?default=false
- our `openlibrary_author_id`: OL6590854A ⚠ **conflicts with the photo OLID**
- `photo_v2_checked_at`: 2026-06-01T14:23:07.763+00:00
- OL record: https://openlibrary.org/authors/OL493904A

### #8179 Ai Si — `ai-si`

- our name: **Ai Si**
- OL name (OL4324514A): **Martin Esslin**
- OL variants: `Martin Esslin`, `Esslin, Martin`, `Martin ESSLIN`, `Ai si lin (Esslin, Martin, 1918- )`, `Martin. Esslin`
- photo: https://covers.openlibrary.org/a/olid/OL4324514A-L.jpg?default=false
- our `openlibrary_author_id`: —
- `photo_v2_checked_at`: 2026-05-27T09:30:14.525+00:00
- OL record: https://openlibrary.org/authors/OL4324514A

### #13166 Chris Tebbetts — `chris-tebbetts`

- our name: **Chris Tebbetts**
- OL name (OL22258A): **James Patterson**
- OL variants: `James Patterson`, `Patterson, James`, `James Brendan Patterson`, `James B. Patterson`, `James Paterson; Chris Tebbetts`, `James Paterson with Maxine Paetro`, `james paterson `, `James patterson`, `Patterson, James, Grabenstein, Chris`
- photo: https://covers.openlibrary.org/a/olid/OL22258A-L.jpg?default=false
- our `openlibrary_author_id`: —
- `photo_v2_checked_at`: 2026-06-10T13:50:56.983+00:00
- OL record: https://openlibrary.org/authors/OL22258A

### #16046 Margaret Csaba — `margaret-csaba`

- our name: **Margaret Csaba**
- OL name (OL28127A): **Edgar Allan Poe**
- OL variants: `Edgar Allan Poe`, `Poe, Edgar Allan`, `Edgar Alan Poe`, `Edgar A. Poe`, `Poe,Edgar Allan ポー,エドガー・アラン (1809-1849)`, `Edgar Poe`, `/Edgar Allan Poe/Alihassanifard`, `Poe Edgar Allan`, `Poe E.A.`, `Edgar Allan 1809-1849 Poe`, `Edgar Allan Poe,Edgar Allan Poe`, `Edgar ALLAN POE`, `Poe, Edgar Allan, 1809-1849`, `EDGAR ALLAN POE`, `POE EDGAR ALLAN`, `Edgar allan Poe`, `Edgar Allan POE`, `Edgar Allan, Poe,`, `Poe Edgar Ala`, `POE Edgar Allan`, `E. Poe`, `POE-E`, `E. A Poe`, `E. A. Poe`, `E.A.: Poe`, `(mei) Po`, `Edgar POE`, `Po`, `Edgar Allan Edgar Allan Poe`, `Mr Edgar Allan Poe`, `M. Edgar Allan Poe`, `Edgar Allen Poe`, `edgar allan poe`, `Poe Edgar-Allan`, `Edgar Allan Poe Poe`, `Edgar Allan EDGAR ALLAN POE`, `Edgar-Allan Poe`, `Edgar Allan. : Poe`, `Эдгар Аллан По`, `Эдгар По`, `Э. По`, `Edgar Allan Poe Allan Poe`, `POE,EDGAR ALLAN`, `Poe, Edgar Allan,`, `Allan Poe Edgar`, `poe-edgar-allan`, `Poe,Edgar Allan`, `POE Edgar Allan -`, `ALLAN POE,EDGAR`, `Poe (Edgar Allan).`, `Poe. Edgar Allan`, `edgar poe`, `Édgar Poe`, `Edgar Poe Restrepo`, `Eager Allan Poe`, `Edagar Allan Poe`, `Edgar Alan Poe Staff`, `Edagr Allan Poe`, `Edgard Allan Poe`, `E.A. Poe`, `Poe, Edgar Allan; Alterton, Margaret (ed.)`, `E A Poe`, `Edgar A. POE`, `Edgard Poe`, `Edger Allan Poe`, `Poe, Edgar Allan ---- Van Doren Stern, Philip, editor`, `Edgar Allewn Poe`, `Edgar Allan Poe and Edwin Markham`, `Edgar Allan Poe, Edward Davidson, E. H. Davidson (Editor)`, `Edgar Allan; Edgar Allan Poe (Author); Groff Conklin (Edited with an Introduction by) Poe`, `Poe, Edgar Allan Carlson, Eric W.,`, `Poe, Edgar Allan and Sharp, William (Photogravures)`, `Edgar Allan et al POE`, `Edgar Allan Poe Marjorie P. Katz Pablo Marcos Studios`, `Edgar Allan Poe (The Franklin Library)`, `Edgrar Allan Poe`, `Edgar Allan. With Commentary By Mary Newton Stanard Poe`, `Edgar Allan`, `edgar allan [adapted by marjorie katz] poe`, `POE, EDGAR ALLAN with an introduction by GRAHAM, KENNETH`, `POE, EDGAR ALLAN`, `edgar allan poe/ laura benet`, `Poe, Edgar Allan Ostrom, John Ward,`, `Poe Edgar`, `Poe, Edgar Allan Macdonald, Dwight,`, `Poe, Edgar Allan Eichenberg, Fritz,`, `Edgar Allan Poe, Csaba Hunyadi, Katalin Sóvágó`, `Poe, Edgar Allan, Illustrated by Cover Art`, `Poe, Edgar Allan, ,Markham, Edwin,`, `Poe, Edgar Allan, Illustrated By Norman Nodel`, `Edgar Allen Poe (Edited By J. Montgomery Gambrill)`, `Edgar Allan Poe traduction de Charles Baudelaire`, `Poe, Edgar Allan Stovall, Floyd,`, `Poe, Edgar Allan;Allen, Hervey, special biographical introduction`, `Edgar Allan Poe Edgar Allan Poe`, `Poe, Edgar Allan ; Quinn, Arthur Hobson (Introduction) ; O'Neill, Edward (Notes)`, `Illus Edgar Allan Poe/Arthur Rackham`, `Edgar Allan . . . [et al Poe`, `Edgar Allan (adapt. Sara Torrico) Poe`, `EDGAR ALLA POE`, `Poe Edgar Allan Stevenson Robert Louis Grabiski Stefan`, `Edgar Allan Poe et. al.`, `Edgar Allan Poe Edebé (obra colectiva)`, `Edgar Allen Poe Herbert Spencer`, `Edgar Allan; Vincent Starrett (intro) Poe`, `Edgdar Allan Poe`, `POE, Edgar Allan (Subject);HOFFMAN, Daniel (Author)`, `POE, Edgar Allan`, `Poe, Edgar Allen; Davidson, E. H. (editor)`, `Poe, Edgar Allen`, `poe, edgar allan & sohn, david`, `poe, edgar allan`, `Egar Allan Poe`, `edgar allan edgar allan poe`, `Edga Allan Poe`, `POE, Edgar Allan and VERNE, Jules`, `E. Allen Poe`, `Edgar Allan Poe, Poe, Edgar`, `Edger Poe`, `Poe, Edgar Allan, Richardson, Charles Francis`, `Poe, Edgar Allan, Kay, Christopher, Cowan, Ted, Swallow, Bill`, `Edgar Allan Poe, Luigi Pirandello, Katherine Mansfiled`, `Poe, Edgar Allan; Allen, Hervey`, `Poe, Edgar Allan \ Lindsay, Philip`, `Edgar Edgar Allan Poe`, `Edgarz Edgar Allan Poe`, `edgar allen poe`, `Edgar Allan Poe; Introduction By Neil Gaiman`, `Edgar Allan Poe,Arthur E. Becher`, `Edgar Allan (Subject) POE`
- photo: https://covers.openlibrary.org/a/olid/OL28127A-L.jpg?default=false
- our `openlibrary_author_id`: —
- `photo_v2_checked_at`: 2026-06-30T10:13:37.695+00:00
- OL record: https://openlibrary.org/authors/OL28127A

### #2389 Michael Cadnum — `michael-cadnum`

- our name: **Michael Cadnum**
- OL name (OL772148A): **Elizabeth Wein**
- OL variants: `Elizabeth Wein`, `WEIN ELIZABETH`, `Alexander, Lloyd, Farmer, Nancy, Pierce, Meredith Ann, Wein, Elizabeth, Cadnum, Michael, Dalkey, Kara, Springer, Nancy, Bull, Emma, McKillip, Patricia`, `Elizabeth E. Wein`
- photo: https://covers.openlibrary.org/a/olid/OL772148A-L.jpg?default=false
- our `openlibrary_author_id`: —
- `photo_v2_checked_at`: —
- OL record: https://openlibrary.org/authors/OL772148A

### #951 Nancy Farmer — `nancy-farmer`

- our name: **Nancy Farmer**
- OL name (OL772148A): **Elizabeth Wein**
- OL variants: `Elizabeth Wein`, `WEIN ELIZABETH`, `Alexander, Lloyd, Farmer, Nancy, Pierce, Meredith Ann, Wein, Elizabeth, Cadnum, Michael, Dalkey, Kara, Springer, Nancy, Bull, Emma, McKillip, Patricia`, `Elizabeth E. Wein`
- photo: https://covers.openlibrary.org/a/olid/OL772148A-L.jpg?default=false
- our `openlibrary_author_id`: —
- `photo_v2_checked_at`: —
- OL record: https://openlibrary.org/authors/OL772148A

### #11465 Otto Strasser — `otto-strasser`

- our name: **Otto Strasser**
- OL name (OL19024A): **Upton Sinclair**
- OL variants: `Upton Sinclair`, `Upton, Sinclair`, `Upton Beall Sinclair`, `Upton SINCLAIR`, `Sinclair`, `Upton`, `Upton sinclair`, `UPTON SINCLAIR`, `Upton Becall Sinclair`, `Upton Beale Sinclair`, `U. Sinclair`, `Upton Sinclair, Eugene Brieux`, `Sinclair, Upton`, `Upto Sinclair`, `Mr Upton Sinclair`, `Upton Upton Sinclair`, `Sinclair Upton 1878-1968`, `Sinclair Upton Sinclair`, `upton sinclair`, `Upton 1878-1968 Sinclair`, `Upton Sinclair (Author); Robert B. Downs (Afterword)`, `Upton Sinclair Marc Spirial`, `SINCLAIR,Upton`, `Sinclair Upton`, `Upton Sinclair Translated by O. A. Joutsen`, `Sinclair, Upton, 1878-1968.`, `Upton Sinclair, Otto Strasser, K. A. Arvid Enlind`, `Sinclair, Upton, 1878-1968`
- photo: https://covers.openlibrary.org/a/olid/OL19024A-L.jpg?default=false
- our `openlibrary_author_id`: —
- `photo_v2_checked_at`: 2026-05-30T18:11:03.574+00:00
- OL record: https://openlibrary.org/authors/OL19024A

## SURNAME_MISMATCH (1)

Some tokens overlap (usually the given name) but the surnames disagree — likely a namesake. Check by eye before nulling.

### #1385 Kevin Brooks — `kevin-brooks`

- our name: **Kevin Brooks**
- OL name (OL257278A): **Kevin B. Eastman**
- OL variants: `Kevin B. Eastman`, `Kevin Eastman; Kevin Brooks Eastman`
- shared tokens: kevin
- photo: https://covers.openlibrary.org/a/olid/OL257278A-L.jpg?default=false
- our `openlibrary_author_id`: OL1427200A ⚠ **conflicts with the photo OLID**
- `photo_v2_checked_at`: —
- OL record: https://openlibrary.org/authors/OL257278A

