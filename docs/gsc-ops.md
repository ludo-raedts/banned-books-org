# Google Search Console operations

Local-only tooling for pulling Search Console performance data — not deployed.

## Setup (one-time)

- OAuth client: `~/.gcp/banned-books-gsc-oauth.json` (Desktop app, GCP project `banned-books-496007`)
- Refresh token: `~/.gcp/banned-books-gsc-token.json` (chmod 600, created on first run)
- GSC API enabled on the project
- Owner account: raedts.net Workspace (banned-books.org is verified there)

If the refresh token is rejected ("Login Required" after auth), delete
`~/.gcp/banned-books-gsc-token.json` and rerun — the script will reopen
the browser for re-auth.

## Scripts

| Script | Use |
| ------ | --- |
| `scripts/gsc-query.ts` | Top queries + top pages over a window (default 28 days). Output: `data/gsc/queries-YYYY-MM-DD.json`, `pages-YYYY-MM-DD.json`. |
| `scripts/gsc-diagnose.ts` | Daily breakdown — sitewide or filtered. Use to spot drops, spikes, or news-driven traffic. |

### gsc-diagnose flags

```
--days=N             Window length (default 60)
--query=substring    Filter to queries containing substring (e.g. --query=deenie)
--page=substring     Filter to pages containing substring (e.g. --page=/books/deenie)
--site=URL           Override site (default sc-domain:banned-books.org)
```

Note: GSC API lags actual data by ~2-3 days. The most recent days in the
output are usually incomplete — don't compare them against historical
fully-settled days when judging "is traffic dropping?" Always re-check
2-3 days later before alarming.

## Things to watch

- **CTR collapse on news spikes** — high impressions with <1% CTR at
  position <10 means title/description doesn't answer the query the
  spike is driven by. Fix the meta tags ASAP; spikes recur.
- **www vs non-www split** — banned-books.org and www.banned-books.org
  index separately in GSC. Verify they remain canonicalised to one host
  (currently `www.`).
- **Position drift** — sudden position drop on a high-volume query is
  a stronger ban signal than a clicks drop (clicks can drop for many
  innocent reasons).

## Output directory

`data/gsc/` — gitignored. Re-runnable from the API on demand. If you
want to version trends, commit specific files explicitly.
