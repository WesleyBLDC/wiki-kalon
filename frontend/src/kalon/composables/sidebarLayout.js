import { nextTick, onBeforeUnmount, onMounted, reactive } from 'vue'

/**
 * The sidebar's width and whether it is collapsed, on a wide screen.
 *
 * Client-side state only, remembered for this browser in `localStorage` like the page tree's open
 * folders. Storage may be unavailable (a private window, blocked site data), and the sidebar then
 * starts at its default every visit.
 */

export const SIDEBAR_MIN = 176
export const SIDEBAR_MAX = 360
export const SIDEBAR_DEFAULT = 264
export const SIDEBAR_STEP = 16

const STORAGE_KEY = 'kalon.sidebar'

function clamp(width) {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(width)))
}

function read() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    return {
      width: Number.isFinite(saved?.width) ? clamp(saved.width) : SIDEBAR_DEFAULT,
      collapsed: saved?.collapsed === true
    }
  } catch {
    return { width: SIDEBAR_DEFAULT, collapsed: false }
  }
}

/**
 * `peeking` is the collapsed sidebar floated over the page for a moment, from a hover on the left edge
 * or the expand glyph; it is never saved, and collapsing or expanding ends it.
 */
const layout = reactive({ ...read(), peeking: false })

function save() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ width: layout.width, collapsed: layout.collapsed })
    )
  } catch {
    // -> Storage unavailable: the layout lasts for this visit only
  }
}

export function setSidebarWidth(width) {
  layout.width = clamp(width)
  save()
}

export function setSidebarCollapsed(collapsed) {
  layout.collapsed = Boolean(collapsed)
  endSidebarPeek()
  save()
}

/** How long a hover has to rest before the sidebar peeks, and how long it lingers once left (ms). */
const PEEK_OPEN_DELAY = 120
const PEEK_CLOSE_DELAY = 300

/** The one pending peek change, so a later hover or leave replaces an earlier one. */
let peekTimer = 0

function schedulePeek(peeking, delay) {
  window.clearTimeout(peekTimer)
  peekTimer = window.setTimeout(() => {
    layout.peeking = peeking && layout.collapsed
  }, delay)
}

/** The pointer reached the edge or the glyph of a collapsed sidebar: float it in after a beat. */
export function requestSidebarPeek() {
  if (layout.collapsed && !layout.peeking) {
    schedulePeek(true, PEEK_OPEN_DELAY)
  } else {
    window.clearTimeout(peekTimer)
  }
}

/**
 * The pointer left the floating sidebar or what calls it up. It stays while something inside it holds
 * the reader: the focus (typing a search) or one of its menus, which open outside the panel. Those
 * end it with a click elsewhere or Escape instead (`useSidebarLayout`).
 */
export function releaseSidebarPeek() {
  if (!layout.peeking) {
    window.clearTimeout(peekTimer)
    return
  }
  if (isPeekHeld()) {
    return
  }
  schedulePeek(false, PEEK_CLOSE_DELAY)
}

export function endSidebarPeek() {
  window.clearTimeout(peekTimer)
  layout.peeking = false
}

function peekPanel() {
  return document.querySelector('.kalon-sidebar-peek')
}

function isPeekHeld() {
  return Boolean(peekPanel()?.contains(document.activeElement) || document.querySelector('.w-menu'))
}

export function toggleSidebarCollapsed() {
  setSidebarCollapsed(!layout.collapsed)
}

/**
 * The shapes the sidebar can be in, so the layout asks one question ("which shape?") instead of
 * combining the same four conditions wherever it needs an answer.
 *
 * - `none`: the site, the page or the editor has no sidebar.
 * - `overlay`: a narrow screen, where the drawer slides over the page when opened. Whether it is open
 *   right now is upstream's own state (`isNarrowSidebarOpen` in `MainLayout.vue`).
 * - `rail`: a wide screen on a page whose navigation is hidden, which upstream draws as the icon rail.
 * - `open`: a wide screen with the full sidebar, the site header folded into it.
 * - `collapsed`: a wide screen with the full sidebar put away by the reader.
 * - `peek`: collapsed, and floated over the page for a moment without moving it.
 */
export const SIDEBAR_MODE = Object.freeze({
  NONE: 'none',
  OVERLAY: 'overlay',
  RAIL: 'rail',
  OPEN: 'open',
  COLLAPSED: 'collapsed',
  PEEK: 'peek'
})

/** Which shape the sidebar is in, from what the layout knows and the reader's collapsed choice. */
export function sidebarModeFor({ isAvailable, isWide, isRail }) {
  if (!isAvailable) {
    return SIDEBAR_MODE.NONE
  }
  if (!isWide) {
    return SIDEBAR_MODE.OVERLAY
  }
  if (isRail) {
    return SIDEBAR_MODE.RAIL
  }
  if (!layout.collapsed) {
    return SIDEBAR_MODE.OPEN
  }
  return layout.peeking ? SIDEBAR_MODE.PEEK : SIDEBAR_MODE.COLLAPSED
}

/** The layout state alone, for components that read or change it without owning the shortcut. */
export function sidebarLayout() {
  return layout
}

/** Whether a keypress belongs to whatever is being typed in rather than to the page around it. */
function isTyping(target) {
  return Boolean(
    target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable]')
  )
}

/** Focus the search field at the top of the sidebar once it has been drawn. */
async function focusSidebarSearch() {
  await nextTick()
  window.requestAnimationFrame(() => {
    document.querySelector('.kalon-sidebar-search input')?.focus()
  })
}

/**
 * The layout state, plus two keys while the calling component is mounted:
 *
 * - Ctrl+\ (Cmd+\ on a Mac) collapses and expands the sidebar.
 * - Ctrl+K, while the sidebar is collapsed, opens it with its search field focused. Upstream's
 *   `HeaderSearch` owns Ctrl+K, but it lives in the sidebar and is not mounted while it is collapsed.
 *
 * Both are left alone while typing, while `isBlocked()` says so (an overlay open), and while
 * `isCollapsible()` says the sidebar cannot be collapsed at all (a narrow screen, the icon rail).
 */
export function useSidebarLayout({
  isBlocked = () => false,
  isCollapsible = () => true,
  canSearch = () => true
} = {}) {
  function onKeydown(ev) {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey || ev.shiftKey) {
      return
    }
    const isToggle = ev.key === '\\'
    const isSearch = ev.key === 'k' && ev.ctrlKey && layout.collapsed && canSearch()
    if (!isToggle && !isSearch) {
      return
    }
    if (isTyping(ev.target) || isBlocked() || !isCollapsible()) {
      return
    }
    ev.preventDefault()
    if (isSearch) {
      setSidebarCollapsed(false)
      focusSidebarSearch()
    } else {
      toggleSidebarCollapsed()
    }
  }
  // -> A peek held open by its focus or a menu ends with Escape or a press outside the panel and its menus
  function onPeekKeydown(ev) {
    if (ev.key === 'Escape' && layout.peeking && !document.querySelector('.w-menu')) {
      endSidebarPeek()
    }
  }
  function onPointerdown(ev) {
    if (layout.peeking && !ev.target?.closest?.('.kalon-sidebar-peek, .w-menu')) {
      endSidebarPeek()
    }
  }
  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('keydown', onPeekKeydown)
    window.addEventListener('pointerdown', onPointerdown, true)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('keydown', onPeekKeydown)
    window.removeEventListener('pointerdown', onPointerdown, true)
    endSidebarPeek()
  })
  return layout
}
