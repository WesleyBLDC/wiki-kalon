import { reactive } from 'vue'

/**
 * State for the sidebar's page tree: the folder levels fetched so far, the menus that order them, and
 * which folders are open.
 *
 * One level per `GET sites/:siteId/tree/browse` call, exactly as the Browse menu (`NavBrowseMenu.vue`)
 * walks the tree, so the server decides what a reader may see and nothing here filters. Held at module
 * level, so the tree keeps its levels when the layout around it is rebuilt.
 *
 * The server sorts a level by title. Each level is shown in the order of the navigation menu the
 * sidebar shows at that folder instead (what Edit Nav arranges by dragging), and what that menu does
 * not name follows in the server's order. The menu is read through the same public routes the
 * curated sidebar uses, so it holds only what this reader may see.
 *
 * Which folders are open is remembered per site and locale in `localStorage`. That is a convenience
 * for this browser only: storage may be unavailable (a private window, blocked site data), and the
 * tree then simply starts closed.
 */

const STORAGE_PREFIX = 'kalon.tree.open'

/**
 * Where a level is. Its items are kept while it reloads, so a level being fetched again shows what it
 * held instead of a loading note.
 */
export const LEVEL_STATUS = Object.freeze({
  LOADING: 'loading',
  READY: 'ready',
  FAILED: 'failed'
})

const state = reactive({
  /** `<siteId>:<locale>`, what the levels below belong to. */
  scope: '',
  /** The URL prefix of that locale ('' for the primary one), which menu links carry. */
  localePrefix: '',
  /**
   * Levels by folder path ('' is the site root): `{ status, items, truncated, navId }`, with `items`
   * in the server's order and `navId` the menu shown at the folder (null when there is none, or it
   * could not be read).
   */
  levels: {},
  /** The page paths each menu names, in its order, by menu id. */
  menus: {},
  /** Open folders, by path. */
  open: {}
})

/** Menu requests on their way, by menu id, so levels sharing a menu ask for it once. */
const menuRequests = new Map()

/**
 * Bumped whenever the levels are dropped, so a response to a request made before that is discarded
 * instead of writing an old level back.
 */
let generation = 0

function storageKey(scope) {
  return `${STORAGE_PREFIX}:${scope}`
}

function readOpen(scope) {
  try {
    const paths = JSON.parse(window.localStorage.getItem(storageKey(scope)) ?? '[]')
    return Array.isArray(paths) ? Object.fromEntries(paths.map((p) => [String(p), true])) : {}
  } catch {
    return {}
  }
}

function writeOpen() {
  try {
    window.localStorage.setItem(storageKey(state.scope), JSON.stringify(Object.keys(state.open)))
  } catch {
    // -> Storage unavailable: the open folders last for this visit only
  }
}

/**
 * The page path a menu link points at inside this site, or null for anything else (another site, a
 * file, `mailto:`). Links carry the locale prefix of a non-primary locale, and `/` is the home page.
 */
function linkPath(target, localePrefix) {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) {
    return null
  }
  let path = target.split(/[?#]/)[0]
  if (localePrefix && (path === localePrefix || path.startsWith(`${localePrefix}/`))) {
    path = path.slice(localePrefix.length)
  }
  path = path.replace(/^\/+|\/+$/g, '')
  return path || 'home'
}

/**
 * The page paths a menu names, in the order it shows them: each link's own path then its children's,
 * and the page a `menu` item links to (`targetPage`, present only where this reader may open it).
 */
export function menuPathsOf(items, localePrefix) {
  const out = []
  for (const item of items ?? []) {
    const path =
      item.type === 'menu' ? (item.targetPage ?? null) : linkPath(item.target, localePrefix)
    if (path !== null) {
      out.push(path)
    }
    if (item.children?.length) {
      out.push(...menuPathsOf(item.children, localePrefix))
    }
  }
  return out
}

/** A level's items in menu order, then the ones the menu does not name in the order given. */
export function orderByMenu(items, menuPaths) {
  if (!menuPaths?.length) {
    return items
  }
  const rank = new Map()
  menuPaths.forEach((path, i) => {
    if (!rank.has(path)) {
      rank.set(path, i)
    }
  })
  const named = items.filter((item) => rank.has(item.path))
  const rest = items.filter((item) => !rank.has(item.path))
  return [...named.toSorted((a, b) => rank.get(a.path) - rank.get(b.path)), ...rest]
}

/** The folders above a path, outermost first: `a/b/c` gives `a` and `a/b`. */
export function ancestorsOf(path) {
  const parts = path.split('/').filter(Boolean)
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'))
}

export function usePageTree() {
  /** Points the tree at a site and locale, starting over when either changes. */
  function setScope(siteId, locale, localePrefix) {
    const scope = `${siteId}:${locale}`
    if (scope === state.scope) {
      return false
    }
    generation++
    menuRequests.clear()
    state.scope = scope
    state.localePrefix = localePrefix
    state.levels = {}
    state.menus = {}
    state.open = readOpen(scope)
    return true
  }

  /**
   * The id of the menu shown at a folder, reading that menu too unless it is held. Null when the
   * folder shows none or either request fails: the level then keeps the server's order, which is
   * still a usable tree, so a failure here is not worth a notice.
   */
  async function loadMenuAt(siteId, locale, path) {
    try {
      const at = await API_CLIENT.get(`sites/${siteId}/navigation/path`, {
        searchParams: { path, locale }
      }).json()
      const navId = at?.navigationId ?? null
      if (!navId || state.menus[navId]) {
        return navId
      }
      if (!menuRequests.has(navId)) {
        // -> Forgotten once settled: what it read is kept in `state.menus`, and a failure is retried
        menuRequests.set(
          navId,
          API_CLIENT.get(`sites/${siteId}/navigation/${navId}`)
            .json()
            .finally(() => menuRequests.delete(navId))
        )
      }
      const gen = generation
      const items = await menuRequests.get(navId)
      if (gen === generation) {
        state.menus[navId] = menuPathsOf(items, state.localePrefix)
      }
      return navId
    } catch {
      return null
    }
  }

  /**
   * Fetches one level unless it is already held or on its way. Resolves to false when the request
   * failed, so the caller can tell the reader.
   */
  async function load(siteId, locale, path) {
    const held = state.levels[path]
    if (held && held.status !== LEVEL_STATUS.FAILED) {
      return true
    }
    const gen = generation
    state.levels[path] = {
      status: LEVEL_STATUS.LOADING,
      items: held?.items ?? [],
      truncated: false,
      navId: held?.navId ?? null
    }
    // -> Both before the level is shown, so it never appears in one order and then jumps to another
    const menu = loadMenuAt(siteId, locale, path)
    try {
      const data = await API_CLIENT.get(`sites/${siteId}/tree/browse`, {
        searchParams: { path, locale }
      }).json()
      const navId = await menu
      if (gen === generation) {
        state.levels[path] = {
          status: LEVEL_STATUS.READY,
          items: data.items ?? [],
          truncated: Boolean(data.truncated),
          navId
        }
      }
      return true
    } catch {
      if (gen === generation) {
        state.levels[path] = {
          status: LEVEL_STATUS.FAILED,
          items: [],
          truncated: false,
          navId: null
        }
      }
      return false
    }
  }

  /** A level's items in the order they are shown. */
  function itemsOf(level) {
    return orderByMenu(level.items, level.navId ? state.menus[level.navId] : null)
  }

  /**
   * Takes in a menu the curated sidebar has just read, if the tree orders a level by it: an edit in
   * Edit Nav reorders the tree as it reorders the sidebar, with no request of its own.
   */
  function takeMenu(navId, items) {
    if (navId && state.menus[navId]) {
      state.menus[navId] = menuPathsOf(items, state.localePrefix)
    }
  }

  function setOpen(path, isOpen) {
    if (isOpen) {
      state.open[path] = true
    } else {
      delete state.open[path]
    }
    writeOpen()
  }

  /** Drops every level and menu, for a reload after content changed. Open folders stay open. */
  function drop() {
    generation++
    menuRequests.clear()
    state.levels = {}
    state.menus = {}
  }

  return { state, setScope, load, itemsOf, takeMenu, setOpen, drop }
}
