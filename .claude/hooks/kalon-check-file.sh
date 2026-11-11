#!/usr/bin/env bash
# Wiki.js Kalon: format and lint one file right after an agent edits it.
#
# A Claude Code PostToolUse hook (see `.claude/settings.json`), fed the tool call as JSON on stdin.
# For a frontend source file of this repository:
#   - a Kalon file (`frontend/src/kalon/`) is formatted in place with oxfmt;
#   - an upstream file is only checked, since reformatting it wholesale would bloat the seam;
#   - every file is linted with oxlint, and a lint error is handed back to the agent (exit 2).
# Anything else (other repositories, backend, docs) passes through untouched. The full check (build,
# icon bundle) runs at commit time: `.claude/hooks/kalon-pre-commit.sh`.

set -u

input=$(cat)
file=$(printf '%s' "$input" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d))
  process.stdin.on("end", () => {
    try {
      const j = JSON.parse(s)
      process.stdout.write(j.tool_input?.file_path ?? j.tool_input?.path ?? "")
    } catch {}
  })
' 2>/dev/null)

[ -n "$file" ] && [ -f "$file" ] || exit 0

root=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -f "$root/KALON.md" ] || exit 0

rel=${file#"$root"/}
case "$rel" in
  frontend/src/*.vue | frontend/src/*.js | frontend/src/*.mjs | frontend/src/*.scss | frontend/src/*.css) ;;
  *) exit 0 ;;
esac

bin="$root/frontend/node_modules/.bin"
[ -x "$bin/oxlint" ] && [ -x "$bin/oxfmt" ] || exit 0

cd "$root/frontend" || exit 0
target=${rel#frontend/}
notes=""

case "$rel" in
  frontend/src/kalon/*)
    "$bin/oxfmt" --write "$target" >/dev/null 2>&1 || notes="oxfmt could not format $rel."
    ;;
  *)
    if ! "$bin/oxfmt" --check "$target" >/dev/null 2>&1; then
      notes="oxfmt would reformat $rel (an upstream file). Format only the lines you changed, never the whole file."
    fi
    ;;
esac

case "$rel" in
  *.vue | *.js | *.mjs)
    if ! lint=$("$bin/oxlint" "$target" 2>&1); then
      printf 'oxlint found errors in %s:\n%s\n' "$rel" "$lint" >&2
      [ -n "$notes" ] && printf '%s\n' "$notes" >&2
      exit 2
    fi
    ;;
esac

if [ -n "$notes" ]; then
  node -e 'process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: process.argv[1] } }))' "$notes"
fi
exit 0
