#!/usr/bin/env bash
# Wiki.js Kalon: the full frontend check before a commit, run as the clone's git pre-commit hook.
#
#   ln -sf ../../.claude/hooks/kalon-pre-commit.sh .git/hooks/pre-commit
#
# Runs only when the commit touches `frontend/`: oxlint over the frontend, oxfmt on the staged Kalon
# files, the icon bundle check, and a production build. The build needs Node 26 on PATH, as the
# frontend does. Per-file formatting and lint already ran as each file was edited
# (`.claude/hooks/kalon-check-file.sh`).

set -eu

root=$(git rev-parse --show-toplevel)
staged=$(git diff --cached --name-only --diff-filter=ACMR)

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

kalon_files=$(printf '%s\n' "$staged" | grep -E '^frontend/src/kalon/.*\.(vue|js|mjs|scss|css)$' | sed 's#^frontend/##' || true)
if [ -n "$kalon_files" ]; then
  echo "kalon pre-commit: oxfmt"
  # shellcheck disable=SC2086
  "$bin/oxfmt" --check $kalon_files
fi

echo "kalon pre-commit: icon bundle"
npm run --silent icons:check

echo "kalon pre-commit: build"
log=$(mktemp)
trap 'rm -f "$log"' EXIT
# -> The build's warnings are upstream's own; shown only when the build fails
if ! npm run --silent build >"$log" 2>&1; then
  cat "$log" >&2
  exit 1
fi
echo "kalon pre-commit: passed"
