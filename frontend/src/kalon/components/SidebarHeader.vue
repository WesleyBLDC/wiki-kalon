<template>
  <div class="kalon-sidebar-header">
    <div class="kalon-sidebar-brand">
      <router-link class="kalon-sidebar-site" :to="homePath" @click="leaveEditorForHome">
        <img class="kalon-sidebar-logo" :src="`/_site/current/logo`" alt="" />
        <span v-if="siteStore.logoText" class="kalon-sidebar-title">{{ siteStore.title }}</span>
      </router-link>
      <w-btn
        class="kalon-sidebar-collapse"
        flat
        dense
        round
        size="sm"
        :aria-label="t('kalon.sidebar.collapse')"
        @click="setSidebarCollapsed(true)">
        <!-- -> Drawn here rather than taken from the icon bundle, which has no sidebar glyph -->
        <svg class="kalon-sidebar-glyph" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
          <path d="M9.5 4.5v15" />
        </svg>
        <w-tooltip>{{ t('kalon.sidebar.collapse') }} (Ctrl+\)</w-tooltip>
      </w-btn>
    </div>
    <div class="kalon-sidebar-search">
      <header-search />
    </div>
  </div>
</template>

<script setup>
import { useSiteStore } from '@/stores/site'

import HeaderSearch from '@/components/HeaderSearch.vue'

import { setSidebarCollapsed } from '../composables/sidebarLayout'
import { useSiteHome } from '../composables/siteHome'
import { useKalonI18n } from '../i18n'

/**
 * The top of the sidebar on a wide screen, where the site header is folded away: the logo and site
 * title leading home, a button collapsing the sidebar, and upstream's search field (`HeaderSearch`,
 * Ctrl+K and all) under them.
 */

const siteStore = useSiteStore()
const { homePath, leaveEditorForHome } = useSiteHome()
const { t } = useKalonI18n()
</script>

<style lang="scss">
.kalon-sidebar-header {
  flex: none;
  padding: 8px 8px 4px;
}

.kalon-sidebar-brand {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 40px;
}

.kalon-sidebar-site {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 36px;
  padding: 0 8px;
  border-radius: var(--kalon-radius-sm);
  color: var(--kalon-text);
  text-decoration: none;

  &:hover {
    background-color: var(--kalon-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--kalon-accent);
    outline-offset: -2px;
  }
}

.kalon-sidebar-logo {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: var(--kalon-radius-xs);
  object-fit: contain;
}

.kalon-sidebar-collapse {
  flex: none;
  color: var(--kalon-text-2);

  &:hover {
    background-color: var(--kalon-hover);
  }
}

.kalon-sidebar-glyph {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}

.kalon-sidebar-title {
  overflow: hidden;
  font-size: 0.9375rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
  `HeaderSearch` sizes its toolbar inline for a 64px header, which only `!important` outranks; here it
  is a 36px field in a row of its own.
*/
.kalon-sidebar-search {
  .w-toolbar {
    height: 40px !important;
    min-height: 0;
    padding: 0;
  }

  .header-search-field {
    height: 32px;
    padding-inline: 10px 6px;
    font-size: 0.875rem;
  }

  .header-search-lead {
    font-size: 16px;
  }

  /*
    The results panel, which upstream hangs under the field at the field's width -- a strip as narrow
    as the sidebar here. It floats beside the sidebar instead, at a reading width, as a menu card.
  */
  .searchpanel {
    position: fixed;
    top: 8px;
    left: calc(var(--w-drawer-width, 255px) + 8px);
    right: auto;
    width: min(640px, calc(100vw - var(--w-drawer-width, 255px) - 24px));
    max-height: calc(100vh - 16px);
    overflow-y: auto;
    border-radius: var(--kalon-radius);

    .w-drawer--right & {
      left: auto;
      right: calc(var(--w-drawer-width, 255px) + 8px);
    }
  }
}
</style>
