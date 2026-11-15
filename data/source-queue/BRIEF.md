# Research brief — per-case source check (read-only research; DO NOT touch the database or any repo file except your findings file)

Context: banned-books.org records bans. 68 ban rows cite only the generic Index on Censorship homepage
(https://www.indexoncensorship.org/) as source. Your job, per assigned row: find out whether a SPECIFIC, citable
public source supports the ban claim, and what the facts are.

For each row answer:
1. Is there a specific source (URL) that records this ban (authority/decision, e.g. court, ministry, censorship board, customs, regime list; or a reliable secondary source: major news, scholarly work, PEN, Index/Article 19 report, Wikipedia only as a last resort and then say which article section and what it cites)?
2. What exactly was decided, by whom, and how (ban on publication / import / sale / library removal / confiscation / author prosecution)?
3. Date: year (and month if given) of the decision; is our year (`year`) right? Say whether the date is the decision, the first reported ban, or the book's publication.
4. Status today: still in force / lifted (when, source) / unknown.
5. Verdict, exactly one of: SUPPORTED (specific source confirms country + book + roughly our year), PARTIAL (book banned in that country but year/status/details differ - give corrected facts), UNSUPPORTED (searched properly, nothing found - this is NOT evidence the ban is false), CONTRADICTED (a reliable source says the claim is wrong - quote the fact in your own words).
Rules: be honest about what you could not reach (paywall, timeout). Never invent URLs: only cite pages you actually opened. Paraphrase; do not copy long quotes (max one short phrase). Prefer primary/official and well-known secondary sources. A missing source never means the claim is false.
Also give, per row, `suggested_note`: one factual English sentence (<=300 chars) that states only what your cited source records, with the date type, or null.

Output: write a JSON array to the findings file named in your task, one object per ban row:
{ban_id, slug, country, our_year, verdict, source_url, source_name, locator (page/section/entry), decision_actor, measure, year_found, date_type, status_now, status_source_url, correction (or null), suggested_note, uncertainty}
Then reply with a 5-line summary (counts per verdict). Queue data: data/source-queue/index-homepage-queue.json (fields ban_id, slug, title, country, year, status).
