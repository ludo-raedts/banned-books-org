# Hand research brief — a sourced censorship history for books that the automatic pipeline could not source

For each of your books (data/top100-check/hand/books.json has title, author, year and the ban rows we hold), find
1–3 concrete, DATED censorship events about the BOOK itself (not a film, anime, stage or comic adaptation) in sources
you actually fetch and read in full (Bash: curl -sL -A "Mozilla/5.0" URL, then strip HTML with python3 to plain text;
Wikipedia: https://en.wikipedia.org/w/index.php?title=<Title>&action=raw; other-language Wikipedias, news archives,
court judgments, government gazettes, university/library exhibits, ALA/NCAC/PEN/Index/Article 19/Freedom to Read pages,
Papers Past, Trove, Gallica, etc.). Wikipedia articles that cite a source are acceptable; say what they cite.

A mechanical verifier will publish your entry ONLY IF each quote occurs LITERALLY on the page (whitespace, case and
quote marks are normalised), every 3–4 digit number in your text occurs in the quotes, and every capitalised name in your
text occurs in the quotes (or is the book title/author). So:
 - copy each quote EXACTLY from the plain text you fetched (60–400 characters, one passage, no ellipses, no edits);
 - write `text` = 1–3 plain English sentences that restate only what the quotes say (actor/place + measure + date);
   do not add outside knowledge, do not add dates or names that are not in the quotes; no adjectives of judgement;
 - state the measure accurately (ban, removal, challenge, prosecution, restricted classification, listing on an Index);
 - if sources disagree (e.g. 1955 vs 1956), either pick the better-sourced event or include both quotes and say so;
 - events must not contradict our ban rows in books.json; if a source shows one of our rows is wrong, add it to `row_issues`.
If no usable dated event exists after real effort, return that book with `entry: null` and the reason; never invent.

Output: a JSON array in your findings file, one object per book:
{ "slug", "entry": { "slug", "text", "sources": [ {"url","title","quote"} ], "note": "optional" } | null, "no_entry_reason", "row_issues": [ {"country","issue","source_url"} ], "opened_urls": [] }
Do not touch the database or any other file. Reply with: n entries, n null.
