#!/bin/sh
# Vercel ignoreCommand: exit 0 = skip the build, exit 1 = build. Any other code
# fails the deployment, so a missing base commit (the last good deploy fell
# outside Vercel's shallow clone, 2026-11-10) must map to 1, not git's 128.
B="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
git cat-file -e "$B^{commit}" 2>/dev/null || exit 1
git diff --quiet "$B" HEAD -- . ':!data' ':!docs' ':!supabase' ':!private' ':!.claude' ':!*.md' ':!scripts' \
  && git diff --quiet "$B" HEAD -- scripts/build-dataset.ts scripts/lib/dataset-io.ts scripts/vercel-ignore.sh
