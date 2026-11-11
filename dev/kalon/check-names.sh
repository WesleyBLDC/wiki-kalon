#!/usr/bin/env bash
# Wiki.js Kalon: lint the names the fork publishes under.
#
#   dev/kalon/check-names.sh
#
# Run by the git pre-commit hook (`.claude/hooks/kalon-pre-commit.sh`) on every commit and by the
# image workflow before it builds. Reads the index (the staged copy), so it judges what a commit holds.
#   1. Kalon workflows name this repository and its image only through `github.repository`
#      (`${{ github.repository }}`, `$GITHUB_REPOSITORY`), never spelled out, so a renamed repository
#      builds and publishes under its new name. Upstream's names (`requarks`) are the only literal
#      owners allowed.
#   2. Retired names stay retired: the repository and its image were called `wikijs-kalon` until
#      2026-11 (now `wiki-kalon`), and nothing should point at the old name.

set -eu

cd "$(git rev-parse --show-toplevel)"
self=dev/kalon/check-names.sh
failed=0

# -> 1. A literal owner after ghcr.io/ or github.com/ that is not upstream's or an expression
literal=$(git grep --cached -n -i -E '(ghcr\.io|github\.com)/[a-z0-9]' -- '.github/workflows/kalon-*.yml' \
  | grep -v -i -E '(ghcr\.io|github\.com)/requarks/' || true)
if [ -n "$literal" ]; then
  echo "kalon names: a Kalon workflow spells out an owner or repository; use \${{ github.repository }} or \$GITHUB_REPOSITORY:" >&2
  printf '%s\n' "$literal" >&2
  failed=1
fi

# -> 2. The pattern is split so this file does not match itself
retired='wikijs''-kalon'
old=$(git grep --cached -n -I -i -F "$retired" -- . ":(exclude)$self" || true)
if [ -n "$old" ]; then
  echo "kalon names: the retired name $retired is still mentioned; use wiki-kalon:" >&2
  printf '%s\n' "$old" >&2
  failed=1
fi

[ "$failed" -eq 0 ] && echo "kalon names: passed"
exit "$failed"
