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
 * A folder is open for one of two reasons: the reader opened it, or the tree opened it to show the
 * page being read. Only the first is remembered, per site and locale in `localStorage`, so browsing
 * does not pile up open folders for good. That is a convenience for this browser only: storage may be
 * unavailable (a private window, blocked site data), and the tree then simply starts closed.
 */

const STORAGE_PREFIX = 'kalon.tree.open'

/**
 * Where a level is. A level with no entry has not been asked for yet.
 *
 * - `loading`: fetched for the first time; nothing to show yet.
 * - `ready`: fetched, and current.
 * - `stale`: fetched before content changed somewhere; its items still show, and it is fetched again
 *   once it is on screen.
 * - `refreshing`: a stale level on its way again, still showing what it held.
 * - `failed`: the last fetch failed; offered again with "Try again".
 */
export const LEVEL_STATUS = Object.freeze({
  LOADING: 'loading',
  READY: 'ready',
  STALE: 'stale',
  REFRESHING: 'refreshing',
  FAILED: 'failed'
})

/** The statuses whose items are shown. */
const SHOWS_ITEMS = new Set([LEVEL_STATUS.READY, LEVEL_STATUS.STALE, LEVEL_STATUS.REFRESHING])

/** Why a folder is open: only what the reader chose is remembered. */
export const OPEN_REASON = Object.freeze({
  CHOSEN: 'chosen',
  REVEALED: 'revealed'
})

/** How a request for a level ended, for the caller to decide what, if anything, to tell the reader. */
export const LOAD_RESULT = Object.freeze({
  LOADED: 'loaded',
  /** The folder is not there (deleted, moved, or a path nobody has written yet); dropped quietly. */
  MISSING: 'missing',
  FAILED: 'failed',
  /** The levels were dropped while it was on its way, so what it read was thrown away. */
  SUPERSEDED: 'superseded'
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
  /** Open folders: path to `OPEN_REASON`. */
  open: {}
})

/** Level requests on their way, by path, so a second ask for a level waits on the first. */
const levelRequests = new Map()
/** Menu requests on their way, by menu id, so levels sharing a menu ask for it once. */
const menuRequests = new Map()
/**
 * The menus read since content last changed. `state.menus` keeps older ones so a stale level keeps its
 * order while it reloads; a menu not in here is read again.
 */
const freshMenus = new Set()

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
    return Array.isArray(paths)
      ? Object.fromEntries(paths.map((p) => [String(p), OPEN_REASON.CHOSEN]))
      : {}
  } catch {
    return {}
  }
}

function writeOpen() {
  try {
    const chosen = Object.keys(state.open).filter((p) => state.open[p] === OPEN_REASON.CHOSEN)
    window.localStorage.setItem(storageKey(state.scope), JSON.stringify(chosen))
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

/** Discards every request on its way, so what they read is not written back. */
function abandonRequests() {
  generation++
  levelRequests.clear()
  menuRequests.clear()
  freshMenus.clear()
}

/** Forgets every level and menu, for another site or locale. */
function startOver() {
  abandonRequests()
  state.levels = {}
  state.menus = {}
}

/**
 * Marks every level stale after content changed, keeping what each one shows until it is fetched
 * again. A level that was on its way or had failed is forgotten instead, so it is asked for afresh.
 */
function markStale() {
  abandonRequests()
  for (const [path, level] of Object.entries(state.levels)) {
    if (SHOWS_ITEMS.has(level.status)) {
      level.status = LEVEL_STATUS.STALE
    } else {
      delete state.levels[path]
    }
  }
}

/** Closes a folder and every folder under it. */
function forgetOpen(path) {
  for (const p of Object.keys(state.open)) {
    if (p === path || p.startsWith(`${path}/`)) {
      delete state.open[p]
    }
  }
}

function isNotFound(err) {
  return err?.response?.status === 404
}

export function usePageTree() {
  /** Points the tree at a site and locale, starting over when either changes. */
  function setScope(siteId, locale, localePrefix) {
    const scope = `${siteId}:${locale}`
    if (scope === state.scope) {
      return false
    }
    startOver()
    state.scope = scope
    state.localePrefix = localePrefix
    state.open = readOpen(scope)
    return true
  }

  /**
   * The id of the menu shown at a folder, reading that menu too unless it is held. Null when the
   * folder shows none or either request fails: the level then keeps the server's order, which is
   * still a usable tree, so a failure here is not worth a notice.
   */
  async function loadMenuAt(siteId, locale, path) {
    const gen = generation
    try {
      const at = await API_CLIENT.get(`sites/${siteId}/navigation/path`, {
        searchParams: { path, locale }
      }).json()
      const navId = at?.navigationId ?? null
      if (!navId || gen !== generation || freshMenus.has(navId)) {
        return navId
      }
      let request = menuRequests.get(navId)
      if (!request) {
        // -> Forgotten once settled: what it read is kept in `state.menus`, and a failure is retried.
        //    Only this request's own entry, which a start over may already have replaced.
        request = API_CLIENT.get(`sites/${siteId}/navigation/${navId}`).json()
        menuRequests.set(navId, request)
        request
          .finally(() => {
            if (menuRequests.get(navId) === request) {
              menuRequests.delete(navId)
            }
          })
          .catch(() => {})
      }
      const items = await request
      if (gen === generation) {
        state.menus[navId] = menuPathsOf(items, state.localePrefix)
        freshMenus.add(navId)
      }
      return navId
    } catch {
      return null
    }
  }

  /**
   * Fetches one level unless it is current, and waits on it if it is already on its way. Resolves to a
   * `LOAD_RESULT`.
   */
  function load(siteId, locale, path) {
    if (state.levels[path]?.status === LEVEL_STATUS.READY) {
      return Promise.resolve(LOAD_RESULT.LOADED)
    }
    if (!levelRequests.has(path)) {
      const request = fetchLevel(siteId, locale, path)
      levelRequests.set(path, request)
      request.finally(() => {
        if (levelRequests.get(path) === request) {
          levelRequests.delete(path)
        }
      })
    }
    return levelRequests.get(path)
  }

  async function fetchLevel(siteId, locale, path) {
    const gen = generation
    const held = state.levels[path]
    state.levels[path] =
      held?.status === LEVEL_STATUS.STALE
        ? { ...held, status: LEVEL_STATUS.REFRESHING }
        : { status: LEVEL_STATUS.LOADING, items: [], truncated: false, navId: null }
    // -> Both before the level is shown, so it never appears in one order and then jumps to another
    const menu = loadMenuAt(siteId, locale, path)
    try {
      const data = await API_CLIENT.get(`sites/${siteId}/tree/browse`, {
        searchParams: { path, locale }
      }).json()
      const navId = await menu
      if (gen !== generation) {
        return LOAD_RESULT.SUPERSEDED
      }
      state.levels[path] = {
        status: LEVEL_STATUS.READY,
        items: data.items ?? [],
        truncated: Boolean(data.truncated),
        navId
      }
      return LOAD_RESULT.LOADED
    } catch (err) {
      if (gen !== generation) {
        return LOAD_RESULT.SUPERSEDED
      }
      // -> A folder that is not there (deleted, moved) is closed with everything under it, and held as
      //    empty so nothing asks for it again until content changes
      if (isNotFound(err)) {
        state.levels[path] = {
          status: LEVEL_STATUS.READY,
          items: [],
          truncated: false,
          navId: null
        }
        forgetOpen(path)
        writeOpen()
        return LOAD_RESULT.MISSING
      }
      state.levels[path] = {
        status: LEVEL_STATUS.FAILED,
        items: [],
        truncated: false,
        navId: null
      }
      return LOAD_RESULT.FAILED
    }
  }

  /** The request for a level on its way, or null, for a caller waiting until it has arrived. */
  function pendingLevel(path) {
    return levelRequests.get(path) ?? null
  }

  /** Whether a level has items to show, current or not. */
  function showsItems(level) {
    return SHOWS_ITEMS.has(level?.status)
  }

  /** Whether a level is to be fetched: never asked for, or stale. */
  function needsLoad(path) {
    const status = state.levels[path]?.status
    return !status || status === LEVEL_STATUS.STALE
  }

  /** A level's items in the order they are shown. */
  function itemsOf(level) {
    return orderByMenu(level.items, level.navId ? state.menus[level.navId] : null)
  }

  /**
   * Takes in a menu the curated sidebar has just read. A level ordered by it then needs no request of
   * its own, and an edit in Edit Nav reorders the tree as it reorders the sidebar.
   */
  function takeMenu(navId, items) {
    if (navId) {
      state.menus[navId] = menuPathsOf(items, state.localePrefix)
      freshMenus.add(navId)
    }
  }

  /**
   * Opens or closes a folder. The tree revealing a folder never downgrades one the reader chose; the
   * reader closing a folder closes it whatever opened it.
   */
  function setOpen(path, isOpen, reason = OPEN_REASON.CHOSEN) {
    if (!isOpen) {
      delete state.open[path]
    } else if (reason === OPEN_REASON.CHOSEN || !state.open[path]) {
      state.open[path] = reason
    }
    writeOpen()
  }

  return {
    state,
    setScope,
    load,
    pendingLevel,
    showsItems,
    needsLoad,
    itemsOf,
    takeMenu,
    setOpen,
    markStale
  }
}
