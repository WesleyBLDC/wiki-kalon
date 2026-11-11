<template>
  <!--
    While the sidebar is collapsed: the glyph that brings it back, in the top corner on the sidebar's
    side, and a strip along that edge of the window. Resting the pointer on either floats the sidebar
    over the page (a peek) without moving it; a click on the glyph brings it back for good.
  -->
  <div class="kalon-sidebar-edge" :class="{ 'is-right': isRight }">
    <div
      class="kalon-sidebar-edge-strip"
      aria-hidden="true"
      @mouseenter="requestSidebarPeek"
      @mouseleave="releaseSidebarPeek" />
    <sidebar-toggle-button
      class="kalon-sidebar-expand"
      @mouseenter="requestSidebarPeek"
      @mouseleave="releaseSidebarPeek" />
  </div>
</template>

<script setup>
import { releaseSidebarPeek, requestSidebarPeek } from '../composables/sidebarLayout'

import SidebarToggleButton from './SidebarToggleButton.vue'

defineProps({
  /** Whether the site puts its sidebar on the right. */
  isRight: {
    type: Boolean,
    default: false
  }
})
</script>

<style lang="scss">
.kalon-sidebar-edge-strip {
  position: fixed;
  inset-block: 0;
  left: 0;
  z-index: 19;
  width: 10px;

  .is-right > & {
    right: 0;
    left: auto;
  }
}

.kalon-sidebar-edge.is-right > .kalon-sidebar-expand {
  right: 8px;
  left: auto;
}

/*
  The floating sidebar: lifted off the page as a card inset from the window's edges, over the page
  rather than beside it. Out of the layout's grid, so the page keeps its width while it shows.
*/
:root .w-drawer.kalon-sidebar-peek {
  position: fixed;
  inset-block: 8px;
  left: 8px;
  z-index: 40;
  grid-area: unset;
  height: auto;
  overflow: hidden;
  border: 1px solid var(--kalon-border-strong);
  border-radius: var(--kalon-radius);
  box-shadow: var(--kalon-shadow-pop);

  &.w-drawer--right {
    right: 8px;
    left: auto;
  }
}
</style>
