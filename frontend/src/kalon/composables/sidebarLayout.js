import { onBeforeUnmount, onMounted, reactive } from 'vue'

/**
 * The sidebar's width and whether it is collapsed, on a wide screen.
 *
 * Client-side state only, remembered for this browser in `localStorage` like the page tree's open
 * folders. Storage may be unavailable (a private window, blocked site data), and the sidebar then
 * starts at its default every visit.
 */

export const SIDEBAR_MIN = 208
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

/**
 * The layout state, plus Ctrl+\ (Cmd+\ on a Mac) to collapse and expand while the calling component
 * is mounted. The key is left alone while typing, and while `isBlocked()` says so (an overlay open).
 */
export function useSidebarLayout({ isBlocked = () => false } = {}) {
  function onKeydown(ev) {
    if (ev.key !== '\\' || !(ev.ctrlKey || ev.metaKey) || ev.altKey || ev.shiftKey) {
      return
    }
    if (isTyping(ev.target) || isBlocked()) {
      return
    }
    ev.preventDefault()
    toggleSidebarCollapsed()
  }
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
  return layout
}
