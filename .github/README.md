# Wiki.js Kalon

A calmer, cleaner, Notion-like reading and navigation experience for Wiki.js 3.

> **Unofficial fork.**
> Wiki.js Kalon is an independent fork of [Wiki.js](https://github.com/requarks/wiki) and is not affiliated with or endorsed by the Wiki.js project.
> Report Wiki.js bugs to [requarks/wiki](https://github.com/requarks/wiki/issues).
> Share feature ideas for Wiki.js at [feedback.js.wiki](https://feedback.js.wiki).
> Open an issue here only for something specific to Kalon.

## What it is

Kalon customizes only the Vue 3 and Tailwind 4 frontend of stock Wiki.js 3.
The backend, the database schema and the API are unchanged.

The name comes from the Greek *to kalon*: beauty that comes from order, symmetry and fitness (Aristotle's *taxis*, *symmetria* and *to horismenon*).

**Status:** release `3.3.0-kalon.1` is stock Wiki.js 3.3.0 plus documentation and CI.
The `kalon/3.3.0` branch carries the frontend redesign for the next release: Inter and calm light and dark tokens, a sidebar holding the site header, search and a lazily loaded page tree, a resizable and collapsible sidebar that peeks on hover, a 44px top bar with the page actions, a Notion-style title block, and quieter content blocks.
`KALON.md` lists every change.

## Use it

Kalon is a drop-in replacement for the stock image of the same upstream version.
It uses the same environment variables, volumes and database.
Kalon never changes the database and ships no migrations, so switching back to `ghcr.io/requarks/wiki` at the same version is always safe.

In your existing compose file, change only the image line:

```yaml
services:
  wiki:
    image: ghcr.io/wesleybldc/wikijs-kalon:3.3.0-kalon.1
    # everything else stays as it was
```

Always pin an exact tag.
There is no `latest` tag.

For installation and configuration, follow the [Wiki.js documentation](https://docs.js.wiki).

## Versioning

Git and image tags are `<upstream version>-kalon.<n>`, for example `3.3.0-kalon.1`.
The running app reports its version as `<upstream>+kalon.<n>`, using semver build metadata, so update checks behave like stock Wiki.js.
Each upstream release has a branch named `kalon/<upstream version>`, and the newest one is the default branch.

## Future extensions

Ideas from the design work that are not built yet:

- **Search with actions.** The search panel could offer commands beside matching pages, such as "New page in <folder>" or "Switch to light theme", like a command palette.
- **Icons on link cards.** Link cards (`{.links-list}`) could show a coloured icon tile beside the title. Wiki.js link lists carry no icon today, so this needs a way to give each card one; the links grid block, which does take icons, is the alternative for now.
- **Peek timing.** The collapsed sidebar floats in after the pointer rests on the window's edge or the expand button for 120ms, and leaves 300ms after the pointer moves away. The delays stop it flashing open when the pointer only passes the edge, and keep it open while the pointer crosses a small gap. They could become tunable if they prove too eager or too slow.

## Documentation

See [KALON.md](../KALON.md) for the maintainer guide: branches and tags, the carried commits table, fork rules, releasing, upgrading to a new upstream release, local development and rollback.

## License

[AGPL-3.0](../LICENSE), the same as Wiki.js.
Wiki.js is created by Nicolas Giard and the Wiki.js contributors, and all credit for it belongs to them.
