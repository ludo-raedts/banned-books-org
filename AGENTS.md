<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Reading large data files

Files under `data/` can be multiple MB (e.g. `data/film/film-data.json`, `data/pen-america-*.json`). Do not read them in full. Use `jq`, `grep`, `wc`, or `Read` with `offset`/`limit` to pull only the slice you need. Reserve a full read for files you have confirmed are small.
