#!/usr/bin/env bash
# Wiki.js Kalon: the checks before a commit, run as the clone's git pre-commit hook.
#
#   ln -sf ../../.claude/hooks/kalon-pre-commit.sh .git/hooks/pre-commit
#
# On every commit: the name lint (`dev/kalon/check-names.sh`: no spelled out repository names in the
# workflows, no retired names). Then, only when the commit touches `frontend/`: oxlint over the
# frontend, oxfmt on the staged Kalon files, the icon bundle check, and a production build into a
# scratch folder. Lint and build read the working tree, so stage whole files. The build needs Node 26
# on PATH, as the frontend does. Per-file formatting and lint already ran as each file was edited
# (`.claude/hooks/kalon-check-file.sh`).

set -eu

root=$(git rev-parse --show-toplevel)
staged=$(git diff --cached --name-only --diff-filter=ACMR)

"$root/dev/kalon/check-names.sh"

printf '%s\n' "$staged" | grep -q '^frontend/' || exit 0

major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$major" -lt 26 ]; then
  echo "kalon pre-commit: the frontend build needs Node 26 or newer on PATH (found $(node -v 2>/dev/null || echo none))." >&2
  exit 1
fi

cd "$root/frontend"
bin=./node_modules/.bin

echo "kalon pre-commit: oxlint"
"$bin/oxlint" --quiet

# -> The staged copy of each file, not the working tree's, so a partly staged file is judged by what
#    the commit will hold
kalon_files=$(printf '%s\n' "$staged" | grep -E '^frontend/src/kalon/.*\.(vue|js|mjs|scss|css)$' | sed 's#^frontend/##' || true)
if [ -n "$kalon_files" ]; then
  echo "kalon pre-commit: oxfmt"
  unformatted=''
  for f in $kalon_files; do
    if ! git show ":frontend/$f" | "$bin/oxfmt" --stdin-filepath="$f" | cmp -s - <(git show ":frontend/$f"); then
      unformatted="$unformatted $f"
    fi
  done
  if [ -n "$unformatted" ]; then
    echo "kalon pre-commit: not formatted (run oxfmt on them and stage again):$unformatted" >&2
    exit 1
  fi
fi

echo "kalon pre-commit: icon bundle"
npm run --silent icons:check

echo "kalon pre-commit: build"
log=$(mktemp)
out=$(mktemp -d)
trap 'rm -rf "$log" "$out"' EXIT
# -> Into a scratch folder rather than `../assets`, so a check never swaps the files a running local
#    backend is serving. The build's warnings are upstream's own; shown only when the build fails
if ! npm run --silent build -- --outDir "$out" >"$log" 2>&1; then
  cat "$log" >&2
  exit 1
fi
echo "kalon pre-commit: passed"
