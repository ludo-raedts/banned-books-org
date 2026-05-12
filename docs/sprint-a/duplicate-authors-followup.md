# Duplicate-author follow-up (Sprint A taak 1.5 spillover)

When the bulk NFD slug-repair migration
(`supabase/migrations/20260512065936_bulk_nfd_slug_fix.sql`) was first run
against the remote database, the `authors_slug_key` UNIQUE index aborted
the transaction. Pre-flight collision check
(`scripts/check-nfd-collisions.ts`) found that four target slugs were
already held by sibling rows representing the same author. Those four
UPDATEs — and their corresponding redirects in
`src/lib/redirects/nfd-bulk.ts` — were intentionally excluded from the
applied migration.

This document is the parking spot for the editorial follow-up.

## The four duplicate pairs

Below — current state of all eight rows on production, with the number of
`book_authors` links each row owns. The "fix" candidate is the row that
currently holds the NFD-bug slug; the "blocker" is the sibling that
already holds the correct slug.

| pair | id   | display_name             | slug                       | books |
| ---- | ---- | ------------------------ | -------------------------- | ----- |
| 1    | 398  | Benjamin Alire Sáenz     | `benjamin-alire-s-enz`     | 2     |
| 1    | 431  | Benjamin Alire Sáenz     | `benjamin-alire-saenz`     | 0     |
| 2    | 80   | Gabriel García Márquez   | `gabriel-garcia-marquez`   | 2     |
| 2    | 1487 | Gabriel García Márquez   | `gabriel-garc-a-m-rquez`   | 1     |
| 3    | 517  | José Saramago            | `jose-saramago`            | 1     |
| 3    | 3249 | José Saramago            | `jos-saramago`             | 1     |
| 4    | 3284 | Sylvia Aguilar Zeleny    | `sylvia-aguilar-zeleny`    | 5     |
| 4    | 3528 | Sylvia Aguilar Zéleny    | `sylvia-aguilar-z-leny`    | 1     |

Query that produced this (against production via the admin client):

```sql
SELECT a.id, a.display_name, a.slug,
       COUNT(ba.book_id) AS book_count
  FROM authors a
  LEFT JOIN book_authors ba ON ba.author_id = a.id
 WHERE a.id IN (398, 431, 1487, 80, 3249, 517, 3528, 3284)
 GROUP BY a.id, a.display_name, a.slug
 ORDER BY a.id;
```

## Per-pair merge strategy

**Pair 1 — Benjamin Alire Sáenz (398 ↔ 431)** · canonical: **398**
- 431 holds the canonical slug `benjamin-alire-saenz` but owns 0 books.
- 398 holds the buggy slug `benjamin-alire-s-enz` and owns 2 books.
- `display_name` identical between rows — no decision needed there.
- Shape: delete the empty 431, then re-run the NFD slug fix on 398 (it
  will then collide-free take the vacated `benjamin-alire-saenz`).

**Pair 2 — Gabriel García Márquez (80 ↔ 1487)** · canonical: **80**
- 80 owns 2 books, 1487 owns 1. `display_name` identical.
- Shape: re-point the one `book_authors` row from author_id=1487 onto
  author_id=80, then delete 1487. The canonical slug stays on 80.

**Pair 3 — José Saramago (517 ↔ 3249)** · canonical: **517**
- 517 owns 1 book, 3249 owns 1. `display_name` identical. 517 already
  holds the canonical slug `jose-saramago`.
- Shape: re-point the single `book_authors` row from 3249 onto 517,
  then delete 3249.

**Pair 4 — Sylvia Aguilar Zéleny / Zeleny (3284 ↔ 3528)** · canonical row: **3284**, canonical `display_name`: **3528's**
- 3284 owns 5 books and already holds the correct slug
  `sylvia-aguilar-zeleny`, BUT its `display_name` is the diacritic-
  stripped "Sylvia Aguilar Zeleny" — almost certainly an artefact of an
  import path that fed `display_name` from the same NFD-stripped source
  that produced the buggy slugs. 3528 owns 1 book and carries the
  diacritic-correct "Sylvia Aguilar Zéleny".
- Three-step merge:
  1. `UPDATE book_authors SET author_id = 3284 WHERE author_id = 3528;`
     (re-points the one link)
  2. `UPDATE authors SET display_name = 'Sylvia Aguilar Zéleny' WHERE id = 3284;`
     (adopts the diacritic-correct form from the deleted row)
  3. `DELETE FROM authors WHERE id = 3528;`
- After this merge the bulk-NFD-fix does NOT need to re-run for this
  row: 3284 keeps its already-correct slug `sylvia-aguilar-zeleny`. The
  fix is purely on `display_name`.

## What this migration leaves behind

The 8 rows above remain in the DB unchanged. The 4 buggy-slug URLs
(`/authors/benjamin-alire-s-enz`, `/authors/gabriel-garc-a-m-rquez`,
`/authors/jos-saramago`, `/authors/sylvia-aguilar-z-leny`) keep resolving
to their respective author pages. No redirects are installed for them
(see `nfd-bulk.ts` header note for the reasoning).

When the merge is done in a follow-up sprint, that work should:

1. Re-point `book_authors.author_id` from the source row to the target
   row, per the canonical-row choices above.
2. `DELETE FROM authors WHERE id IN (...)` for the four sources
   (Pair 1: 431, Pair 2: 1487, Pair 3: 3249, Pair 4: 3528).
3. Re-run the bulk-NFD slug fix for the survivors that still carry a
   buggy slug — Pairs 1 only (398 → `benjamin-alire-saenz`). Pairs 2, 3
   keep their already-canonical slugs on the survivors. Pair 4 needs no
   slug change but does need the `display_name` update described above.
4. Add the three redirects this migration omitted whose surviving row
   gets a new slug (Pair 1 only). Pairs 2 and 3 already serve the
   canonical slug on the survivor, so no redirect is gained. Pair 4
   needs no redirect.
