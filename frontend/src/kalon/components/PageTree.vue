<template>
  <section v-if="isShown" class="kalon-tree" :aria-label="t('kalon.tree.pages')">
    <div class="kalon-tree-header">
      <span class="kalon-tree-title">{{ t('kalon.tree.pages') }}</span>
      <w-btn
        v-if="canAdd"
        class="kalon-tree-add kalon-tree-add--header"
        flat
        dense
        round
        size="sm"
        icon="la:plus"
        :aria-label="t('kalon.tree.newPage')">
        <w-tooltip>{{ t('kalon.tree.newPage') }}</w-tooltip>
        <page-new-menu base-path="" :locale="locale" hide-asset-btn />
      </w-btn>
    </div>

    <!--
      One flat list of the rows on screen, each with its depth, rather than nested groups: arrow keys
      move through what is visible, which a flat list makes a matter of an index. `aria-level`,
      `aria-setsize` and `aria-posinset` give assistive technology the same tree a nested one would.
    -->
    <div
      ref="treeEl"
      class="kalon-tree-rows"
      role="tree"
      :aria-label="t('kalon.tree.pages')"
      @keydown="onKeydown">
      <template v-for="row of rows" :key="row.key">
        <div
          v-if="row.kind === 'item'"
          class="kalon-tree-row"
          :class="{ 'is-current': row.isCurrent }"
          :style="{ '--kalon-tree-depth': row.depth }"
          role="treeitem"
          :aria-level="row.depth + 1"
          :aria-setsize="row.setSize"
          :aria-posinset="row.position"
          :aria-expanded="row.item.isFolder ? isOpen(row.item.path) : undefined"
          :aria-current="row.isCurrent ? 'page' : undefined"
          :tabindex="row.key === focusKey ? 0 : -1"
          :data-key="row.key"
          @focus="focusKey = row.key">
          <button
            v-if="row.item.isFolder"
            type="button"
            class="kalon-tree-chevron"
            :class="{ 'is-open': isOpen(row.item.path) }"
            tabindex="-1"
            :aria-label="
              t(isOpen(row.item.path) ? 'kalon.tree.collapse' : 'kalon.tree.expand', {
                title: row.item.title
              })
            "
            @click="toggle(row.item)">
            <w-icon name="la:angle-right" size="xs" />
          </button>
          <span v-else class="kalon-tree-chevron" aria-hidden="true" />

          <router-link
            v-if="row.item.isPage"
            class="kalon-tree-link"
            :to="pageHref(row.item.path)"
            tabindex="-1">
            <w-icon class="kalon-tree-icon" :name="row.item.icon || 'la:file-alt'" size="xs" />
            <span class="kalon-tree-label">{{ row.item.title }}</span>
          </router-link>
          <button
            v-else
            type="button"
            class="kalon-tree-link"
            tabindex="-1"
            @click="toggle(row.item)">
            <w-icon class="kalon-tree-icon" name="mdi:folder-outline" size="xs" />
            <span class="kalon-tree-label">{{ row.item.title }}</span>
          </button>

          <w-btn
            v-if="canAdd"
            class="kalon-tree-add"
            flat
            dense
            round
            size="sm"
            icon="la:plus"
            tabindex="-1"
            :aria-label="t('kalon.tree.newPageIn', { title: row.item.title })">
            <w-tooltip>{{ t('kalon.tree.newPageIn', { title: row.item.title }) }}</w-tooltip>
            <page-new-menu :base-path="row.item.path" :locale="locale" hide-asset-btn />
          </w-btn>
        </div>
        <div
          v-else
          class="kalon-tree-note"
          :style="{ '--kalon-tree-depth': row.depth }"
          role="treeitem"
          aria-disabled="true"
          :aria-level="row.depth + 1">
          {{ row.label }}
        </div>
      </template>
    </div>
    <w-btn
      v-if="canAdd"
      class="kalon-tree-new"
      flat
      no-caps
      icon="la:plus"
      :label="t('kalon.tree.newPage')">
      <page-new-menu base-path="" :locale="locale" hide-asset-btn />
    </w-btn>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { debounce } from 'es-toolkit/function'

import { notify } from '@/composables/notify'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import PageNewMenu from '@/components/PageNewMenu.vue'

import { ancestorsOf, usePageTree } from '../composables/pageTree'
import { useKalonI18n } from '../i18n'

/**
 * The site's pages as a tree under the curated menu, loaded a folder at a time from `tree/browse`.
 *
 * Opens to the page being read, remembers which folders were opened, and offers "+" to start a page
 * inside a folder. The server filters every level by what the reader may read, so this never shows a
 * folder the Browse menu would not.
 *
 * Keyboard use follows the WAI-ARIA tree pattern: one row is focusable at a time, Up and Down move,
 * Right opens a folder or steps into it, Left closes it or steps out to the parent, Home and End jump,
 * Enter opens the page.
 */

const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()
const router = useRouter()

const { t } = useKalonI18n()

const { state, setScope, load, setOpen, drop } = usePageTree()

const treeEl = ref(null)
const focusKey = ref('')

// COMPUTED

/** The "Allow Browsing" site setting, which `tree/browse` refuses to answer without. */
const isShown = computed(() => Boolean(siteStore.features.browse && siteStore.id))

const locale = computed(() => pageStore.locale || siteStore.locales.primary || 'en')

/**
 * Whether to offer "+". `write:pages` is a page rule, so there is no way to ask the server whether
 * the reader may write in each folder shown; `canWriteOnSite` says some rule grants it somewhere, and
 * the new page flow is refused server side where it does not apply.
 */
const canAdd = computed(() => userStore.authenticated && userStore.canWriteOnSite)

const rows = computed(() => {
  const out = []
  walk('', 0, out)
  return out
})

const itemRows = computed(() => rows.value.filter((r) => r.kind === 'item'))

// METHODS

function walk(path, depth, out) {
  const level = state.levels[path]
  if (!level || (level.loading && level.items.length < 1)) {
    out.push({ kind: 'note', key: `${path}:loading`, depth, label: t('common.loading') })
    return
  }
  if (level.failed) {
    out.push({ kind: 'note', key: `${path}:failed`, depth, label: t('common.browse.loadFailed') })
    return
  }
  level.items.forEach((item, i) => {
    out.push({
      kind: 'item',
      key: item.path,
      item,
      depth,
      position: i + 1,
      setSize: level.items.length,
      isCurrent: item.isPage && item.path === pageStore.path
    })
    if (item.isFolder && state.open[item.path]) {
      walk(item.path, depth + 1, out)
    }
  })
  if (level.items.length < 1) {
    out.push({ kind: 'note', key: `${path}:empty`, depth, label: t('common.browse.empty') })
  }
  if (level.truncated) {
    out.push({ kind: 'note', key: `${path}:more`, depth, label: t('common.browse.truncated') })
  }
}

/** A locale's home page is served at its root, as `NavSidebar` links it. */
function pageHref(path) {
  const prefix = siteStore.localeUrlPrefix(locale.value)
  return path === 'home' ? prefix || '/' : `${prefix}/${path}`
}

function isOpen(path) {
  return Boolean(state.open[path])
}

async function loadLevel(path) {
  const ok = await load(siteStore.id, locale.value, path)
  if (!ok) {
    notify({ type: 'negative', message: t('common.browse.loadFailed') })
  }
}

function toggle(item) {
  const next = !isOpen(item.path)
  setOpen(item.path, next)
  if (next) {
    loadLevel(item.path)
  }
}

/** Loads the root and every remembered open folder. */
function loadVisible() {
  loadLevel('')
  for (const path of Object.keys(state.open)) {
    loadLevel(path)
  }
}

/** Opens the folders above the page being read and brings its row into view. */
async function revealCurrent() {
  if (!pageStore.path) {
    return
  }
  const folders = ancestorsOf(pageStore.path)
  for (const path of folders) {
    if (!isOpen(path)) {
      setOpen(path, true)
    }
  }
  await Promise.all(['', ...folders].map((path) => loadLevel(path)))
  focusKey.value = pageStore.path
  await nextTick()
  treeEl.value?.querySelector('.kalon-tree-row.is-current')?.scrollIntoView({ block: 'nearest' })
}

function focusRow(key) {
  focusKey.value = key
  nextTick(() => {
    treeEl.value?.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus()
  })
}

function onKeydown(ev) {
  const list = itemRows.value
  const index = list.findIndex((r) => r.key === focusKey.value)
  const row = list[index]
  if (!row) {
    return
  }
  const rtl = getComputedStyle(treeEl.value).direction === 'rtl'
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
  const back = rtl ? 'ArrowRight' : 'ArrowLeft'
  switch (ev.key) {
    case 'ArrowDown':
      if (index < list.length - 1) {
        focusRow(list[index + 1].key)
      }
      break
    case 'ArrowUp':
      if (index > 0) {
        focusRow(list[index - 1].key)
      }
      break
    case 'Home':
      focusRow(list[0].key)
      break
    case 'End':
      focusRow(list[list.length - 1].key)
      break
    case forward:
      if (row.item.isFolder && !isOpen(row.item.path)) {
        toggle(row.item)
      } else if (row.item.isFolder && list[index + 1]?.depth > row.depth) {
        focusRow(list[index + 1].key)
      }
      break
    case back:
      if (row.item.isFolder && isOpen(row.item.path)) {
        toggle(row.item)
      } else if (row.depth > 0) {
        const parent = list.slice(0, index).findLast((r) => r.depth < row.depth)
        if (parent) {
          focusRow(parent.key)
        }
      }
      break
    case 'Enter':
      if (row.item.isPage) {
        router.push(pageHref(row.item.path))
      } else {
        toggle(row.item)
      }
      break
    default:
      return
  }
  ev.preventDefault()
}

// WATCHERS

watch(
  () => [siteStore.id, locale.value, isShown.value],
  () => {
    if (!isShown.value) {
      return
    }
    setScope(siteStore.id, locale.value)
    loadVisible()
    revealCurrent()
  },
  { immediate: true }
)

watch(
  () => pageStore.path,
  () => {
    if (isShown.value) {
      revealCurrent()
    }
  }
)

/*
  A page created, moved, renamed or deleted anywhere changes what the levels hold. Debounced as the
  curated menu's own refresh is (`NavSidebar`), since one save can fire several of these.
*/
const onContentChanged = debounce(() => {
  if (isShown.value) {
    drop()
    loadVisible()
  }
}, 300)

onMounted(() => {
  EVENT_BUS.on('contentChanged', onContentChanged)
})
onBeforeUnmount(() => {
  EVENT_BUS.off('contentChanged', onContentChanged)
  onContentChanged.cancel()
})
</script>

<style lang="scss">
.kalon-tree {
  margin-top: 12px;
  padding: 8px 0 16px;
  border-top: 1px solid var(--kalon-border);
}

.kalon-tree-header {
  display: flex;
  align-items: center;
  min-height: 32px;
  margin-inline: 8px;
  padding-inline: 8px 2px;
}

.kalon-tree-title {
  flex: 1;
  color: var(--kalon-text-3);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

// -> "+ New page" after the last row, as the board draws it; the same menu as the "+" by "Pages"
.kalon-tree-new {
  display: flex;
  justify-content: flex-start;
  width: calc(100% - 16px);
  min-height: 30px;
  margin: 4px 8px 0;
  padding-inline: 6px;
  border-radius: var(--kalon-radius-sm);
  color: var(--kalon-text-2);
  font-size: 0.875rem;
  font-weight: 400;

  .w-icon {
    font-size: 16px;
  }

  &:hover {
    background-color: var(--kalon-hover);
    color: var(--kalon-text);
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
}

.kalon-tree-row,
.kalon-tree-note {
  --kalon-tree-indent: calc(var(--kalon-tree-depth, 0) * 16px);
}

.kalon-tree-row {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 30px;
  margin-inline: 8px;
  padding-inline-start: calc(4px + var(--kalon-tree-indent));
  padding-inline-end: 2px;
  border-radius: var(--kalon-radius-sm);
  color: var(--kalon-text);
  outline: none;

  @media (hover: hover) {
    &:hover {
      background-color: var(--kalon-hover);
    }
  }

  &:focus-visible {
    box-shadow: inset 0 0 0 2px var(--kalon-accent);
  }

  &.is-current {
    background-color: var(--kalon-active);
    font-weight: 500;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
}

.kalon-tree-chevron {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: var(--kalon-radius-xs);
  background: none;
  color: var(--kalon-text-2);
  cursor: pointer;
  transition: transform 0.15s var(--ease-standard);

  &:is(button):hover {
    background-color: var(--kalon-hover);
  }

  &.is-open {
    transform: rotate(90deg);
  }

  [dir='rtl'] &:not(.is-open) {
    transform: scaleX(-1);
  }

  @media (pointer: coarse) {
    width: 32px;
    height: 32px;
  }
}

.kalon-tree-link {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: inherit;
  padding: 0 4px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  text-decoration: none;
  cursor: pointer;
}

.kalon-tree-icon {
  flex: none;
  color: var(--kalon-text-2);
}

.kalon-tree-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
  "+" shows on the row under the pointer or holding focus, and always where there is no hover, so a
  touch screen can reach it.
*/
.kalon-tree-add {
  flex: none;
  color: var(--kalon-text-2);
  opacity: 0;
  transition: opacity 0.1s var(--ease-standard);

  .kalon-tree-row:hover &,
  .kalon-tree-row:focus-within &,
  &--header {
    opacity: 1;
  }

  @media (hover: none) {
    opacity: 1;
  }
}

.kalon-tree-note {
  margin-inline: 8px;
  padding-block: 4px;
  padding-inline: calc(32px + var(--kalon-tree-indent)) 8px;
  color: var(--kalon-text-3);
  font-size: 0.8125rem;
}
</style>
