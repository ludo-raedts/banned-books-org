# Top-100 sourced histories (2026-11-16)

Pipeline: scripts/verify-censorship-context.ts --with-ban-text --from-sources (literal-quote gated). 18 published as source_verified; the top-100 now has 54/100 sourced histories. Report: data/censorship-context-verify-top100-2026-11-16.md

## Source/record conflicts = leads for ban-row review (rows untouched)

- 1984 [record_conflict]: text: The Soviet Union ban lasted until 1988. ↔ records: The first openly available Russian edition appeared in 1988, but the book was legalised by 1990. · text: ban in SU 1988 ↔ rows: 1950
- a-banquet-for-seaweed [record_conflict]: text: The cultural ministry eventually withdrew the book from print in Egypt. ↔ records: The Egypt 2000 ban is marked active, although its row note also says the novel was withdrawn in 2000.
- call-me-by-your-name [record_conflict]: text: Labirint hid the book from sale amid removals of books mentioning the LGBT community, as reported on 2022-12-06. ↔ records: The Russia retail restriction began in 2023, following the November 20
- animal-farm [record_conflict]: text: The Ministry of Education banned Animal Farm from schools in the United Arab Emirates in 2002. ↔ records: The United Arab Emirates row records a public-library ban in 2002.
- for-whom-the-bell-tolls [source_conflict]: The quotes disagree about the 1968 Spanish publication: q1 described the translated edition as censored, while q2 said it appeared without cuts.
- forever-amber [record_conflict]: text: The New Zealand ban used import licence regulations and did not prohibit private imports. ↔ records: The New Zealand row note says the ban was under the Indecent Publications Act.
- lady-chatterleys-lover [record_conflict]: text: challenge in GB 1960 ↔ rows: 1928
- les-miserables [record_conflict]: text: ban in ES 1961 ↔ rows: 1939
- lolita [source_conflict]: The quotes conflict on when France banned Lolita: q1 says 1958, while q7 says 1955. They also conflict on when the ban was finally lifted: q2 says the year after 1958, while q7 says late 1958.
- one-thousand-and-one-nights [record_conflict]: text: In 1985, an injunction removed the book from the market; a higher court reversed it a year later. ↔ records: The Egypt row records a 1985 ban, while its note says attempts to ban the book in 198
- naked-lunch [record_conflict]: text: The petition was filed in the Superior Court on September 17, 1964. ↔ records: The Massachusetts in rem proceeding began in January 1965.
- the-handmaids-tale [record_conflict]: text: Goddard school officials reversed the removal decision and allowed the book to be checked out while reviewing the library-materials vetting policy. ↔ records: The 2021 Goddard Public Schools, Ka
- the-hunchback-of-notre-dame [source_conflict]: The quotes give conflicting end years for the Index listing of Notre Dame de Paris: 1959 and 1966.
- the-satanic-verses [source_conflict]: The quotes date the bans in Bangladesh, Sudan, and South Africa to both 1988 and 1989.
- the-turner-diaries [record_conflict]: text: The Turner Diaries was banned in Germany in April 2006. ↔ records: The Turner Diaries was placed on the BPjM index in Germany in April 2006. · text: ban in CA 1996 ↔ rows: 1980
- this-book-is-gay [record_conflict]: text: The book was returned to Iowa City school libraries. ↔ records: The Iowa City restriction is listed as active.
- tropic-of-capricorn [record_conflict]: text: The US ban lasted until 1964. ↔ records: The US ban lasted until a 1961 Justice Department ruling declared the book not obscene.
- zhuan-falun [record_conflict]: text: The Chinese government banned Zhuan Falun on 24 July 1996. ↔ records: The China ban row says the ban began in 1993. · text: ban in CN 1996 ↔ rows: 1993

## Conflict follow-up (2026-11-16)
11 ban rows fixed from fetched sources (`scripts/apply-conflict-fixes-2026-11-16.ts`, `LEDGER-conflicts.md`, backup `backup-conflict-fixes-2026-11-16.json`; Animal Farm/UAE scope public_library→school, old row in `backup-ban-952-scope.json`). Re-verified: 10 more sourced histories published (1984, Banquet for Seaweed, Forever Amber, Animal Farm, Lady Chatterley, Les Misérables, Naked Lunch, Handmaid's Tale, Turner Diaries, Zhuan Falun). Top-100 sourced histories: 64/100.
Still open (sources disagree with each other, rows untouched): For Whom the Bell Tolls (1968 edition censored or not), Lolita (France 1955/1956, lifting 1958/1959), Hunchback of Notre-Dame (Index end 1959/1966), Satanic Verses (country years 1988/1989), Tropic of Capricorn (US ban end 1961 vs 1964; the 1961 row note is unsourced). Insufficient evidence: Call Me by Your Name, One Thousand and One Nights, This Book Is Gay.

## Round 3 (2026-11-16): 72/100 sourced histories
Rerun with Firecrawl for the 28 books still open: 5 published (For Whom the Bell Tolls, Gender Queer, The Trial, Tintin in the Congo, Tropic of Capricorn). New flag `--seed-from-rows` (verify-censorship-context.ts) lets books with no text at all be checked against their own ban rows: 3 published (All Quiet, Quran, Candy). The Pearl held: the NZ list entry is attributed to "Anonymous" and may be another work than Steinbeck's novel (NZ row 12929 marked unverified; text not published). Rows fixed: Zundel/Canada 885 (1985, status unclear), Color Purple US 1984 row 25 rescinded (board approved the book). Backup: backup-r3-row-fixes.json.
Still without a sourced text (28): sources give no dated event or only the film/anime (Tin Drum, Tokyo Ghoul), or conflict (Lolita, Hunchback, Satanic Verses), or a failed grounding (Beartown, What If It's Us, Handmaid's graphic novel); Das Kapital Portugal (1933 vs 1962) unresolved.

## Hand research (2026-11-16): 93/100 sourced histories
Seven agents researched the last 28 books; `scripts/publish-hand-sourced-history.ts` publishes an entry only if each quote occurs literally on the fetched page and every number/name in the text occurs in the quotes (21 published: 16 + 5 after quote repair). Held back as too thin or not about the book itself: The Tin Drum (prize refusal only), Das Kapital (one Korean line), What If It's Us (no year in the quote). No usable event: Black Skin White Masks, Tokyo Ghoul (anime only), Sons and Lovers, The Pearl. Row follow-ups in hand/LEDGER-row-fixes.md; other row issues are in hand/row_issues.json (e.g. Hunchback Index end 1959 vs 1966 left as is).
