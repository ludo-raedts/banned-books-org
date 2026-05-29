# Tier-3 Wikipedia coverage diagnostic

Generated 2026-05-29T06:18:57Z. Probed 3306 of 3306 Tier-3 candidate(s).

For each Latin-script author missing a bio and/or photo, we ran EN Wikipedia opensearch and bucketed by whether the resulting article title shares a 5-char prefix with the longest name token (same gate as the Cyrillic pilot — catches fuzzy matches to wholly different people).

## Buckets

| bucket | authors | linked books (sum) | recommended path |
|---|---:|---:|---|
| `wikipedia-match` | 1368 | 1936 | **Firecrawl pilot can address these directly** — same pipeline as Cyrillic pilot, en.wikipedia.org as source |
| `wikipedia-fuzzy-mismatch` | 908 | 1144 | Skip auto-enrichment; either obscure namesakes or genuine ambiguity. Manual review only. |
| `wikipedia-no-match` | 1030 | 1251 | OpenLibrary, Goodreads, or skip. Not a Firecrawl target. |

### Bucket × missing-field matrix

| | bio-only | photo-only | both |
|---|---:|---:|---:|
| `wikipedia-match` | 191 | 789 | 388 |
| `wikipedia-fuzzy-mismatch` | 116 | 289 | 503 |
| `wikipedia-no-match` | 104 | 217 | 709 |

## Top 50 Firecrawl candidates (`wikipedia-match`, ranked by book_count)

| id | books | author | gap | wiki title |
|---:|---:|---|---|---|
| 8156 | 40 | [Ashaari Muhammad](/authors/ashaari-muhammad) | photo-only | Ashaari Muhammad |
| 7998 | 22 | [Wei Wei](/authors/wei-wei) | both | Wei Wei |
| 1246 | 15 | [Don Nardo](/authors/don-nardo) | photo-only | Don Nardo |
| 3028 | 14 | [Robin Furth](/authors/robin-furth) | photo-only | Robin Furth |
| 1583 | 11 | [Kristin Hannah](/authors/kristin-hannah) | photo-only | Kristin Hannah |
| 388 | 10 | [Alex Sanchez](/authors/alex-sanchez) | bio-only | Alex Sanchez |
| 2229 | 10 | [Time-Life Books](/authors/time-life-books) | bio-only | Time-Life Books |
| 813 | 8 | [Duchess Harris](/authors/duchess-harris) | photo-only | Duchess Harris |
| 4880 | 8 | [Yi Li](/authors/yi-li) | both | Yi Li |
| 4921 | 8 | [Dan Wang](/authors/dan-wang) | photo-only | Dan Wang |
| 7339 | 8 | [Hsia Fei](/authors/hsia-fei) | photo-only | Hsia-Fei Chang |
| 7885 | 8 | [Kassim Ahmad](/authors/kassim-ahmad) | photo-only | Kassim Ahmad |
| 211 | 7 | [Elana K. Arnold](/authors/elana-k-arnold) | photo-only | Elana K. Arnold |
| 225 | 7 | [Mindy McGinnis](/authors/mindy-mcginnis) | photo-only | Mindy McGinnis |
| 946 | 7 | [Carl Deuker](/authors/carl-deuker) | photo-only | Carl Deuker |
| 1248 | 7 | [Takako Shimura](/authors/takako-shimura) | photo-only | Takako Shimura |
| 1453 | 7 | [Pittacus Lore](/authors/pittacus-lore) | both | Pittacus Lore |
| 4605 | 7 | [Han](/authors/han) | bio-only | Han |
| 4976 | 7 | [Chen](/authors/chen) | both | Chen |
| 1267 | 6 | [DK](/authors/dk) | both | DK |
| 2217 | 6 | [Joe Hill](/authors/joe-hill) | bio-only | Joe Hill |
| 4607 | 6 | [Li](/authors/li) | both | Li |
| 7243 | 6 | [Various](/authors/various) | bio-only | Various |
| 9382 | 6 | [Medina, Enrique](/authors/medina-enrique) | both | Henrique Medina |
| 1150 | 5 | [Anna-Marie McLemore](/authors/anna-marie-mclemore) | photo-only | Anna-Marie McLemore |
| 1260 | 5 | [Steve Parker](/authors/steve-parker) | both | Steve Parker |
| 1395 | 5 | [Christopher Pike](/authors/christopher-pike) | bio-only | Christopher Pike |
| 2264 | 5 | [John Scott](/authors/john-scott) | both | John Scott |
| 2282 | 5 | [L. A. Meyer](/authors/l-a-meyer) | photo-only | L. A. Meyer |
| 2641 | 5 | [Chris Lynch](/authors/chris-lynch) | photo-only | Chris Lynch |
| 2737 | 5 | [Tsubasa Yamaguchi](/authors/tsubasa-yamaguchi) | photo-only | Tsubasa Yamaguchi |
| 3247 | 5 | [Tim Bowler](/authors/tim-bowler) | photo-only | Tim Bowler |
| 3692 | 5 | [Tony Allan](/authors/tony-allan) | photo-only | Tony Allan |
| 3728 | 5 | [John Hamilton](/authors/john-hamilton) | bio-only | John Hamilton |
| 5903 | 5 | [Laurie Forest](/authors/laurie-forest) | bio-only | Laurel forest |
| 5947 | 5 | [Craig Glenday](/authors/craig-glenday) | bio-only | Craig Glenday |
| 250 | 4 | [E. R. Frank](/authors/e-r-frank) | photo-only | E. R. Frank |
| 355 | 4 | [Andrew Smith](/authors/andrew-smith) | both | Andrew Smith |
| 383 | 4 | [Megan McCafferty](/authors/megan-mccafferty) | photo-only | Megan McCafferty |
| 773 | 4 | [Dahlia Adler](/authors/dahlia-adler) | photo-only | Dahlia Adler |
| 909 | 4 | [Tash McAdam](/authors/tash-mcadam) | bio-only | Trish McAdam |
| 943 | 4 | [Jodi Lynn Anderson](/authors/jodi-lynn-anderson) | photo-only | Jodi Lynn Anderson |
| 965 | 4 | [Robert Rodi](/authors/robert-rodi) | photo-only | Robert Rodi |
| 1385 | 4 | [Kevin Brooks](/authors/kevin-brooks) | bio-only | Kevin Brooks |
| 1497 | 4 | [Steve Alten](/authors/steve-alten) | photo-only | Steve Alten |
| 1573 | 4 | [Robyn Schneider](/authors/robyn-schneider) | both | Rob Schneider |
| 1575 | 4 | [Alane Ferguson](/authors/alane-ferguson) | photo-only | Alane Ferguson |
| 1734 | 4 | [Susan Beth Pfeffer](/authors/susan-beth-pfeffer) | photo-only | Susan Beth Pfeffer |
| 2070 | 4 | [F.T. Lukens](/authors/f-t-lukens) | bio-only | F. T. Lukens |
| 2226 | 4 | [Deborah Murrell](/authors/deborah-murrell) | bio-only | Deborah Murrell |

## Sample of `wikipedia-fuzzy-mismatch` (first 20 by book_count)

| id | books | author | wiki title (rejected) |
|---:|---:|---|---|
| 5040 | 23 | Zhiying Li | Zhiying Zeng |
| 6433 | 16 | Kanoko Sakurakōji | Kanoko Sakurakoji |
| 7147 | 12 | Sam Moussavi | Sam Mussabini |
| 854 | 7 | Andrea Robertson | André Roberson |
| 1699 | 7 | Lisa Greenwald | Lisa Grunwald |
| 1309 | 6 | Jeremy Quist | Jeremy Sisto |
| 5055 | 6 | Yizheng Lian | Yizheng, Jiangsu |
| 7703 | 6 | F.W.Paul | F. Paul Wilson |
| 7835 | 6 | Sia Fei | Sia discography |
| 4888 | 5 | Yue Ma | Yue Man Square |
| 7265 | 5 | Hon Meng | Hong Kong plastic shopping bag environmental levy scheme |
| 7372 | 5 | Mark B. Mitin | Mark Britnell |
| 1088 | 4 | Keito Gaku | Keito Nakamura |
| 1128 | 4 | Tamra B. Orr | Tara Correa-McMullen |
| 1800 | 4 | Phil Stamper | Phil Stamp |
| 1952 | 4 | Jaime A. Seba | Sebastián Jaime |
| 4600 | 4 | Cheng'en Xu | Xue-Min Cheng |
| 5205 | 4 | Ge Juan | GE Universal Series |
| 8179 | 4 | Ai Si | Ai singles discography |
| 907 | 3 | Sarah Prager | Sarah Parker Remond |
