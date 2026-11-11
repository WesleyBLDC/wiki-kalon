/**
 * The editors that write an article, in the order the site offers them (`siteStore.activeEditors`):
 * what a page created straight from its address can be opened in. Blog, feedback board and redirection
 * make a different kind of page, chosen on purpose from the New menu, so they are not picked for it.
 */
const ARTICLE_EDITORS = ['markdown', 'visual', 'asciidoc', 'excalidraw']

/**
 * The first article editor the site has turned on, or null when it has none. Upstream's missing page
 * screen creates in Markdown only, so a site that writes in Visual alone had no way to start a page
 * from a link to one.
 */
export function firstArticleEditor(activeEditors) {
  return activeEditors.find((editor) => ARTICLE_EDITORS.includes(editor)) ?? null
}
