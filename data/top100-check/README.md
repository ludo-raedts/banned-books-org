# Top-100 source check (2026-11-16)

Scope: the 100 books of /top-100-banned-books (1,742 ban rows). 1,159 rows cite US list indexes (PEN/TX/FL/EveryLibrary etc.) and were not rechecked; 132 cite the Wikipedia 'List of books banned by governments'; for 104 of those the list page does not visibly show country+book by an automatic text match (crude: naming differences, multi-country entries).

Per-row check with opened pages only (agents; Wikipedia article pages count as sources): {'SUPPORTED': 18, 'PARTIAL': 38, 'UNSUPPORTED': 46, 'CONTRADICTED': 2}.

Applied (apply-top100-check-2026-11-16.ts): specific source link added for SUPPORTED/PARTIAL rows (old links kept); notes replaced by what the source records; years changed only where an opened source gave another year; film/other-measure rows + 1984/China marked unverified; 4 implausible rows marked 'Source needed'. Nothing deleted except one duplicate (ban 654 merged into 25495). UNSUPPORTED rows (46) were left untouched — absence from the pages opened is not evidence — and are listed below for a second pass.

Provenance caveat: a first apply run aborted on a unique-key collision after updating part of slices 1-4; the second run overwrote backup-2026-11-16.json, so original values of those rows are in data/top100-check/rows.json (note, year, status) instead; confidence was 'reported' for all. Ban 654's pre-merge row is in backup-ban-654-merge.json.

## UNSUPPORTED rows left as they were

- 1095 lady-chatterleys-lover / Norway 1928: English and Norwegian Wikipedia say nothing of a Norwegian ban (Norwegian translation 1952); absence is not disproof.
- 1100 tropic-of-cancer / Norway 1934: Norwegian URL was the latitude article, not the book; nothing on Norway found.
- 1101 tropic-of-cancer / Denmark 1934: Only the English article checked; absence not disproof.
- 1106 brave-new-world / Canada 1980: The only 1980 entry in Wikipedia is Miller, Missouri (US), possibly the source of a mix-up; only first 100k chars of article read.
- 611 les-miserables / Spain 1939: Spanish article says only that the Church put it on the Index (undated, not Spain-specific); no Franco-era ban found.
- 1139 the-color-purple / South Africa 1984: A search snippet (not opened) suggested the Publications Control Board banned the 1985 FILM; the book ban is unverified.
- 1110 the-god-of-small-things / Lebanon 1997: Nothing on Lebanon found.
- 887 the-red-and-the-black / France 1830: No censorship in France recorded on Wikipedia; only a Brazil 1964 episode.
- 1107 1984 / Romania 1949: Absence from the opened pages is not evidence the ban did not exist; a Waseda paper and Southampton thesis that may cover this were not readable. Year 1949 like
- 1108 1984 / Hungary 1949: Absence from the opened pages is not evidence the ban did not exist; a Waseda paper and Southampton thesis that may cover this were not readable. Year 1949 like
- 1143 1984 / Bulgaria 1949: Absence from the opened pages is not evidence the ban did not exist; a Waseda paper and Southampton thesis that may cover this were not readable. Year 1949 like
- 1144 1984 / Albania 1949: Absence from the opened pages is not evidence the ban did not exist; a Waseda paper and Southampton thesis that may cover this were not readable. Year 1949 like
- 652 aristotle-and-dante-discover-the-secrets-of-the-universe / Russia 2023: Russia may have removed it informally; not found. Possible country mix-up with Belarus.
- 1104 the-diary-of-a-young-girl / Lebanon 1986: Secondary lists claim a Lebanon ban; unopened/unverified.
- 1142 the-diary-of-a-young-girl / Malaysia 2014: A Malay edition exists per a catalogue (search snippet only); no gazette check possible.
- 628 the-protocols-of-the-elders-of-zion / Germany 1945: Wikipedia pages truncated; post-war sections unread. Allied post-1945 lists may well have included it.
- 1141 the-handmaids-tale / Iran 1985: Search snippets (not opened) say translated 2003; some blogs claim a ban without evidence.
- 1098 lolita / Norway 1956: Nothing found in opened pages; only a compiled database snippet (not opened) claims 1956. Not evidence of falsity; Norwegian sources (Nabokov-Norway, Nasjonalbi
- 1099 lolita / Denmark 1956: Wikipedia says only that Danish translation appeared; no ban found. Not evidence of falsity.
- 1809 lolita / South Africa 1955: Opened pages do not mention South Africa; Wikipedia list (opened part) lists only Argentina, Canada, France. Search snippets (not opened) mention SA ban without
- 1212 the-communist-manifesto / New Zealand 1942: Wikipedia list has Nazi Germany row only for this book. No NZ 1942 evidence found; a search suggested NZ wartime restrictions on communist publications but no M
- 1127 the-jewel-of-medina / Saudi Arabia 2008: Wikipedia records only US (Random House cancellation), Serbia (withdrawal), UK (postponement after firebombing). Nothing on Saudi Arabia.
- 1128 the-jewel-of-medina / Qatar 2008: Nothing found on Qatar.
- 1129 the-jewel-of-medina / Malaysia 2008: Nothing found on Malaysia.
- 857 justine-de-sade / France 1791: Wikipedia (Marquis de Sade, first 100k chars) records no ban of 1791 Justine; Sade's later works were seized in 1801. 1791 is the publication year, not a ban ye
- 642 lajja / Iran 1994: Wikipedia mentions Bangladesh ban (NYT 8 Jun 1994) only; nothing on Iran. A database claiming Iran 1994 was not opened.
- 1138 beloved / South Africa 1987: Wikipedia's banning section covers US only (first 100k chars read).
- 620 the-story-of-o / Australia 1960: Possible 1965 date from unopened AustLit snippet; verify via AustLit/NAA.
- 1163 the-story-of-o / Denmark 1967: Only Wikipedia article opened; no Danish source found.
- 1164 the-story-of-o / Norway 1954: Only Wikipedia article opened; no Norwegian source found.
- 827 the-origin-of-species / Yugoslavia 1935: Opened Wikipedia page (first 100k chars) mentions Serbian translation 1878, no ban.
- 1102 the-painted-bird / Czechoslovakia 1965: Absence of evidence only.
- 1103 the-painted-bird / Soviet Union 1965: Absence of evidence only.
- 613 sons-and-lovers / Australia 1930: Only a search snippet of an aggregator (not opened) claims this.
- 614 sons-and-lovers / United States 1930: Nothing found.
- 1208 married-love / New Zealand None: A search snippet says Te Ara reports it was hard to obtain in NZ (not opened).
- 1137 and-tango-makes-three / China 2016: Possible confusion with Hong Kong 2018 (SCMP 2018-06-20, cited by Wikipedia). Not verified at primary source.
- 908 quran / Albania 1967: Context is real (1967 campaign; 1977 law on religious literature) but a Quran-specific 1967 ban was not found; Censorship_of_the_Quran URL gave 404.
- 29817 state-and-revolution / Singapore None: Underlying Singapore prohibition order not opened.
- 1079 the-story-of-zahra / Lebanon 1980: Search snippets only for the wider claim (not counted); encyclopedia.com returned 403.
- 1080 the-story-of-zahra / Saudi Arabia 1980: Search snippets only for the wider claim (not counted); encyclopedia.com returned 403.
- 1081 the-story-of-zahra / Egypt 1982: Search snippets only for the wider claim (not counted); encyclopedia.com returned 403.
- 1105 animal-farm / Libya 1945: Absence in opened pages is not proof of falsity; no Libyan primary source found.
- 1145 animal-farm / Romania 1947: Communist-era Romanian suppression is plausible but nothing opened records it.
- 1146 animal-farm / Bulgaria 1947: Same as Romania.
- 625 one-thousand-and-one-nights / Saudi Arabia 1985: Wikipedia article only read to first 100k chars.
