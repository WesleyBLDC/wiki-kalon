<template>
  <w-btn
    class="kalon-sidebar-toggle"
    flat
    dense
    round
    size="sm"
    :aria-label="label"
    :aria-expanded="!layout.collapsed"
    @click="toggleSidebarCollapsed">
    <!-- -> Drawn here rather than taken from the icon bundle, which has no sidebar glyph -->
    <svg class="kalon-sidebar-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M9.5 4.5v15" />
    </svg>
    <w-tooltip>{{ label }} (Ctrl+\)</w-tooltip>
  </w-btn>
</template>

<script setup>
import { computed } from 'vue'

import { sidebarLayout, toggleSidebarCollapsed } from '../composables/sidebarLayout'
import { useKalonI18n } from '../i18n'

/**
 * The one button that collapses the sidebar and brings it back: the same glyph in the sidebar's header
 * and, while it is collapsed, in the top left corner of the page.
 */

const { t } = useKalonI18n()
const layout = sidebarLayout()

const label = computed(() =>
  layout.collapsed ? t('kalon.sidebar.expand') : t('kalon.sidebar.collapse')
)
</script>

<style lang="scss">
.kalon-sidebar-toggle {
  flex: none;
  color: var(--kalon-text-2);

  &:hover {
    background-color: var(--kalon-hover);
    color: var(--kalon-text);
  }
}

.kalon-sidebar-glyph {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}

/*
  While the sidebar is collapsed: pinned in the top corner on the sidebar's side, over the start of the
  page's top bar, which makes room for it (`_overrides.scss`).
*/
.kalon-sidebar-expand {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 20;

  &.is-right {
    right: 8px;
    left: auto;
  }
}
</style>
