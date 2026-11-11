---
paths:
  - "frontend/**"
  - "backend/**"
  - "blocks/**"
  - "KALON.md"
  - ".github/README.md"
  - ".github/workflows/kalon-*.yml"
---

# Kalon fork rules

This repository is Wiki.js Kalon, an unofficial fork of `requarks/wiki`.
It customizes only the frontend and replays onto each new upstream release, so every edit must keep that replay cheap.
`KALON.md` is the maintainer guide.

- **Additive first.** Put our code in new files under `frontend/src/kalon/` (`components/`, `composables/`, `css/`). Theme tokens go in `css/theme.css`, selector overrides in `css/_overrides.scss`.
- **Tiny marked seams.** When an upstream file must change, make the smallest edit and add a comment starting with `kalon:` that says why. `git grep "kalon:"` must list every touch point.
- **No housekeeping edits to upstream files.** Leave upstream workflows (disabled through the GitHub API, not deleted), `README.md`, `CLAUDE.md` and `package.json` untouched. The version is set at build time like upstream's CI.
- **Follow upstream patterns.** Before touching an area, read and obey `CLAUDE.md`, `frontend/CLAUDE.md`, `backend/CLAUDE.md`, `blocks/CLAUDE.md` and the matching `.claude/rules/*.md`. Use the shared W components in `frontend/src/components/shared`, Pinia stores, the existing API client and the existing endpoints as upstream components do. Add no parallel data paths and no endpoints.
- **No database changes and no new stored settings.** Add no npm dependencies unless unavoidable, and pin any exactly.
- **Tokens before selectors.** Restyle by overriding upstream CSS variables. Name new variables `--kalon-*`, classes `.kalon-*` and i18n keys `kalon.*`.
- **Overrides win on specificity, not order.** Upstream component styles load in lazy chunks after ours, so prefix every rule in `_overrides.scss` with `:root` (and name `body` where upstream keys off `body--light` or `body--dark`). See the Theming reference in `KALON.md`.
- **New text strings.** The only locale file is upstream's `backend/locales/en.json`, which cannot carry a `kalon:` marker. Reuse existing keys where they fit; otherwise keep Kalon's strings in `frontend/src/kalon/` and merge them after the locale loads.
- **Work on every screen.** Phone, tablet and desktop, with upstream breakpoints and the narrow layout mode (the sidebar becomes an overlay below `SIDEBAR_OVERLAY_BELOW` in `frontend/src/layouts/MainLayout.vue`). Touch targets are at least 44px and nothing scrolls horizontally. Check light and dark mode (`body--dark`), keyboard use and WCAG AA contrast.
- **Work with every editor and content path.** Markdown, Visual, AsciiDoc, Excalidraw, Git sync and MCP edits.
- **Checks run themselves.** `.claude/settings.json` formats (Kalon files only) and lints each frontend file after an agent edits it, and hands lint errors back; the git pre-commit hook (`.claude/hooks/kalon-pre-commit.sh`, install per `KALON.md`) runs oxlint, oxfmt, the icon check and the build. Fix what they report; never skip them with `--no-verify`. Format an upstream file only on the lines you changed.
- **One feature per commit**, with the subject `kalon: <what>`. Fix an earlier Kalon commit with `git commit --fixup` so the next replay folds it in with `--autosquash`.
- **Stay generic.** Write nothing about a particular deployment: no real domains, emails, company or team names, ids, servers or screenshots of real content. Use `example.com` in examples.
- **Offer generic improvements upstream** as small PRs per `.github/CONTRIBUTING.md`. An accepted PR is a commit we stop carrying.
- **Update the carried commits table in `KALON.md` in the same commit** that adds, changes or drops a Kalon commit.
- **In workflows and scripts, pass `--repo` to every `gh` command.** In a fork, `gh` defaults to the parent repository (`requarks/wiki`), so a bare `gh release create` or `gh issue create` targets upstream and fails.
