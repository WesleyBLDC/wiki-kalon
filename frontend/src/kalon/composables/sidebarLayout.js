import { computed, nextTick, onBeforeUnmount, onMounted, reactive } from 'vue'

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
 * Where the peek is: the collapsed sidebar floated over the page for a moment, from a hover on the
 * window's edge or the expand glyph. Never saved.
 *
 * - `off`: not floating.
 * - `opening`: the pointer rests on the edge or the glyph; it floats in after `PEEK_OPEN_DELAY`.
 * - `shown`: floating, with the pointer on it.
 * - `held`: floating with the pointer away, kept by something inside it: typing in its search, or one
 *   of its menus (which open outside the panel). Letting go of that starts `closing`; Escape or a press
 *   outside ends it at once.
 * - `closing`: the pointer left; it goes after `PEEK_CLOSE_DELAY` unless the pointer comes back.
 */
export const PEEK = Object.freeze({
  OFF: 'off',
  OPENING: 'opening',
  SHOWN: 'shown',
  HELD: 'held',
  CLOSING: 'closing'
})

/** What can happen to a peek. `DISMISS` is Escape, a press outside, a page opened or a collapse change. */
const PEEK_EVENT = Object.freeze({
  POINTER_IN: 'pointerIn',
  POINTER_OUT: 'pointerOut',
  TIMER: 'timer',
  LET_GO: 'letGo',
  DISMISS: 'dismiss'
})

const layout = reactive({ ...read(), peek: PEEK.OFF })

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

/** `save: false` while a drag is under way, which saves once when it ends rather than on every move. */
export function setSidebarWidth(width, { save: shouldSave = true } = {}) {
  layout.width = clamp(width)
  if (shouldSave) {
    save()
  }
}

export function setSidebarCollapsed(collapsed) {
  layout.collapsed = Boolean(collapsed)
  endSidebarPeek()
  save()
}

/** How long a hover has to rest before the sidebar peeks, and how long it lingers once left (ms). */
const PEEK_OPEN_DELAY = 120
const PEEK_CLOSE_DELAY = 300

/** The one pending timer, for `opening` or `closing`; every transition clears it. */
let peekTimer = 0

/** Where a peek goes from `peek` on `event`; the same state when the event means nothing there. */
function nextPeek(peek, event) {
  if (event === PEEK_EVENT.DISMISS) {
    return PEEK.OFF
  }
  switch (peek) {
    case PEEK.OFF:
      return event === PEEK_EVENT.POINTER_IN && layout.collapsed ? PEEK.OPENING : peek
    case PEEK.OPENING:
      if (event === PEEK_EVENT.TIMER) {
        return PEEK.SHOWN
      }
      return event === PEEK_EVENT.POINTER_OUT ? PEEK.OFF : peek
    case PEEK.SHOWN:
      if (event !== PEEK_EVENT.POINTER_OUT) {
        return peek
      }
      return isPeekHeld() ? PEEK.HELD : PEEK.CLOSING
    case PEEK.HELD:
      if (event === PEEK_EVENT.POINTER_IN) {
        return PEEK.SHOWN
      }
      return event === PEEK_EVENT.LET_GO && !isPeekHeld() ? PEEK.CLOSING : peek
    case PEEK.CLOSING:
      if (event === PEEK_EVENT.POINTER_IN) {
        return PEEK.SHOWN
      }
      return event === PEEK_EVENT.TIMER ? PEEK.OFF : peek
    default:
      return PEEK.OFF
  }
}

function peekTransition(event) {
  const next = nextPeek(layout.peek, event)
  if (next === layout.peek) {
    return
  }
  window.clearTimeout(peekTimer)
  layout.peek = next
  if (next === PEEK.OPENING || next === PEEK.CLOSING) {
    const delay = next === PEEK.OPENING ? PEEK_OPEN_DELAY : PEEK_CLOSE_DELAY
    peekTimer = window.setTimeout(() => peekTransition(PEEK_EVENT.TIMER), delay)
  }
}

/** The pointer reached the edge, the glyph or the floating sidebar. */
export function requestSidebarPeek() {
  peekTransition(PEEK_EVENT.POINTER_IN)
}

/** The pointer left the floating sidebar or what calls it up. */
export function releaseSidebarPeek() {
  peekTransition(PEEK_EVENT.POINTER_OUT)
}

export function endSidebarPeek() {
  peekTransition(PEEK_EVENT.DISMISS)
}

/** Whether the sidebar is floating over the page, for the layout to draw it so. */
function isFloating() {
  return layout.peek === PEEK.SHOWN || layout.peek === PEEK.HELD || layout.peek === PEEK.CLOSING
}

// -> The drawer carries this class whenever the sidebar is collapsed, peeking or not, so it never
//    changes shape as it slides away
function peekPanel() {
  return document.querySelector('.kalon-sidebar-floating')
}

// -> Typing in the panel (its search) or one of its menus open; a link or button merely focused by a click
//    does not hold it, which would leave it over the page after a page was picked
function isPeekHeld() {
  const focused = document.activeElement
  return Boolean(
    (peekPanel()?.contains(focused) && focused?.matches?.('input, textarea')) ||
    document.querySelector('.w-menu')
  )
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
  return isFloating() ? SIDEBAR_MODE.PEEK : SIDEBAR_MODE.COLLAPSED
}

/**
 * Everything the layout reads off the sidebar's shape, derived in one place from `sidebarModeFor`:
 * `inputs` returns `{ isAvailable, isWide, isRail }`. A reactive object, so its fields read as values.
 */
export function useSidebarShape(inputs) {
  const mode = computed(() => sidebarModeFor(inputs()))
  const isOneOf = (...modes) => computed(() => modes.includes(mode.value))
  return reactive({
    mode,
    /** Drawn as a column or floating; the narrow overlay's openness is upstream's own state. */
    isDrawn: isOneOf(SIDEBAR_MODE.RAIL, SIDEBAR_MODE.OPEN, SIDEBAR_MODE.PEEK),
    /** The full sidebar on a wide screen, in any state: no site header then, and the dragged width. */
    isFullWide: isOneOf(SIDEBAR_MODE.OPEN, SIDEBAR_MODE.COLLAPSED, SIDEBAR_MODE.PEEK),
    /** The site header's contents are in the sidebar. */
    holdsHeader: isOneOf(SIDEBAR_MODE.OPEN, SIDEBAR_MODE.PEEK),
    /**
     * Put away by the reader, peeking or not: the glyph in the corner, and the floating style. Not the
     * same as `layout.collapsed`, the saved choice, which also holds on a narrow screen or the rail.
     */
    isPutAway: isOneOf(SIDEBAR_MODE.COLLAPSED, SIDEBAR_MODE.PEEK),
    isPeeking: isOneOf(SIDEBAR_MODE.PEEK),
    canResize: isOneOf(SIDEBAR_MODE.OPEN)
  })
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
 * Ctrl+K is left alone while typing. Both are left alone while `isBlocked()` says so (an overlay open), and while
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
    // -> Ctrl+K belongs to what is being typed in; Ctrl+\ types nothing, so it works from an editor too
    if ((isSearch && isTyping(ev.target)) || isBlocked() || !isCollapsible()) {
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
    if (ev.key === 'Escape' && isFloating() && !document.querySelector('.w-menu')) {
      endSidebarPeek()
    }
  }
  function onPointerdown(ev) {
    if (isFloating() && !ev.target?.closest?.('.kalon-sidebar-floating, .w-menu')) {
      endSidebarPeek()
    }
  }
  // -> Focus leaving the search, or a menu closing (its item loses focus), may let go of a held peek.
  //    After the event, once the focus has landed and the menu is gone
  function onFocusout() {
    if (layout.peek === PEEK.HELD) {
      window.setTimeout(() => peekTransition(PEEK_EVENT.LET_GO))
    }
  }
  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('keydown', onPeekKeydown)
    window.addEventListener('pointerdown', onPointerdown, true)
    window.addEventListener('focusout', onFocusout)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('keydown', onPeekKeydown)
    window.removeEventListener('pointerdown', onPointerdown, true)
    window.removeEventListener('focusout', onFocusout)
    endSidebarPeek()
  })
  return layout
}
