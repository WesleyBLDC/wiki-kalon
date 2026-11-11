# Wiki.js Kalon: maintainer guide

Wiki.js Kalon is an unofficial fork of [requarks/wiki](https://github.com/requarks/wiki) (Wiki.js 3, AGPL-3.0).
It aims for a calmer, cleaner, Notion-like reading and navigation experience by customizing only the Vue 3 and Tailwind 4 frontend.
This file is the maintainer guide.
The public front page is `.github/README.md`; upstream's root `README.md` stays untouched.

## Branches, tags and versions

- Image: `ghcr.io/wesleybldc/wikijs-kalon`.
- Git and image tags: `<upstream version>-kalon.<n>`, for example `3.3.0-kalon.1`.
- The app reports its version as `<upstream>+kalon.<n>` (semver build metadata), so update checks behave like stock.
- One branch per upstream release: `kalon/<upstream version>`, for example `kalon/3.3.0`. The newest is the default branch.
- Never use `latest` tags. Pin an exact tag.
- Old `kalon/*` branches and `*-kalon.*` tags are protected (no force push, no delete). They stay as rollback points.

Kalon is a drop-in replacement for `ghcr.io/requarks/wiki:<same version>`: same environment variables, volumes and database.
Kalon never changes the database (no migrations), so switching back to the stock image always works.

## Carried commits

Every commit on a kalon branch that is not upstream's is listed here.
Update this table in the same commit that adds, changes or drops a row.

| Commit subject | Purpose | Upstream files touched |
| --- | --- | --- |
| `kalon: fork scaffolding` | Adds `.github/README.md`, `KALON.md`, `.claude/rules/kalon.md` and two workflows (`kalon-image.yml`, `kalon-upstream-watch.yml`). | None |
| `kalon: theme` | Inter (vendored under `frontend/public/_assets/fonts/inter/`, SIL OFL) and Notion style light and dark tokens in `frontend/src/kalon/css/theme.css`; a flat light sidebar and header, flat page chrome and content ink in `frontend/src/kalon/css/_overrides.scss`. | `frontend/src/main.js` (imports the two sheets) |
| `kalon: typography` | A 40px bold page title, a quieter content heading ramp (30, 24, 20px) with no rules under headings, and small sidebar section labels, all in `_overrides.scss`. Body text stays upstream's 16px / 1.6. | None |
| `kalon: page tree sidebar` | `frontend/src/kalon/components/PageTree.vue` and `kalon/composables/pageTree.js`: the site's pages as a lazily loaded tree under the curated menu, from `GET sites/:siteId/tree/browse` like the Browse menu. Opens to the current page, remembers open folders per site and locale in `localStorage`, "+" to start a page in a folder (shown when `userStore.canWriteOnSite`), WAI-ARIA tree keys. Hidden when Allow Browsing is off. Kalon's strings live in `frontend/src/kalon/i18n.js`, a local i18n scope that falls back to upstream's. | `frontend/src/components/NavSidebar.vue` (renders and imports `PageTree`) |
| `kalon: sidebar header and footer` | On a wide screen (1200px and up, with a full sidebar) the site header folds into the sidebar: `kalon/components/SidebarHeader.vue` (logo, title and upstream's `HeaderSearch`, its results floating beside the sidebar) and `SidebarFooter.vue` (account, New, Library, Inbox, Admin, with `HeaderNav`'s gates). `kalon/composables/siteHome.js` copies `HeaderNav`'s home link logic; compare the two on each replay. With the tree present the Browse button is hidden and the locale button moves above the footer (CSS). Elsewhere the header is restyled to 48px. | `frontend/src/layouts/MainLayout.vue` (`v-if` on the header, renders and imports the two components, `kalonHeaderInSidebar`) |
| `kalon: sidebar resize and collapse` | On a wide screen the sidebar resizes from 208 to 360px (default 264) by dragging its inner edge or with the arrow keys on it (`kalon/components/SidebarResizeHandle.vue`, a WAI-ARIA window splitter), and collapses from a button in the sidebar header, a double-click on the edge, or Ctrl+\ (Cmd+\). Both are remembered in `localStorage` (`kalon/composables/sidebarLayout.js`). Collapsed, the 48px header returns and upstream's corner button reopens the sidebar. The icon rail and the narrow overlay are unchanged. | `frontend/src/layouts/MainLayout.vue` (sidebar width, open state, corner button, scroll-to-top anchor, `openSidebar`, renders the handle) |
| `kalon: page header` | While a page is read, the breadcrumb strip becomes a 44px top bar holding "Edited <date>", watch, the review queue, a ⋯ menu and Edit or Suggest Edits (`kalon/components/PageActions.vue`, conditions and handlers copied from `PageHeader.vue`). The ⋯ menu (`kalon/components/PageMenu.vue`, copied from `PageActionsCol.vue`) lists history, source, print, properties, data, duplicate, move, convert, rerender and delete as labelled rows, so the header's reading actions and the action rail are hidden by CSS while reading; the editor keeps both. Tags and "Last edited by" move under the title (`kalon/components/PageMeta.vue`) and leave the contents column (750px and up; tags are edited from Properties). A flat title block with a 40px icon, and Article, Talk and Links as underlined text tabs. Compare the copied logic on each replay. | `frontend/src/pages/Index.vue` (renders and imports `PageActions` and `PageMeta`) |
| `kalon: content blocks` | Calmer content blocks, CSS only under `.page-contents` in `_overrides.scss`: callouts as a soft tint with a hairline of their colour all round (no side bar), plain quotes with a 2px ink bar, `{.links-list}` as a grid of bordered cards with the description under the title, code blocks on warm grey with no border, smaller rounded inline code, and tables with row hairlines only (no dark head, stripes or shadow). Mostly upstream's `--content-*` tokens, with the dark values under `not print` as upstream does. | None |

## Clean fork rules

These rules keep every upgrade a cheap replay.
They are also in `.claude/rules/kalon.md` for agents.

1. **Additive first.** Our code lives in new files under `frontend/src/kalon/` (`components/`, `composables/`, `css/`). Theme tokens go in `css/theme.css`, selector overrides in `css/_overrides.scss`.
2. **Tiny marked seams.** An unavoidable edit to an upstream file is minimal and carries a comment starting with `kalon:` that explains why. `git grep "kalon:"` lists every touch point.
3. **Never edit upstream files for housekeeping.** Upstream workflows are disabled through the GitHub API, not deleted. Upstream `README.md`, `CLAUDE.md` and `package.json` stay untouched. The version is set at build time, like upstream's CI.
4. **Follow upstream patterns.** Before touching an area, read and obey upstream `CLAUDE.md`, `frontend/CLAUDE.md`, `backend/CLAUDE.md`, `blocks/CLAUDE.md` and the matching `.claude/rules/*.md`. Use the shared W components in `frontend/src/components/shared`, Pinia stores, the existing API client and the existing API endpoints the way upstream components do. No parallel data paths, no new endpoints.
5. **No database changes, no new stored settings.** Add no new npm dependencies unless unavoidable, and pin any exactly.
6. **Tokens before selectors.** Restyle by overriding upstream CSS variables. New variables are named `--kalon-*`, CSS classes `.kalon-*`, i18n keys `kalon.*`.
7. **Every UI change works everywhere.** Phone, tablet and desktop, using upstream breakpoints and the narrow layout mode where the sidebar becomes an overlay below `SIDEBAR_OVERLAY_BELOW` in `frontend/src/layouts/MainLayout.vue`. Touch targets are at least 44px, with no horizontal scroll. Light and dark mode (`body--dark`) both work, and keyboard use and WCAG AA contrast are kept.
8. **Compatible with every editor and content path.** Markdown, Visual, AsciiDoc, Excalidraw, Git sync and MCP edits.
9. **One feature per commit.** The subject is `kalon: <what>`. Fixes made during a release use `git commit --fixup` and are folded in with `--autosquash` on the next replay.
10. **Generic.** Nothing about any particular deployment: no real domains, emails, company or team names, ids, servers or screenshots of real content. Examples use `example.com`.
11. **Upstreamable.** Generic improvements are offered to `requarks/wiki` as small PRs, following its `.github/CONTRIBUTING.md`. Each accepted PR is a commit we stop carrying.

## Theming reference

How the Wiki.js 3 frontend is styled, for Kalon look work (checked against 3.3.0).

- Vue 3 on Vite, Tailwind CSS 4 and the in-repo `W` component library in `frontend/src/components/shared/`; no Vuetify or Quasar.
- Design tokens are CSS variables: the `@theme static` block in `frontend/src/css/tailwind.css` and `frontend/src/css/_theme.scss`. Page content styles are in `_page-contents.scss` (and `_page-contents-asciidoc.scss`), chrome in `_page-chrome.scss`, the visual editor in `_visual-editor.scss`.
- Stock defaults that make it look dated: header `--q-header: #000`, Material blue `--q-primary: #1976d2`, `--font-sans: 'Roboto', ...`, very large thin headings (`--text-h1: 6rem` at weight 300, `--text-h2: 3.75rem` at weight 300).
- Useful tokens: `--q-primary`, `--q-secondary`, `--q-accent`, `--q-header`, `--q-sidebar` (and their `--color-*` mirrors with `-light` and `-lighter` mixes), `--color-dark-1` to `--color-dark-6`, `--color-grey-*`, `--font-sans`, `--font-mono`, `--text-h1` to `--text-h6` with their `--font-weight` and `--line-height`.
- Dark mode is the `body--dark` class (`frontend/src/composables/dark.js`); users already get a site, light or dark choice in the account menu and their profile, so Kalon defines token sets for both modes and adds no toggle logic.
- Admin > Theme still works on top of Kalon: the backend injects a site's CSS override into the served page (`backend/helpers/appShell.ts`), never inside `/_admin`.

How Kalon's own styling is wired (from `kalon: theme`):

- Every colour, radius and font is a `--kalon-*` token in `frontend/src/kalon/css/theme.css`, once for light and once for dark (`body.body--dark` and its `.w-dark-surface` twin).
- `.bg-header` and `.bg-sidebar` (`css/_base.scss`) read `--q-header` and `--q-sidebar`, which `App.vue` writes inline on `<html>`. `theme.css` redeclares both, and their `--color-*` mirrors, on `<body>`, so Admin > Theme's Header and Sidebar colours no longer apply on the reading screen. Primary, secondary and accent still come from Admin > Theme.
- Upstream component styles load in lazy chunks after Kalon's sheets, so a tie on specificity goes to upstream. Every rule in `_overrides.scss` is prefixed with `:root` to outrank the rule it overrides by one class; where upstream keys off `body--light` or `body--dark`, the override names `body` too, which also beats a scoped rule's data attribute.
- Content colours are overridden on both `.page-contents` and `.body--dark .page-contents`, because upstream's dark block uses the second.
- The admin area keeps its own colours; only the font changes there.

Community themes: as of November 2026 none targets Wiki.js 3; they are CSS for 2.x (Vuetify) and must be ported, not pasted.
Check one with:

```sh
grep -c -E 'v-navigation-drawer|v-application|theme--(dark|light)|v-toolbar' theme.css   # 2.x selectors
grep -c -E -- '--color-primary|--font-sans|body--dark|--q-primary' theme.css            # 3.x tokens
```

The most useful design reference is `Tom-Stadermann/Wiki-js-shadcn-theme` (shadcn/ui look: zinc greys, 1px borders, rounded cards, Inter, restyled callouts), written for 2.x.

## Release

1. Make sure the carried commits table above is current.
2. Tag the tip of the kalon branch, then push the branch and the tag:

   ```sh
   git tag 3.3.0-kalon.2
   git push origin kalon/3.3.0 3.3.0-kalon.2
   ```

3. The `.github/workflows/kalon-image.yml` workflow runs on the tag.
   It builds the frontend and blocks like upstream, builds `dev/build/Dockerfile`, smoke tests the image, pushes `ghcr.io/wesleybldc/wikijs-kalon:<tag>` and creates a GitHub Release.
4. Fixes during a release are `git commit --fixup <commit>` on the kalon branch, followed by a new tag with the next `<n>`.

## Upgrade to a new upstream release

### Automatic

The weekly `.github/workflows/kalon-upstream-watch.yml` workflow (also runnable by hand) checks for a newer upstream release.
It tries the replay as a dry run and opens one issue per release, saying either that the replay is clean or which files conflict.
It pushes nothing: the replay rewrites our workflow files, which `GITHUB_TOKEN` may not push, so a maintainer does the replay locally as below.

### Manual replay

A clone needs the upstream remote once (pushing to it is disabled on purpose):

```sh
git remote add upstream https://github.com/requarks/wiki.git
git remote set-url --push upstream no_push
```

Then replay onto the new release:

```sh
git fetch upstream --tags
git switch -c kalon/3.4.0 kalon/3.3.0
GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash --onto 3.4.0 3.3.0
# resolve conflicts, build, test
git push origin kalon/3.4.0
git tag 3.4.0-kalon.1 && git push origin 3.4.0-kalon.1
```

After the replay:

1. Resolve conflicts one commit at a time. Because of rules 1 and 2, they should be rare and small.
2. Re-read the upstream `CLAUDE.md` files and `.claude/rules/*.md` for areas we touch, since upstream conventions may have changed.
3. Run `git grep "kalon:"` and confirm every seam still makes sense.
4. Drop any commit that upstream now provides.
5. Make the new branch the default branch once its release is out.

## Local development

Use the upstream dev container, described at https://docs.js.wiki/dev.

- Backend: `npm run dev` in `backend/`.
- Frontend: `npm run dev` in `frontend/`, served on port 3001.
- Both workspaces need Node 26. Without the dev container, a Postgres 17+ in Docker on a local port and a `config.yml` (copied from `config.sample.yml`, gitignored) pointing at it is enough; run `npm run build` in `frontend/` once before the first backend start, since the backend serves `assets/`.
- To try a change against a clean wiki, use the upstream throwaway instance skill in `.claude/skills/throwaway-instance`.

Check every UI change on phone, tablet and desktop widths, in light and dark mode, before committing.

## Rollback

- To go back to a previous Kalon release, set the image to that exact earlier tag, for example `ghcr.io/wesleybldc/wikijs-kalon:3.3.0-kalon.1`. Old tags are protected and stay available.
- To leave Kalon entirely, set the image to `ghcr.io/requarks/wiki:<same upstream version>`. Kalon never changes the database, so no restore is needed.
- Keep a backup before any upstream version upgrade, as with stock Wiki.js. A newer upstream version may migrate the database in ways older images cannot read.
