import { reactive } from 'vue'

/**
 * State for the sidebar's page tree: the folder levels fetched so far and which folders are open.
 *
 * One level per `GET sites/:siteId/tree/browse` call, exactly as the Browse menu (`NavBrowseMenu.vue`)
 * walks the tree, so the server decides what a reader may see and nothing here filters. Held at module
 * level, so the tree keeps its levels when the layout around it is rebuilt.
 *
 * Which folders are open is remembered per site and locale in `localStorage`. That is a convenience
 * for this browser only: storage may be unavailable (a private window, blocked site data), and the
 * tree then simply starts closed.
 */

const STORAGE_PREFIX = 'kalon.tree.open'

const state = reactive({
  /** `<siteId>:<locale>`, what the levels below belong to. */
  scope: '',
  /** Levels by folder path ('' is the site root): `{ items, truncated, loading, failed }`. */
  levels: {},
  /** Open folders, by path. */
  open: {}
})

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

/** The folders above a path, outermost first: `a/b/c` gives `a` and `a/b`. */
export function ancestorsOf(path) {
  const parts = path.split('/').filter(Boolean)
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'))
}

export function usePageTree() {
  /** Points the tree at a site and locale, starting over when either changes. */
  function setScope(siteId, locale) {
    const scope = `${siteId}:${locale}`
    if (scope === state.scope) {
      return false
    }
    generation++
    state.scope = scope
    state.levels = {}
    state.open = readOpen(scope)
    return true
  }

  /**
   * Fetches one level unless it is already held or on its way. Resolves to false when the request
   * failed, so the caller can tell the reader.
   */
  async function load(siteId, locale, path) {
    const held = state.levels[path]
    if (held && (held.loading || !held.failed)) {
      return true
    }
    const gen = generation
    state.levels[path] = {
      items: held?.items ?? [],
      truncated: false,
      loading: true,
      failed: false
    }
    try {
      const data = await API_CLIENT.get(`sites/${siteId}/tree/browse`, {
        searchParams: { path, locale }
      }).json()
      if (gen === generation) {
        state.levels[path] = {
          items: data.items ?? [],
          truncated: Boolean(data.truncated),
          loading: false,
          failed: false
        }
      }
      return true
    } catch {
      if (gen === generation) {
        state.levels[path] = { items: [], truncated: false, loading: false, failed: true }
      }
      return false
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

  /** Drops every level, for a reload after content changed. Open folders stay open. */
  function drop() {
    generation++
    state.levels = {}
  }

  return { state, setScope, load, setOpen, drop }
}
