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

const layout = reactive(read())

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
  save()
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
 */
export const SIDEBAR_MODE = Object.freeze({
  NONE: 'none',
  OVERLAY: 'overlay',
  RAIL: 'rail',
  OPEN: 'open',
  COLLAPSED: 'collapsed'
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
  return layout.collapsed ? SIDEBAR_MODE.COLLAPSED : SIDEBAR_MODE.OPEN
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
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
  return layout
}
