<template>
  <!--
    A focusable separator, the WAI-ARIA window splitter: drag it, or focus it and use the arrow keys
    (Home and End for the narrowest and widest); double-click or Enter collapses the sidebar.
  -->
  <div
    class="kalon-resize-handle"
    :class="{ 'is-dragging': isDragging }"
    role="separator"
    tabindex="0"
    aria-orientation="vertical"
    :aria-label="t('kalon.sidebar.resize')"
    :aria-valuemin="SIDEBAR_MIN"
    :aria-valuemax="SIDEBAR_MAX"
    :aria-valuenow="layout.width"
    @pointerdown="onPointerDown"
    @dblclick="setSidebarCollapsed(true)"
    @keydown="onKeydown" />
</template>

<script setup>
import { ref } from 'vue'

import {
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  SIDEBAR_STEP,
  setSidebarCollapsed,
  setSidebarWidth,
  sidebarLayout
} from '../composables/sidebarLayout'
import { useKalonI18n } from '../i18n'

const props = defineProps({
  /** Which edge of the window the sidebar is on, which decides which way a drag widens it. */
  side: {
    type: String,
    default: 'left'
  }
})

const { t } = useKalonI18n()
const layout = sidebarLayout()

const isDragging = ref(false)
let startX = 0
let startWidth = 0

function onPointerDown(ev) {
  if (ev.button !== 0) {
    return
  }
  ev.preventDefault()
  ev.currentTarget.setPointerCapture(ev.pointerId)
  startX = ev.clientX
  startWidth = layout.width
  isDragging.value = true
  ev.currentTarget.addEventListener('pointermove', onPointerMove)
  ev.currentTarget.addEventListener('pointerup', onPointerUp, { once: true })
  ev.currentTarget.addEventListener('pointercancel', onPointerUp, { once: true })
}

function onPointerMove(ev) {
  const delta = props.side === 'right' ? startX - ev.clientX : ev.clientX - startX
  setSidebarWidth(startWidth + delta)
}

function onPointerUp(ev) {
  isDragging.value = false
  ev.currentTarget.removeEventListener('pointermove', onPointerMove)
}

function onKeydown(ev) {
  const wider = props.side === 'right' ? 'ArrowLeft' : 'ArrowRight'
  const narrower = props.side === 'right' ? 'ArrowRight' : 'ArrowLeft'
  switch (ev.key) {
    case wider:
      setSidebarWidth(layout.width + SIDEBAR_STEP)
      break
    case narrower:
      setSidebarWidth(layout.width - SIDEBAR_STEP)
      break
    case 'Home':
      setSidebarWidth(SIDEBAR_MIN)
      break
    case 'End':
      setSidebarWidth(SIDEBAR_MAX)
      break
    case 'Enter':
      setSidebarCollapsed(true)
      break
    default:
      return
  }
  ev.preventDefault()
}
</script>

<style lang="scss">
/*
  On the sidebar's inner edge: 8px to aim at, a 2px accent line while hovered, focused or dragged.
  The drawer is positioned for it (`_overrides.scss`).
*/
.kalon-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  right: -4px;
  z-index: 5;
  width: 8px;
  cursor: col-resize;
  touch-action: none;
  outline: none;

  .w-drawer--right & {
    right: auto;
    left: -4px;
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 3px;
    width: 2px;
    background-color: transparent;
    transition: background-color 0.15s var(--ease-standard);
  }

  &:hover::after,
  &:focus-visible::after,
  &.is-dragging::after {
    background-color: var(--kalon-accent);
  }
}
</style>
